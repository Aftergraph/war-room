# Aftergraph War Room

> **Unified Autonomous Intelligence Operating Environment & Human Control Plane**
> Observing, understanding, authorizing, and verifying autonomous work across 31 repositories, compute nodes (Jonas Lenovo Yoga & Hetzner VDS), agent fleets, and external integrations without inventing canonical state.

```text
Observe → Normalize → Correlate → Reason → Prioritize
        → Authorize → Execute → Evidence → Verify
```

---

## Architecture

```text
┌──────────────────────────────── AFTERGRAPH WAR ROOM ────────────────────────────────┐
│                                                                                     │
│  Web/PWA ── Command Palette ── Graph Explorer ── Mission Control ── Incident UI     │
│       │                                                                             │
│       └────────────────────── War Room API / BFF ───────────────────────────────┐    │
│                                                                                │    │
│  ┌──────────────────── REALTIME / QUERY / COMMAND PLANE ─────────────────────┐ │    │
│  │ REST/GraphQL-ish Query API │ SSE/WS │ Search │ Commands │ Subscriptions   │ │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘ │    │
│                                     │                                            │    │
│  ┌────────────────────────── INTELLIGENCE PLANE ──────────────────────────────┐ │    │
│  │ Correlation │ Risk │ Anomaly │ Collision │ Attention │ Briefing │ Drift  │ │    │
│  │ EGAC (Evidence-Gated Autonomy Controller) — Advisory Evidence Model           │ │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘ │    │
│                                     │                                            │    │
│  ┌────────────────────────── ONTOLOGY PLANE ──────────────────────────────────┐ │    │
│  │ Decision Objects │ Reality Diff │ Why Graph │ Trust Passports (L1-L4)     │ │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘ │    │
│                                     │                                            │    │
│  ┌──────────────────────────── STATE / GRAPH PLANE ────────────────────────────┐ │    │
│  │ Entities │ Relations │ Events │ Evidence │ Snapshots │ Projections │ FTS  │ │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘ │    │
│                                     │                                            │    │
│  ┌──────────────────────────── INGESTION FABRIC ───────────────────────────────┐ │    │
│  │ Adapters → Envelope → Validate → Dedupe → Correlate → Persist → Project   │ │    │
│  └──────────┬───────────────┬──────────────┬───────────────┬───────────────────┘ │    │
└─────────────┼───────────────┼──────────────┼───────────────┼─────────────────────┘
              │               │              │               │
           GitHub          Telegram      VDS Bridge      Lenovo Bridge
              │               │              │               │
              ├───────────────┴──────────────┴───────────────┤
              │                                               │
              ▼                                               ▼
       AFTERGRAPH CORE                                EXTERNAL INTEGRATIONS
 WI → TG → WORKS → Runtime → Evidence → Sentinel     Gmail / Calendar / Drive
 AIE / AFM / Model Registry / Continuity             Supabase / Cloudflare / MCP
```

---

## The 6 Core Domains

1. **01 SYSTEM REALITY**: Dynamic 31-repo polyrepo inventory with live GitHub sync, interactive topology mesh (7 planes), 30-repo grid view, and Operational Twin diff (Expected vs Observed HEAD SHAs).
2. **02 MISSIONS & WORKGRAPH**: Mission Control, budget tracking, SPEC-001 verifications, and interactive WorkGraph DAG execution canvas.
3. **03 AGENTS & COMPUTE**: Agent fleet, live Lenovo Yoga & Hetzner VDS hardware telemetry, real-time Collision Radar, and Agent Trust Passports (L1 Observer → L4 Autonomous).
4. **04 TRUST & AUTHORITY**: Trust Gateway/Relay authority boundary, Active Learning triage, EGAC advisory research signals, and cross-repo blast-radius analysis.
5. **05 EVIDENCE & TIME MACHINE**: Cryptographic SHA-256 HashChain ledger, exact-HEAD Sentinel radar (with automatic invalidation to `STALE`), and historical snapshot scrubber.
6. **06 INCIDENTS & ATTENTION**: Global Attention Queue ("Needs You"), "While You Were Away" briefing, quarantine proposals, and a Decision Inbox that routes consequential actions to canonical authority/control services.

---

## EGAC — Evidence-Gated Autonomy Controller

EGAC v1 is an **advisory research model only**. It does not govern execution, mint authority, or substitute for AIE / Trust Gateway / Relay. Its current tier sensitivities, specificities and plane priors are provisional model parameters rather than universal empirical estimates.

### Current evidence status

The canonical research audit classifies STUDY-008 as `METHODOLOGICAL_PILOT`: **275 attempted runs = 2 LIVE_VALID, 9 provider failures, 264 simulated**. Condition-level FCR/VSR values derived from the simulation-dominated dataset are useful for method development, not inferential claims about live model performance.

### Advisory flow

```
Provisional prior → sequential model update → advisory defect estimate
                         ↓
          legacy miss-rate product under stated assumptions
                         ↓
             RECOMMEND_AUTOMATION / HUMAN_REVIEW / HALT
                         ↓
                 authority = NONE
```

The multiplicative miss-rate model requires dependence/coverage assumptions that are not established by STUDY-008. A zero model product is therefore **not** exposed as a formal proof of real-world false-completion rate.

### Safety boundary

- `tier_0` self-assertion alone cannot recommend automation under the default strict threshold.
- Every EGAC result carries `advisoryOnly: true` and `authority: NONE`.
- Consequential actions still require the canonical Relay / Trust Gateway authority path.
- Deterministic tests become strong evidence only relative to a defined claim and oracle profile; `tier_2` is not universally perfect.

See `packages/egac/SPECIFICATION.md` for model details and limitations.

---

## API Endpoints

### Query Plane (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server health, uptime, SSE clients |
| `GET /api/org/summary` | Full state summary with telemetry |
| `GET /api/repos` | 31 repos with governance classification |
| `GET /api/missions` | Active missions |
| `GET /api/agents` | Agent fleet |
| `GET /api/telemetry` | Lenovo + VDS hardware telemetry |
| `GET /api/events` | Event store (latest N) |
| `GET /api/timemachine` | Historical state replay |
| `GET /api/wywa` | "While You Were Away" briefing |
| `GET /api/search` | Cross-entity search |
| `GET /api/radar/collisions` | Collision radar state |

### Ontology Plane (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /api/ontology/decisions` | Decision Inbox items |
| `GET /api/ontology/reality-diff` | Expected vs Observed drift |
| `GET /api/ontology/why-graph` | Causal reasoning DAG |
| `GET /api/ontology/trust-passports` | Agent autonomy passports (L1-L4) |

### EGAC Plane (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /api/egac/status` | Engine config, tiers, priors, calibration |
| `GET /api/egac/fcr?tiers=tier_2,tier_1` | FCR bound for given tiers |

### Command Plane (POST)

| Endpoint | Description |
|----------|-------------|
| `POST /api/agents/register` | Register bot/agent in fleet |
| `POST /api/agents/intent` | Pre-flight collision check |
| `POST /api/agents/heartbeat` | Telemetry heartbeat |
| `POST /api/auth/ticket` | Disabled locally (`503`); War Room does not mint Trust Gateway authority |
| `POST /api/ingest` | Ingest observation envelope |
| `POST /api/commands/dispatch` | Fail-closed (`503`) until canonical Relay/TG execution adapter is wired |
| `POST /api/telegram/webhook` | Telegram bot webhook |
| `POST /api/org/sync` | Trigger live GitHub org sync |
| `POST /api/ontology/decisions/:id/action` | Fail-closed (`503`); decision proposals require canonical authority path |
| `POST /api/egac/decide` | EGAC advisory recommendation (`authority: NONE`) |
| `POST /api/egac/calibrate` | Online calibration recording |

### Realtime (SSE)

| Endpoint | Description |
|----------|-------------|
| `GET /api/realtime/stream` | Server-Sent Events stream |

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Zero external package dependencies needed (pure Node.js stdlib).

### Quickstart
```bash
# Start the Full War Room Server & Operator Cockpit
node server.js
```
Open **`http://localhost:3333`** in your browser.

### Verification & Automated Testing
```bash
# Run the complete acceptance suite (21/21 tests passing)
node tests/run-all.js

# Run quick assertion self-check (8/8 checks passing)
node check.js

# Run EGAC model-property suite (advisory assumptions, not authority proofs)
node packages/egac/tests/proof-suite.js

# Check EGAC model behavior against STUDY-008 mixed pilot data
node packages/egac/tests/validate-mission-bench.js
```

---

## Project Structure

```
aftergraph-watchtower/
├── apps/api/src/server.js          — API server + SSE + static serving
├── algorithms.js                   — 10 core algorithms (risk, anomaly, hashchain, collision)
├── app.js                          — Operator cockpit frontend orchestrator
├── index.html                      — Cyber cockpit HTML
├── styles.css                      — Military-grade dark theme
├── check.js                        — 8-check self-verification
├── seed-data.json                  — Initial bootstrapping data
├── packages/
│   ├── egac/
│   │   ├── SPECIFICATION.md        — Advisory model specification and assumptions
│   │   ├── src/index.js            — Evidence-Gated Autonomy Controller
│   │   └── tests/
│   │       ├── proof-suite.js      — 10 model-property tests
│   │       └── validate-mission-bench.js — mixed-pilot methodological check
│   ├── ontology/src/index.js       — Palantir AIP operational ontology
│   ├── contracts/src/observation.js — ObservationEnvelope schema
│   ├── domain/src/                  — Domain entities & relations
│   └── adapters/src/base.js        — Base adapter class
├── services/
│   ├── intelligence/src/index.js   — 7 algorithmic engines + EGAC
│   ├── persistence/src/store.js    — Event store with WAL & dedup
│   ├── projection/src/projector.js — State projector with live repo updates
│   ├── ingestion/src/pipeline.js   — Ingestion pipeline
│   └── node-bridge/                — Hardware telemetry bridges
├── integrations/
│   ├── github/src/adapter.js       — Live GitHub org sync (31 repos)
│   └── telegram/                   — Telegram bot gateway
├── security/src/credentialBroker.js — local credential metadata broker (authority minting disabled)
└── tests/run-all.js                — 21-test acceptance suite
```

---

## Bot & Hardware Integrations

- **[BOT_INTEGRATION_SPEC.md](BOT_INTEGRATION_SPEC.md)**: Standard HTTP API specification for registering bots and checking intent with Collision Radar.
- **[TELEGRAM_BOT_PROMPT.md](TELEGRAM_BOT_PROMPT.md)**: Operational prompt for @AftergraphWatchdogBot.
- **[AGENTS.md](AGENTS.md)**: Canonical Agent Execution Contract (Aftergraph AIE 2.0).
- **[bot-runner.js](integrations/telegram/bot-runner.js)**: Runnable Telegram bot gateway daemon.
- **[bridge-client.js](services/node-bridge/bridge-client.js)**: Runnable hardware bridge telemetry client.

---

## Research Foundation

This system is grounded in the Aftergraph Intelligence Systems Engineering research program:

- **VAIE** (Verified Adaptive Intelligence Engineering): Intent → Mission → State → Execution → Assurance → Evidence → Verified Outcome
- **MISSION-Bench**: STUDY-008 methodological pilot (2 LIVE_VALID / 9 provider failures / 264 simulated) plus simulation-supported ablation analysis
- **EGAC**: Evidence-Gated Autonomy Controller — advisory evidence model with an explicit non-authority boundary

Key research repos:
- `Aftergraph/intelligence-systems-research` — Research agenda, experiment design, MISSION-Bench
- `Aftergraph/after-graph-governance` — Canonical contracts, `latest-org-state.json`
- `Aftergraph/war-room` — This repository

---

## License
Internal Aftergraph Infrastructure — Governed by Aftergraph AIE Standards.

---

## Desktop operator client

The Windows x64 operator client is maintained as an official component under [`desktop/`](desktop/README.md). It is a separate implementation surface from the repository-root Node control plane, not a replacement or competing source of truth.

Desktop releases use the tag namespace `desktop-vX.Y.Z`. Release governance, configuration, verification evidence, known weaknesses, and security/toolchain gates are versioned with the desktop source. Compiled Windows binaries are published as GitHub Release assets rather than committed to the source tree.

See [`desktop/docs/GITHUB-OFFICIALIZATION.md`](desktop/docs/GITHUB-OFFICIALIZATION.md) and [`desktop/docs/RELEASE-POLICY.md`](desktop/docs/RELEASE-POLICY.md).
