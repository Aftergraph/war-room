#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
VERSION="${VERSION:-1.6.12}"
MIN_RELEASE_GO="${MIN_RELEASE_GO:-1.25.13}"
mkdir -p dist

go_version="$(go env GOVERSION | sed 's/^go//')"
if [ "$(printf '%s\n%s\n' "$MIN_RELEASE_GO" "$go_version" | sort -V | head -n1)" != "$MIN_RELEASE_GO" ]; then
  echo "Release build requires Go >= ${MIN_RELEASE_GO}; found ${go_version}" >&2
  exit 1
fi
for gate in staticcheck govulncheck; do
  if ! command -v "$gate" >/dev/null 2>&1; then
    echo "Required release gate '$gate' is not installed" >&2
    exit 1
  fi
done

echo '[1/10] release metadata'
python scripts/verify-release-metadata.py

echo '[2/10] gofmt'
gofmt -w *.go

echo '[3/10] unit + race + vet + staticcheck'
go test -count=1 ./...
go test -race -count=1 ./...
go vet ./...
staticcheck ./...

echo '[4/10] frontend syntax'
node --check web/app.js
node --check web/visual-engine.js
node --check web/spatial-engine.js
node --check web/icons.js
if grep -RIn --include='*.html' --include='*.js' 'style="' web; then
  echo 'Inline style attribute found; strict CSP would block it' >&2
  exit 1
fi

echo '[5/10] deterministic shell render (when Playwright is available)'
if python - <<'PY' >/dev/null 2>&1
import playwright
PY
then
  python qa/render_shell.py
else
  echo 'Playwright unavailable; skipping visual QA harness'
fi

echo '[6/10] Windows cross-test binary'
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go test -c -o dist/warroom-desktop.test.exe .

echo '[7/10] Windows GUI build'
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-H=windowsgui -s -w -X main.version=${VERSION}" -o dist/Aftergraph-War-Room.exe .
file dist/Aftergraph-War-Room.exe

echo '[8/10] binary vulnerability gate'
govulncheck -mode=binary dist/Aftergraph-War-Room.exe

echo '[9/10] secret scan'
if grep -RIE --exclude-dir=.git --exclude='*.exe' --exclude='*.zip' '(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|apikey_[A-Za-z0-9_]{24,})' .; then
  echo 'Potential reusable secret found' >&2
  exit 1
fi
echo '[10/10] manifest + checksums'
RELEASE_GATES_COMPLETE=1 python scripts/generate-release-metadata.py
sha256sum dist/Aftergraph-War-Room.exe
