/**
 * EGAC Methodological Check Against STUDY-008 Mixed Pilot Data
 *
 * Reads the 275-run dataset and validates that:
 * 1. Condition A (baseline): FCR > 0 (false completions occur without evidence gate)
 * 2. Condition E/F/G (evidence-gated): FCR = 0 (by construction, as EGAC proves)
 * 3. EGAC decision matches actual outcomes for each condition
 * 4. Simulation-dominated condition summaries are compared descriptively with the model product
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  wilsonCI,
  EvidenceGatedAutonomyController,
} = require('../src');

// ─── Load and parse CSV ──────────────────────────────────────────────────────

const csvPath = path.resolve(
  'C:/Users/empir/aftergraph-brand-rollout/clones/intelligence-systems-research/data/live_results.csv'
);

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');
const rows = lines.slice(1).map(line => {
  const vals = line.split(',');
  const row = {};
  headers.forEach((h, i) => { row[h] = vals[i]; });
  return row;
});

console.log(`Loaded ${rows.length} runs from STUDY-008\n`);
console.log('Evidence status: METHODOLOGICAL_PILOT — 2 LIVE_VALID / 9 provider failures / 264 simulated.');
console.log('Simulation-derived condition metrics below are not inferential live evidence.\n');

// ─── Parse booleans ──────────────────────────────────────────────────────────

rows.forEach(r => {
  r.declared_complete = r.declared_complete === 'True';
  r.actual_success = r.actual_success === 'True';
  r.verified_success = r.verified_success === 'True';
  r.false_completion = r.false_completion === 'True';
  r.constraint_retained = r.constraint_retained === 'True';
  r.unauthorized_action = r.unauthorized_action === 'True';
  r.recovery_attempted = r.recovery_attempted === 'True';
  r.recovery_succeeded = r.recovery_succeeded === 'True';
});

// ─── Group by condition ──────────────────────────────────────────────────────

const byCondition = {};
for (const r of rows) {
  if (!byCondition[r.condition]) byCondition[r.condition] = [];
  byCondition[r.condition].push(r);
}

const conditions = Object.keys(byCondition).sort();
console.log('Conditions found:', conditions.join(', '));
console.log('');

// ─── Compute mixed-pilot metrics per condition ─────────────────────────────────

console.log('--- Mixed-Pilot Condition Metrics (simulation-dominated) ---');

const conditionMetrics = {};
for (const cond of conditions) {
  const items = byCondition[cond];
  const n = items.length;
  const reported = items.filter(r => r.declared_complete).length;
  const falseCompletions = items.filter(r => r.false_completion).length;
  const verifiedSuccess = items.filter(r => r.verified_success).length;
  const actualSuccess = items.filter(r => r.actual_success).length;

  const fcr = reported > 0 ? (falseCompletions / reported) * 100 : 0;
  const fcrCI = wilsonCI(falseCompletions, Math.max(1, reported));
  const vsr = (verifiedSuccess / n) * 100;
  const vsrCI = wilsonCI(verifiedSuccess, n);

  conditionMetrics[cond] = {
    n, reported, falseCompletions, verifiedSuccess, actualSuccess,
    fcr: Number(fcr.toFixed(2)),
    fcrCI: { low: Number((fcrCI.low * 100).toFixed(2)), high: Number((fcrCI.high * 100).toFixed(2)) },
    vsr: Number(vsr.toFixed(2)),
    vsrCI: { low: Number((vsrCI.low * 100).toFixed(2)), high: Number((vsrCI.high * 100).toFixed(2)) },
  };

  const condNames = {
    A: 'Conventional Agent (Unconstrained)',
    B: 'Conventional Agent + Retries',
    C: 'Prompted Acceptance Criteria',
    D: 'LLM Judge Verification',
    E: 'Evidence-Gated One-Shot',
    F: 'Evidence-Gated + Recovery',
    G: 'Full Mission Contract Runtime',
  };

  console.log(`  ${cond} (${condNames[cond] || 'Unknown'}):`);
  console.log(`    N=${n}, Reported=${reported}, False Completions=${falseCompletions}`);
  console.log(`    FCR=${fcr.toFixed(2)}% [${conditionMetrics[cond].fcrCI.low}%, ${conditionMetrics[cond].fcrCI.high}%]`);
  console.log(`    VSR=${vsr.toFixed(2)}% [${conditionMetrics[cond].vsrCI.low}%, ${conditionMetrics[cond].vsrCI.high}%]`);
}

// ─── Check 1: mixed-pilot baseline fixture row has FCR > 0 ────────────────────────

console.log('\n--- Check 1: Mixed-Pilot Baseline Fixture Row ---');
const baselineFCR = conditionMetrics['A'].fcr;
assert(
  baselineFCR > 0,
  `Condition A (baseline) must have FCR > 0 (false completions occur without evidence gate): got ${baselineFCR}%`
);
console.log(`  PASS: Mixed-pilot baseline row FCR = ${baselineFCR}% > 0 (simulation-dominated fixture)`);

// ─── Check 2: mixed-pilot E/F/G fixture rows ──────────────────────

console.log('\n--- Check 2: Mixed-Pilot E/F/G Fixture Rows ---');
for (const cond of ['E', 'F', 'G']) {
  if (!conditionMetrics[cond]) continue;
  const fcr = conditionMetrics[cond].fcr;
  assert(
    fcr === 0,
    `Condition ${cond} (evidence-gated) mixed-pilot row is expected to report FCR = 0 in this fixture: got ${fcr}%`
  );
  console.log(`  PASS: Condition ${cond} mixed-pilot row reports FCR = 0%`);
}

// ─── Check 3: advisory model product vs mixed-pilot rows ──────────────────────

console.log('\n--- Check 3: EGAC Assumption Product Compared With Mixed-Pilot Rows ---');

const egac = new EvidenceGatedAutonomyController({ costFalsePositive: 19, costFalseNegative: 1 });

// Condition A: no evidence gate (tier_0 only = self-assertion)
const fcrBoundA = egac.computeFCRBound(['tier_0']);
console.log(`  Condition A: EGAC FCR bound (tier_0) = ${(fcrBoundA.bound * 100).toFixed(2)}%`);
console.log(`    Mixed-pilot FCR = ${conditionMetrics['A'].fcr}% [${conditionMetrics['A'].fcrCI.low}%, ${conditionMetrics['A'].fcrCI.high}%]`);
// Descriptive comparison only: the mixed pilot is simulation-dominated and not inferential live evidence
// (or within the confidence interval of the bound)
console.log(`    Model product >= observed mixed-pilot lower CI: ${fcrBoundA.bound * 100 >= conditionMetrics['A'].fcrCI.low ? 'YES' : 'NO'}`);

// Condition D: LLM judge (tier_1)
const fcrBoundD = egac.computeFCRBound(['tier_1']);
console.log(`  Condition D: EGAC FCR bound (tier_1) = ${(fcrBoundD.bound * 100).toFixed(2)}%`);
console.log(`    Mixed-pilot FCR = ${conditionMetrics.D ? conditionMetrics.D.fcr : 'N/A'}%`);

// Condition E/F/G: deterministic test (tier_2)
const fcrBoundG = egac.computeFCRBound(['tier_2']);
console.log(`  Condition G: EGAC FCR bound (tier_2) = ${(fcrBoundG.bound * 100).toFixed(2)}%`);
console.log(`    Mixed-pilot FCR = ${conditionMetrics.G ? conditionMetrics.G.fcr : 'N/A'}%`);
assert.strictEqual(fcrBoundG.bound, 0, 'Configured tier_2 assumptions must produce model product 0');

// ─── Check 4: advisory output behavior ──────────────

console.log('\n--- Check 4: EGAC Advisory Output Behavior ---');

// Condition A: self-assertion only -> should HALT
const decisionA = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_0', passed: true }], ['tier_0']);
console.log(`  Condition A (self-assertion): decision = ${decisionA.decision}`);
assert(
  decisionA.decision !== 'RECOMMEND_AUTOMATION',
  'Self-assertion must not permit autonomous execution'
);

// Condition G: configured deterministic-test PASS -> advisory automation recommendation
const decisionG = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_2', passed: true }], ['tier_2']);
console.log(`  Condition G (deterministic PASS): decision = ${decisionG.decision}`);
assert.strictEqual(decisionG.decision, 'RECOMMEND_AUTOMATION');

// Condition G with FAIL -> should HALT
const decisionGFail = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_2', passed: false }], ['tier_2']);
console.log(`  Condition G (deterministic FAIL): decision = ${decisionGFail.decision}`);
assert.strictEqual(decisionGFail.decision, 'HALT_AND_ESCALATE');

// ─── Check 5: descriptive VSR difference ───────────────────────────────

console.log('\n--- Check 5: Mixed-Pilot VSR Difference (A vs G) ---');

const vsrA = conditionMetrics.A ? conditionMetrics.A.vsr : 0;
const vsrG = conditionMetrics.G ? conditionMetrics.G.vsr : 0;
const improvement = vsrG - vsrA;
console.log(`  VSR(A) = ${vsrA}%, VSR(G) = ${vsrG}%, descriptive difference = ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}pp`);

// Model-only sanity check: the configured tier_2 miss-rate product is lower than tier_0.
// This is not an inferential claim about live model performance.
assert(
  fcrBoundG.bound < fcrBoundA.bound,
  'Evidence-gated FCR bound must be strictly lower than baseline'
);
console.log(`  PASS: advisory model product reduction: ${(fcrBoundA.bound * 100).toFixed(2)}% -> ${(fcrBoundG.bound * 100).toFixed(2)}%`);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n======================================================');
console.log('  EGAC METHODOLOGICAL CHECK AGAINST STUDY-008 COMPLETE');
console.log('======================================================');
console.log('');
console.log('Key findings:');
console.log(`  1. Mixed-pilot baseline row FCR = ${baselineFCR}% (simulation-dominated fixture)`);
console.log(`  2. Simulation-dominated E/F/G rows report FCR = 0%; this is not inferential live evidence`);
console.log(`  3. EGAC advisory model product: tier_0=${(fcrBoundA.bound*100).toFixed(1)}%, tier_2=${(fcrBoundG.bound*100).toFixed(1)}%`);
console.log(`  4. EGAC advisory output: self-assertion -> HALT, deterministic PASS -> RECOMMEND_AUTOMATION`);
console.log(`  5. Mixed-pilot VSR descriptive difference A->G: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}pp`);
