# Live Operations Fabric — v1.6

## Goal

Unify repository activity, CI, worker presence and agent events into one source-bounded operational projection without creating a new authority plane.

## GitHub

Authenticated GitHub REST reconciliation observes organization repositories, PRs, issues, commits and GitHub Actions runs. Private repository observation requires an operator-owned read-only token. The desktop app reports REST reconciliation cadence and provider rate-limit state; it does not label polling as a webhook stream.

## WORKS

War Room consumes the existing read-only WORKS `/v1/ui/events` SSE stream. Runner frames project worker liveness/state; work frames project execution events. War Room never leases, completes or mutates WORKS from this adapter.

## Agent Bridge

Contract: `aftergraph.agent.heartbeat/0.1`.

Endpoints:

- `POST /api/agents/heartbeat`
- `POST /api/agents/event`
- `GET/POST /api/agents/bridge`

Bridge authentication uses a locally generated bearer token stored in the War Room secret vault. Session state is stale when heartbeat age exceeds the configured threshold.

## Projection law

Presence exists only when a heartbeat, WORKS runner frame or explicit event exists. Installed software, repository membership or historical docs are not enough to mark an agent live.
