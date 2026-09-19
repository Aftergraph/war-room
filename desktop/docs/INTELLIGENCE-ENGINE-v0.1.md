# AFTERGRAPH / WAR ROOM — Operational Intelligence Engine v0.1

Status: **experimental ranking layer**. It is not a verifier, policy engine, authority source, or claim of AGI.

## Goal

Turn live system evidence into a small, explainable queue of operator attention candidates while preserving Aftergraph's core invariants:

- unknown is not healthy,
- model output is not evidence,
- recommendation is not execution,
- ranking cannot grant authority,
- agent completion is not a verified outcome.

## Control loop

```text
Observe
  ↓
Normalize current GitHub / CI / probe state
  ↓
Feature extraction
  ↓
Signal fusion
  ↓
Constrained logistic attention ranker
  ↓
Explain top contributing signals
  ↓
Human feedback: Relevant / Noise
  ↓
Online logistic update
  ↺
```

The loop changes **ranking weights only**. It cannot mutate AIE policy, credentials, mission state, verification state, or external systems.

## Feature vector

Each repository can expose the following bounded features in `[0,1]`:

| Feature | Meaning |
|---|---|
| `ci_failure` | latest observed workflow failed |
| `repeat_failure` | density of recent workflow failures |
| `service_degraded` | direct HTTP probe for the owning domain is degraded/down |
| `unverified_change` | recent source activity without a recent successful workflow observation |
| `source_gap` | incomplete private/live observation coverage |
| `freshness_gap` | current GitHub observation exceeds expected refresh freshness |
| `issue_pressure` | normalized open-issue pressure |
| `activity_velocity` | normalized 24h event rate |
| `recent_change` | recency of code activity |

## Initial model

The initial model is an interpretable expert prior, not a calibrated probability model.

```text
z = bias + Σ(weight_i × feature_i)
risk_score = sigmoid(z)
```

The current prior gives deterministic failures and direct service degradation the largest positive weights. Missing source coverage lowers confidence rather than turning absence into a green state.

`priority_score` combines the model risk score, evidence confidence, and urgency. The UI labels it **priority**, not probability.

## Online learning

Human feedback supplies a binary ranking label:

- `Relevant` → this candidate deserved operator attention.
- `Noise` → this candidate should have been ranked lower.

The engine applies constrained online logistic regression with small L2 shrinkage. Weights are bounded to avoid one label causing extreme policy-like behavior. Feedback is persisted locally in `intelligence-model.json`.

Learning states:

- `prior-only` — no human labels yet,
- `online-learning` — 1–19 labels,
- `feedback-trained` — 20+ labels.

The term `feedback-trained` intentionally does **not** claim calibrated probabilities or external generalization.

## Why this architecture

War Room needs a bridge between raw telemetry and autonomous execution. The safe bridge is an **observation → ranking → explanation** layer, not an LLM that silently starts acting.

The design borrows three proven patterns:

1. long-running agents benefit from structured state and incremental progress rather than one-shot execution,
2. automated evaluators can guide search and improvement when the objective can be measured,
3. agent systems require evals and evidence before increasing autonomy.

The implementation therefore makes learning subordinate to deterministic evidence and human authority.

## Next research gates

Before any stronger autonomy claim:

1. collect labelled attention outcomes,
2. measure precision@k / recall@k and calibration error,
3. compare the learned ranker against the fixed prior,
4. run replay evaluation over historical incidents,
5. test drift and adversarial features,
6. measure operator minutes saved and false-negative cost,
7. only then consider bounded automatic dispatch into a governed mission queue.

