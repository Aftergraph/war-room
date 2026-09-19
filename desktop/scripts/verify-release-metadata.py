#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
root = Path(__file__).resolve().parents[1]
app = (root / 'app.go').read_text()
m = re.search(r'var version = "([^"]+)"', app)
if not m:
    raise SystemExit('version not found in app.go')
version = m.group(1)
required = [
    root/'CHANGELOG.md',
    root/'VERIFICATION.md',
    root/'BUILD-MANIFEST.json',
    root/'SHA256SUMS.txt',
    root/'docs'/'WEAKNESSES-AND-RISK-REGISTER.md',
    root/'docs'/'CONFIGURATION.md',
    root/'docs'/'RELEASE-POLICY.md',
    root/'config'/'settings.schema.json',
    root/'config'/'settings.example.json',
]
missing = [str(p.relative_to(root)) for p in required if not p.exists()]
if missing:
    raise SystemExit('missing release metadata: ' + ', '.join(missing))
if f'[{version}]' not in (root/'CHANGELOG.md').read_text():
    raise SystemExit(f'changelog has no [{version}] entry')
json.loads((root/'config'/'settings.schema.json').read_text())
json.loads((root/'config'/'settings.example.json').read_text())
manifest_path = root/'BUILD-MANIFEST.json'
sums_path = root/'SHA256SUMS.txt'
manifest = json.loads(manifest_path.read_text())
if manifest.get('version') != version:
    raise SystemExit(f"manifest version {manifest.get('version')!r} does not match app version {version}")
for item in manifest.get('files', []):
    rel = str(item.get('path', ''))
    if rel == 'coverage.out' or '/__pycache__/' in '/'+rel or rel.endswith('.pyc'):
        raise SystemExit('generated artifact leaked into source manifest: ' + rel)
for path in (manifest_path, sums_path):
    if b'\r' in path.read_bytes():
        raise SystemExit(f'{path.name} must use LF-only line endings')
print(f'release metadata OK for {version}')
