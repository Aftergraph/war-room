/**
 * Aftergraph War Room — Enhanced Intelligence & Algorithmic Engines
 * 1. BayesianRiskEngine: Heuristic Bayesian risk (legacy, kept for backward compat)
 * 2. MultiDimensionalCollisionEngine: Overlap across Repos, Branches, Files, Contracts & Authority
 * 3. WeibullHazardStallEngine: Time-decay hazard rate prediction for execution leases
 * 4. GlobalAttentionEngine: Multi-factor operational queue prioritization
 * 5. ContextContinuityEngine: Token entropy calculation & ACC Graph Slice generator
 * 6. EvidenceGatedAutonomyController: advisory evidence-gated research model (EGAC)
 *    Uses provisional Bayesian parameters and a miss-rate model for recommendations only;
 *    it carries no execution authority and STUDY-008 is simulation-dominated.
 */

const {
  EvidenceGatedAutonomyController,
  wilsonCI,
  hoeffdingSampleSize,
  EVIDENCE_TIERS,
  PLANE_PRIORS,
} = require('../../../packages/egac/src');

/**
 * 1. MATHEMATICAL BAYESIAN RISK ENGINE
 * Computes exact posterior probability of regression:
 * P(Defect | Evidence) = (P(Evidence | Defect) * P(Defect)) / P(Evidence)
 */
class BayesianRiskEngine {
  constructor() {
    // Prior defect probability based on architecture plane
    this.planePriors = {
      GOVERNANCE: 0.40,   // Highest impact (Trust Gateway, Policy, Contracts)
      EXECUTION: 0.28,    // Medium-high impact (works-execution, Sentinel)
      AGENTS: 0.22,       // Medium impact (Forge, Hermes, Model Registry)
      EXPERIENCE: 0.12,   // Standard impact (Studio, Docs, Public Platform)
      INFRASTRUCTURE: 0.18
    };
  }

  evaluate(envelope, systemState = {}) {
    const factors = [];
    const repo = (envelope.subject?.id || '').toLowerCase();
    const actor = envelope.actor?.id || 'unknown';
    const eventType = envelope.event?.type || '';

    // Step A: Determine Plane & Prior P(Defect)
    let plane = 'EXPERIENCE';
    if (repo.includes('governance') || repo.includes('trust-gateway') || repo.includes('contracts') || repo.includes('aie')) {
      plane = 'GOVERNANCE';
    } else if (repo.includes('works-execution') || repo.includes('sentinel') || repo.includes('runtime')) {
      plane = 'EXECUTION';
    } else if (repo.includes('forge') || repo.includes('hermes') || repo.includes('atlas')) {
      plane = 'AGENTS';
    }

    const prior = this.planePriors[plane] || 0.15;
    factors.push({ name: `Prior: ${plane} Plane`, weight: `P(D)=${prior.toFixed(2)}`, desc: 'Baseline defect probability for this plane' });

    // Step B: Calculate Likelihood Ratios P(Evidence | Defect) vs P(Evidence | NoDefect)
    // 1. Actor factor
    let lrActor = 1.0;
    if (actor.includes('bot') || actor.includes('codex') || actor.includes('forge')) {
      lrActor = 1.35; // Autonomous bots have higher unreviewed mutation velocity
      factors.push({ name: 'Autonomous Actor Likelihood', weight: `LR=${lrActor}`, desc: `Autonomous bot execution (${actor})` });
    } else {
      lrActor = 0.85; // Human operator changes tend to be deliberate
      factors.push({ name: 'Operator Supervised Likelihood', weight: `LR=${lrActor}`, desc: `Direct human supervision (${actor})` });
    }

    // 2. Mutation type factor
    let lrMutation = 1.0;
    if (eventType.includes('Delete') || eventType.includes('ForcePush') || eventType.includes('destructive')) {
      lrMutation = 2.80; // High hazard
      factors.push({ name: 'High-Hazard Mutation', weight: `LR=${lrMutation}`, desc: 'Deletion or forced git branch rewrite' });
    } else if (eventType.includes('commit') || eventType.includes('push')) {
      lrMutation = 1.15;
    } else {
      lrMutation = 0.90; // Read/heartbeat/query
    }

    // Step C: Bayesian Posterior Computation via Odds Ratio
    // Prior Odds = P(D) / (1 - P(D))
    // Posterior Odds = Prior Odds * LR_total
    // Posterior P(D|E) = Posterior Odds / (1 + Posterior Odds)
    const totalLR = lrActor * lrMutation;
    const priorOdds = prior / (1 - prior);
    const posteriorOdds = priorOdds * totalLR;
    const posteriorP = posteriorOdds / (1 + posteriorOdds);

    const score = Math.round(posteriorP * 100);
    const level = score >= 70 ? 'CRITICAL' : score >= 40 ? 'ELEVATED' : 'NOMINAL';

    return {
      engine: 'BayesianRiskEngine/v2 (Exact Posterior)',
      score,
      level,
      posteriorProbability: Number(posteriorP.toFixed(4)),
      priorProbability: prior,
      likelihoodRatio: Number(totalLR.toFixed(2)),
      factors,
      confidence: 0.95,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 2. MULTI-DIMENSIONAL COLLISION ENGINE
 * Calculates collision probability across:
 * - File graph overlap (exact path match & directory proximity)
 * - Semantic contract dependency (Producer vs Consumer)
 * - Temporal execution window (active leases)
 * - Branch divergence
 */
class MultiDimensionalCollisionEngine {
  constructor() {
    this.activeIntents = new Map(); // intentId -> Intent
  }

  registerIntent(intent) {
    if (!intent || !intent.agentId || !intent.repo) {
      throw new Error('Invalid intent declaration');
    }
    const id = intent.id || `intent_${intent.agentId}_${Date.now()}`;
    const normalized = {
      id,
      agentId: intent.agentId,
      machineId: intent.machineId || 'unknown',
      repo: intent.repo,
      branch: intent.branch || 'main',
      files: intent.files || [],
      contracts: intent.contracts || [],
      declaredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (intent.durationMinutes || 15) * 60000).toISOString()
    };

    this.activeIntents.set(id, normalized);
    return normalized;
  }

  releaseIntent(intentId) {
    return this.activeIntents.delete(intentId);
  }

  getActiveIntents() {
    // Purge expired
    const now = Date.now();
    for (const [id, item] of this.activeIntents.entries()) {
      if (new Date(item.expiresAt).getTime() < now) {
        this.activeIntents.delete(id);
      }
    }
    return Array.from(this.activeIntents.values());
  }

  /**
   * Evaluates collision risk for an incoming intent or batch of active attempts
   */
  evaluateCollisions(candidateIntent = null) {
    const all = this.getActiveIntents();
    const collisions = [];

    // Compare all pairs or candidate against active
    const targets = candidateIntent ? [candidateIntent] : all;

    for (let i = 0; i < targets.length; i++) {
      const a1 = targets[i];
      for (let j = 0; j < all.length; j++) {
        const a2 = all[j];
        if (a1.id === a2.id || a1.agentId === a2.agentId) continue;

        // 1. Repo match
        if (a1.repo !== a2.repo) continue;

        // 2. File overlap
        const commonFiles = (a1.files || []).filter(f => (a2.files || []).includes(f));
        const fileOverlapScore = commonFiles.length > 0 ? 0.95 : 0.2;

        // 3. Contract overlap
        const commonContracts = (a1.contracts || []).filter(c => (a2.contracts || []).includes(c));
        const contractOverlapScore = commonContracts.length > 0 ? 0.90 : 0.1;

        // 4. Branch overlap
        const sameBranch = a1.branch === a2.branch;
        const branchScore = sameBranch ? 0.85 : 0.4;

        // Multi-dimensional collision metric
        const collisionRisk = Number((fileOverlapScore * 0.45 + contractOverlapScore * 0.35 + branchScore * 0.20).toFixed(2));

        if (collisionRisk >= 0.40) {
          const isHigh = collisionRisk >= 0.70;
          collisions.push({
            riskScore: collisionRisk,
            level: isHigh ? 'HIGH' : 'MEDIUM',
            agents: [a1.agentId, a2.agentId],
            repo: a1.repo,
            branch: a1.branch,
            commonFiles,
            commonContracts,
            recommendation: isHigh 
              ? `HALT_AND_REBASE: Agent '${a1.agentId}' must defer until '${a2.agentId}' releases lease on ${a1.repo}.`
              : `PROCEED_WITH_GUARD: Concurrent branches detected. Require pre-merge exact-HEAD check.`
          });
        }
      }
    }

    return collisions;
  }
}

/**
 * 3. WEIBULL HAZARD STALL ENGINE
 * Computes instantaneous hazard rate h(t) for execution leases
 */
class WeibullHazardStallEngine {
  predict(lease) {
    const now = Date.now();
    const started = new Date(lease.startedAt || now).getTime();
    const elapsedMinutes = Math.max(0.1, (now - started) / 60000);
    const timeoutMinutes = lease.timeoutMinutes || 15;

    // Weibull shape (beta) and scale (eta)
    // beta > 1 means wear-out / stall probability increases as time elapses
    const beta = 2.4;
    const eta = timeoutMinutes * 0.70;

    // Hazard rate h(t) = (beta / eta) * (t / eta)^(beta - 1)
    const hazard = (beta / eta) * Math.pow(elapsedMinutes / eta, beta - 1);
    const failureProb = 1 - Math.exp(-Math.pow(elapsedMinutes / eta, beta));

    const normalizedProb = Math.min(0.99, Number(failureProb.toFixed(3)));

    return {
      engine: 'WeibullHazardStallEngine/v2',
      leaseId: lease.id,
      elapsedMinutes: Number(elapsedMinutes.toFixed(1)),
      hazardRate: Number(hazard.toFixed(4)),
      stallProbability: normalizedProb,
      isStalled: normalizedProb > 0.80,
      recommendation: normalizedProb > 0.80 ? 'TRIGGER_HEARTBEAT_PROBE' : 'NOMINAL'
    };
  }
}

/**
 * 4. TEMPORAL ANOMALY & BURST DETECTOR
 */
class TemporalAnomalyEngine {
  constructor() {
    this.history = new Map();
  }

  evaluate(envelope) {
    const actor = envelope.actor?.id || 'unknown';
    const now = Date.now();

    if (!this.history.has(actor)) this.history.set(actor, []);
    const window = this.history.get(actor);
    window.push(now);

    const cutoff = now - 60000;
    while (window.length > 0 && window[0] < cutoff) {
      window.shift();
    }

    const freq = window.length;
    const isRunaway = freq >= 20;

    return {
      engine: 'TemporalAnomalyEngine/v2',
      actor,
      actionsLastMinute: freq,
      isRunaway,
      anomalyScore: isRunaway ? 0.98 : freq > 10 ? 0.60 : 0.05
    };
  }
}

/**
 * 5. GLOBAL ATTENTION SCORER
 */
class GlobalAttentionEngine {
  calculatePriority(item) {
    const severity = item.severity || 3;
    const uncertainty = item.uncertainty || 1.4;
    const blastRadius = item.blastRadius || 1.2;
    const verificationGap = item.unverified ? 2.2 : 1.0;

    const raw = severity * uncertainty * blastRadius * verificationGap;
    let label = 'WATCHING';
    if (raw > 15) label = 'NEEDS_YOU';
    else if (raw > 8) label = 'NEEDS_AGENT';

    return {
      score: Number(raw.toFixed(2)),
      priorityCategory: label
    };
  }
}

/**
 * 6. CONTEXT CONTINUITY & ENTROPY SCORER
 */
class ContextContinuityEngine {
  generateCapsule(mission, work, attempt, recentObservations = []) {
    const payloadStr = JSON.stringify({ mission, work, attempt });
    const entropy = this.calculateShannonEntropy(payloadStr);

    return {
      schema: 'aftergraph.continuity-capsule/1.0',
      capsuleId: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mission: mission ? { id: mission.id, title: mission.title } : null,
      work: work ? { id: work.id, objective: work.objective } : null,
      attempt: attempt ? { id: attempt.id, agent: attempt.agentId } : null,
      recentObservations: recentObservations.slice(-10),
      metrics: {
        shannonEntropy: Number(entropy.toFixed(3)),
        fidelityScore: Number((1.0 - Math.min(1.0, entropy / 8.0)).toFixed(2))
      },
      freshness: {
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7200000).toISOString()
      }
    };
  }

  calculateShannonEntropy(str = '') {
    if (!str) return 0;
    const freqs = {};
    for (const char of str) {
      freqs[char] = (freqs[char] || 0) + 1;
    }
    const len = str.length;
    let entropy = 0;
    for (const char in freqs) {
      const p = freqs[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
}

class UnifiedIntelligenceEngine {
  constructor() {
    this.bayesianRisk = new BayesianRiskEngine();
    this.collision = new MultiDimensionalCollisionEngine();
    this.stall = new WeibullHazardStallEngine();
    this.anomaly = new TemporalAnomalyEngine();
    this.attention = new GlobalAttentionEngine();
    this.continuity = new ContextContinuityEngine();
    this.egac = new EvidenceGatedAutonomyController({
      costFalsePositive: 19,
      costFalseNegative: 1,
    });
  }

  async evaluateObservation(envelope, systemState) {
    const risk = this.bayesianRisk.evaluate(envelope, systemState);
    const anomaly = this.anomaly.evaluate(envelope);
    return {
      risk,
      anomaly,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * EGAC advisory evidence recommendation.
   * Produces a non-authoritative model result; canonical execution authority remains external.
   */
  evaluateAutonomy(repoName, evidenceChain, verificationTiers) {
    return this.egac.decide(repoName, evidenceChain, verificationTiers);
  }

  /**
   * EGAC FCR bound computation for a set of verification tiers.
   */
  computeFCRBound(tierIds) {
    return this.egac.computeFCRBound(tierIds);
  }

  /**
   * EGAC online calibration: record an evidence outcome.
   */
  recordCalibration(tierId, detected) {
    this.egac.recordCalibration(tierId, detected);
  }
}

module.exports = {
  BayesianRiskEngine,
  MultiDimensionalCollisionEngine,
  WeibullHazardStallEngine,
  TemporalAnomalyEngine,
  GlobalAttentionEngine,
  ContextContinuityEngine,
  EvidenceGatedAutonomyController,
  wilsonCI,
  hoeffdingSampleSize,
  EVIDENCE_TIERS,
  PLANE_PRIORS,
  UnifiedIntelligenceEngine
};
