'use strict';
const assert = require('assert');
const { ToolFabricProjection } = require('../services/tool-fabric/src/projection');

const p = new ToolFabricProjection();

let status = p.ingest({
  schemaVersion: 'aftergraph.tool-fabric-snapshot/v1',
  observationCount: 12,
  authorityGranted: false,
  tools: [{
    schemaVersion: 'aftergraph.tool/v1',
    id: 'relay.system.health',
    version: '1.0.0',
    kind: 'mcp',
    capabilities: ['EXECUTION_OBSERVE'],
    runtime: 'relay',
    credentialBindings: [],
    health: { state: 'healthy' },
    provenance: { source: 'test', revision: 'abc', digest: 'a'.repeat(64) }
  }]
}, 'fixture');

assert.strictEqual(status.available, true);
assert.strictEqual(status.toolCount, 1);
assert.strictEqual(status.health.healthy, 1);
assert.strictEqual(status.authorityGranted, false);
assert.strictEqual(p.listTools()[0].id, 'relay.system.health');

status = p.ingest({
  schemaVersion: 'aftergraph.tool-fabric-snapshot/v1',
  authorityGranted: true,
  tools: []
}, 'unsafe');
assert.strictEqual(status.available, false);
assert.ok(status.errors.includes('authority_claim_forbidden'));

console.log('ToolFabric projection: PASS');


status = p.ingest({
  schemaVersion: 'aftergraph.tool-fabric-snapshot/v1',
  generatedAt: '2026-09-30T20:00:00.000Z',
  observationCount: 7,
  authorityGranted: false,
  credentialsExposed: false,
  federation: {
    schemaVersion: 'aftergraph.tool-federation-status/v1',
    healthy: false,
    sources: [
      { source: 'Aftergraph/relay', state: 'fresh', required: true, ageMs: 1000, ttlMs: 60000 },
      { source: 'Aftergraph/skills-vault', state: 'stale', required: false, ageMs: 130000, ttlMs: 120000 }
    ],
    activeToolCount: 1,
    quarantinedSources: ['Aftergraph/skills-vault'],
    authorityGranted: false
  },
  tools: [{
    schemaVersion: 'aftergraph.tool/v1',
    id: 'relay.system.health',
    version: '1.0.0',
    kind: 'mcp',
    capabilities: ['EXECUTION_OBSERVE'],
    runtime: 'relay',
    credentialBindings: [],
    health: { state: 'healthy' },
    provenance: { source: 'test', revision: 'abc', digest: 'a'.repeat(64) }
  }]
}, 'federated-fixture');

assert.strictEqual(status.generatedAt, '2026-09-30T20:00:00.000Z');
assert.strictEqual(status.federation.healthy, false);
assert.deepStrictEqual(status.federation.quarantinedSources, ['Aftergraph/skills-vault']);
assert.strictEqual(status.credentialsExposed, false);
