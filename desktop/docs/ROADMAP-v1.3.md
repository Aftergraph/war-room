# AFTERGRAPH / WAR ROOM — Roadmap after v1.2

## P0 — Make the current intelligence loop scientifically useful

- [ ] Add durable time-series snapshots for repository, CI, service and host features.
- [ ] Build replay evaluation: fixed prior vs learned model on identical historical windows.
- [ ] Add precision@k, recall@k, false-negative rate, calibration error and operator-minutes-saved metrics.
- [ ] Add candidate lifecycle: `OPEN → ACKNOWLEDGED → RESOLVED / FALSE_POSITIVE`.
- [ ] Bind resolution labels to source evidence instead of UI-only feedback.
- [ ] Export an evaluation dataset without credentials or sensitive payloads.

## P1 — World model / causal layer

- [ ] Replace flat repo scoring with a typed dependency graph: repo → service → mission → verifier → deployment → user surface.
- [ ] Add causal propagation so an upstream runtime failure raises downstream uncertainty without double-counting the same evidence.
- [ ] Add change-point detection for activity, failure density, latency and evidence freshness.
- [ ] Add counterfactual queries: “if this PR merges, what surfaces and missions become exposed?”
- [ ] Reuse canonical topology from governance instead of creating a second source of truth.

## P1 — Mission intelligence

- [ ] Ingest Mission / Work / Attempt / Evidence / Verification objects from canonical Aftergraph sources.
- [ ] Rank missions by expected verified value, deadline, dependency blockage, CPVO and human attention cost.
- [ ] Add recovery-policy recommendation using MISSION-Bench failure classes.
- [ ] Explicitly separate recoverable faults from containment faults (`revocation`, `budget_exhaustion`).

## P2 — Algorithm discovery loop

- [ ] Add an offline candidate-policy lab inspired by evaluator-guided evolutionary search.
- [ ] Evolve ranking / recovery heuristics only against frozen replay datasets and deterministic evaluators.
- [ ] Preserve champion/challenger models with exact dataset hash, code SHA and metrics.
- [ ] Never promote a candidate directly from online self-evaluation to production authority.

## P2 — Multi-model reasoning layer

- [ ] Add optional LLM hypothesis generator behind the deterministic ranker.
- [ ] LLM may propose explanations / hypotheses / mission drafts; it may not mutate evidence or verification truth.
- [ ] Compare single-model, ensemble and small-local-model routing on CPVO, latency and verified yield.
- [ ] Add context-budget accounting and Useful Context Ratio.

## P2 — Governed action loop

- [ ] Convert a ranked candidate into an inspectable Mission draft.
- [ ] Resolve explicit principal, authority lease, budget and acceptance criteria before dispatch.
- [ ] Route execution through canonical Runtime / WORKS surfaces, not through War Room directly.
- [ ] Require independent evidence before candidate closure becomes `VERIFIED`.

## P3 — Hardware / distributed system reality

- [ ] Authenticated Lenovo and VDS bridges with signed telemetry.
- [ ] GPU/NPU utilization, queue depth, process health and agent-session ownership.
- [ ] Collision detection across simultaneous agents touching the same repository / mission / resource.
- [ ] Remote nodes remain `UNOBSERVED` until a governed bridge supplies evidence.

## P3 — Release hardening

- [ ] Native Windows execution receipt from a real Windows runner.
- [ ] Authenticode signing.
- [ ] Auto-update channel with signed manifests and rollback.
- [ ] Crash reporting / local diagnostics with opt-in privacy controls.
- [ ] Accessibility pass on the intelligence view and keyboard navigation.

