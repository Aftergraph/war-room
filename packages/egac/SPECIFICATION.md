# Evidence-Gated Autonomy Controller (EGAC) — Formal Specification

> **Status: advisory research-only.** EGAC v1 has no execution authority. STUDY-008 is a methodological pilot (2 LIVE_VALID / 9 provider failures / 264 simulated); fixed tier parameters are provisional assumptions, not universal empirical measurements.

## Problem

The current `BayesianRiskEngine` uses hardcoded likelihood ratios (1.35 for bots, 0.85 for humans) and labels the output "Exact Posterior" with "confidence: 0.95". These are constants, not estimates. There is no sequential updating, no data grounding, and no provable bound on the False Completion Rate (FCR).

This specification defines a research model derived from VAIE/MISSION-Bench concepts and simulation-supported results.

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

### Provisional priors (research assumptions; not live-validated)

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

Critical difference from the old engine: LR_i is computed from provisional sensitivity/specificity parameters. Claim-specific calibration is required before inferential use.

### Step 3 — Legacy Miss-Rate Product (Advisory)

For evidence-gated verification with independent verifiers:

```
FCR_bound = Product_{i=1..n} (1 - sensitivity_{t_i})
```

Assumption-model interpretation:

If every verifier sensitivity value is valid for the exact claim/oracle pair and verifier misses can be combined under the stated dependence model, the product above is a useful miss-rate model. A configured `tier_2` sensitivity of 1.0 therefore produces a model product of zero.

That zero is **not** a universal proof that real-world FCR is zero. STUDY-008 does not establish perfect deterministic-test sensitivity across arbitrary claims, nor the independence/coverage assumptions required to promote the product to an external safety guarantee. War Room exposes the result as advisory evidence only.

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

Use CI_low as a conservative model parameter; this does not by itself establish external validity.

### Step 5 — Autonomy Decision

Cost-asymmetry threshold:
```
alpha = C_FN / (C_FP + C_FN)
```

Where:
- C_FP = cost of false positive (allowing a defective mission to proceed)
- C_FN = cost of false negative (blocking a correct mission)

Decision:
```
P_defect = P_n(Defect | evidence)
FCR_bound = Product_i (1 - sensitivity_{t_i})

if FCR_bound < alpha AND P_defect < alpha:
    -> RECOMMEND_AUTOMATION
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

STUDY-008 attempted 275 runs, but the canonical audit classifies 2 as LIVE_VALID, 9 as provider failures and 264 as simulated. The condition rows below are simulation-dominated methodological evidence:
  epsilon = sqrt(ln(20) / (2*39)) ~ 0.21 at 95% confidence per condition.
  With pooled data across conditions: epsilon ~ 0.06 at 95% confidence.

## Algebraic Model Properties (under stated assumptions)

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

### Property 4: Advisory Threshold Behavior
If alpha = 0.05 (standard significance level) and all evidence is tier_2:
  FCR_bound = (1 - 1.0)^n = 0 < 0.05
  -> RECOMMEND_AUTOMATION is an advisory model result only; canonical authority is still required.

If any evidence is tier_0 (self-assertion only):
  FCR_bound = (1 - 0.10) = 0.90 > 0.05
  -> HALT_AND_ESCALATE (unless human approval is obtained)
