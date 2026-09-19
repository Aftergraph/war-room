# AFTERGRAPH / WAR ROOM — v1.6.10 Stabilization Pass X / Officialization

v1.6.10 does not expand operator authority or invent a new product surface. It turns the desktop line into a governable release candidate with explicit security/toolchain gates, canonical GitHub placement, configuration documentation, and a durable weakness register.

## Why this pass exists

The exact v1.6.9 Windows executable was later scanned with `govulncheck` and found to contain 53 reachable vulnerabilities from the Go 1.23.2 standard library. No additional vulnerable imported third-party packages/modules were reported by that scan. v1.6.9 is therefore superseded as a release candidate even though its runtime/UI evidence remains useful as a performance baseline.

## Closed in source

1. `scripts/build-release.sh` enforces a minimum release Go version and requires `staticcheck` + `govulncheck`.
2. API handlers use named `net/http` status constants; the unused HTTP response helper found by static analysis is removed.
3. `CHANGELOG.md` is now a required release artifact.
4. Runtime/build configuration is documented from actual defaults/validation and mirrored by `config/settings.example.json` + JSON schema.
5. `docs/WEAKNESSES-AND-RISK-REGISTER.md` makes missing evidence and accepted limitations explicit.
6. `docs/RELEASE-POLICY.md` defines candidate/release/superseded states, required gates, tag naming, and artifact rules.
7. `docs/GITHUB-OFFICIALIZATION.md` defines `Aftergraph/war-room/desktop` as the canonical source location without replacing the existing repository-root control-plane implementation.
8. Release metadata verification is automated by `scripts/verify-release-metadata.py`.

## Preserved v1.6.9 hardening

- durable state is published in memory only after persistence succeeds,
- persistence journals are validated/quarantined and crash recovery remains generation-aware,
- Agent Bridge sequence/order/liveness protections remain fail-closed,
- topology scale tiers and long-task instrumentation remain bounded,
- forced-colors and reduced-motion behavior remain part of the UI stability contract,
- native 120 Hz evidence remains historical baseline evidence, not a substitute for v1.6.10 exact-binary verification.

## Release status

**RELEASE CANDIDATE — native security/build gates green; canonical GitHub officialization still required.**

The final candidate source passed native Windows unit/shuffle/race/vet/staticcheck, Windows build, exact-binary `govulncheck`, secret scan, health, single-instance, and shutdown smoke with Go 1.26.8. Candidate EXE SHA-256 is `b2b9a3e36881195f28766f08ecf18986a0ac8254f25e5a92546357a484d1cf44`.

The only remaining P0 is canonical source provenance: PR/CI/merge/tag/release in `Aftergraph/war-room`. See `VERIFICATION.md` and the risk register.
