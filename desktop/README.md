# AFTERGRAPH / WAR ROOM Desktop v1.6.14

Portable Windows x64 operator environment for **live, evidence-bounded Aftergraph system reality**.

v1.6.14 is the **governed updater foundation** line. It keeps v1.6.13 runtime authority unchanged while adding a fail-closed updater helper: signed update-plan verification, pinned production trust roots, state-schema preflight, state snapshot, atomic executable swap, native health smoke, and rollback on failed verification. Automatic updates remain disabled until an approved production release public key is provisioned.

The desktop implementation lives under `desktop/` in the canonical `Aftergraph/war-room` repository. Local ZIPs and chat-generated binaries are evidence inputs only; GitHub merge/tag/release is the official distribution record. Current residual weaknesses are tracked in `docs/WEAKNESSES-AND-RISK-REGISTER.md`.

1. near-live GitHub organization activity and CI reconciliation across the full Aftergraph repository inventory,
2. a read-only execution-presence fabric for WORKS runners and generic Hermes/Vibe/Codex/custom agent heartbeats,
3. a native in-app Aftergraph Assistant grounded in War Room state, with optional local Ollama synthesis.

## Official release governance

- Release history: `CHANGELOG.md`
- Current verification: `VERIFICATION.md`
- Known weaknesses/residual risk: `docs/WEAKNESSES-AND-RISK-REGISTER.md`
- Runtime/build configuration: `docs/CONFIGURATION.md`
- Release/tag/artifact policy: `docs/RELEASE-POLICY.md`
- Canonical GitHub layout/workflow: `docs/GITHUB-OFFICIALIZATION.md`

A release is not official until the exact reviewed commit passes the mandatory GitHub/native gates and is tagged `desktop-vX.Y.Z`.

## Run

Double-click `Aftergraph-War-Room.exe`.

The application binds its Go control plane to `127.0.0.1` only and opens an app-mode desktop shell. No Node/Python runtime is required on the target machine.

Runtime state lives under:

`%LOCALAPPDATA%\Aftergraph\WarRoom\`

## UI Stability Track

The browser now consumes an explicit semantic observation mode: `unknown`, `snapshot`, `stale`, `offline`, `reconnecting`, `connecting`, or `live`. Motion engines receive that same mode, so decorative activity cannot upgrade a snapshot or stale observation into live truth. Reconnect performs canonical state reconciliation, concurrent refreshes are coalesced, unknown agent states remain inactive/unknown, modal focus follows one shared dialog contract, topology has keyboard/non-drag controls, and frontend resources have deterministic cleanup.

Strict CSP remains intact. Dynamic progress/meter widths are applied through bounded CSSOM values rather than inline style attributes, and the release build now rejects new inline `style=` attributes in JS/HTML.

See `docs/UI-STABILITY-TRACK.md` for the parallel stabilization track and its native evidence gates.

## Live GitHub system reality

With a read-only fine-grained GitHub token configured under `Connections`, War Room reconciles the organization inventory, PRs, issues, commits and GitHub Actions workflow runs at the configured interval. Authenticated mode can observe private repositories; unauthenticated mode deliberately slows down and retains explicit private-snapshot provenance instead of pretending those repositories are live.

The UI labels this correctly as **near-live REST observation**. It does not claim a push stream when no webhook/event transport exists.

## Agent / worker fabric

War Room now projects execution presence from two bounded sources:

- **WORKS SSE**: consumes the canonical read-only `/v1/ui/events` runner/work stream.
- **Agent Bridge**: authenticated `aftergraph.agent.heartbeat/0.1` heartbeat/event contract for Hermes, Vibe, Codex and custom workers.

Observed sessions expose running/waiting/blocked/stale state, current action, repo/work identity, model/node metadata, progress and last heartbeat. Stale presence fails closed from heartbeat age; no agent is invented merely because its software exists somewhere.

The bridge token is generated locally and stored through the platform secret vault. The bridge can be rotated from Connections.

## Native Aftergraph Assistant

The assistant lives inside the main conversation surface alongside the Digital Twin, Operational Intelligence and Jev.

Its **grounded core is always available** and can answer system questions directly from structured War Room state, including:

- what changed in GitHub,
- current CI failures,
- active/blocked/stale agents and workers,
- repository/domain state,
- topology scope,
- current TypeSafe/Jev decision,
- top Operational Intelligence candidate,
- service/attention state.

Answers can contain interactive structured objects and safe navigation/focus actions.

Optionally, War Room can use a local Ollama model for prose synthesis. The model receives only a bounded JSON projection of current War Room state; its output remains advisory. It cannot grant authority, execute work, or constitute verification evidence.

## Native TypeSafe / Jev

Jev remains a bounded typed decision primitive in the runtime loop after material observed-state changes.

```text
observe → normalize → deterministic rank
                  └→ Jev typed decision fabric
                         ↓
            confidence-aware review routing
```

Calls are constrained by state fingerprinting, minimum interval, daily budget and single-flight execution. The raw API key is never embedded in the release; Windows uses DPAPI current-user encryption.

## Reactive Digital Twin

`Topology` remains the spatial projection of the 33-repository / nine-domain system, and now includes observed agent/worker presence when live telemetry exists.

It includes semantic zoom, pan/focus, Heatmap, Reality Diff, provenance/freshness, graph pulses, adaptive framing and reduced-motion/performance-governed behavior. Mission/agent/evidence edges remain absent when their canonical telemetry is absent.

## Living Surface engine

v1.6 retains the v1.5 reactive/spatial grammar: pointer parallax, bounded tilt, specular sheen, magnetic controls, spring motion, attention/recency decay, ambient risk state, frame-budget governor, battery-aware motion reduction, off-screen suspension, opt-in procedural Web Audio, WCAG contrast diagnostics and color-vision simulation.

The supplied 001–300 capability catalogue remains mapped in `docs/REACTIVE-SPATIAL-CAPABILITY-MATRIX-v1.5.md`; v1.6 adds live execution-presence and assistant surfaces without turning unobserved capabilities into fake animation.

## Core views

- **Now** — assistant conversation, system pulse, live GitHub + agent activity, Needs You, Jev and next move.
- **Activity** — mixed commits / PR / issue / CI / agent timeline.
- **Topology** — reactive spatial digital twin.
- **Agents & workers** — WORKS runners and Agent Bridge sessions/events.
- **Intelligence** — deterministic/learned attention ranking.
- **Systems** — nine operational domains.
- **Repositories** — source/freshness-aware inventory.
- **Evidence** — observed metric ledger.
- **Services** — probes, local compute and execution fabric state.
- **Connections** — GitHub, WORKS, Agent Bridge, Jev and Assistant configuration.

## Evidence boundary

```text
observation != inference
inference != evidence
model confidence != verification
assistant answer != authority
attention routing != authority
completion != verified outcome
```

War Room is an operational projection/control surface. It does not become a new canonical truth owner merely because it can visualize or discuss the whole system.
