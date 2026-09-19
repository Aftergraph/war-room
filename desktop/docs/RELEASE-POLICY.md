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
- exact-binary `govulncheck`
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
- release ZIP
- `SHA256SUMS.txt`
- `VERIFICATION.md`
- `CHANGELOG.md`

Compiled binaries are release assets, not source-tree commits.
