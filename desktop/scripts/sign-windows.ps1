param(
    [Parameter(Mandatory = $true)]
    [string[]] $Path,

    [switch] $ValidateOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Env([string] $Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Name is required for an official Authenticode signing run"
    }
    return $value.Trim()
}

function Normalize-Thumbprint([string] $Value) {
    return ($Value -replace '[^0-9A-Fa-f]', '').ToUpperInvariant()
}

function Find-SignTool {
    $programFilesX86 = (Get-Item "Env:ProgramFiles(x86)" -ErrorAction SilentlyContinue).Value
    $roots = @($programFilesX86, $env:ProgramFiles) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { Join-Path $_ "Windows Kits\10\bin" } |
        Where-Object { Test-Path $_ }

    $tools = foreach ($root in $roots) {
        Get-ChildItem -Path $root -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' }
    }
    $tool = $tools | Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $tool) {
        throw "signtool.exe (x64) was not found in the Windows SDK"
    }
    return $tool.FullName
}

if ($ValidateOnly) {
    [void][scriptblock]::Create((Get-Content -LiteralPath $PSCommandPath -Raw))
    Write-Host "Authenticode signing script syntax OK"
    exit 0
}

$pfxBase64 = Require-Env "WAR_ROOM_AUTHENTICODE_PFX_B64"
$pfxPassword = Require-Env "WAR_ROOM_AUTHENTICODE_PFX_PASSWORD"
$expectedThumbprint = Normalize-Thumbprint (Require-Env "WAR_ROOM_AUTHENTICODE_CERT_SHA1")
$timestampUrl = Require-Env "WAR_ROOM_AUTHENTICODE_TIMESTAMP_URL"

if ($expectedThumbprint.Length -ne 40) {
    throw "WAR_ROOM_AUTHENTICODE_CERT_SHA1 must be a SHA-1 certificate thumbprint"
}
$timestampUri = $null
if (-not [Uri]::TryCreate($timestampUrl, [UriKind]::Absolute, [ref] $timestampUri) -or
    $timestampUri.Scheme -ne "https") {
    throw "WAR_ROOM_AUTHENTICODE_TIMESTAMP_URL must be an absolute HTTPS URL"
}

$resolved = @()
foreach ($item in $Path) {
    $file = Resolve-Path -LiteralPath $item -ErrorAction Stop
    if ((Get-Item -LiteralPath $file).PSIsContainer) {
        throw "Authenticode input must be a file: $item"
    }
    $resolved += $file.Path
}

$pfxPath = Join-Path $env:RUNNER_TEMP ("war-room-signing-" + [Guid]::NewGuid().ToString("N") + ".pfx")
$imported = @()
try {
    try {
        [byte[]] $pfxBytes = [Convert]::FromBase64String($pfxBase64)
    } catch {
        throw "WAR_ROOM_AUTHENTICODE_PFX_B64 is not valid base64"
    }
    if ($pfxBytes.Length -lt 128) {
        throw "decoded Authenticode PFX payload is unexpectedly small"
    }
    [IO.File]::WriteAllBytes($pfxPath, $pfxBytes)

    $securePassword = ConvertTo-SecureString -String $pfxPassword -AsPlainText -Force
    $imported = @(Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation "Cert:\CurrentUser\My" -Password $securePassword -Exportable:$false)
    $leaf = $imported | Where-Object { $_.HasPrivateKey } | Select-Object -First 1
    if (-not $leaf) {
        throw "PFX did not import a certificate with a private key"
    }
    $actualThumbprint = Normalize-Thumbprint $leaf.Thumbprint
    if ($actualThumbprint -ne $expectedThumbprint) {
        throw "imported signing certificate thumbprint does not match WAR_ROOM_AUTHENTICODE_CERT_SHA1"
    }
    if ($leaf.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow) {
        throw "Authenticode signing certificate is expired"
    }
    if ($leaf.NotBefore.ToUniversalTime() -gt [DateTime]::UtcNow) {
        throw "Authenticode signing certificate is not valid yet"
    }

    $signTool = Find-SignTool
    foreach ($file in $resolved) {
        & $signTool sign /sha1 $expectedThumbprint /s My /fd SHA256 /tr $timestampUrl /td SHA256 $file
        if ($LASTEXITCODE -ne 0) {
            throw "signtool sign failed for $file"
        }

        & $signTool verify /pa /all /v $file
        if ($LASTEXITCODE -ne 0) {
            throw "signtool verify failed for $file"
        }

        $signature = Get-AuthenticodeSignature -LiteralPath $file
        if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
            throw "PowerShell Authenticode verification failed for $file with status $($signature.Status)"
        }
        $signedThumbprint = Normalize-Thumbprint $signature.SignerCertificate.Thumbprint
        if ($signedThumbprint -ne $expectedThumbprint) {
            throw "signed file certificate thumbprint mismatch for $file"
        }

        Write-Host ("AUTHENTICODE_OK path={0} sha256={1} thumbprint={2}" -f
            $file,
            (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant(),
            $signedThumbprint)
    }
} finally {
    foreach ($cert in $imported) {
        if ($cert.PSPath -and (Test-Path -LiteralPath $cert.PSPath)) {
            Remove-Item -LiteralPath $cert.PSPath -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $pfxPath) {
        Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue
    }
    Remove-Variable pfxBase64, pfxPassword, securePassword, pfxBytes -ErrorAction SilentlyContinue
}
