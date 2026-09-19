# War Room v1.6.2 — Stabilization Pass II

This release intentionally adds no major product surface. It continues the v1.6.x hardening track before any v1.7 feature work.

## Correctness and state ownership

- Store ownership is now deep, not shallow: metric labels, agent capabilities and agent/event metadata are cloned on write and read.
- Settings responses return the canonical clamped state actually persisted, not the pre-validation request body.
- All JSON mutation routes in the core API use strict one-value decoding; trailing JSON and unknown fields fail closed.
- Health, summary and SSE stream endpoints now enforce GET semantics explicitly.

## Persistence recovery

- State files use a durable generation pattern: write + fsync temporary file, retain previous generation as `.bak`, then replace the primary.
- Startup reads automatically fall back to the last valid backup when the primary is missing or corrupt.
- Regression tests cover corrupt-primary recovery, interrupted-replace recovery and previous-generation retention.

This is not yet a multi-file transaction journal. Cross-file atomicity remains deferred.

## Provider reliability and deterministic testing

- GitHub REST transport is injectable and now retries bounded, idempotent GET failures only (network errors and 429/502/503/504), with cancellation-aware exponential backoff and `Retry-After` support.
- Permanent GitHub failures do not retry.
- TypeSafe/Jev transport is injectable; POST evaluation deliberately does **not** auto-retry because a duplicate evaluation can incur duplicate provider cost.
- WORKS validation/SSE, Ollama assistant calls and service probes now expose injected transports for deterministic failure simulation.
- Tests pin authorization headers, transient/permanent retry behavior, canceled contexts, WORKS SSE projection, local-model fallback and probe classification.

## Code structure

Behavior-preserving extraction reduced large multi-role files:

- `app.go` → core application/state helpers
- `api_handlers.go` → HTTP API handlers
- `runtime.go` → lifecycle/background/server runtime
- `agents.go` → agent state model/core
- `agents_api.go` → Agent Bridge + WORKS connection API
- `works_connector.go` → WORKS SSE client/projection

This removes two major mixed-responsibility files without introducing new abstractions or runtime dependencies.

## Verification movement

Statement coverage moved from **45.4% in v1.6.1 to 55%+ in v1.6.2** while adding failure-path tests rather than snapshot-only coverage.

## Remaining stabilization debt

- `typesafe.go`, `intelligence.go`, `assistant.go` and `github.go` remain large and need behavior-pinned extraction.
- Persistence has single-file recovery generations, not a cross-file WAL/transaction journal.
- GitHub retry telemetry is not yet exported as first-class metrics.
- Full chaos tests for process kill during state replacement are still pending.
- Windows-native 120/144 Hz, forced-colors and sustained SSE/provider profiling remain pending on Lenovo.
