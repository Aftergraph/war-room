'use strict';

const fs = require('fs');

class ToolFabricProjection {
  constructor() {
    this.snapshot = null;
    this.source = null;
    this.loadedAt = null;
    this.errors = [];
  }

  loadFile(file) {
    if (!file || !fs.existsSync(file)) {
      this.snapshot = null;
      this.source = file || null;
      this.loadedAt = null;
      this.errors = file ? ['snapshot_not_found'] : ['snapshot_not_configured'];
      return this.status();
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      this.snapshot = null;
      this.source = file;
      this.loadedAt = null;
      this.errors = ['snapshot_invalid_json'];
      return this.status();
    }
    return this.ingest(parsed, file);
  }

  ingest(snapshot, source = 'memory') {
    const errors = [];
    if (!snapshot || typeof snapshot !== 'object') errors.push('snapshot_required');
    const schema = snapshot && (snapshot.schemaVersion || snapshot.schema);
    if (!['aftergraph.tool-fabric-snapshot/v1', 'aftergraph.tool-registry/v1'].includes(schema)) {
      errors.push('unsupported_schema');
    }
    const tools = snapshot && Array.isArray(snapshot.tools) ? snapshot.tools : null;
    if (!tools) errors.push('tools_array_required');
    if (snapshot && snapshot.authorityGranted === true) errors.push('authority_claim_forbidden');
    if (snapshot && snapshot.credentialsExposed === true) errors.push('credential_exposure_forbidden');

    if (tools) {
      for (const tool of tools) {
        if (!tool || tool.schemaVersion !== 'aftergraph.tool/v1') errors.push('invalid_tool_descriptor');
        if (tool && tool.credentialMaterialExposed === true) errors.push('credential_exposure_forbidden');
      }
    }

    if (errors.length) {
      this.snapshot = null;
      this.source = source;
      this.loadedAt = null;
      this.errors = [...new Set(errors)];
      return this.status();
    }

    this.snapshot = JSON.parse(JSON.stringify(snapshot));
    this.source = source;
    this.loadedAt = new Date().toISOString();
    this.errors = [];
    return this.status();
  }

  status() {
    const tools = this.snapshot?.tools || [];
    const health = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
    const runtimes = {};
    const kinds = {};
    for (const tool of tools) {
      const state = tool.health?.state || 'unknown';
      health[state] = (health[state] || 0) + 1;
      runtimes[tool.runtime || 'unknown'] = (runtimes[tool.runtime || 'unknown'] || 0) + 1;
      kinds[tool.kind || 'unknown'] = (kinds[tool.kind || 'unknown'] || 0) + 1;
    }
    return {
      schemaVersion: 'aftergraph.war-room-tool-fabric/v1',
      available: Boolean(this.snapshot),
      source: this.source,
      loadedAt: this.loadedAt,
      toolCount: tools.length,
      observationCount: Number(this.snapshot?.observationCount || 0),
      generatedAt: this.snapshot?.generatedAt || null,
      federation: this.snapshot?.federation ? JSON.parse(JSON.stringify(this.snapshot.federation)) : null,
      health,
      runtimes,
      kinds,
      authorityGranted: false,
      credentialsExposed: false,
      errors: this.errors.slice(),
    };
  }

  listTools() {
    return this.snapshot?.tools ? JSON.parse(JSON.stringify(this.snapshot.tools)) : [];
  }
}

module.exports = { ToolFabricProjection };
