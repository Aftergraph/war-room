// Self-check for Aftergraph Watchtower Intelligence Engine
// Ponytail principle: One runnable assert-based check, zero external frameworks.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  evaluateRisk,
  activeLearningTriage,
  detectAnomalies,
  generateHashChain,
  verifyHashChainIntegrity,
  detectAgentCollisions,
  predictStallsAndFailures,
  getLenovoTelemetry,
  getVdsTelemetry
} = require('./algorithms');

console.log('Running comprehensive Watchtower + AI/AL/ML intelligence verification...');

// 1. Files exist
const dir = __dirname;
assert(fs.existsSync(path.join(dir, 'index.html')), 'index.html must exist');
assert(fs.existsSync(path.join(dir, 'styles.css')), 'styles.css must exist');
assert(fs.existsSync(path.join(dir, 'app.js')), 'app.js must exist');
assert(fs.existsSync(path.join(dir, 'algorithms.js')), 'algorithms.js must exist');
assert(fs.existsSync(path.join(dir, 'AGENTS.md')), 'AGENTS.md must exist');
assert(fs.existsSync(path.join(dir, 'BOT_INTEGRATION_SPEC.md')), 'BOT_INTEGRATION_SPEC.md must exist');
assert(fs.existsSync(path.join(dir, 'TELEGRAM_BOT_PROMPT.md')), 'TELEGRAM_BOT_PROMPT.md must exist');
assert(fs.existsSync(path.join(dir, 'seed-data.json')), 'seed-data.json must exist');

// 2. Validate Bayesian Risk Scorer (XAI)
const lowRiskEvent = {
  type: 'PushEvent',
  actor: { display_login: 'JonasAbde' },
  repo: { name: 'Aftergraph/docs' },
  payload: { commits: [{ message: 'docs: update readme typo' }] }
};
const lowRiskResult = evaluateRisk(lowRiskEvent);
assert(lowRiskResult.score < 40, 'Docs typo by human should be low risk');
assert(lowRiskResult.factors.some(f => f.name.includes('Documentation')), 'Should detect documentation factor');

const highRiskEvent = {
  type: 'PushEvent',
  actor: { display_login: 'autonomous-agent-bot' },
  repo: { name: 'Aftergraph/trust-gateway' },
  payload: { commits: [{ message: 'feat(tg): modify security token authentication and database migration' }] }
};
const highRiskResult = evaluateRisk(highRiskEvent);
assert(highRiskResult.score >= 60, 'Security/migration in trust-gateway by bot should be high risk');
console.log('✓ Bayesian Risk Scorer verified (low:', lowRiskResult.score, 'high:', highRiskResult.score, ')');

// 3. Validate Active Learning (AL) Triage Classifier
const routineTask = { title: 'chore(deps): bump astro to 7.3.2', repo: 'docs', riskScore: 15 };
const routineTriage = activeLearningTriage(routineTask);
assert.strictEqual(routineTriage.triageDecision, 'AUTO_ADMIT_RECOMMENDED', 'Routine dependency bump should be auto-admitted');

const criticalTask = { title: 'feat(governance): migration on large table without guard', repo: 'after-graph-governance', riskScore: 75 };
const criticalTriage = activeLearningTriage(criticalTask);
assert.strictEqual(criticalTriage.triageDecision, 'OPERATOR_REVIEW_REQUIRED', 'High uncertainty/risk task must require human oracle');
console.log('✓ Active Learning Classifier verified (Auto-admit vs Human Oracle triage)');

// 4. Validate Temporal Anomaly Detector
const mockBurstyEvents = Array(20).fill(null).map((_, i) => ({
  id: `burst_${i}`,
  type: 'PushEvent',
  actor: { display_login: 'hyperactive-bot' },
  repo: { name: 'Aftergraph/works-execution' },
  created_at: new Date().toISOString(),
  payload: { commits: [{ message: 'fix(works): attempt retry loop' }] }
}));
const anomalies = detectAnomalies(mockBurstyEvents);
assert(anomalies.length > 0, 'Burst of 20 events from single bot should trigger anomaly');
assert(anomalies.some(a => a.type.includes('RUNAWAY') || a.type.includes('DUPLICATE')), 'Should identify runaway or duplicate loop');
console.log('✓ Temporal Anomaly Detector verified (Detected', anomalies.length, 'anomalies)');

// 5. Validate Cryptographic HashChain & Tamper-Detection
async function testHashChain() {
  const mockEvents = [
    { id: '1', type: 'PushEvent', actor: { display_login: 'forge' }, repo: { name: 'Aftergraph/works-execution' }, created_at: '2026-09-15T12:00:00Z' },
    { id: '2', type: 'PullRequestEvent', actor: { display_login: 'atlas' }, repo: { name: 'Aftergraph/trust-gateway' }, created_at: '2026-09-15T12:01:00Z' },
    { id: '3', type: 'IssueCommentEvent', actor: { display_login: 'sentinel' }, repo: { name: 'Aftergraph/studio' }, created_at: '2026-09-15T12:02:00Z' }
  ];

  const chain = await generateHashChain(mockEvents);
  assert.strictEqual(chain.length, 3, 'Chain should contain 3 blocks');
  
  // Verify clean chain
  const cleanVerification = await verifyHashChainIntegrity(chain);
  assert.strictEqual(cleanVerification.valid, true, 'Clean chain must pass integrity check');

  // Verify tamper detection: alter payload of block 1
  const tamperedChain = JSON.parse(JSON.stringify(chain));
  tamperedChain[1].payload.actor = 'evil-hacker';
  const tamperVerification = await verifyHashChainIntegrity(tamperedChain);
  assert.strictEqual(tamperVerification.valid, false, 'Tampered block must fail integrity check');
  assert(tamperVerification.brokenIndex === 1, 'Should pinpoint broken block at index 1');

  console.log('✓ Cryptographic HashChain verified (Tamper detection confirmed)');

  // 6. Validate Collision Radar
  const mockCollisionEvents = [
    { type: 'PushEvent', repo: { name: 'Aftergraph/trust-gateway' }, payload: { ref: 'refs/heads/feat/policy' }, actor: { display_login: 'Codex-1' } },
    { type: 'PushEvent', repo: { name: 'Aftergraph/trust-gateway' }, payload: { ref: 'refs/heads/feat/policy' }, actor: { display_login: 'Gemini-1' } }
  ];
  const collisions = detectAgentCollisions(mockCollisionEvents);
  assert(collisions.length > 0, 'Colliding branch pushes must trigger collision alert');
  assert.strictEqual(collisions[0].severity, 'HIGH');
  console.log('✓ Agent Collision Radar verified (Detected', collisions.length, 'collisions)');

  // 7. Validate Failure & Stall Prediction
  const riskyTask = { id: 'job_42', title: 'refactor core runtime and migration', repo: 'works-execution' };
  const prediction = predictStallsAndFailures(riskyTask);
  assert(prediction.failureProbability >= 40, 'Core runtime refactor + migration must have elevated failure probability');
  assert.strictEqual(prediction.stallRisk, 'ELEVATED');
  console.log('✓ Failure & Stall Predictor verified (Predicted probability:', prediction.failureProbability + '%)');

  // 8. Validate Lenovo & VDS Hardware Telemetry
  const lenovo = getLenovoTelemetry();
  const vds = getVdsTelemetry();
  assert(lenovo.cpuUsage >= 0 && lenovo.ramUsagePercent >= 0, 'Lenovo telemetry must provide valid CPU/RAM');
  assert(vds.status === 'ONLINE' && vds.dockerContainersRunning > 0, 'VDS telemetry must report container count');
  console.log('✓ Hardware Telemetry Bridges verified (Lenovo Vantage & Hetzner VDS)');
}

testHashChain().then(() => {
  console.log('\n======================================================');
  console.log('✓ ALL WAR ROOM INTELLIGENCE & RADAR CHECKS PASSED (8/8)');
  console.log('======================================================');
}).catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
