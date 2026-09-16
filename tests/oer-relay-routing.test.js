const test = require('node:test');
const assert = require('node:assert/strict');
const { RelayOperatorAdapter } = require('../integrations/relay/src/adapter');

const proposal = {
  decisionId: 'proposal:exec-cancel',
  targetRef: 'runtime-execution:rte_1',
  operation: 'runtime.execution.cancel',
  arguments: { execution_id: 'rte_1' },
  missionId: 'mis_123',
  assertionIds: ['ast_1'],
  sourceRefs: ['runtime:execution:rte_1'],
  evidenceRefs: ['evidence:execution:rte_1'],
  authority: 'NONE',
};

test('OER-224: Relay adapter uses only bounded execution invoke with execution lease', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ schema: 'aftergraph.execution-result/v1', result: { accepted: true } }) };
  };
  const adapter = new RelayOperatorAdapter({ baseUrl: 'http://relay.local:7847', executionToken: 'lease-secret', fetchImpl });
  const result = await adapter.submitDecisionProposal(proposal);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://relay.local:7847/api/execution/invoke');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer lease-secret');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, {
    operation: 'runtime.execution.cancel',
    mission_id: 'mis_123',
    arguments: { execution_id: 'rte_1' },
  });
  assert.equal(JSON.stringify(result).includes('lease-secret'), false);
});

test('OER-224: Relay adapter fails closed without configuration and rejects generic shell', async () => {
  const unconfigured = new RelayOperatorAdapter({ fetchImpl: async () => { throw new Error('must not call network'); } });
  await assert.rejects(unconfigured.submitDecisionProposal(proposal), /RELAY_EXECUTION_LEASE_REQUIRED/);

  const configured = new RelayOperatorAdapter({
    baseUrl: 'http://relay.local:7847',
    executionToken: 'lease-secret',
    fetchImpl: async () => { throw new Error('must not call network'); },
  });
  await assert.rejects(
    configured.submitDecisionProposal({ ...proposal, operation: 'shell.exec' }),
    /RELAY_OPERATION_NOT_ALLOWED/,
  );
});
