# AFTERGRAPH / WAR ROOM Desktop Architecture v1.1

```text
Windows .exe
  ├─ loopback Go control service (127.0.0.1 only)
  │   ├─ GitHub observation adapter
  │   ├─ service probes
  │   ├─ local Windows host collector
  │   ├─ evidence metric ledger
  │   ├─ DPAPI credential vault
  │   └─ SSE live-update stream
  │
  └─ Edge app-mode desktop shell
      ├─ Now / system pulse
      ├─ heterogeneous live activity timeline
      ├─ Needs You exception surface
      ├─ progressive context preview
      ├─ Systems / repositories / evidence / services planes
      └─ deterministic natural-language state query surface
```

## Authority boundary

The browser/app-mode shell is a projection. It does not receive GitHub credentials. Consequential local API mutations require an ephemeral per-launch session capability, and the GitHub token is resolved only inside the Go process from the Windows DPAPI vault.

## Live update model

1. `hostLoop` observes the local machine every 15 seconds and broadcasts an SSE update.
2. Startup performs a best-effort GitHub sync and service probe.
3. Background sync repeats on the configured cadence for both authenticated and public-only mode.
4. Public-only refresh merges live public data with explicitly retained private inventory from the prior authenticated/build snapshot.
5. The shell also pulls `/api/summary` periodically as a recovery path if an SSE update is missed.

## UI information architecture

The shell deliberately separates three visibility levels:

- **Status** — sidebar presence + one system headline + compact pulse.
- **Preview** — `Needs You`, live context and event inspector.
- **Full plane** — dedicated Activity, Systems, Repositories, Verification, Services and Connections views.

This minimizes operator supervision load while keeping drill-down one action away.
