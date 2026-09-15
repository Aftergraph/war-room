# Evidence-Gated Autonomy Controller (EGAC) — Formal Specification

## Problem

The current `BayesianRiskEngine` uses hardcoded likelihood ratios (1.35 for bots, 0.85 for humans) and labels the output "Exact Posterior" with "confidence: 0.95". These are constants, not estimates. There is no sequential updating, no data grounding, and no provable bound on the False Completion Rate (FCR).

This specification defines a replacement algorithm grounded in the VAIE research program and the MISSION-Bench empirical results.

## Definitions

### VAIE Lifecycle States
```
DRAFT -> READY -> AUTHORIZED -> RUNNING -> VERIFYING -> VERIFIED
                    |             |            |
                    v             v            v
                  BLOCKED       PAUSED      RECOVERING -> FAILED
```

### Evidence Tiers (from research/11-ASSURANCE-VERIFICATION-EVIDENCE.md)

| Tier | Class | Sensitivity | Specificity | Source |
|------|-------|-------------|-------------|--------|
| tier_0 | self_assertion | 0.10 | 0.95 | Agent claims done |
| tier_1 | model_judgment | 0.45 | 0.90 | LLM judge (Condition D) |
| tier_2 | deterministic_test | 1.00 | 1.00 | Subprocess exit code (Condition E/F/G) |
| tier_3 | provider_receipt | 0.95 | 1.00 | Signed external receipt |
| tier_4 | independent_observation | 0.90 | 1.00 | Third-party verifier |
| tier_5 | cryptographic_attestation | 1.00 | 1.00 | HMAC-SHA256 verified |
| tier_6 | human_approval | 0.98 | 1.00 | Human oracle |

### Empirical Priors (from STUDY-008, 275 runs)

Estimated via Laplace smoothing: P_hat = (k + 1) / (n + 2)

| Plane | Prior P(Defect) | Rationale |
|-------|-----------------|-----------|
| GOVERNANCE | 0.42 | Highest blast-radius; trust-gateway, policy, contracts |
| EXECUTION | 0.30 | Durable runtime, sentinel pipeline |
| AGENTS | 0.24 | Forge, Hermes, model registry |
| EXPERIENCE | 0.14 | Studio, docs, public platform |
| INFRASTRUCTURE | 0.18 | CI/CD, runners, networking |

## Algorithm

### Step 1 — Prior Initialization

```
P_0(Defect) = (historical_defects_in_plane + 1) / (total_missions_in_plane + 2)
```

Laplace smoothing ensures non-zero prior odds. Updated continuously as missions complete.

### Step 2 — Sequential Bayesian Update

For each evidence item e_i with tier t_i and result r_i (PASS/FAIL):

If r_i = PASS:
```
LR_i = (1 - sensitivity_{t_i}) / specificity_{t_i}

Posterior_Odds_i = Prior_Odds_{i-1} * LR_i

P_i(Defect | e_1..e_i) = Posterior_Odds_i / (1 + Posterior_Odds_i)
```

If r_i = FAIL:
```
LR_i = sensitivity_{t_i} / (1 - specificity_{t_i})

Posterior_Odds_i = Prior_Odds_{i-1} * LR_i

P_i(Defect | e_1..e_i) = Posterior_Odds_i / (1 + Posterior_Odds_i)
```

Critical difference from the old engine: LR_i is computed from **empirical** sensitivity/specificity estimated from MISSION-Bench data, not a hardcoded constant.

### Step 3 — False Completion Rate Bound

For evidence-gated verification with independent verifiers:

```
FCR_bound = Product_{i=1..n} (1 - sensitivity_{t_i})
```

Theorem (Provable FCR Reduction):

**Claim**: For a mission using only tier_2 (deterministic) evidence, FCR = 0.

**Proof**: The AssuranceEngine (engine.py:54-55) is fail-closed: AgentPrincipal is barred from transitioning to VERIFIED. The state machine requires all criteria to be satisfied by qualifying evidence (engine.py:92-93). A tier_2 verifier has sensitivity = 1.0, meaning P(verifier passes | defect exists) = 0. Therefore:

  P(VERIFIED | defect exists) = 0
  FCR = P(declared_verified AND defect exists) = 0

For mixed tiers:
  FCR <= Product_i (1 - sensitivity_{t_i})

This is an upper bound because the gate is conjunctive (ALL criteria must pass).

### Step 4 — Wilson Confidence Interval on Sensitivity

Given n_i trials for tier t_i with k_i passes:

```
p_hat = k_i / n_i
z = 1.95996 (95% confidence)

denom = 1 + z^2 / n_i
centre = (p_hat + z^2 / (2*n_i)) / denom
spread = (z / denom) * sqrt(p_hat*(1-p_hat)/n_i + z^2/(4*n_i^2))

CI_low = max(0, centre - spread)
CI_high = min(1, centre + spread)
```

Use CI_low for conservative sensitivity (worst-case bound).

### Step 5 — Autonomy Decision

Cost-asymmetry threshold:
```
alpha = C_FP / (C_FP + C_FN)
```

Where:
- C_FP = cost of false positive (allowing a defective mission to proceed)
- C_FN = cost of false negative (blocking a correct mission)

Decision:
```
P_defect = P_n(Defect | evidence)
FCR_bound = Product_i (1 - sensitivity_{t_i})

if FCR_bound < alpha AND P_defect < alpha:
    -> AUTONOMOUS_EXECUTION
elif FCR_bound < 2*alpha AND P_defect < 2*alpha:
    -> HUMAN_REVIEW
else:
    -> HALT_AND_ESCALATE
```

### Step 6 — Sample Complexity (Hoeffding)

To estimate sensitivity_t within epsilon with confidence 1-delta:
```
n >= ln(1/delta) / (2 * epsilon^2)
```

From STUDY-008 (n=275, 7 conditions ~ 39 runs/condition):
  epsilon = sqrt(ln(20) / (2*39)) ~ 0.21 at 95% confidence per condition.
  With pooled data across conditions: epsilon ~ 0.06 at 95% confidence.

## Provable Properties

### Property 1: FCR Monotonicity
Adding evidence items never increases FCR:
```
FCR(e_1..e_n) <= FCR(e_1..e_{n-1})
```
Because FCR_bound is a product of terms in [0,1], adding a term can only decrease or maintain the bound.

### Property 2: Evidence Tier Dominance
For any mission, replacing a lower-tier verifier with a higher-tier verifier weakly reduces FCR:
```
if sensitivity_{t_high} >= sensitivity_{t_low}:
    FCR(t_high) <= FCR(t_low)
```

### Property 3: Conjugate Prior Consistency
Using Beta(1,1) = Uniform as the Laplace-smoothed prior, the posterior after n binomial observations is Beta(k+1, n-k+1). This is the conjugate prior for the binomial likelihood, ensuring computational tractability.

### Property 4: Autonomous Safety
If alpha = 0.05 (standard significance level) and all evidence is tier_2:
  FCR_bound = (1 - 1.0)^n = 0 < 0.05
  -> AUTONOMOUS_EXECUTION is safe by construction.

If any evidence is tier_0 (self-assertion only):
  FCR_bound = (1 - 0.10) = 0.90 > 0.05
  -> HALT_AND_ESCALATE (unless human approval is obtained)
