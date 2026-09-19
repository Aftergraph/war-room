# War Room v1.6.1 — Stabilization Pass

This patch intentionally adds no major product surface. It hardens the v1.6 runtime before further capability work.

## Correctness fixes

- Agent state updates are now atomic read-modify-write operations. Concurrent WORKS SSE, Agent Bridge heartbeats and agent events can no longer overwrite each other with stale snapshots.
- Store getters now return defensive copies for mutable GitHub/settings collections. Callers cannot accidentally mutate canonical in-memory state outside Store locking.
- JSON mutation endpoints reject trailing JSON values instead of silently accepting the first value.

## Lifecycle / reliability

- Background TypeSafe work and assistant probing are bound to the application lifecycle instead of detached `context.Background()` work.
- WORKS reconnect/backoff waits are cancellation-aware; shutdown no longer waits on fixed sleeps.
- Browser launch delay is cancellation-aware.
- HTTP server now has explicit header timeout, idle timeout and header-size bound while preserving long-lived SSE.
- Logging safely falls back to `io.Discard` if the log file cannot be opened instead of retaining a nil writer.

## Regression evidence

- New alias-isolation tests for Store snapshots.
- New concurrent agent/event test exercises 80 concurrent updates and asserts no lost sessions/events.
- New lifecycle wait cancellation test.
- New strict JSON framing test.

## Known debt after this pass

- Statement coverage is 45.4%; critical HTTP handlers and provider failure paths need additional integration coverage before v1.7.
- `app.go`, `agents.go`, `intelligence.go` and `typesafe.go` remain large and should be split by bounded subsystem only after behavior is pinned by tests.
- Provider clients still need explicit retry/backoff policy tests and injected transports for deterministic failure simulation.
- Persistence is atomic at file-replace level but not journaled across multiple state files.
