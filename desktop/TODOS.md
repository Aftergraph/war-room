# AFTERGRAPH / WAR ROOM Desktop — release and stabilization backlog

## Completed release milestone — v1.6.10

- Canonical source, path-scoped CI, release workflow, CODEOWNERS/templates, exact-HEAD PR verification, canonical merge, release manifest/checksums, `desktop-v1.6.10` tag, GitHub Release publication, and delivered-state asset/hash read-back are complete.
- Exact released source commit: `fabcdd048dbf3e3f20267cc9b03df7b4112c4a7d`.
- Delivered-state receipt: `RELEASE-RECEIPT-v1.6.10.md` attached to the immutable GitHub Release.

## P1 — next stabilization versions

- >=2h native resource soak with GitHub + WORKS + Agent Bridge connected.
- Narrator + NVDA empirical pass.
- Authenticode signing.
- governed updater + rollback.

### v1.6.12 secret-registry stabilization

- `WR-SEC-003` central secret registry + regression corpus — **CLOSED**: PR #11 exact head `a13a6d9b3d6b10fbbbaa14b7d8ddefddbff69ce2` and post-merge `main@a917cffd4a6cb56435cc936abfb624d02dd5a65c` both passed Desktop stabilization.

### v1.6.11 security stabilization

- Host/Origin hardening — **CLOSED**: PR #7 final head `86b653c769f8b6a2097fc93232fd823b623fd491` and post-merge `main@2d872067a4c866b60ffe205cc609089d72978bdb` both passed `Desktop stabilization`.
- Follow-up hardening — keep release metadata deterministic across Windows/Linux, remove generated artifacts from source manifests, refresh v1.6.11 UI/QA version fixtures, and retain adversarial Host/Origin edge cases.

## P2 / accepted limitations

- physical touch validation requires a device with touchscreen/digitizer; current Lenovo target does not expose one.
- GitHub remains near-live REST reconciliation unless a governed event source is added.
- Assistant/Jev/War Room projections remain non-authoritative by design.
