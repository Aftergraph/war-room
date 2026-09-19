# AFTERGRAPH / WAR ROOM Desktop — release and stabilization backlog

## P0 — v1.6.10 officialization / release blockers

1. Commit the final desktop source under canonical `Aftergraph/war-room/desktop`.
2. Add path-scoped GitHub CI, release workflow, CODEOWNERS, desktop release PR template, and structured desktop bug template.
3. Run GitHub Actions on the exact PR head and reconcile any differences from the native Lenovo gates.
4. Merge only when `WR-REL-001` can be closed and no other P0 item is OPEN.
5. Build release artifacts from the exact merged/tagged commit and regenerate `BUILD-MANIFEST.json` + `SHA256SUMS.txt` in the release artifact.
6. Tag as `desktop-v1.6.10`; publish EXE/ZIP/checksums/verification/changelog as GitHub Release assets.
7. Update the changelog entry date from `Unreleased` to the actual GitHub release date.

## P1 — next stabilization versions

- >=2h native resource soak with GitHub + WORKS + Agent Bridge connected.
- Narrator + NVDA empirical pass.
- Host/Origin hardening or formal acceptance of the single-user loopback threat boundary.
- Authenticode signing.
- governed updater + rollback.
- independent/reproducible Windows build comparison.
- central secret-format registry for log redaction tests.

## P2 / accepted limitations

- physical touch validation requires a device with touchscreen/digitizer; current Lenovo target does not expose one.
- GitHub remains near-live REST reconciliation unless a governed event source is added.
- Assistant/Jev/War Room projections remain non-authoritative by design.
