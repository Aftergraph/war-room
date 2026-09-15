/**
 * Aftergraph War Room — External App & MCP Integration Registry (Section 10)
 * Tracks connection health, rate limits, latency, dependent missions, and credential bindings.
 * Zero plaintext secrets: only credentialBinding IDs and expiry timestamps are stored.
 */

const INTEGRATION_DEFINITIONS = [
  {
    id: 'github',
    name: 'GitHub Platform API',
    type: 'Code / VCS',
    status: 'ONLINE',
    latencyMs: 42,
    errorRate: '0.01%',
    quota: { remaining: 4850, limit: 5000, unit: 'req/hr' },
    credentialBindingId: 'cb_gh_pat_scoped',
    scope: ['repo:read', 'workflow', 'pull_requests'],
    dependentMissions: ['MISSION-2026-09A', 'MISSION-2026-09B'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'telegram',
    name: 'Telegram Bot API (@AftergraphWatchdogBot)',
    type: 'Messaging & Transport',
    status: 'ONLINE',
    latencyMs: 65,
    errorRate: '0.00%',
    quota: { remaining: 2980, limit: 3000, unit: 'msg/min' },
    credentialBindingId: 'cb_tg_bot_token',
    scope: ['messages:send', 'webhook:receive'],
    dependentMissions: ['MISSION-2026-09A'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'supabase',
    name: 'Supabase Postgres & Edge Functions',
    type: 'Persistence & Vector',
    status: 'ONLINE',
    latencyMs: 18,
    errorRate: '0.00%',
    quota: { remaining: 98000, limit: 100000, unit: 'queries/day' },
    credentialBindingId: 'cb_sb_service_role',
    scope: ['db:read', 'db:write:governed', 'storage'],
    dependentMissions: ['MISSION-2026-09C'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers & R2 Storage',
    type: 'Edge & Compute',
    status: 'ONLINE',
    latencyMs: 12,
    errorRate: '0.00%',
    quota: { remaining: 890000, limit: 1000000, unit: 'invocations/day' },
    credentialBindingId: 'cb_cf_api_token',
    scope: ['workers:deploy', 'r2:buckets'],
    dependentMissions: ['MISSION-2026-09A'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude API (Claude 3.5 Sonnet)',
    type: 'LLM Reasoning Engine',
    status: 'ONLINE',
    latencyMs: 420,
    errorRate: '0.02%',
    quota: { remaining: 185000, limit: 200000, unit: 'tokens/min' },
    credentialBindingId: 'cb_anthropic_v1',
    scope: ['messages:create'],
    dependentMissions: ['MISSION-2026-09A', 'MISSION-2026-09B'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'openai',
    name: 'OpenAI API (GPT-4o & Codex Reviewer)',
    type: 'LLM Reasoning & Review',
    status: 'ONLINE',
    latencyMs: 380,
    errorRate: '0.01%',
    quota: { remaining: 290000, limit: 300000, unit: 'tokens/min' },
    credentialBindingId: 'cb_openai_v1',
    scope: ['chat:completions', 'embeddings'],
    dependentMissions: ['MISSION-2026-09B'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'gemini',
    name: 'Google Gemini Pro 2.5 API',
    type: 'Multimodal / Long Context',
    status: 'ONLINE',
    latencyMs: 290,
    errorRate: '0.00%',
    quota: { remaining: 950000, limit: 1000000, unit: 'tokens/min' },
    credentialBindingId: 'cb_google_gemini_v1',
    scope: ['models:generateContent'],
    dependentMissions: ['MISSION-2026-09C'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace (Gmail / Calendar / Drive)',
    type: 'External Collaboration',
    status: 'ONLINE',
    latencyMs: 85,
    errorRate: '0.00%',
    quota: { remaining: 14200, limit: 15000, unit: 'queries/day' },
    credentialBindingId: 'cb_gsuite_oauth',
    scope: ['drive.readonly', 'gmail.send', 'calendar.events'],
    dependentMissions: ['MISSION-2026-09A'],
    lastSuccess: new Date().toISOString()
  },
  {
    id: 'mcp-servers',
    name: 'Aftergraph MCP Tool Connectors',
    type: 'Model Context Protocol',
    status: 'ONLINE',
    latencyMs: 8,
    errorRate: '0.00%',
    quota: { remaining: 10000, limit: 10000, unit: 'local RPC' },
    credentialBindingId: 'cb_mcp_local',
    scope: ['fs.read', 'contracts.inspect', 'sentinel.verify'],
    dependentMissions: ['MISSION-2026-09A', 'MISSION-2026-09B', 'MISSION-2026-09C'],
    lastSuccess: new Date().toISOString()
  }
];

class IntegrationRegistry {
  constructor() {
    this.integrations = new Map();
    for (const item of INTEGRATION_DEFINITIONS) {
      this.integrations.set(item.id, { ...item });
    }
  }

  getAll() {
    return Array.from(this.integrations.values());
  }

  get(id) {
    return this.integrations.get(id) || null;
  }

  recordLatency(id, ms, success = true) {
    const item = this.integrations.get(id);
    if (item) {
      item.latencyMs = ms;
      if (success) {
        item.lastSuccess = new Date().toISOString();
      } else {
        item.lastFailure = new Date().toISOString();
      }
    }
  }
}

module.exports = {
  IntegrationRegistry,
  INTEGRATION_DEFINITIONS
};
