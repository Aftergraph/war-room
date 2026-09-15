# Aftergraph War Room — Canonical Agent Execution Contract
<!-- Generated according to Aftergraph Agentic Institution Engineering (AIE) standard. Revision 2.0. -->

## 1. Project Identity

  Name        Aftergraph War Room (Autonomous Intelligence Operating Environment)
  Role        Human Control & Observability Plane across 30 Polyrepos, Compute & Agents
  Purpose     Observe, correlate, reason, prioritize, authorize, execute, evidence, and verify autonomous work across code, compute, agents, and external integrations without inventing canonical state.
  Stack       Node.js (Pure stdlib REST/SSE BFF), Vanilla Web Cockpit (HTML5, CSS3, JS), Append-only WAL persistence.
  Endpoint    http://localhost:3333

---

## 2. Mandatory Agent Invariants (Strictly Enforced)

1. **The Ponytail Rule**:
   - The best code is the code never written. Minimal diffs, zero unnecessary abstractions, zero bloated external frameworks.
   - Deletion over addition. Boring over clever. Fewest files possible.
   - Every non-trivial logic change leaves ONE runnable test behind.

2. **Trust Gateway (TG) Fail-Closed Separation**:
   - Work Intelligence (WI) proposes actions; Trust Gateway authorizes them.
   - No autonomous agent may execute consequential operations (mutating contracts, merging PRs, deploying platforms, or terminating jobs) without an ephemeral Trust Gateway ticket (`POST /api/auth/ticket`).

3. **Collision Radar Pre-Flight Requirement**:
   - Before acquiring locks or modifying branches/files/contracts, every agent **MUST** declare intent via `POST /api/agents/intent`.
   - If collision risk $\ge 0.70$, the agent must halt, rebase on HEAD, or defer to the lease holder.

4. **Exact-HEAD Sentinel Binding**:
   - Sentinel verification verdicts must be bound to the exact commit SHA.
   - If HEAD advances, the verification is automatically demoted to `STALE`. Never claim green `VERIFIED` on an outdated HEAD.

5. **Secrets-Safe Storage**:
   - Zero raw credentials or tokens stored in browser `localStorage`.
   - Credentials exist only as short-lived, HMAC-signed capability bindings issued by the Credential Broker.

6. **Compute Bridge Telemetry**:
   - Node bridges (Lenovo Yoga and Hetzner VDS) must provide signed hardware heartbeats (`POST /api/agents/heartbeat`) and reject unpermitted arbitrary shell execution (`ALLOWED_COMMANDS = ['job.inspect', 'job.stop', 'agent.restart', 'service.health', 'logs.read']`).

---

## 3. Local Verification Commands

```bash
# Run full automated test pyramid (Contracts, Idempotency, Collision, Sentinel, E2E)
node tests/run-all.js

# Start/run Full War Room Server (Port 3333)
node server.js
```

---

## 4. Bot & Integration References

- [BOT_INTEGRATION_SPEC.md](file:///C:/Users/empir/.gemini/antigravity-ide/scratch/aftergraph-watchtower/BOT_INTEGRATION_SPEC.md): Full HTTP API signature specification for registering bots and checking collisions.
- [TELEGRAM_BOT_PROMPT.md](file:///C:/Users/empir/.gemini/antigravity-ide/scratch/aftergraph-watchtower/TELEGRAM_BOT_PROMPT.md): System prompt & command specification for @AftergraphWatchdogBot.
- [implementation_plan.md](file:///C:/Users/empir/.gemini/antigravity-ide/scratch/aftergraph-watchtower/implementation_plan.md): Full-stack architectural plan across Waves W0 to W15.
