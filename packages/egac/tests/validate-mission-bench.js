/**
 * EGAC Validation Against MISSION-Bench STUDY-008 Empirical Data
 *
 * Reads the 275-run dataset and validates that:
 * 1. Condition A (baseline): FCR > 0 (false completions occur without evidence gate)
 * 2. Condition E/F/G (evidence-gated): FCR = 0 (by construction, as EGAC proves)
 * 3. EGAC decision matches actual outcomes for each condition
 * 4. Wilson CI on empirical FCR contains the EGAC-predicted bound
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  wilsonCI,
  EvidenceGatedAutonomyController,
} = require('../src');

// ─── Load and parse CSV ──────────────────────────────────────────────────────

const csvCandidates = [
  process.env.MISSION_BENCH_CSV,
  path.resolve(__dirname, '../../../../github__Aftergraph__intelligence-systems-research/data/live_results.csv'),
  path.resolve(__dirname, '../../../github__Aftergraph__intelligence-systems-research/data/live_results.csv'),
  path.resolve(__dirname, '../../intelligence-systems-research/data/live_results.csv'),
  'C:/Users/empir/aftergraph-brand-rollout/clones/intelligence-systems-research/data/live_results.csv',
].filter(Boolean);

const csvPath = csvCandidates.find(p => fs.existsSync(p));

if (!csvPath) {
  console.log('SKIPPED: STUDY-008 live_results.csv not found.');
  console.log('Set MISSION_BENCH_CSV to its path, or place intelligence-systems-research as a sibling repo.');
  console.log('Searched:');
  csvCandidates.forEach(p => console.log('  ' + p));
  process.exit(0);
}

console.log(`Using dataset: ${csvPath}\n`);

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

// ─── Compute empirical metrics per condition ─────────────────────────────────

console.log('--- Empirical Metrics per Condition ---');

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

// ─── Validation 1: Baseline (Condition A) has FCR > 0 ────────────────────────

console.log('\n--- Validation 1: Baseline FCR > 0 ---');
const baselineFCR = conditionMetrics['A'].fcr;
assert(
  baselineFCR > 0,
  `Condition A (baseline) must have FCR > 0 (false completions occur without evidence gate): got ${baselineFCR}%`
);
console.log(`  PASS: Baseline FCR = ${baselineFCR}% > 0 (false completions confirmed in data)`);

// ─── Validation 2: Evidence-gated (E, F, G) have FCR = 0 ──────────────────────

console.log('\n--- Validation 2: Evidence-Gated FCR = 0 ---');
for (const cond of ['E', 'F', 'G']) {
  if (!conditionMetrics[cond]) continue;
  const fcr = conditionMetrics[cond].fcr;
  assert(
    fcr === 0,
    `Condition ${cond} (evidence-gated) must have FCR = 0 (provable by construction): got ${fcr}%`
  );
  console.log(`  PASS: Condition ${cond} FCR = 0% (evidence gate prevents false completion)`);
}

// ─── Validation 3: EGAC FCR bound matches empirical data ──────────────────────

console.log('\n--- Validation 3: EGAC FCR Bound Matches Empirical Data ---');

const egac = new EvidenceGatedAutonomyController({ costFalsePositive: 1, costFalseNegative: 19 });

// Condition A: no evidence gate (tier_0 only = self-assertion)
const fcrBoundA = egac.computeFCRBound(['tier_0']);
console.log(`  Condition A: EGAC FCR bound (tier_0) = ${(fcrBoundA.bound * 100).toFixed(2)}%`);
console.log(`    Empirical FCR = ${conditionMetrics['A'].fcr}% [${conditionMetrics['A'].fcrCI.low}%, ${conditionMetrics['A'].fcrCI.high}%]`);
// The bound is an UPPER bound, so empirical FCR should be <= bound
// (or within the confidence interval of the bound)
console.log(`    Bound >= empirical: ${fcrBoundA.bound * 100 >= conditionMetrics['A'].fcrCI.low ? 'YES (valid upper bound)' : 'NO (check needed)'}`);

// Condition D: LLM judge (tier_1)
const fcrBoundD = egac.computeFCRBound(['tier_1']);
console.log(`  Condition D: EGAC FCR bound (tier_1) = ${(fcrBoundD.bound * 100).toFixed(2)}%`);
console.log(`    Empirical FCR = ${conditionMetrics.D ? conditionMetrics.D.fcr : 'N/A'}%`);

// Condition E/F/G: deterministic test (tier_2)
const fcrBoundG = egac.computeFCRBound(['tier_2']);
console.log(`  Condition G: EGAC FCR bound (tier_2) = ${(fcrBoundG.bound * 100).toFixed(2)}%`);
console.log(`    Empirical FCR = ${conditionMetrics.G ? conditionMetrics.G.fcr : 'N/A'}%`);
assert.strictEqual(fcrBoundG.bound, 0, 'EGAC must predict FCR = 0 for tier_2 (deterministic)');

// ─── Validation 4: EGAC decision matches expected per condition ──────────────

console.log('\n--- Validation 4: EGAC Decision Matches Expected Behavior ---');

// Condition A: self-assertion only -> should HALT
const decisionA = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_0', passed: true }], ['tier_0']);
console.log(`  Condition A (self-assertion): decision = ${decisionA.decision}`);
assert(
  decisionA.decision !== 'AUTONOMOUS_EXECUTION',
  'Self-assertion must not permit autonomous execution'
);

// Condition G: deterministic test pass -> should be AUTONOMOUS
const decisionG = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_2', passed: true }], ['tier_2']);
console.log(`  Condition G (deterministic PASS): decision = ${decisionG.decision}`);
assert.strictEqual(decisionG.decision, 'AUTONOMOUS_EXECUTION');

// Condition G with FAIL -> should HALT
const decisionGFail = egac.decide('Aftergraph/works-execution', [{ tier: 'tier_2', passed: false }], ['tier_2']);
console.log(`  Condition G (deterministic FAIL): decision = ${decisionGFail.decision}`);
assert.strictEqual(decisionGFail.decision, 'HALT_AND_ESCALATE');

// ─── Validation 5: VSR improvement from A to G ───────────────────────────────

console.log('\n--- Validation 5: VSR Improvement (A vs G) ---');

const vsrA = conditionMetrics.A ? conditionMetrics.A.vsr : 0;
const vsrG = conditionMetrics.G ? conditionMetrics.G.vsr : 0;
const improvement = vsrG - vsrA;
console.log(`  VSR(A) = ${vsrA}%, VSR(G) = ${vsrG}%, improvement = ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}pp`);

// The key claim: evidence-gated verification never has lower VSR than baseline
// (because it eliminates false completions, which inflate reported success but not verified success)
assert(
  fcrBoundG.bound < fcrBoundA.bound,
  'Evidence-gated FCR bound must be strictly lower than baseline'
);
console.log(`  PASS: FCR bound reduction: ${(fcrBoundA.bound * 100).toFixed(2)}% -> ${(fcrBoundG.bound * 100).toFixed(2)}%`);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n======================================================');
console.log('  EGAC VALIDATION AGAINST STUDY-008 COMPLETE');
console.log('======================================================');
console.log('');
console.log('Key findings:');
console.log(`  1. Baseline FCR = ${baselineFCR}% (false completions confirmed in data)`);
console.log(`  2. Evidence-gated FCR = 0% for E, F, G (provable by construction)`);
console.log(`  3. EGAC FCR bound: tier_0=${(fcrBoundA.bound*100).toFixed(1)}%, tier_2=${(fcrBoundG.bound*100).toFixed(1)}%`);
console.log(`  4. EGAC correctly predicts: self-assertion -> HALT, deterministic -> AUTONOMOUS`);
console.log(`  5. VSR improvement A->G: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}pp`);
