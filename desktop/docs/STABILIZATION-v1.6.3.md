# War Room v1.6.3 — Stabilization Pass III

This release intentionally adds no operator-facing feature surface. It reduces subsystem coupling and hardens persistence/provider observability before any v1.7 expansion.

## Behavior-preserving subsystem splits

The four largest mixed-responsibility files were decomposed while keeping package-level behavior and public API contracts unchanged:

- `typesafe_client.go` — Jev wire contract and response decoding.
- `typesafe_policy.go` — bounded evaluation policy, fingerprinting and provider classification.
- `typesafe_api.go` — credential/evaluation HTTP surface.
- `intelligence_model.go` — model/persistence/feature primitives.
- `intelligence_eval.go` — deterministic feature extraction and scoring.
- `intelligence_learning.go` — online feedback update path.
- `assistant_api.go` — status/query HTTP boundary.
- `assistant_grounded.go` — deterministic grounded planner/renderer.
- `assistant_ollama.go` — optional local-model adapter.
- `github_client.go` — REST transport, retry and rate state.
- `github_reconcile.go` — organization/activity reconciliation.
- `github_workflows.go` — bounded concurrent workflow collection.

## Persistence journal

All Store JSON replacements now pass through one serialized persistence journal. The write path is:

`tmp write + fsync -> journal(prepared) -> primary->backup -> journal(primary-backed-up) -> tmp->primary -> journal(committed) -> directory fsync -> journal clear`

Startup recovery is conservative: an existing primary wins; if the primary disappeared during replacement but a backup exists, the backup is restored. Orphaned temporary files are removed. Recovery rejects invalid journal targets.

Regression tests cover an interrupted `primary -> backup` replacement and a crash after the new primary was already committed.

## Provider observability

GitHub reconciliation now exports request, retry and backoff counters plus the most recent provider error class into the observed GitHub snapshot. TypeSafe/Jev decisions expose a bounded provider error classification without changing the no-auto-retry POST invariant.

Current classifications include `network`, `timeout`, `auth`, `rate-limit`, `server`, `client`, `protocol`, and `network-or-provider` where exact attribution is not supported.

## Coverage

Statement coverage increased from 55.2% to 55.9%. The increase is small by design: this pass prioritized architecture boundaries, persistence crash recovery, and provider telemetry rather than low-value line coverage.
