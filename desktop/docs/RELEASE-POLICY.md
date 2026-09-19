# AFTERGRAPH / WAR ROOM Desktop — Release Policy

The desktop line becomes official only through the canonical `Aftergraph/war-room` repository. Local ZIPs, chat artifacts, or manually copied EXEs are evidence inputs, not releases.

## Canonical layout

The official source lives under `desktop/` in `Aftergraph/war-room`. The existing server/control-plane implementation at repository root remains separate; neither may silently replace the other.

## Version states

1. **development** — local/branch work; no release claim.
2. **release candidate** — exact commit has changelog + verification + risk register updated and all deterministic code gates green.
3. **release** — native Windows build, exact-binary vulnerability scan, hashes, GitHub CI, and release notes are complete; no P0 risk remains open.
4. **superseded/blocked** — a previously built version is known to violate a release gate. It must not be advertised as current.

## Required release PR contents

Every desktop release PR must update:
- `desktop/CHANGELOG.md`
- `desktop/VERIFICATION.md`
- `desktop/docs/WEAKNESSES-AND-RISK-REGISTER.md`
- `desktop/docs/CONFIGURATION.md` if config/env/defaults change
- `desktop/BUILD-MANIFEST.json`
- `desktop/SHA256SUMS.txt`
- version string and `scripts/build-release.sh` default version

The PR description must name the exact compiler/tool versions and explicitly list deferred P1/P2 weaknesses.

## Mandatory gates

- formatting
- unit tests
- shuffled/repeated tests when stabilization work changes concurrency/state ordering
- race tests
- `go vet`
- `staticcheck`
- frontend JS syntax
- deterministic UI QA when Playwright is available
- Windows x64 test build
- Windows GUI build
- Authenticode signing for every shipped Windows executable using the controlled production certificate; expected thumbprint + trusted timestamp + post-sign verification must pass
- exact-binary `govulncheck` for every shipped executable **after** Authenticode signing
- governed-updater trust gate when an updater is shipped: compile-time public key present, matching CI signing key/key-id available, signed update plan generated, and the built updater verifies that plan/candidate before publication
- reusable-secret scan
- native Windows smoke (`/api/health` version + clean shutdown)
- executable SHA-256 and package integrity

A release gate is never marked PASS merely because the tool is unavailable. Tool unavailability is `UNVERIFIED` and blocks an official release when the gate is mandatory.

## Go toolchain policy

The release build must use a Go version at or above `MIN_RELEASE_GO` and must not be known vulnerable according to current `govulncheck` data. v1.6.10 sets the floor to 1.25.13 after the v1.6.9 Go 1.23.2 binary was shown to contain reachable standard-library vulnerabilities.

## Tagging

Desktop tags use `desktop-vMAJOR.MINOR.PATCH`, for example `desktop-v1.6.10`, to avoid ambiguity with the repository-root server line. A tag is created only after merge of the exact release commit.

P0 risk closure is evaluated before tagging. A release-provenance risk may close once canonical merge + exact reviewed CI establish source identity; tag creation, release-workflow success, asset hashes, and delivered-state read-back remain separate mandatory release gates. This avoids a circular rule where the tag required to close a P0 would itself publish a release while that P0 was still open.

## Artifacts

GitHub release assets should include:
- `Aftergraph-War-Room.exe`
- `Aftergraph-War-Room-Updater.exe` when governed updater support is enabled
- signed `UPDATE-PLAN.json` when governed updater support is enabled
- release ZIP
- `SHA256SUMS.txt`
- `VERIFICATION.md`
- `CHANGELOG.md`

Compiled binaries are release assets, not source-tree commits.

## Authenticode policy

Official Windows release artifacts must be signed before any final binary hash/provenance is generated. The signing certificate private key is a protected release credential, never a source/runtime secret.

Required ordering:

1. build desktop + updater,
2. Authenticode-sign both binaries with SHA-256 and an approved HTTPS RFC3161 timestamp service,
3. verify Windows trust policy and exact signer thumbprint,
4. run exact-binary vulnerability scans on the signed binaries,
5. generate/sign the updater plan against the signed desktop EXE,
6. generate release metadata/checksums from the signed bytes,
7. package/publish and perform delivered-state signature/hash read-back.

The release must fail closed when certificate material, password, expected thumbprint, timestamp configuration, signing, timestamping, or signature verification is missing/invalid. A self-signed development certificate cannot close `WR-REL-002`.

## Governed updater policy

Updater trust is source-governed, not caller-provided. The updater binary must contain the approved public release key; runtime flags/files may not replace the production trust root.

The official release environment may access the corresponding private Ed25519 key only through the protected `WAR_ROOM_UPDATE_SIGNING_KEY_B64` secret and `WAR_ROOM_UPDATE_SIGNING_KEY_ID` repository variable. Release CI must fail closed if either side of that trust relationship is missing or mismatched.

Before publication, CI must:

1. build and exact-binary scan both desktop and updater,
2. sign the update plan against the exact release EXE/source commit,
3. execute the updater's `--verify-only` mode against the signed plan and release EXE,
4. include updater + signed update plan in release/package checksums.

A production updater key change is a protected release/security change and requires normal exact-head review/gates.
