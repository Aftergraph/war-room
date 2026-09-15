# Aftergraph War Room

> **Unified Autonomous Intelligence Operating Environment & Human Control Plane**
> Observing, understanding, authorizing, and verifying autonomous work across 30 repositories, compute nodes (Jonas Lenovo Yoga & Hetzner VDS), agent fleets, and external integrations without inventing canonical state.

```text
Observe → Normalize → Correlate → Reason → Prioritize
        → Authorize → Execute → Evidence → Verify
```

---

## 🏛️ Architecture

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

## 🎛️ The 6 Core Domains

1. **01 SYSTEM REALITY**: Dynamic 30-repo polyrepo inventory (28 canonical + 2 fixtures), deployments (`aftergraph.org`, `app.aftergraph.org`, `docs.aftergraph.org`), and 8 canonical epistemic statuses.
2. **02 MISSIONS & WORKGRAPH**: Mission Control, budget tracking, SPEC-001 verifications, and interactive WorkGraph DAG execution canvas.
3. **03 AGENTS & COMPUTE**: Agent fleet, live Lenovo Yoga & Hetzner VDS hardware telemetry, and real-time **Collision Radar**.
4. **04 TRUST & AUTHORITY**: Fail-closed Trust Gateway, Active Learning (Human Oracle) triage, Bayesian risk model, and cross-repo blast-radius matrix.
5. **05 EVIDENCE & TIME MACHINE**: Cryptographic SHA-256 HashChain ledger, exact-HEAD Sentinel radar (with automatic invalidation to `STALE`), and historical snapshot scrubber.
6. **06 INCIDENTS & ATTENTION**: Global Attention Queue ("Needs You"), deterministisk "While You Were Away" briefing, and Emergency Bot Quarantine killswitch.

---

## 🚀 Getting Started

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
# Run the complete testing pyramid (17/17 tests passing)
node tests/run-all.js

# Run quick assertion self-check (8/8 checks passing)
node check.js
```

---

## 🤖 Bot & Hardware Integrations

- **[BOT_INTEGRATION_SPEC.md](BOT_INTEGRATION_SPEC.md)**: Standard HTTP API specification for registering bots and checking intent with Collision Radar.
- **[TELEGRAM_BOT_PROMPT.md](TELEGRAM_BOT_PROMPT.md)**: Operational prompt for @AftergraphWatchdogBot.
- **[AGENTS.md](AGENTS.md)**: Canonical Agent Execution Contract (Aftergraph AIE 2.0).
- **[bot-runner.js](integrations/telegram/bot-runner.js)**: Runnable Telegram bot gateway daemon.
- **[bridge-client.js](services/node-bridge/bridge-client.js)**: Runnable hardware bridge telemetry client.

---

## 📄 License
Internal Aftergraph Infrastructure — Governed by Aftergraph AIE Standards.
