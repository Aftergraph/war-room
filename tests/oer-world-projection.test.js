const test = require('node:test');
const assert = require('node:assert/strict');
const { OperationalOntologyEngine } = require('../packages/ontology/src');

const assertion = (overrides = {}) => ({
  schema: 'world-assertion/0.1',
  assertion_id: 'ast_host_health',
  subject: 'host:jonas-lenovo',
  predicate: 'health',
  value_or_ref: 'degraded',
  epistemic: 'observed',
  currentness: 'current',
  source_refs: ['runtime:host-snapshot:42'],
  evidence_refs: ['evidence:host-snapshot:42'],
  observed_at: '2026-09-16T18:00:00.000Z',
  evidence_observed_at: '2026-09-16T18:00:00.000Z',
  asserted_at: '2026-09-16T18:00:00.000Z',
  valid_until: '2026-09-16T18:05:00.000Z',
  tenant_id: 'tenant:aftergraph',
  domain: 'runtime-host',
  classification: 'internal',
  consent_record: 'consent:ops',
  consent_version: '1',
  purpose: 'operational-safety',
  evidence_requirement: 'current_observed',
  ...overrides,
});
test('OER-221/222: projects V4 assertions without inventing authority or truth', () => {
  const ontology = new OperationalOntologyEngine();
  const projected = ontology.projectWorldAssertions([
    assertion(),
    assertion({
      assertion_id: 'ast_process_host',
      subject: 'process:6696',
      predicate: 'runs_on',
      value_or_ref: 'host:jonas-lenovo',
    }),
  ]);

  assert.equal(projected.assertions.length, 2);
  assert.deepEqual(projected.assertions[0].source_refs, ['runtime:host-snapshot:42']);
  assert.equal(projected.assertions[0].epistemic, 'observed');
  assert.equal(projected.assertions[0].currentness, 'current');
  assert.equal(projected.authority, 'NONE');
  assert.equal(projected.canonicalTruth, false);
  assert.deepEqual(ontology.getDecisions(), []);
  assert.deepEqual(ontology.getTrustPassports(), []);

  const graph = ontology.getOperationalGraph();
  assert.ok(graph.objects.some((node) => node.id === 'host:jonas-lenovo'));
  assert.ok(graph.objects.some((node) => node.id === 'process:6696'));
  assert.ok(graph.links.some((link) => link.from === 'process:6696' && link.to === 'host:jonas-lenovo' && link.relation === 'runs_on'));
});
test('OER-223: Situation and WhyGraph are derived only from explicit assertions', () => {
  const ontology = new OperationalOntologyEngine();
  ontology.projectWorldAssertions([
    assertion(),
    assertion({
      assertion_id: 'ast_incident_cause',
      subject: 'incident:inc_1',
      predicate: 'likely_cause',
      value_or_ref: 'process:6696',
      epistemic: 'inferred',
      source_refs: ['runtime:incident:inc_1'],
      evidence_refs: ['evidence:process-tree:6696'],
    }),
    assertion({
      assertion_id: 'ast_process_host',
      subject: 'process:6696',
      predicate: 'runs_on',
      value_or_ref: 'host:jonas-lenovo',
    }),
  ]);

  const situation = ontology.buildSituation('host:jonas-lenovo');
  assert.equal(situation.authority, 'NONE');
  assert.ok(situation.assertionIds.includes('ast_host_health'));
  assert.ok(situation.sourceRefs.includes('runtime:host-snapshot:42'));

  const why = ontology.getWhyGraph('host:jonas-lenovo');
  assert.equal(why.sourceBacked, true);
  assert.ok(why.edges.some((edge) => edge.relation === 'runs_on'));
  assert.deepEqual(ontology.getWhyGraph('host:missing').edges, []);
});
test('OER-223: assertion reality diff preserves expected and observed provenance', () => {
  const ontology = new OperationalOntologyEngine();
  const expected = assertion({
    assertion_id: 'ast_expected_instance_count',
    subject: 'service:remote-mcp.lenovo',
    predicate: 'instance_count',
    value_or_ref: '1',
    source_refs: ['governance:remote-mcp-singleton'],
    evidence_refs: ['contract:remote-mcp-singleton'],
  });
  const observed = assertion({
    assertion_id: 'ast_observed_instance_count',
    subject: 'service:remote-mcp.lenovo',
    predicate: 'instance_count',
    value_or_ref: '2',
    source_refs: ['runtime:service-snapshot:77'],
    evidence_refs: ['evidence:service-snapshot:77'],
  });

  const diff = ontology.computeAssertionRealityDiff([expected], [observed]);
  assert.equal(diff.diffs.length, 1);
  assert.equal(diff.diffs[0].status, 'DRIFT');
  assert.equal(diff.diffs[0].expected, '1');
  assert.equal(diff.diffs[0].observed, '2');
  assert.deepEqual(diff.diffs[0].expectedSourceRefs, ['governance:remote-mcp-singleton']);
  assert.deepEqual(diff.diffs[0].observedSourceRefs, ['runtime:service-snapshot:77']);
});
test('OER-224: source-backed decisions route to Relay and never resolve locally', async () => {
  const ontology = new OperationalOntologyEngine();
  ontology.projectWorldAssertions([
    assertion({
      assertion_id: 'ast_service_count',
      subject: 'service:remote-mcp.lenovo',
      predicate: 'instance_count',
      value_or_ref: '2',
    }),
  ]);
  const proposal = ontology.createDecisionProposal({
    id: 'proposal:remote-mcp-singleton',
    title: 'Restore Remote MCP singleton ownership',
    targetRef: 'service:remote-mcp.lenovo',
    operation: 'runtime.service.restart',
    arguments: { service_id: 'service:remote-mcp.lenovo' },
    assertionIds: ['ast_service_count'],
  });
  assert.equal(proposal.status, 'PROPOSED');
  assert.equal(proposal.authority, 'NONE');
  assert.equal(proposal.executable, false);
  assert.throws(
    () => ontology.resolveDecision(proposal.id, 'APPROVE', 'operator', { canonical: true, reference: 'pdr_external' }),
    /LOCAL_DECISION_RESOLUTION_DISABLED/,
  );
  const calls = [];
  const relay = {
    submitDecisionProposal: async (input) => {
      calls.push(input);
      return { schema: 'aftergraph.execution-result/v1', operation: input.operation, result: { accepted: true } };
    },
  };
  const routed = await ontology.routeDecisionProposal(proposal.id, relay);
  assert.equal(routed.status, 'ROUTED_TO_RELAY');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'runtime.service.restart');
  assert.deepEqual(calls[0].sourceRefs, ['runtime:host-snapshot:42']);
  assert.equal(ontology.getDecisions()[0].status, 'PROPOSED');

  assert.throws(
    () => ontology.createDecisionProposal({
      id: 'proposal:shell', title: 'bad', targetRef: 'host:jonas-lenovo',
      operation: 'shell.exec', arguments: { command: 'whoami' }, assertionIds: ['ast_service_count'],
    }),
    /RELAY_OPERATION_NOT_ALLOWED/,
  );
});
