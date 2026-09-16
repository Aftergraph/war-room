const GOVERNED_RELAY_OPERATIONS = new Set([
  'runtime.execution.inspect',
  'runtime.execution.cancel',
  'runtime.service.inspect',
  'runtime.service.restart',
  'runtime.host.drain'
]);

class RelayOperatorAdapter {
  constructor({ baseUrl = '', executionToken = '', fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.executionToken = String(executionToken || '');
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.executionToken && typeof this.fetchImpl === 'function');
  }

  async submitDecisionProposal(proposal) {
    if (!GOVERNED_RELAY_OPERATIONS.has(proposal?.operation)) {
      throw new Error('RELAY_OPERATION_NOT_ALLOWED');
    }
    if (!this.isConfigured()) throw new Error('RELAY_EXECUTION_LEASE_REQUIRED');
    const response = await this.fetchImpl(`${this.baseUrl}/api/execution/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.executionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation: proposal.operation,
        mission_id: proposal.missionId || null,
        arguments: { ...(proposal.arguments || {}) }
      })
    });

    if (!response || !response.ok) {
      const status = response?.status || 503;
      let code = 'RELAY_ROUTE_FAILED';
      try {
        const body = await response.json();
        code = body?.detail?.code || body?.error || code;
      } catch (_) {}
      throw new Error(`RELAY_ROUTE_FAILED:${status}:${code}`);
    }
    return response.json();
  }
}

module.exports = { RelayOperatorAdapter, GOVERNED_RELAY_OPERATIONS };
