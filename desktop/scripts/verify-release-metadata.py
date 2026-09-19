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
print(f'release metadata OK for {version}')
