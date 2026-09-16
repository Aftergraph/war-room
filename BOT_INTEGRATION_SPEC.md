# Aftergraph War Room — Bot & Agent Integration Specification
<!-- Revision 2.0. Canonical Integration Contract for Autonomous Bots & Telemetry Bridges -->

This document specifies how **any bot** (Telegram bot, Discord bot, CLI agent, Forge worker, Codex reviewer, Hermes dispatcher, or Claude/Gemini instance) registers with and coordinates through the **Aftergraph War Room Radar** on `http://localhost:3333` (or your production War Room BFF endpoint).

---

## 1. Core Principles

1. **Observe, Don't Invent**: Bots observe and act, but canonical authority is governed by Trust Gateway (TG).
2. **Pre-flight Intent Declaration**: Before acquiring locks or modifying branches/files/contracts, bots **MUST** declare their intent to the **Collision Radar** (`POST /api/agents/intent`).
3. **Exact-HEAD Binding**: Any verification (e.g. Sentinel, CI/CD, test suite) must be linked to the **exact commit SHA**. If the commit SHA advances, the verification is automatically invalidated.
4. **Secrets-Safe Execution**: Bots **NEVER** hold long-lived root credentials and War Room **never mints execution authority**. Consequential actions must use the canonical Relay / Trust Gateway authority path. The local `POST /api/auth/ticket` endpoint is deliberately fail-closed.

---

## 2. API Endpoints for Bots

Base URL: `http://localhost:3333` (or `WAR_ROOM_URL`)

### `POST /api/agents/register`
Registers the bot in the **Agent Fleet**.

**Request Body:**
```json
{
  "agentId": "telegram-watchdog-bot",
  "name": "Telegram Watchdog & Command Gateway",
  "role": "Messaging & Operator Alerts",
  "machineId": "vds-eu-central-01",
  "capabilities": ["messages:send", "alerts:route", "operator.command"],
  "authorityBindings": ["tg.operator.proxy"]
}
```

**Response (200 OK):**
```json
{
  "status": "REGISTERED",
  "agentId": "telegram-watchdog-bot",
  "fleetSize": 6,
  "registeredAt": "2026-09-15T17:35:00.000Z"
}
```

---

### `POST /api/agents/intent` (Collision Radar Pre-Flight Check)
**MANDATORY before mutating shared repositories, branches, contracts, or files.**

**Request Body:**
```json
{
  "agentId": "forge-worker-02",
  "machineId": "vds-eu-central-01",
  "repo": "trust-gateway",
  "branch": "feat/egress-sanitization",
  "files": ["runtime/policy.ts", "security/audit.ts"],
  "contracts": ["policy.token/2"],
  "durationMinutes": 15
}
```

**Response (200 OK - Clean):**
```json
{
  "status": "APPROVED",
  "collisionRisk": 0.12,
  "level": "NOMINAL",
  "conflicts": [],
  "intentId": "intent_forge-worker-02_1789493500",
  "recommendation": "PROCEED: No overlapping branches or contracts detected."
}
```

**Response (200 OK - Collision Alert):**
```json
{
  "status": "COLLISION_WARNING",
  "collisionRisk": 0.88,
  "level": "HIGH",
  "conflicts": [
    {
      "agent": "Codex-4",
      "repo": "trust-gateway",
      "commonFiles": ["runtime/policy.ts"],
      "commonContracts": ["policy.token/2"],
      "recommendation": "HALT_AND_REBASE: Agent 'Codex-4' is currently editing 'runtime/policy.ts' on branch 'feat/policy-v2'."
    }
  ]
}
```

---

### `POST /api/auth/ticket` (Disabled Local Authority Surface)
War Room does not issue Trust Gateway credentials. This compatibility endpoint is fail-closed until a canonical Relay / Trust Gateway adapter is explicitly wired.

**Request Body:**
```json
{
  "actorId": "telegram-watchdog-bot",
  "capability": "job.stop",
  "target": "job_forge_412",
  "ttlSeconds": 300
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "LOCAL_AUTHORITY_DISABLED",
  "required": "canonical Trust Gateway / Relay authority path"
}
```

---

### `POST /api/agents/heartbeat` (Hardware Bridge Telemetry)
Keeps the agent and host node online on the War Room Telemetry bar.

**Request Body:**
```json
{
  "agentId": "hermes",
  "machineId": "lenovo-yoga-local",
  "telemetry": {
    "cpuUsage": 24,
    "ramUsage": 49,
    "activeJobs": 2
  }
}
```

---

### `POST /api/ingest` (Canonical Event Emission)
Emits an observation envelope into the Ingestion Fabric.

**Request Body:**
```json
{
  "schema": "aftergraph.observation/1",
  "id": "obs_unique_uuid",
  "source": {
    "system": "telegram",
    "adapter": "telegram-watchdog-bot",
    "instance": "@AftergraphWatchdogBot"
  },
  "subject": {
    "type": "Action",
    "id": "action_deploy_platform"
  },
  "event": {
    "type": "operator.command_dispatched",
    "occurredAt": "2026-09-15T17:35:00.000Z",
    "observedAt": "2026-09-15T17:35:00.000Z"
  },
  "actor": { "type": "Agent", "id": "JonasAbde" },
  "payload": { "command": "DEPLOY", "target": "aftergraph.org" },
  "freshness": { "observedAt": "2026-09-15T17:35:00.000Z" },
  "integrity": { "digest": "sha256_hex_digest" }
}
```

---

## 3. Python / Node.js Quickstart Client

```javascript
// Node.js Bot Registration Snippet
const http = require('http');

async function checkCollision(intent) {
  const res = await fetch('http://localhost:3333/api/agents/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intent)
  });
  return res.json();
}

// Check before modifying code
const check = await checkCollision({
  agentId: 'my-bot',
  repo: 'studio',
  branch: 'patch-ui',
  files: ['src/App.tsx']
});

if (check.level === 'HIGH') {
  console.error('🚨 Collision Detected! Halting execution:', check.recommendation);
} else {
  console.log('✅ Clean to proceed!');
}
```
