#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import datetime as dt
import hashlib, json, os, re, subprocess

root = Path(__file__).resolve().parents[1]
exe = root / 'dist' / 'Aftergraph-War-Room.exe'
version_match = re.search(r'var version = "([^"]+)"', (root/'app.go').read_text())
if not version_match:
    raise SystemExit('version not found')
version = os.environ.get('VERSION', version_match.group(1))

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def cmd(*args: str) -> str:
    try:
        return subprocess.check_output(args, cwd=root, text=True, stderr=subprocess.STDOUT).strip()
    except Exception:
        return ''

coverage = None
cov = root/'COVERAGE.txt'
if cov.exists():
    m = re.findall(r'total:.*?([0-9]+(?:\.[0-9]+)?)%', cov.read_text())
    if m: coverage = float(m[-1])

files=[]
for p in sorted(root.rglob('*')):
    if not p.is_file():
        continue
    rel=p.relative_to(root).as_posix()
    if rel in {'BUILD-MANIFEST.json','SHA256SUMS.txt'} or rel.startswith('dist/') or '/.git/' in '/'+rel:
        continue
    if rel.endswith(('.zip','.exe')) or rel in {'test.log','race.log','vet.log','staticcheck.log','govulncheck-v1610.log'}:
        continue
    files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})

status = cmd('git','status','--porcelain')
commit = os.environ.get('SOURCE_COMMIT','').strip() or (cmd('git','rev-parse','HEAD') if status == '' else '')
official_release = os.environ.get('OFFICIAL_RELEASE') == '1'
complete = os.environ.get('RELEASE_GATES_COMPLETE') == '1'
manifest={
  'schema':'aftergraph.war-room.desktop.build-manifest/2.0',
  'name':'Aftergraph War Room Desktop',
  'version':version,
  'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
  'releaseType':'stabilization-officialization',
  'releaseStatus':'release' if official_release else 'candidate',
  'sourceCommit':commit or None,
  'coverageStatementPercent':coverage,
  'toolchain':{
    'go':cmd('go','env','GOVERSION'),
    'staticcheck':cmd('staticcheck','-version'),
    'govulncheck':cmd('govulncheck','-version').splitlines()[0] if cmd('govulncheck','-version') else ''
  },
  'verification':{
    'metadata':True,
    'unit':complete,'race':complete,'vet':complete,'staticcheck':complete,
    'frontendSyntax':complete,'windowsCrossBuild':complete,'windowsGuiBuild':complete,
    'govulncheckBinary':complete,'secretScan':complete
  },
  'executable': None if not exe.exists() else {'path':'dist/Aftergraph-War-Room.exe','sha256':sha(exe),'bytes':exe.stat().st_size},
  'files':files
}
(root/'BUILD-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
lines=[]
if exe.exists(): lines.append(f"{sha(exe)}  dist/Aftergraph-War-Room.exe")
for item in files:
    lines.append(f"{item['sha256']}  {item['path']}")
(root/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n')
print(f"generated manifest/checksums for {version}: {len(files)} source files")
