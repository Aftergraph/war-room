# Changelog

All notable changes to the AFTERGRAPH / WAR ROOM Desktop line are recorded here. This file is part of the release contract: every release PR must update it, list security/toolchain changes, and link unresolved weaknesses to `docs/WEAKNESSES-AND-RISK-REGISTER.md`.

The format follows Keep a Changelog conventions and semantic versioning. A version is not considered released until its exact source commit, native Windows build, verification record, executable SHA-256, and release notes are published together.

## [1.6.12] - 2026-09-19

### Security
- Replaced ad-hoc log-secret pattern ownership with a central typed secret registry covering GitHub, WORKS, TypeSafe, Agent Bridge, War Room session, Bearer transport, and generic named-secret surfaces.
- Added a regression corpus for recognizable token formats and opaque credentials in their registered label contexts.
- Added a source-contract test that scans production Go vault access and fails when a new vault credential key is introduced without registry coverage.

### Changed
- Log and diagnostic redaction now route through the canonical registry instead of a private regex list in `logging.go`.
- Desktop build/release defaults and QA version fixtures now target v1.6.12.

### Release verification
- PR #11 final HEAD `a13a6d9b3d6b10fbbbaa14b7d8ddefddbff69ce2` and canonical merge `a917cffd4a6cb56435cc936abfb624d02dd5a65c` passed Linux + native Windows stabilization.
- WR-SEC-003 closure PR #12 merged as `2f418e6940a2d8385f0d11682d8015acf32b2a91`; post-merge run `35430579387` passed Linux + native Windows.
- Exact post-closure Windows artifact smoke on Lenovo: `/api/health` reported v1.6.12 / Go 1.26.8 and authenticated shutdown completed cleanly.
- Smoke artifact: 7,982,592 bytes; SHA-256 `c4f3a82c8ae0a8046a81e0a5cb05c63081ec016439894d281ec851397d16c174`.

## [1.6.11] - 2026-09-19

### Security
- Hardened the loopback HTTP boundary against DNS-rebinding and cross-origin session/token access: every request must use the exact IPv4 loopback authority opened by the desktop runtime, and requests carrying an `Origin` must match that authority exactly.
- Added regression coverage for hostile Host, hostile Origin, mismatched loopback ports, malformed Origin paths, and mutation attempts that present a valid session capability from a hostile Origin.
- Extended boundary regressions to reject nonnumeric loopback ports and mixed duplicate-Origin headers.

### Changed
- Desktop build/release defaults and stabilization builds now target v1.6.11.
- Release metadata generation now emits deterministic LF output on Windows and excludes generated coverage/Python cache artifacts from the source manifest.

## [1.6.10] - 2026-09-19

### Added
- Canonical release governance for the desktop line: changelog, configuration reference, weakness/risk register, release policy, GitHub officialization guide, and machine-readable settings schema.
- Release gate now requires a patched Go toolchain (`MIN_RELEASE_GO`, default `1.25.13`), `staticcheck`, and `govulncheck`.
- Native Windows verification path is documented as a first-class release requirement rather than an ad-hoc QA step.

### Changed
- Replaced numeric HTTP status literals in API handlers with `net/http` constants so `staticcheck` can enforce the API surface consistently.
- Removed an unused response helper found by `staticcheck`.
- Official release configuration now distinguishes user-editable settings, encrypted secrets, test-only environment variables, and release-build controls.
- Future release PRs must state known weaknesses explicitly instead of treating missing evidence as success.

### Security
- v1.6.9 was built with Go 1.23.2. A later binary scan on the exact v1.6.9 executable found 53 reachable vulnerabilities in the Go standard library and no additional vulnerabilities in imported third-party packages/modules. v1.6.9 is therefore treated as release-blocked/superseded.
- v1.6.10 raises the release compiler floor to a patched Go line and makes exact-binary `govulncheck` mandatory before release.
- Credentials remain excluded from source/release artifacts; Windows secrets use current-user DPAPI storage.

### Verification status
- Final v1.6.10 source passed native Windows unit, shuffle/repeat, race, vet, `staticcheck`, JS syntax, strict-CSP inline-style, Windows cross-test/build, exact-binary `govulncheck`, and secret-scan gates using Go 1.26.8.
- Exact candidate EXE SHA-256: `b2b9a3e36881195f28766f08ecf18986a0ac8254f25e5a92546357a484d1cf44`.
- Native `/api/health` reported `version=1.6.10`, `ok=true`, `go=go1.26.8`; single-instance and authenticated shutdown smoke tests passed.
- Canonical GitHub officialization is complete through merge: PR #5 head `e7808c229f95c40acf74534fd031883b403e76e1` passed `Desktop stabilization`, merged as `f274787eb8de5ad6763361844877b1023073caed`, and the post-merge `main` stabilization run also passed.
- v1.6.10 was released as `desktop-v1.6.10` from exact source commit `fabcdd048dbf3e3f20267cc9b03df7b4112c4a7d`; the tag-triggered release workflow and post-publication asset/hash read-back passed. The immutable release carries `RELEASE-RECEIPT-v1.6.10.md` for delivered-state evidence.

## [1.6.9] - 2026-09-19

### Added
- Durable-write-before-memory-publication semantics.
- Corrupt persistence-journal quarantine and stricter journal validation.
- Agent heartbeat sequence ordering and future-event rejection.
- Connector recovery/stability telemetry.
- Explicit topology scale tiers through 5,000+ repositories.
- Long-task instrumentation and forced-colors policy.
- Native 120 Hz Lenovo performance evidence.

### Security
- This build is superseded because it was compiled with Go 1.23.2 and later exact-binary scanning identified reachable standard-library vulnerabilities. Do not publish v1.6.9 as the current official binary.

## [1.6.8] - 2026-09-19

### Added
- UI Stability Track I using the `war-room-ui-stability` methodology.
- Truthful observation modes, single-flight refresh, modal focus containment, keyboard topology controls, URL-scheme validation, reduced-motion parity, CSP inline-style gate, and frontend resource cleanup.

## [1.6.7] - 2026-09-19

### Added
- Connector transition invariants, bounded diagnostic event ring, monotonic persistence generations, and real child-process shutdown proof with active SSE/WORKS streams.

## [1.6.6] - 2026-09-19

### Added
- Single-instance state-directory lock, connector failure/recovery telemetry, deterministic lifecycle shutdown, more clock injection, and persistence property/fuzz tests.

## [1.6.5] - 2026-09-19

### Added
- Shared connector lifecycle states, bounded/redacted log rotation, process-level crash recovery, broader provider/API coverage, and a >=65% stabilization coverage gate.

## [1.6.4] - 2026-09-19

### Added
- Versioned state envelopes, persistence phase fault injection, persistent GitHub connector ownership, deterministic clocks, and bounded runtime diagnostics.

## [1.6.3] - 2026-09-19

### Changed
- Split TypeSafe, intelligence, assistant, and GitHub code into smaller responsibility-focused files.
- Added serialized persistence journaling and provider observability.

## [1.6.2] - 2026-09-19

### Added
- Injectable provider transports, bounded GitHub retry/backoff, backup/recovery persistence, deeper defensive copies, and broader failure-path tests.

## [1.6.1] - 2026-09-19

### Fixed
- Atomic Agent Fabric updates, mutable-state leakage, lifecycle cancellation, strict JSON parsing, HTTP server hardening, and log fallback behavior.
