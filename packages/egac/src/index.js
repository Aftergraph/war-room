/**
 * Evidence-Gated Autonomy Controller (EGAC)
 *
 * Advisory research model derived from VAIE/MISSION-Bench concepts.
 * It does not grant authority and its fixed tier parameters are assumptions, not universal empirical estimates.
 *
 * Key differences from the old engine:
 * 1. Likelihood ratios use provisional tier sensitivity/specificity parameters;
 *    they require claim-specific calibration before inferential use.
 * 2. Posterior from step i becomes prior for step i+1 (true sequential updating).
 * 3. Computes a model miss-rate product; it is not a universal FCR proof without explicit verifier-dependence assumptions.
 * 4. Autonomy decision is based on cost-asymmetry threshold, not a magic number.
 *
 * Algebraic model properties under stated assumptions:
 * - FCR = 0 for tier_2-only evidence (deterministic gate is fail-closed)
 * - FCR is monotonically non-increasing with additional evidence
 * - Higher evidence tiers weakly dominate lower tiers
 */

// ─── Evidence Tier Definitions ────────────────────────────────────────────────

const EVIDENCE_TIERS = {
  tier_0: { name: 'self_assertion',          sensitivity: 0.10, specificity: 0.95 },
  tier_1: { name: 'model_judgment',           sensitivity: 0.45, specificity: 0.90 },
  tier_2: { name: 'deterministic_test',      sensitivity: 1.00, specificity: 1.00 },
  tier_3: { name: 'provider_receipt',        sensitivity: 0.95, specificity: 1.00 },
  tier_4: { name: 'independent_observation', sensitivity: 0.90, specificity: 1.00 },
  tier_5: { name: 'cryptographic_attestation', sensitivity: 1.00, specificity: 1.00 },
  tier_6: { name: 'human_approval',          sensitivity: 0.98, specificity: 1.00 },
};

// ─── Provisional Plane Priors (research assumptions; not live-validated) ─────

const PLANE_PRIORS = {
  GOVERNANCE:    0.42,
  EXECUTION:     0.30,
  AGENTS:        0.24,
  EXPERIENCE:    0.14,
  INFRASTRUCTURE: 0.18,
};

// ─── Wilson Score Confidence Interval ────────────────────────────────────────

/**
 * Computes the Wilson score interval for a binomial proportion.
 * Used to bound sensitivity/specificity estimates from finite samples.
 *
 * @param {number} k - successes
 * @param {number} n - trials
 * @param {number} z - z-score (default 1.95996 for 95% CI)
 * @returns {{low: number, high: number, point: number}}
 */
function wilsonCI(k, n, z = 1.95996) {
  if (n === 0) return { low: 0.0, high: 0.0, point: 0.0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const spread = (z / denom) * Math.sqrt((p * (1 - p) / n) + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, centre - spread),
    high: Math.min(1, centre + spread),
    point: p,
  };
}

// ─── Hoeffding Sample Complexity ─────────────────────────────────────────────

/**
 * Minimum samples needed to estimate a proportion within epsilon
 * with confidence 1 - delta.
 *
 * n >= ln(1/delta) / (2 * epsilon^2)
 */
function hoeffdingSampleSize(epsilon, delta = 0.05) {
  return Math.ceil(Math.log(1 / delta) / (2 * epsilon * epsilon));
}

// ─── EGAC Core Engine ────────────────────────────────────────────────────────

class EvidenceGatedAutonomyController {
  constructor(options = {}) {
    // Plane priors can be overridden for online learning
    this.planePriors = { ...PLANE_PRIORS };
    this.tiers = { ...EVIDENCE_TIERS };

    // Online calibration store: tierId -> { passes, total }
    this.calibration = {};
    for (const tierId of Object.keys(EVIDENCE_TIERS)) {
      this.calibration[tierId] = { passes: 0, total: 0 };
    }

    // Cost-asymmetry threshold (default: false positive is 19x worse than false negative)
    this.costFalsePositive = options.costFalsePositive || 19.0;
    this.costFalseNegative = options.costFalseNegative || 1.0;
    this.alpha = this.costFalseNegative / (this.costFalsePositive + this.costFalseNegative);
  }

  /**
   * Classifies a repository name into its architecture plane.
   * @param {string} repoName
   * @returns {string} plane name
   */
  classifyPlane(repoName) {
    const repo = (repoName || '').toLowerCase();
    if (repo.includes('governance') || repo.includes('trust-gateway') ||
        repo.includes('contracts') || repo.includes('aie')) {
      return 'GOVERNANCE';
    }
    if (repo.includes('works-execution') || repo.includes('sentinel') ||
        repo.includes('runtime')) {
      return 'EXECUTION';
    }
    if (repo.includes('forge') || repo.includes('hermes') || repo.includes('atlas')) {
      return 'AGENTS';
    }
    if (repo.includes('docs') || repo.includes('brand') || repo.includes('studio') ||
        repo.includes('site')) {
      return 'EXPERIENCE';
    }
    return 'INFRASTRUCTURE';
  }

  /**
   * Gets the prior defect probability for a plane.
   * @param {string} plane
   * @returns {number} P(Defect | plane)
   */
  getPrior(plane) {
    return this.planePriors[plane] || 0.15;
  }

  /**
   * Gets the sensitivity for a tier, using calibrated data if available.
   * Falls back to a provisional research parameter; not a universal empirical estimate.
   * @param {string} tierId
   * @returns {number} sensitivity in [0, 1]
   */
  getSensitivity(tierId) {
    const cal = this.calibration[tierId];
    if (cal && cal.total >= 10) {
      // Use the Laplace-smoothed calibration estimate with Wilson lower bound
      const ci = wilsonCI(cal.passes, cal.total);
      return ci.low; // Conservative: use lower bound
    }
    const tier = this.tiers[tierId];
    return tier ? tier.sensitivity : 0.5;
  }

  /**
   * Gets the specificity for a tier.
   * @param {string} tierId
   * @returns {number} specificity in [0, 1]
   */
  getSpecificity(tierId) {
    const tier = this.tiers[tierId];
    return tier ? tier.specificity : 0.95;
  }

  /**
   * Computes the likelihood ratio for a single evidence item.
   *
   * If evidence PASSED:
   *   LR = P(pass | Defect) / P(pass | ¬Defect) = (1 - sensitivity) / specificity
   *   A PASS is evidence AGAINST defect, so LR < 1 when sensitivity > 0.
   *
   * If evidence FAILED:
   *   LR = P(fail | Defect) / P(fail | ¬Defect) = sensitivity / (1 - specificity)
   *   A FAIL is evidence FOR defect, so LR > 1 when sensitivity > 0.
   *
   * @param {string} tierId
   * @param {boolean} passed
   * @returns {number} likelihood ratio
   */
  computeLikelihoodRatio(tierId, passed) {
    const sens = this.getSensitivity(tierId);
    const spec = this.getSpecificity(tierId);

    if (passed) {
      // P(e=pass | D) / P(e=pass | ¬D) = (1 - sens) / spec
      // If sensitivity = 1.0 (deterministic), a PASS proves ¬Defect: LR = 0.
      // Only floor the denominator to avoid division by zero.
      const numerator = 1 - sens;
      const denominator = Math.max(1e-10, spec);
      return numerator / denominator;
    } else {
      // P(e=fail | D) / P(e=fail | ¬D) = sens / (1 - spec)
      const numerator = Math.max(1e-10, sens);
      const denominator = Math.max(1e-10, 1 - spec);
      return numerator / denominator;
    }
  }

  /**
   * Sequential Bayesian update over a chain of evidence items.
   *
   * P_0(Defect) = prior
   * For each evidence e_i:
   *   Posterior_Odds_i = Prior_Odds_{i-1} * LR_i
   *   P_i(Defect) = Posterior_Odds_i / (1 + Posterior_Odds_i)
   *
   * @param {string} plane - architecture plane
   * @param {Array<{tier: string, passed: boolean}>} evidenceChain
   * @returns {{posterior: number, odds: number, trace: Array, priorOdds: number}}
   */
  sequentialUpdate(plane, evidenceChain = []) {
    const prior = this.getPrior(plane);
    const priorOdds = prior / (1 - prior);
    let currentOdds = priorOdds;
    const trace = [];

    trace.push({
      step: 0,
      type: 'PRIOR',
      plane,
      probability: prior,
      odds: priorOdds,
      lr: null,
    });

    for (let i = 0; i < evidenceChain.length; i++) {
      const { tier, passed } = evidenceChain[i];
      const lr = this.computeLikelihoodRatio(tier, passed);
      currentOdds = currentOdds * lr;
      const posterior = currentOdds / (1 + currentOdds);

      trace.push({
        step: i + 1,
        type: 'EVIDENCE_UPDATE',
        tier,
        result: passed ? 'PASS' : 'FAIL',
        lr: Number(lr.toFixed(6)),
        odds: Number(currentOdds.toFixed(6)),
        probability: Number(posterior.toFixed(6)),
      });
    }

    const posterior = currentOdds / (1 + currentOdds);
    return { posterior, odds: currentOdds, trace, priorOdds };
  }

  /**
   * Computes the legacy model miss-rate product used for advisory comparison.
   *
   * FCR_bound = Product_i (1 - sensitivity_{t_i})
   *
   * Multiplication is only an upper-bound interpretation under additional
   * dependence/coverage assumptions. The controller therefore exposes this
   * as ASSUMPTION_MODEL_ONLY and never as executable authority.
   *
   * @param {Array<string>} tierIds - evidence tiers used
   * @returns {{bound: number, perTier: Array, isProvableZero: boolean}}
   */
  computeFCRBound(tierIds = []) {
    let bound = 1.0;
    const perTier = [];

    for (const tierId of tierIds) {
      const sens = this.getSensitivity(tierId);
      const contribution = 1 - sens;
      bound *= contribution;
      perTier.push({
        tier: tierId,
        sensitivity: sens,
        missRate: contribution,
        cumulativeBound: Number(bound.toFixed(8)),
      });
    }

    return {
      bound: Number(bound.toFixed(8)),
      perTier,
      // A zero produced by hard-coded tier assumptions is a model result, not a
      // formal guarantee about a real verifier/claim pair.
      isProvableZero: false,
      modelAssumptionZero: bound === 0,
      evidenceStatus: 'ASSUMPTION_MODEL_ONLY',
      assumptions: [
        'tier sensitivities/specificities are provisional model parameters',
        'multiplicative miss rates require dependence assumptions not established by STUDY-008',
        'deterministic-test sensitivity=1 is not universal across claims or oracles',
      ],
    };
  }

  /**
   * Makes the autonomy decision based on posterior defect probability
   * and the FCR bound.
   *
   * Decision matrix:
   *   model product < alpha AND P(defect) < alpha -> RECOMMEND_AUTOMATION
   *   FCR < 2*alpha AND P(defect) < 2*alpha -> HUMAN_REVIEW
   *   else -> HALT_AND_ESCALATE
   *
   * @param {string} repoName
   * @param {Array<{tier: string, passed: boolean}>} evidenceChain
   * @param {Array<string>} verificationTiers - tiers used for the gate
   * @returns {Object} decision record
   */
  decide(repoName, evidenceChain = [], verificationTiers = []) {
    const plane = this.classifyPlane(repoName);
    const bayes = this.sequentialUpdate(plane, evidenceChain);
    const fcr = this.computeFCRBound(verificationTiers);

    const pDefect = bayes.posterior;
    const alpha = this.alpha;

    let decision;
    let reasoning;

    if (fcr.bound < alpha && pDefect < alpha) {
      decision = 'RECOMMEND_AUTOMATION';
      reasoning = `FCR bound (${fcr.bound.toExponential(2)}) < alpha (${alpha}) and P(Defect) (${pDefect.toFixed(4)}) < alpha. Advisory evidence threshold met; canonical authority is still required.`;
    } else if (fcr.bound < 2 * alpha && pDefect < 2 * alpha) {
      decision = 'HUMAN_REVIEW';
      reasoning = `FCR bound (${fcr.bound.toExponential(2)}) or P(Defect) (${pDefect.toFixed(4)}) in review zone. Human oracle recommended.`;
    } else {
      decision = 'HALT_AND_ESCALATE';
      reasoning = `FCR bound (${fcr.bound.toExponential(2)}) >= threshold or P(Defect) (${pDefect.toFixed(4)}) too high. Must not proceed without intervention.`;
    }

    return {
      engine: 'EGAC/v1 (advisory research controller)',
      advisoryOnly: true,
      authority: 'NONE',
      timestamp: new Date().toISOString(),
      repo: repoName,
      plane,
      decision,
      reasoning,
      metrics: {
        priorPDefect: Number(bayes.trace[0].probability.toFixed(6)),
        posteriorPDefect: Number(pDefect.toFixed(6)),
        priorOdds: Number(bayes.priorOdds.toFixed(6)),
        posteriorOdds: Number(bayes.odds.toFixed(6)),
        fcrBound: fcr.bound,
        fcrIsProvableZero: fcr.isProvableZero,
        fcrModelAssumptionZero: fcr.modelAssumptionZero,
        evidenceStatus: fcr.evidenceStatus,
        alphaThreshold: Number(alpha.toFixed(6)),
      },
      evidenceTrace: bayes.trace,
      fcrDecomposition: fcr.perTier,
    };
  }

  /**
   * Online calibration: record an evidence outcome and update the
   * sensitivity estimate for that tier.
   *
   * @param {string} tierId
   * @param {boolean} detected - did the verifier detect the defect?
   */
  recordCalibration(tierId, detected) {
    if (!this.calibration[tierId]) {
      this.calibration[tierId] = { passes: 0, total: 0 };
    }
    this.calibration[tierId].total += 1;
    if (detected) {
      this.calibration[tierId].passes += 1;
    }
  }

  /**
   * Returns calibration confidence using Hoeffding's inequality.
   * If we have n samples, we can estimate sensitivity within epsilon
   * with confidence 1 - delta where epsilon = sqrt(ln(1/delta) / (2n)).
   *
   * @param {string} tierId
   * @returns {{samples: number, epsilon95: number|null, wilsonCI: Object|null}}
   */
  calibrationStatus(tierId) {
    const cal = this.calibration[tierId];
    if (!cal || cal.total === 0) {
      return { samples: 0, epsilon95: null, wilsonCI: null };
    }
    const n = cal.total;
    const epsilon95 = Math.sqrt(Math.log(1 / 0.05) / (2 * n));
    return {
      samples: n,
      epsilon95: Number(epsilon95.toFixed(4)),
      wilsonCI: wilsonCI(cal.passes, n),
    };
  }
}

// ─── Module Exports ──────────────────────────────────────────────────────────

module.exports = {
  EVIDENCE_TIERS,
  PLANE_PRIORS,
  wilsonCI,
  hoeffdingSampleSize,
  EvidenceGatedAutonomyController,
};
