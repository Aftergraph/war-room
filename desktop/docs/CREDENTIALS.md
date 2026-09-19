# Credential model

No account secret is embedded in this package.

## GitHub

The application supports a fine-grained GitHub Personal Access Token for live private organization visibility. On Windows:

1. The token is validated using `GET /user`.
2. Plaintext is never returned to the web UI after submission.
3. The value is encrypted using Windows DPAPI (`CryptProtectData`) in current-user scope.
4. The encrypted blob is stored under `%LOCALAPPDATA%\\Aftergraph\\WarRoom\\vault.json`.
5. Disconnect deletes the stored ciphertext.

A read-only token is sufficient. Recommended repository permissions: Metadata, Contents, Actions, Issues and Pull requests = Read.

## Why the ZIP has no pre-wired GitHub credential

The ChatGPT-side GitHub connector credential is not exportable into an executable and should not be copied into a distributable artifact. The build therefore contains a **sanitized authenticated inventory snapshot** only; live private access is established locally by the Windows user.

This boundary is deliberate: the War Room receives a scoped capability, while the credential remains outside the UI and outside source control.
