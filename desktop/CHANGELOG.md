# Changelog

All notable changes to the AFTERGRAPH / WAR ROOM Desktop line are recorded here. This file is part of the release contract: every release PR must update it, list security/toolchain changes, and link unresolved weaknesses to `docs/WEAKNESSES-AND-RISK-REGISTER.md`.

The format follows Keep a Changelog conventions and semantic versioning. A version is not considered released until its exact source commit, native Windows build, verification record, executable SHA-256, and release notes are published together.

## [1.6.14] - Unreleased

### Added
- Governed updater foundation with Ed25519-signed update plans, compile-time pinned production trust roots, artifact hash/size verification, state-schema compatibility preflight, state snapshot, atomic executable swap, native health smoke, and automatic executable rollback after failed verification.
- CI-only `war-room-update-plan` signer; private signing material is consumed only from the official release environment.
- `war-room-updater --verify-only` release gate so the published updater validates the signed plan against the same pinned trust root before publication.

### Security
- Added fail-closed Authenticode release signing for desktop + updater with pinned signer thumbprint, HTTPS RFC3161 timestamping, post-sign trust verification, and signed-byte provenance ordering. Production certificate material remains intentionally unprovisioned in source.
- Caller-supplied trust stores are deliberately unsupported. A caller cannot replace the updater trust root at runtime.
- Official release is fail-closed while the production update public key is unprovisioned; release CI also requires the corresponding private signing key and key id.
- Stabilization CI builds and exact-binary scans both the desktop app and updater helper.

### Release status
- v1.6.14 is a candidate line only. `WR-REL-003` remains blocked on production signing/trust provisioning and an official signed-plan delivered-state verification.
- `WR-REL-002` signing infrastructure is implemented but remains blocked on a controlled trusted production code-signing certificate and delivered signed-release verification.

## [1.6.13] - 2026-09-19

### Fixed
- Added repository `.gitattributes` rules that force LF checkout semantics for `BUILD-MANIFEST.json`, `SHA256SUMS.txt`, and release metadata Python scripts across Windows/Linux.
- Advanced release/stabilization version fixtures to v1.6.13 without changing runtime authority or credential semantics.

### Release provenance
- `desktop-v1.6.12` remains immutably bound to `14ac599a87f5aca1ab434c1633695237722a2814`, but release run `35430873251` failed before build/publication because Windows checkout converted `BUILD-MANIFEST.json` to CRLF. No v1.6.12 GitHub Release assets were published.
- v1.6.13 supersedes that failed publication attempt while preserving the v1.6.12 tag as historical evidence.
- v1.6.13 was subsequently released from exact source commit `20106f8885175a2f006e21a476da4bf867ac4ddd`; tag-triggered release run `35431659577` passed and public asset read-back matched the release manifest. The release carries `RELEASE-RECEIPT-v1.6.13.md`.

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
