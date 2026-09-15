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
│  │ EGAC (Evidence-Gated Autonomy Controller) — Provable FCR Bound           │ │    │
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
4. **04 TRUST & AUTHORITY**: Fail-closed Trust Gateway, Active Learning (Human Oracle) triage, EGAC evidence-gated autonomy with provable FCR bound, and cross-repo blast-radius matrix.
5. **05 EVIDENCE & TIME MACHINE**: Cryptographic SHA-256 HashChain ledger, exact-HEAD Sentinel radar (with automatic invalidation to `STALE`), and historical snapshot scrubber.
6. **06 INCIDENTS & ATTENTION**: Global Attention Queue ("Needs You"), "While You Were Away" briefing, Emergency Bot Quarantine killswitch, and Palantir AIP-style Decision Inbox with 1-click Authorize/Reject.

---

## EGAC — Evidence-Gated Autonomy Controller

The core algorithm that governs autonomous execution across all 31 repos. Grounded in the VAIE research program and MISSION-Bench STUDY-008 empirical results (275 runs, 7 conditions, 3 models).

### How it works

```
Prior P(Defect|plane) → Sequential Bayesian Update → Posterior P(Defect|evidence)
                         ↓
                    FCR Bound = Product(1 - sensitivity_t_i)
                         ↓
                    Decision: AUTONOMOUS / HUMAN_REVIEW / HALT
```

### Evidence Tiers

| Tier | Class | Sensitivity | Specificity |
|------|-------|-------------|-------------|
| tier_0 | self_assertion | 0.10 | 0.95 |
| tier_1 | model_judgment | 0.45 | 0.90 |
| tier_2 | deterministic_test | 1.00 | 1.00 |
| tier_3 | provider_receipt | 0.95 | 1.00 |
| tier_4 | independent_observation | 0.90 | 1.00 |
| tier_5 | cryptographic_attestation | 1.00 | 1.00 |
| tier_6 | human_approval | 0.98 | 1.00 |

### Provable properties

- **FCR = 0** for tier_2-only evidence (deterministic gate is fail-closed)
- **FCR monotonicity**: adding evidence never increases FCR
- **Tier dominance**: higher tiers weakly dominate lower
- **Self-assertion safety**: tier_0 alone never permits AUTONOMOUS_EXECUTION

### Empirical validation (STUDY-008)

| Condition | FCR | VSR |
|-----------|-----|-----|
| A (baseline) | 56% | 44% |
| G (full mission contract) | 0% | 84% |

VSR improvement: +40 percentage points. FCR reduction: 90% → 0%.

See `packages/egac/SPECIFICATION.md` for the formal specification with proofs.

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
| `POST /api/auth/ticket` | Trust Gateway scoped ticket |
| `POST /api/ingest` | Ingest observation envelope |
| `POST /api/commands/dispatch` | Governed command execution |
| `POST /api/telegram/webhook` | Telegram bot webhook |
| `POST /api/org/sync` | Trigger live GitHub org sync |
| `POST /api/ontology/decisions/:id/action` | Approve/Reject decision |
| `POST /api/egac/decide` | EGAC autonomy decision |
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

# Run EGAC proof suite (10/10 mathematical proofs)
node packages/egac/tests/proof-suite.js

# Validate EGAC against MISSION-Bench STUDY-008 (275 runs)
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
│   │   ├── SPECIFICATION.md        — Formal spec with mathematical proofs
│   │   ├── src/index.js            — Evidence-Gated Autonomy Controller
│   │   └── tests/
│   │       ├── proof-suite.js      — 10 proof tests
│   │       └── validate-mission-bench.js — 275-run empirical validation
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
├── security/src/credentialBroker.js — Trust Gateway credential broker
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
- **MISSION-Bench**: Ablation ladder (Conditions A-G) with 275 runs across 3 models, statistical analysis with Wilson CI, Cohen's h, McNemar test
- **EGAC**: Evidence-Gated Autonomy Controller — replaces heuristic risk with provable FCR-bounded autonomy

Key research repos:
- `Aftergraph/intelligence-systems-research` — Research agenda, experiment design, MISSION-Bench
- `Aftergraph/after-graph-governance` — Canonical contracts, `latest-org-state.json`
- `Aftergraph/war-room` — This repository

---

## License
Internal Aftergraph Infrastructure — Governed by Aftergraph AIE Standards.
