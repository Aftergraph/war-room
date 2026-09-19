# AFTERGRAPH / WAR ROOM v1.6.14 — Verification

This document distinguishes completed evidence from pending release gates. A missing tool/result is never treated as PASS.

## v1.6.14 native soak evidence analyzer

The repository now contains `scripts/analyze-soak.py` for deterministic analysis of the >=2h native resource soak required by `WR-QA-001`.

The analyzer verifies:

- receipt schema and exact expected source commit / executable SHA-256
- receipt duration >=2h **and** independently observed NDJSON sample span >=2h
- first sample near the start of collection
- receipt/sample-count consistency
- zero receipt collection errors and zero NDJSON error rows
- recomputed GitHub, WORKS and Agent Bridge liveness
- zero stale-agent samples
- sample-gap continuity
- first/last quartile medians, min/max, linear slope/hour and consecutive-growth fraction for working set, private bytes, Go heap, handles and threads
- GitHub reconnect transitions, connecting samples, maximum observed recovery time and provider error classes

The trend rules are deliberately diagnostic only. The output field `closureVerdict` is pinned to `NOT_EMITTED`: analyzer success means the evidence is structurally complete, **not** that `WR-QA-001` is closed. Exact-state human/independent review of the resulting trends remains mandatory.

Regression coverage falsifies:

- forged provenance
- receipt-only two-hour claims with a shorter observed sample span
- non-live connector evidence
- accidental auto-closure semantics

## v1.6.14 target-Windows accessibility evidence

Target: Lenovo Windows x64, 3200×2000 @ 120 Hz.

### NVDA

- portable NVDA `2026.1.1` launched with isolated configuration and add-ons disabled
- empirical command-palette test found decorative `.pal-icon` glyphs included in option accessible names
- PR #16 final HEAD `2721620b6f9e0a860a1718831061a43fde4e690b` passed Desktop stabilization run `35434559164`
- PR #16 merged as `ac2e5260b71f00a013af772b72fa336c20ee9b3c`; post-merge run `35434644954` passed Linux + native Windows
- exact post-merge Windows artifact SHA-256 `a4ad19ce4477cf294b1106fbd94bf0280b112051af7ea0fad6edaaaf6399e7f2`
- NVDA retest announced the palette option cleanly as “Now Assistant, system pulse and live activity view” without the decorative glyph prefix — **PASS**

### Narrator + Windows UI Automation

- Narrator `10.0.26100.8941` running on target
- Microsoft Windows App Development CLI `0.6.1.0` used to inspect the same live UI Automation tree consumed by Windows accessibility clients
- pre-fix UIA sweep on the exact War Room window found exactly 11 unnamed interactive controls: the 10 compact primary navigation buttons plus `commandBtn`
- PR #18 final HEAD `9580a86ff5f2c6d3469bb667b1ed5f25067ebeb2` passed Desktop stabilization run `35436031854`
- PR #18 merged as `a8496d59cdea7d33be278712bd97739f3cab9077`; post-merge run `35436125747` passed Linux + native Windows
- exact merged Windows artifact: `7,983,104` bytes, SHA-256 `fd37a0445ca2976d72cde43fb10c263e4e4c5b10f575431caf093c0154400cf2`
- delivered-state UIA inspection with Narrator active confirmed explicit names for `Now`, `Activity`, `Topology`, `Agents & workers`, `Intelligence`, `Systems`, `Repositories`, `Evidence`, `Services`, `Connections`, and `Search or ask War Room` — **PASS**
- the prior 11 unnamed controls are therefore closed by exact delivered-state evidence

### Remaining WR-A11Y-001 evidence

`WR-A11Y-001` remains **PARTIAL / OPEN**. The exit criterion still requires recorded screen-reader evidence for:

- visual/accessibility drawer
- topology interaction/instructions
- status/live-region changes
- structured assistant objects

DOM/Playwright semantics alone are not substituted for the remaining Narrator/NVDA empirical evidence.

## v1.6.14 Authenticode candidate

Implemented release controls:

- dedicated `scripts/sign-windows.ps1` with no runtime signing surface
- protected PFX/password inputs required only in official release CI
- expected 40-hex signer thumbprint is pinned through repository configuration
- absolute HTTPS RFC3161 timestamp URL is mandatory
- PFX is imported non-exportably into the ephemeral current-user certificate store and removed in `finally`
- both `Aftergraph-War-Room.exe` and `Aftergraph-War-Room-Updater.exe` are signed
- `signtool verify /pa /all /v` and `Get-AuthenticodeSignature` must both pass
- resulting signer thumbprint must equal the expected thumbprint
- exact-binary `govulncheck` executes on post-signing bytes
- updater plan is generated after signing, so its artifact SHA-256 binds the shipped signed EXE
- release metadata/checksums are generated after signing
- source regression test pins sign → scan → update-plan → metadata ordering
- Windows stabilization runs `sign-windows.ps1 -ValidateOnly` without requiring production credentials

Production evidence is intentionally absent: no trusted production certificate has been provisioned and no signed v1.6.14 release has been published/read back. `WR-REL-002` remains **IMPLEMENTED / BLOCKED**, not CLOSED.

## v1.6.14 governed updater candidate

Implementation scope:

- Ed25519-signed update-plan contract (`aftergraph.war-room.desktop.update-plan/1.0`)
- compile-time pinned production trust root; runtime caller-supplied trust stores are not supported
- artifact SHA-256 + byte-count verification before swap
- state-envelope compatibility preflight and state snapshot
- adjacent atomic executable swap with previous-binary preservation
- native post-install health smoke + authenticated shutdown
- automatic previous-executable restoration when health verification fails
- CI-only update-plan signer using `WAR_ROOM_UPDATE_SIGNING_KEY_B64`
- release `--verify-only` path that makes the updater validate the signed plan against its own pinned trust root before publication
- stabilization CI builds and exact-binary scans both desktop and updater

Local focused evidence obtained before final exact-head CI:

- `go test -count=1 ./internal/updater ./cmd/war-room-updater` — **PASS**
- `go vet ./internal/updater ./cmd/war-room-updater` — **PASS**
- signature acceptance/tamper/untrusted-key regressions — **PASS**
- state-schema incompatibility rejected before executable swap — **PASS**
- successful swap snapshots state and archives previous executable — **PASS**
- failed health check restores previous executable byte-for-byte — **PASS**

Production updater trust is intentionally not provisioned yet. `ProductionTrustStore()` currently contains no key, so the official-release trust gate must fail until an approved Aftergraph desktop release public key is committed and the matching CI private signing key/key-id are provisioned. `WR-REL-003` therefore remains **IMPLEMENTED / BLOCKED**, not CLOSED.

## v1.6.13 released-state evidence

- canonical source commit — `20106f8885175a2f006e21a476da4bf867ac4ddd`
- PR #14 exact-head stabilization — run `35431478700`, **PASS** Linux + native Windows
- post-merge stabilization — run `35431565767`, **PASS** Linux + native Windows
- native canonical artifact smoke — **PASS**, version `1.6.13`, Go `go1.26.8`, authenticated shutdown PASS
- tag — `desktop-v1.6.13`
- tag-triggered release workflow — run `35431659577`, **PASS**
- published EXE — `7,982,592` bytes, SHA-256 `8045447dd326e397353c6914bd4cf883153a7747815a3d0600e1a9b52f3c380b`
- published ZIP — SHA-256 `35110b4cf9b2b8678822d5d9cba8fd383d2e4a080d97cb00654e27e6ba7ee380`
- published manifest — `releaseStatus=release`, `sourceCommit=20106f8885175a2f006e21a476da4bf867ac4ddd`, exact-binary govulncheck PASS
- delivered release receipt — `RELEASE-RECEIPT-v1.6.13.md`, SHA-256 `3c68e5ce4060a75ddb79f9dd22fb7376223fd831d08a6f3a28141c7518e96718`
- historical `desktop-v1.6.12` remains an immutable failed publication attempt; its release run stopped before build/package/publication and no v1.6.12 GitHub Release exists

## v1.6.12 secret-registry security evidence

- central registry source: `secret_registry.go`
- production vault credential coverage: `github.token`, `works.token`, `typesafe.api_key`, `agents.bridge_token`
- non-vault credential transports: `X-WarRoom-Session`, Bearer authorization, generic named-secret fallback
- regression corpus: GitHub fine-grained/classic tokens, opaque GitHub/WORKS/TypeSafe values, Agent Bridge token, War Room session, Bearer transport, generic JSON token — **PASS locally**
- production source coverage test scans direct `vault.Get/Set/Delete` calls and fails if any used vault key is absent from the registry — **PASS locally**
- full `go test -count=1 ./...` — **PASS locally**
- `go vet ./...` — **PASS locally**

`WR-SEC-003` is **CLOSED for v1.6.12**: PR #11 final HEAD `a13a6d9b3d6b10fbbbaa14b7d8ddefddbff69ce2` passed Desktop stabilization run `35430262886` on Linux and native Windows; it merged as `a917cffd4a6cb56435cc936abfb624d02dd5a65c`; post-merge canonical `main` then passed Desktop stabilization run `35430352696` on Linux and native Windows. No material redaction code changed between the verified PR head and merge.

### v1.6.12 release-readiness evidence

- canonical WR-SEC-003 closure merge — `2f418e6940a2d8385f0d11682d8015acf32b2a91`
- closure post-merge Desktop stabilization — run `35430579387`, **PASS** on Linux + native Windows
- exact post-closure native Windows smoke artifact — `7,982,592` bytes, SHA-256 `c4f3a82c8ae0a8046a81e0a5cb05c63081ec016439894d281ec851397d16c174`
- native `/api/health` — **PASS**, `version=1.6.12`, `ok=true`, `go=go1.26.8`
- authenticated native `/api/shutdown` — **PASS**, endpoint unreachable after shutdown
- P0 register — **PASS**, no P0 item OPEN
- deferred P1/P2 risks for release notes: `WR-QA-001`, `WR-A11Y-001`, `WR-REL-002`, `WR-REL-003`, `WR-A11Y-002`, plus accepted `WR-DATA-001` and permanent `WR-AUTH-001`

The public release remains incomplete until the exact merged release-readiness commit is tagged, the tag-triggered release workflow passes, and the published assets/manifest are read back.

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

## v1.6.11 independent reproducibility evidence

The published `desktop-v1.6.11` executable is bit-for-bit reproducible on an independent Windows builder when the checkout bytes match the release manifest.

- release source commit — `2d872067a4c866b60ffe205cc609089d72978bdb`
- tag-triggered release run — `35423444087`, **PASS**
- official release EXE — `7,982,592` bytes, SHA-256 `16382969514446446f291101eb08ca5292dfd4ad77cbf9f52e5baa4eece42d3a`
- independent builder — Lenovo Windows target, fresh clone, `core.autocrlf=true`, clean detached checkout of the exact release commit
- independent toolchain — official `go1.26.8.windows-amd64.zip`, SHA-256 `b92c3b2adae85a11ba71fe7216daf0d84e82af4c8ab6c5625807f28622043a59`
- source-manifest comparison — **112/112 entries matched** the published `BUILD-MANIFEST.json`
- independent EXE — `7,982,592` bytes, SHA-256 `16382969514446446f291101eb08ca5292dfd4ad77cbf9f52e5baa4eece42d3a`
- binary equality — **PASS**

An LF-normalized checkout did not reproduce the historical release and showed 111/112 source-manifest mismatches. Reproduction of this tagged artifact therefore requires the Windows-normalized checkout bytes captured by its release manifest. Full evidence and the exact boundary are recorded in `docs/REPRODUCIBILITY-v1.6.11.md`. This closes `WR-REL-004` for v1.6.11.

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
