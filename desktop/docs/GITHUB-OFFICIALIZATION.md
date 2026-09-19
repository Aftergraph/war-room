# AFTERGRAPH / WAR ROOM Desktop — GitHub Officialization

## Decision

The desktop implementation is an official component of `Aftergraph/war-room`, stored under `desktop/`. This avoids creating a second competing War Room truth while preserving the repository-root server architecture.

## GitHub controls

The canonical repository should contain:
- `desktop/` source and release evidence.
- `.github/workflows/desktop-stabilization.yml` path-scoped CI.
- `.github/PULL_REQUEST_TEMPLATE/desktop-release.md` release PR checklist.
- `.github/ISSUE_TEMPLATE/desktop-bug.yml` structured desktop bug reports.
- CODEOWNERS coverage for `/desktop/`.

## Branch and tag naming

- stabilization branch: `desktop/stabilize-vX.Y.Z`
- ordinary desktop feature branch: `desktop/<topic>`
- release tag: `desktop-vX.Y.Z`

Do not reuse the temporary `qa/*` branch namespace for canonical releases.

## Merge rule

A desktop PR may merge only when:
1. required GitHub checks are green,
2. `CHANGELOG.md`, `VERIFICATION.md`, risk register, and build manifest agree on the version,
3. no P0 risk remains OPEN,
4. no secret is present in the diff,
5. release binaries are built from the exact reviewed commit.

## GitHub Releases

The GitHub Release is the public distribution record. Release notes are generated from the matching changelog entry, but must also contain:
- exact commit SHA,
- Go version,
- staticcheck/govulncheck versions,
- EXE SHA-256,
- ZIP SHA-256,
- known/deferred weaknesses,
- whether native AT/touch/soak evidence is complete.

## Security reporting

A security defect affecting a released desktop binary is recorded in the risk register immediately. If the issue violates a mandatory release gate, that version is marked superseded/blocked even before a replacement release is ready.
