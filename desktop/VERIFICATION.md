# AFTERGRAPH / WAR ROOM v1.6.10 — Verification

This document distinguishes completed evidence from pending release gates. A missing tool/result is never treated as PASS.

## Source gates completed before GitHub officialization

- `gofmt` — PASS
- `go test -count=1 ./...` — PASS
- `go test -race -count=1 ./...` — PASS
- `go vet ./...` — PASS
- Go statement coverage — **66.7%** (fresh v1.6.10 source measurement; coverage target remains a prioritization signal, not a release-quality score)
- frontend syntax (`app.js`, `visual-engine.js`, `spatial-engine.js`, `icons.js`) — PASS
- deterministic UI/scale QA inherited from the v1.6.9 source line — PASS in build environment
- `scripts/verify-release-metadata.py` — required in v1.6.10

## Native Windows evidence already obtained

Target: Lenovo, Windows x64, Intel Core Ultra 9 285H, 3200×2000 @ 120 Hz.

- portable Go 1.26.8 toolchain available — PASS
- reconstructed v1.6.10 source ZIP transferred/hash-checked on target — PASS
- native `go test -count=1 ./...` with Go 1.26.8 — PASS (`4.604s` observed in the pre-staticcheck-fix source snapshot)
- native `go test -race -count=1 ./...` with Go 1.26.8 — PASS (`8.000s` observed in the pre-staticcheck-fix source snapshot)
- native `go vet ./...` — PASS

The source was subsequently changed only to resolve `staticcheck` findings and add release governance/documentation; all native gates must be rerun on the final exact source before release.

## Security finding that invalidates v1.6.9 as current release

Exact v1.6.9 EXE metadata reported Go 1.23.2. `govulncheck v1.8.0 -mode=binary` reported 53 reachable vulnerabilities from the Go standard library and no additional vulnerabilities in imported packages/modules. v1.6.9 is therefore superseded/release-blocked.

## Final native v1.6.10 candidate gates

Executed on the target Lenovo from the final source snapshot after the static-analysis fixes:

- release metadata check — **PASS**
- `go test -count=1 ./...` — **PASS**
- `go test -shuffle=on -count=10 ./...` — **PASS**
- `go test -race -count=1 ./...` — **PASS**
- `go vet ./...` — **PASS**
- `staticcheck ./...` — **PASS**, staticcheck 2026.2.1 / 0.8.1
- frontend JS syntax — **PASS**
- strict-CSP inline-style source gate — **PASS**
- Windows x64 test binary — **PASS**
- Windows GUI build — **PASS**
- exact-binary `govulncheck -mode=binary` — **PASS**, exit 0
- reusable-secret scan — **PASS**
- compiler embedded in exact candidate — **Go 1.26.8**
- candidate EXE bytes — **7,979,008**
- candidate EXE SHA-256 — `b2b9a3e36881195f28766f08ecf18986a0ac8254f25e5a92546357a484d1cf44`
- `/api/health` — **PASS**, `version=1.6.10`, `ok=true`, `go=go1.26.8`
- same-state-directory second process — **PASS**: second process exited and only the first listener remained
- authenticated `/api/shutdown` — **PASS**; endpoint was unreachable ~900 ms later

### Remaining official-release gates

- canonical `Aftergraph/war-room` desktop PR on exact source — PENDING
- path-scoped GitHub Actions green on exact PR head — PENDING
- merge to canonical `main` — PENDING
- `desktop-v1.6.10` tag + GitHub Release assets/checksums — PENDING
- no P0 OPEN item in the risk register — currently blocked only by source officialization (`WR-REL-001`)

## UI evidence carried forward as baseline, not release proof

The v1.6.9 exact binary on the target 120 Hz panel produced a 600-frame visible-page sample around 8.3 ms median / 8.4 ms p95 and approximately 120.48 Hz, with no >25 ms frame in the isolated rerun. A short page-level soak did not show monotonic JS-heap growth. These results are useful regression baselines but do not replace exact v1.6.10 native proof or the still-open multi-hour/Narrator/NVDA/touch items.
