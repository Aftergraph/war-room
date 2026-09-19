const test = require('node:test');
const assert = require('node:assert/strict');

process.env.WAR_ROOM_DISABLE_BOOT_SYNC = '1';
const { server } = require('../apps/api/src/server');

let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

async function post(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, json: await response.json() };
}

test('local authority ticket endpoint is fail-closed', async () => {
  const { response, json } = await post('/api/auth/ticket', { actorId: 'agent', capability: 'job.stop' });
  assert.equal(response.status, 503);
  assert.equal(json.error, 'LOCAL_AUTHORITY_DISABLED');
});

test('local command dispatch endpoint is fail-closed', async () => {
  const { response, json } = await post('/api/commands/dispatch', { command: 'job.stop', params: { jobId: 'x' } });
  assert.equal(response.status, 503);
  assert.equal(json.error, 'CANONICAL_AUTHORITY_REQUIRED');
});

test('local decision action endpoint is fail-closed', async () => {
  const { response, json } = await post('/api/ontology/decisions/demo/action', { action: 'APPROVE' });
  assert.equal(response.status, 503);
  assert.equal(json.error, 'CANONICAL_AUTHORITY_REQUIRED');
});

test('EGAC endpoint is advisory-only on the real API path', async () => {
  const { response, json } = await post('/api/egac/decide', {
    repo: 'Aftergraph/trust-gateway',
    evidenceChain: [{ tier: 'tier_0', passed: true }],
    verificationTiers: ['tier_0'],
  });
  assert.equal(response.status, 200);
  assert.equal(json.authority, 'NONE');
  assert.equal(json.advisoryOnly, true);
  assert.notEqual(json.decision, 'RECOMMEND_AUTOMATION');
});

test('EGAC miss-rate endpoint exposes model assumptions and no authority', async () => {
  const response = await fetch(`${baseUrl}/api/egac/fcr?tiers=tier_2`);
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.advisoryOnly, true);
  assert.equal(json.authority, 'NONE');
  assert.equal(json.isProvableZero, false);
  assert.equal(json.modelAssumptionZero, true);
  assert.equal(json.evidenceStatus, 'ASSUMPTION_MODEL_ONLY');
  assert.ok(Array.isArray(json.assumptions));
});