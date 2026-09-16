const test = require('node:test');
const assert = require('node:assert/strict');

const { CredentialBroker } = require('../security/src/credentialBroker');
const { NodeBridgeDaemon } = require('../services/node-bridge/src/daemon');
const { OperationalOntologyEngine } = require('../packages/ontology/src');
const { EvidenceGatedAutonomyController } = require('../packages/egac/src');

test('OER-002: local credential broker cannot mint execution authority', () => {
  const broker = new CredentialBroker('local-display-secret');
  assert.throws(
    () => broker.requestScopedTicket({ actorId: 'agent', capability: 'job.stop' }),
    /LOCAL_AUTHORITY_DISABLED/,
  );
});

test('OER-003: node bridge rejects forged ALLOW-shaped receipts without canonical verifier', async () => {
  const daemon = new NodeBridgeDaemon('test-node', 'cloud-runner', { mockHardware: true });
  await assert.rejects(
    daemon.executeCommand('job.inspect', { jobId: 'job_forge_412' }, { decision: 'ALLOW', ticketId: 'forged' }),
    /CANONICAL_AUTHORITY_VERIFIER_REQUIRED/,
  );
});

test('OER-003: node bridge can execute only after an injected canonical authority verifier accepts', async () => {
  const verifiedRefs = [];
  const daemon = new NodeBridgeDaemon('test-node', 'cloud-runner', {
    mockHardware: true,
    authorityVerifier: async ({ commandName, authority }) => {
      verifiedRefs.push(authority.reference);
      return commandName === 'job.inspect' && authority.reference === 'pdr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    },
  });
  const result = await daemon.executeCommand(
    'job.inspect',
    { jobId: 'job_forge_412' },
    { reference: 'pdr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  );
  assert.equal(result.command, 'job.inspect');
  assert.deepEqual(verifiedRefs, ['pdr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
});

test('OER-004/005: EGAC v1 default self-assertion is advisory and never executable authority', () => {
  const egac = new EvidenceGatedAutonomyController();
  const out = egac.decide(
    'Aftergraph/trust-gateway',
    [{ tier: 'tier_0', passed: true }],
    ['tier_0'],
  );
  assert.notEqual(out.decision, 'AUTONOMOUS_EXECUTION');
  assert.equal(out.advisoryOnly, true);
  assert.equal(out.authority, 'NONE');
});

test('OER-008: production ontology starts empty instead of inventing canonical operational state', () => {
  const ontology = new OperationalOntologyEngine();
  assert.deepEqual(ontology.getDecisions(), []);
  assert.deepEqual(ontology.getTrustPassports(), []);
});

test('OER-008: demo fixtures are explicit and cannot resolve without external authority reference', () => {
  const ontology = new OperationalOntologyEngine({ seedFixtures: true });
  const decisions = ontology.getDecisions();
  const passports = ontology.getTrustPassports();
  assert.ok(decisions.length > 0);
  assert.ok(passports.length > 0);
  assert.ok(decisions.every((d) => d.sourceKind === 'synthetic_fixture'));
  assert.ok(passports.every((p) => p.sourceKind === 'synthetic_fixture'));
  assert.throws(
    () => ontology.resolveDecision(decisions[0].id, 'APPROVE', 'human-operator', null),
    /CANONICAL_AUTHORITY_REQUIRED/,
  );
});


test('OER-004/005: Unified intelligence API path uses strict false-positive cost asymmetry', () => {
  const { UnifiedIntelligenceEngine } = require('../services/intelligence/src');
  const engine = new UnifiedIntelligenceEngine();
  const out = engine.evaluateAutonomy(
    'Aftergraph/trust-gateway',
    [{ tier: 'tier_0', passed: true }],
    ['tier_0']
  );
  assert.equal(engine.egac.costFalsePositive, 19);
  assert.equal(engine.egac.costFalseNegative, 1);
  assert.ok(engine.egac.alpha <= 0.05);
  assert.notEqual(out.decision, 'RECOMMEND_AUTOMATION');
  assert.equal(out.authority, 'NONE');
});

test('OER-003: Telegram quarantine never claims local execution without canonical authority path', async () => {
  const { TelegramBotRunner } = require('../integrations/telegram/bot-runner');
  const runner = new TelegramBotRunner();
  const result = await runner.handleCommand('/quarantine', 'operator');
  assert.equal(result.status, 'AUTHORITY_PATH_REQUIRED');
  assert.match(result.text, /Relay|Trust Gateway/);
  assert.doesNotMatch(result.text, /EMERGENCY_EXECUTED|All worker slices halted/i);
});