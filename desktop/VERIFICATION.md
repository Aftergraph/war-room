# AFTERGRAPH / WAR ROOM v1.6.11 — Verification

This document distinguishes completed evidence from pending release gates. A missing tool/result is never treated as PASS.

## v1.6.11 loopback-boundary security evidence

Canonical implementation: PR #7, `fix(desktop): harden loopback HTTP boundary`.

- implementation evidence HEAD `168bd28e5049d4cbc5a0d45732513e52e5ad001b` — **PASS** through `Desktop stabilization` run `35422788362`
- final PR #7 HEAD `86b653c769f8b6a2097fc93232fd823b623fd491` — **PASS** through exact-head `Desktop stabilization` run `35423255178`
- canonical merge commit `2d872067a4c866b60ffe205cc609089d72978bdb` — **PASS** through post-merge `main` run `35423366567`
- Linux gates — **PASS**: release metadata, format, unit, shuffle/repeat, race, vet, `staticcheck`, frontend syntax, strict-CSP source gate, Windows cross-build, exact-binary `govulncheck`, reusable-secret scan, SHA-256
- native Windows gates — **PASS**: source gates, Windows GUI build, exact-binary `govulncheck`, artifact upload
- exact CI-produced v1.6.11 Windows EXE downloaded to the Lenovo target — **PASS**, `7,982,592` bytes, SHA-256 `d2cfac9cca8aef381b9450b228f7290ce8483c617af2deb57b3a4ef3e018f99c`
- native `/api/health` — **PASS**, `version=1.6.11`, `ok=true`, `go=go1.26.8`
- exact same-origin `Origin: http://127.0.0.1:<listener-port>` → **200**
- DNS-rebinding Host → **403**
- loopback Host without explicit port → **403**
- hostile cross-site Origin → **403**
- mismatched loopback Origin port → **403**
- duplicate Origin headers → **403**
- hostile Origin carrying a valid `X-WarRoom-Session` on a mutation route → **403**
- authenticated native shutdown — **PASS**, Trust Gateway `job.stop` authorization obtained and endpoint became unreachable after shutdown

These results close the behavioral exit criterion for `WR-SEC-002`. PR #9 is a follow-up only: metadata determinism, version-fixture cleanup, local API documentation, and additional malformed-authority regression coverage. Any material security-code change would require fresh exact-state evidence.

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

### Canonical GitHub officialization evidence

- canonical PR — **PASS**: PR #5 reviewed head `e7808c229f95c40acf74534fd031883b403e76e1`
- path-scoped `Desktop stabilization` on exact PR head — **PASS**, GitHub Actions run `35419509619`
- merge to canonical `main` — **PASS**: merge commit `f274787eb8de5ad6763361844877b1023073caed` at `2026-09-19T03:49:23Z`
- post-merge `Desktop stabilization` on exact canonical `main` commit — **PASS**, GitHub Actions run `35419637477`
- canonical source location — **PASS**: `Aftergraph/war-room/desktop`
- P0 weakness register — **PASS for tagging precondition**: `WR-SEC-001` and `WR-REL-001` are closed; tag/release publication remains a separate mandatory release gate

### Completed v1.6.10 release gates

- `desktop-v1.6.10` tag — **PASS**, exact source commit `fabcdd048dbf3e3f20267cc9b03df7b4112c4a7d`
- tag-triggered `Desktop release` workflow — **PASS**, run `35422295555`
- published release manifest — **PASS**, `releaseStatus=release`, `sourceCommit=fabcdd048dbf3e3f20267cc9b03df7b4112c4a7d`, Go `go1.26.8`, exact-binary `govulncheck=true`
- published EXE — **PASS**, `7,980,544` bytes, SHA-256 `d4796a44eba6cc1e52886ef38b4ed1c51764574a83fa21df4035fda42f7c5b28`
- published Windows ZIP — **PASS**, SHA-256 `bb673ad2658c4bd101a96302e8b0fee8743fbf76ef90af63ec74aed301130837`
- delivered-state read-back — **PASS**: release assets were downloaded, ZIP expanded, standalone and packaged EXE hashes matched, packaged manifest matched the published manifest, and the manifest bound to the exact tag commit
- immutable post-publication receipt — **PASS**: `RELEASE-RECEIPT-v1.6.10.md` attached to the GitHub Release

## UI evidence carried forward as baseline, not release proof

The v1.6.9 exact binary on the target 120 Hz panel produced a 600-frame visible-page sample around 8.3 ms median / 8.4 ms p95 and approximately 120.48 Hz, with no >25 ms frame in the isolated rerun. A short page-level soak did not show monotonic JS-heap growth. These results remain useful regression baselines but do not replace the still-open multi-hour connected soak, Narrator/NVDA, or physical-touch evidence.
