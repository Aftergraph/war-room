# AFTERGRAPH / WAR ROOM Desktop v1.6.14 — Governed Updater

## Outcome

The updater is a separate Windows helper owned by War Room Desktop. It does not create a new authority system. It consumes only a cryptographically signed release plan whose public trust root is compiled into the updater binary.

The main application remains the operator/control surface; release authorization remains governed by the canonical Aftergraph repository/release process.

## Components

- `cmd/war-room-updater` — verifies and applies an update.
- `cmd/war-room-update-plan` — CI-only signer used by the official release workflow.
- `internal/updater` — signed-plan verification, artifact verification, state preflight/snapshot, atomic swap, native smoke and rollback primitives.
- `internal/updater/production_trust.go` — compile-time public trust root.
- `UPDATE-PLAN.json` — signed release contract emitted by CI.

## Update plan contract

Schema: `aftergraph.war-room.desktop.update-plan/1.0`.

The signed payload binds:

- current version,
- target version,
- exact target source commit,
- target executable name,
- target executable SHA-256,
- target executable byte count,
- supported state-schema range,
- Ed25519 key id/signature.

Changing any signed field invalidates the signature.

## Trust model

Runtime callers cannot provide a trust store. The updater calls `ProductionTrustStore()`, which is compiled into the binary.

Before automatic update publication can be enabled:

1. an approved Aftergraph desktop release Ed25519 public key must be committed to `production_trust.go`;
2. the corresponding private key must be provisioned only as the GitHub Actions secret `WAR_ROOM_UPDATE_SIGNING_KEY_B64`;
3. its public key id must be configured as repository variable `WAR_ROOM_UPDATE_SIGNING_KEY_ID`;
4. the official release workflow must pass `TestOfficialReleaseRequiresProductionUpdateTrust`;
5. the release workflow signs `UPDATE-PLAN.json`;
6. the built updater runs `--verify-only` against the signed plan and release EXE before publication.

The current v1.6.14 candidate intentionally has no production key and therefore cannot pass the official-release trust gate.

## Apply algorithm

1. Verify signed update plan against compile-time production trust.
2. Verify candidate EXE byte count and SHA-256.
3. Preflight every recognized `aftergraph.war-room.state` envelope against the target state compatibility range.
4. Snapshot the current state directory outside the live state tree.
5. Stage the candidate executable beside the installed executable.
6. Verify the staged candidate again.
7. Move the current executable aside.
8. Atomically rename the staged candidate into the install path.
9. Verify the installed candidate hash/size.
10. Launch the candidate with browser disabled.
11. Require loopback `/api/health` to report the exact target version.
12. Acquire the per-launch session capability and perform authenticated shutdown.
13. Archive the previous executable in the update backup.
14. Remove the adjacent temporary previous executable.

If post-install verification fails, the candidate is removed and the previous executable is restored before the updater returns failure.

## State boundary

The updater does not migrate state itself. It performs compatibility preflight only.

State migration authority remains with the application/store implementation. The updater refuses a recognized state envelope whose version lies outside the signed target compatibility range.

The snapshot includes the existing state directory before executable replacement. The update backup directory must be outside the live state directory to avoid recursive/self-referential backups.

## Release assets

Once production trust is provisioned, an updater-enabled release publishes:

- `Aftergraph-War-Room.exe`
- `Aftergraph-War-Room-Updater.exe`
- `UPDATE-PLAN.json`
- Windows ZIP
- release manifest/checksums/evidence

Both desktop and updater executables are built and exact-binary scanned by stabilization/release CI.

## Rollback evidence

Automated regressions cover:

- valid signed-plan acceptance,
- signed-plan tamper rejection,
- untrusted key rejection,
- state incompatibility rejection before swap,
- successful state snapshot and previous-binary archival,
- failed post-install health verification restoring the previous executable.

A public `WR-REL-003` closure still requires production key provisioning, a signed updater release, and delivered-state recovery evidence on the exact released binaries.
