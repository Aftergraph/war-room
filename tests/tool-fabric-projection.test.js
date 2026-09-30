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
