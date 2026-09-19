# Desktop release / stabilization PR

## Release identity
- [ ] Target version matches `desktop/app.go`, `desktop/CHANGELOG.md`, and build script.
- [ ] Changelog updated.
- [ ] `desktop/VERIFICATION.md` updated with exact evidence.
- [ ] `desktop/docs/WEAKNESSES-AND-RISK-REGISTER.md` reviewed.
- [ ] Configuration docs/schema updated if defaults, env vars, or settings changed.

## Mandatory gates
- [ ] unit + shuffle/repeat + race
- [ ] go vet
- [ ] staticcheck
- [ ] frontend syntax + CSP inline-style gate
- [ ] Windows build
- [ ] exact-binary govulncheck
- [ ] secret scan
- [ ] native health/single-instance/shutdown smoke
- [ ] GitHub Actions green on exact PR head

## Release boundary
- [ ] No P0 risk remains OPEN before merge.
- [ ] No credentials or reusable tokens in diff/artifacts.
- [ ] Desktop remains a projection/control surface; no new authority boundary is implied.
- [ ] Compiled binaries are release assets, not source-tree commits.

## Post-merge
- [ ] Tag `desktop-vX.Y.Z`.
- [ ] Publish EXE, ZIP, checksums, verification, and changelog as GitHub Release assets.
