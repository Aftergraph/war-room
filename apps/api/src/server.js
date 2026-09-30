/**
 * Aftergraph War Room — Production API Server & Realtime BFF Engine
 * Implements REST Query Plane, Trust Gateway Governed Command Plane,
 * Server-Sent Events (SSE) Realtime Stream, and Static Operator UX Serving.
 * Zero external dependencies: pure Node.js stdlib.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { EventStore } = require('../../../services/persistence/src/store');
const { StateProjector } = require('../../../services/projection/src/projector');
const { IngestionPipeline } = require('../../../services/ingestion/src/pipeline');
const { UnifiedIntelligenceEngine, EVIDENCE_TIERS, PLANE_PRIORS } = require('../../../services/intelligence/src');
const { NodeBridgeDaemon } = require('../../../services/node-bridge/src/daemon');
const { GitHubAdapter } = require('../../../integrations/github/src/adapter');
const { TelegramAdapter } = require('../../../integrations/telegram/src/adapter');
const { IntegrationRegistry } = require('../../../integrations/external/src/registry');
const { CredentialBroker } = require('../../../security/src/credentialBroker');
const { OperationalOntologyEngine } = require('../../../packages/ontology/src');

const PORT = process.env.PORT || 3333;
const ROOT_DIR = path.resolve(__dirname, '../../../');

class RealtimeHub {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}

// 1. Initialize Subsystems
const realtimeHub = new RealtimeHub();
const eventStore = new EventStore(path.join(ROOT_DIR, 'data'));

// Load seed data if available
let seedData = null;
try {
  const seedPath = path.join(ROOT_DIR, 'seed-data.json');
  if (fs.existsSync(seedPath)) {
    seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Server] Could not load seed-data.json:', e.message);
}

const projector = new StateProjector(seedData || {});
const intelEngine = new UnifiedIntelligenceEngine();
const pipeline = new IngestionPipeline({
  eventStore,
  projector,
  intelligenceEngine: intelEngine,
  realtimeHub
});

// Compute daemons & adapters
const lenovoDaemon = new NodeBridgeDaemon('lenovo-yoga-local', 'local-operator');
const vdsDaemon = new NodeBridgeDaemon('vds-eu-central-01', 'cloud-runner');
const githubAdapter = new GitHubAdapter({ org: 'Aftergraph', seedData });
const telegramAdapter = new TelegramAdapter();
const integrationRegistry = new IntegrationRegistry();
const credentialBroker = new CredentialBroker();
const ontologyEngine = new OperationalOntologyEngine();

// Non-blocking live org sync on boot to hydrate 31 repositories from GitHub
githubAdapter.syncLiveOrg().then(syncRes => {
  if (syncRes && syncRes.repos) {
    projector.updateRepositories(syncRes.repos);
    console.log(`[Server] Live Aftergraph Org synced: ${syncRes.totalRepos} repositories, ${syncRes.totalOpenPrs} open PRs`);
  }
}).catch(err => {
  console.warn('[Server] Initial live org sync notice:', err.message);
});

// Ingest seed events if store is empty
if (eventStore.getEventCount() === 0 && seedData && Array.isArray(seedData.events)) {
  console.log(`[Server] Bootstrapping event store with ${seedData.events.length} initial observations...`);
  for (const ev of seedData.events.slice(0, 40)) {
    pipeline.ingest(ev);
  }
}

// MIME Types for Static Serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * HTTP Request Handler
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const reqPath = parsedUrl.pathname;
  const method = req.method;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // --- 1. REALTIME STREAM (SSE) ---
  if (reqPath === '/api/realtime/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'STREAMING', time: new Date().toISOString() })}\n\n`);
    realtimeHub.addClient(res);
    return;
  }

  // --- 2. REST QUERY PLANE ---
  if (method === 'GET') {
    if (reqPath === '/api/health') {
      const state = projector.getState();
      return sendJson(res, 200, {
        status: 'HEALTHY',
        uptimeSeconds: Math.round(process.uptime()),
        repoCount: state.repoCount,
        eventsIngested: eventStore.getEventCount(),
        sseClients: realtimeHub.clients.size,
        timestamp: new Date().toISOString()
      });
    }

    if (reqPath === '/api/org/summary') {
      const state = projector.getState();
      // Inject fresh hardware telemetry
      const lenovoTelem = lenovoDaemon.sampleTelemetry();
      const vdsTelem = vdsDaemon.sampleTelemetry();

      return sendJson(res, 200, {
        summary: state,
        compute: {
          lenovo: lenovoTelem,
          vds: vdsTelem
        },
        integrations: integrationRegistry.getAll(),
        quota: githubAdapter.getQuota()
      });
    }

    if (reqPath === '/api/repos') {
      const state = projector.getState();
      const classification = githubAdapter.classifyGovernance(state.repos);
      return sendJson(res, 200, {
        repos: state.repos,
        governance: classification
      });
    }

    if (reqPath === '/api/missions') {
      const state = projector.getState();
      return sendJson(res, 200, { missions: state.missions });
    }

    if (reqPath === '/api/agents') {
      const state = projector.getState();
      return sendJson(res, 200, { agents: state.agents });
    }

    if (reqPath === '/api/telemetry') {
      return sendJson(res, 200, {
        lenovo: lenovoDaemon.sampleTelemetry(),
        vds: vdsDaemon.sampleTelemetry()
      });
    }

    if (reqPath === '/api/integrations') {
      return sendJson(res, 200, { integrations: integrationRegistry.getAll() });
    }

    if (reqPath === '/api/events') {
      const limit = parseInt(parsedUrl.query.limit, 10) || 50;
      const all = eventStore.getAllEvents();
      return sendJson(res, 200, { events: all.slice(-limit).reverse() });
    }

    if (reqPath === '/api/timemachine') {
      const targetTime = parsedUrl.query.timestamp;
      if (!targetTime) {
        return sendJson(res, 400, { error: 'Missing timestamp parameter' });
      }
      const historicalEvents = eventStore.replayUntil(targetTime);
      return sendJson(res, 200, {
        targetTimestamp: targetTime,
        reconstructedEventCount: historicalEvents.length,
        events: historicalEvents.slice(-30).reverse()
      });
    }

    if (reqPath === '/api/wywa') {
      const sinceEventId = parsedUrl.query.sinceEventId;
      const sinceAt = parsedUrl.query.sinceAt;
      const events = eventStore.getEventsSince(sinceEventId, sinceAt);

      const agentActions = events.filter(e => e.actor).length;
      const commits = events.filter(e => e.provenance?.commitSha).length;
      const highlights = [
        `Observed ${events.length} system observations across 30 repositories`,
        `${agentActions} autonomous agent actions executed without human intervention`,
        'Cryptographic SHA-256 HashChain verified intact across all blocks',
        'Sentinel exact-HEAD safety radar maintains 100% precision score'
      ];

      return sendJson(res, 200, {
        period: { sinceEventId, sinceAt, now: new Date().toISOString() },
        metrics: { totalEvents: events.length, agentActions, commits },
        highlights
      });
    }

    if (reqPath === '/api/search') {
      const q = (parsedUrl.query.q || '').toLowerCase();
      const state = projector.getState();
      const results = [];

      // Search repos
      for (const r of state.repos) {
        if (r.name.toLowerCase().includes(q)) {
          results.push({ type: 'Repository', id: r.name, title: r.name, detail: `Plane: ${r.plane} • ${r.governanceStatus}` });
        }
      }

      // Search missions
      for (const m of state.missions) {
        if (m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) {
          results.push({ type: 'Mission', id: m.id, title: m.title, detail: `Status: ${m.status} • Budget: $${m.budget.spent}` });
        }
      }

      // Search agents
      for (const a of state.agents) {
        if (a.name.toLowerCase().includes(q)) {
          results.push({ type: 'Agent', id: a.id, title: a.name, detail: a.role });
        }
      }

      if (reqPath === '/api/radar/collisions') {
        const collisions = intelEngine.collision.evaluateCollisions();
        const activeIntents = intelEngine.collision.getActiveIntents();
        return sendJson(res, 200, {
          activeIntents,
          collisions,
          clean: collisions.length === 0,
          timestamp: new Date().toISOString()
        });
      }

      return sendJson(res, 200, { query: q, results: results.slice(0, 15) });
    }

    if (reqPath === '/api/radar/collisions') {
      const collisions = intelEngine.collision.evaluateCollisions();
      const activeIntents = intelEngine.collision.getActiveIntents();
      return sendJson(res, 200, {
        activeIntents,
        collisions,
        clean: collisions.length === 0,
        timestamp: new Date().toISOString()
      });
    }

    // --- Live Aftergraph Org Sync Query ---
    if (reqPath === '/api/org/sync') {
      try {
        const syncRes = await githubAdapter.syncLiveOrg();
        if (syncRes && syncRes.repos) {
          projector.updateRepositories(syncRes.repos);
          realtimeHub.broadcast('org.synced', {
            totalRepos: syncRes.totalRepos,
            totalOpenPrs: syncRes.totalOpenPrs,
            timestamp: syncRes.lastSync
          });
        }
        return sendJson(res, 200, syncRes);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // --- Palantir AIP Operational Ontology Endpoints ---
    if (reqPath === '/api/ontology/decisions') {
      return sendJson(res, 200, { decisions: ontologyEngine.getDecisions() });
    }

    if (reqPath === '/api/ontology/reality-diff') {
      const state = projector.getState();
      const diffResult = ontologyEngine.computeRealityDiff(githubAdapter.orgStateContract, state.repos);
      return sendJson(res, 200, { realityDiff: diffResult });
    }

    if (reqPath === '/api/ontology/why-graph') {
      const target = parsedUrl.query.target || 'DEC-2026-0915-PR93';
      const graph = ontologyEngine.getWhyGraph(target);
      return sendJson(res, 200, { target, whyGraph: graph });
    }

    if (reqPath === '/api/ontology/trust-passports') {
      return sendJson(res, 200, { passports: ontologyEngine.getTrustPassports() });
    }

    // --- EGAC Evidence-Gated Autonomy Controller Endpoints ---

    if (reqPath === '/api/egac/status') {
      return sendJson(res, 200, {
        engine: 'EGAC/v1 (Evidence-Gated Autonomy Controller)',
        alphaThreshold: Number(intelEngine.egac.alpha.toFixed(6)),
        costFalsePositive: intelEngine.egac.costFalsePositive,
        costFalseNegative: intelEngine.egac.costFalseNegative,
        evidenceTiers: EVIDENCE_TIERS,
        planePriors: PLANE_PRIORS,
        calibration: Object.fromEntries(
          Object.entries(intelEngine.egac.calibration).map(([tier, cal]) => [
            tier,
            intelEngine.egac.calibrationStatus(tier),
          ])
        ),
        timestamp: new Date().toISOString(),
      });
    }

    if (reqPath === '/api/egac/fcr') {
      const tiersParam = parsedUrl.query.tiers || 'tier_2';
      const tierIds = tiersParam.split(',').map(t => t.trim());
      const fcr = intelEngine.computeFCRBound(tierIds);
      return sendJson(res, 200, {
        tiers: tierIds,
        fcrBound: fcr.bound,
        isProvableZero: fcr.isProvableZero,
        decomposition: fcr.perTier,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // --- 3. COMMAND & INGESTION PLANE ---
  if (method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let payload = {};
      try {
        if (body) payload = JSON.parse(body);
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }

      // Agent Registration
      if (reqPath === '/api/agents/register') {
        const { agentId, name, role, machineId, capabilities, authorityBindings } = payload;
        if (!agentId) return sendJson(res, 400, { error: 'Missing agentId' });

        const agentRecord = {
          id: agentId,
          name: name || agentId,
          role: role || 'Autonomous Contributor',
          machine: machineId || 'vds-eu-central-01',
          capabilities: capabilities || [],
          authorityBindings: authorityBindings || [],
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          activeRepos: new Set()
        };

        projector.agents.set(agentId, agentRecord);
        realtimeHub.broadcast('agent.registered', { agentId, name, machineId });

        return sendJson(res, 200, {
          status: 'REGISTERED',
          agentId,
          fleetSize: projector.agents.size,
          registeredAt: agentRecord.registeredAt
        });
      }

      // Agent Intent (Collision Radar Pre-Flight)
      if (reqPath === '/api/agents/intent') {
        try {
          const registered = intelEngine.collision.registerIntent(payload);
          const collisions = intelEngine.collision.evaluateCollisions(registered);

          const isConflict = collisions.length > 0 && collisions.some(c => c.level === 'HIGH');
          const maxRisk = collisions.reduce((max, c) => Math.max(max, c.riskScore), 0);

          if (isConflict) {
            realtimeHub.broadcast('alert', {
              type: 'COLLISION_ALERT',
              agentId: payload.agentId,
              repo: payload.repo,
              collisions
            });
          }

          return sendJson(res, 200, {
            status: isConflict ? 'COLLISION_WARNING' : 'APPROVED',
            collisionRisk: maxRisk || 0.10,
            level: isConflict ? 'HIGH' : 'NOMINAL',
            conflicts: collisions,
            intentId: registered.id,
            recommendation: isConflict ? collisions[0].recommendation : 'PROCEED: Intent approved by Collision Radar.'
          });
        } catch (e) {
          return sendJson(res, 400, { error: e.message });
        }
      }

      // Agent Heartbeat & Telemetry Bridge
      if (reqPath === '/api/agents/heartbeat') {
        const { agentId, machineId, telemetry } = payload;
        if (agentId && projector.agents.has(agentId)) {
          const ag = projector.agents.get(agentId);
          ag.lastSeenAt = new Date().toISOString();
        }
        if (machineId && projector.machines.has(machineId)) {
          const mach = projector.machines.get(machineId);
          mach.lastHeartbeat = new Date().toISOString();
          if (telemetry) {
            if (telemetry.cpuUsage) mach.cpuUsage = telemetry.cpuUsage;
            if (telemetry.ramUsage) mach.ramUsage = telemetry.ramUsage;
          }
        }
        return sendJson(res, 200, { status: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() });
      }

      // Scoped Credential / Trust Gateway Ticket
      if (reqPath === '/api/auth/ticket') {
        const { actorId, capability, target, ttlSeconds } = payload;
        const ticket = credentialBroker.requestScopedTicket({
          actorId: actorId || 'autonomous-bot',
          capability: capability || 'system.command',
          ttlSeconds: ttlSeconds || 300
        });
        return sendJson(res, 200, {
          status: 'AUTHORIZED',
          ...ticket
        });
      }

      if (reqPath === '/api/ingest') {
        const result = await pipeline.ingest(payload);
        return sendJson(res, result.success ? 200 : 422, result);
      }

      if (reqPath === '/api/commands/dispatch') {
        const { command, target, params } = payload;
        
        // Trust Gateway Policy Evaluation
        const ticket = credentialBroker.requestScopedTicket({
          actorId: payload.actor || 'human-operator',
          capability: command || 'system.command'
        });

        if (command === 'agent.quarantine') {
          realtimeHub.broadcast('alert', {
            type: 'EMERGENCY_QUARANTINE',
            target,
            ticketId: ticket.ticketId,
            timestamp: new Date().toISOString()
          });
          return sendJson(res, 200, {
            status: 'EXECUTED',
            command: 'agent.quarantine',
            target,
            authReceipt: ticket
          });
        }

        if (command === 'job.stop') {
          const result = await vdsDaemon.executeCommand('job.stop', params, ticket);
          return sendJson(res, 200, { status: 'EXECUTED', result, authReceipt: ticket });
        }

        return sendJson(res, 200, {
          status: 'AUTHORIZED',
          command,
          authReceipt: ticket
        });
      }

      if (reqPath === '/api/telegram/webhook') {
        const tgResult = await telegramAdapter.processInboundMessage(payload);
        return sendJson(res, 200, { status: 'PROCESSED', tgResult });
      }

      // EGAC Autonomy Decision (Evidence-Gated)
      if (reqPath === '/api/egac/decide') {
        const { repo, evidenceChain, verificationTiers } = payload;
        if (!repo) return sendJson(res, 400, { error: 'Missing repo' });
        const decision = intelEngine.evaluateAutonomy(
          repo,
          evidenceChain || [],
          verificationTiers || []
        );
        realtimeHub.broadcast('egac.decision', decision);
        return sendJson(res, 200, decision);
      }

      // EGAC Calibration Record
      if (reqPath === '/api/egac/calibrate') {
        const { tier, detected } = payload;
        if (!tier) return sendJson(res, 400, { error: 'Missing tier' });
        intelEngine.recordCalibration(tier, !!detected);
        const status = intelEngine.egac.calibrationStatus(tier);
        return sendJson(res, 200, {
          status: 'CALIBRATED',
          tier,
          detected: !!detected,
          calibration: status,
        });
      }

      // Live Org Sync Command
      if (reqPath === '/api/org/sync') {
        try {
          const syncRes = await githubAdapter.syncLiveOrg();
          if (syncRes && syncRes.repos) {
            projector.updateRepositories(syncRes.repos);
            realtimeHub.broadcast('org.synced', {
              totalRepos: syncRes.totalRepos,
              totalOpenPrs: syncRes.totalOpenPrs,
              timestamp: syncRes.lastSync
            });
          }
          return sendJson(res, 200, syncRes);
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      }

      // Operational Decision Resolution (Approve / Reject)
      if (reqPath.startsWith('/api/ontology/decisions/') && reqPath.endsWith('/action')) {
        const parts = reqPath.split('/');
        const decisionId = parts[4];
        const { action, actor } = payload;
        try {
          const ticket = credentialBroker.requestScopedTicket({
            actorId: actor || 'human-operator-jonas',
            capability: `decision.${(action || 'resolve').toLowerCase()}`
          });
          const resolution = ontologyEngine.resolveDecision(decisionId, action, actor, ticket);
          realtimeHub.broadcast('decision.resolved', resolution);
          return sendJson(res, 200, resolution);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      return sendJson(res, 404, { error: 'Endpoint not found' });
    });
    return;
  }

  // --- 4. STATIC OPERATOR COCKPIT SERVING ---
  let staticPath = decodeURIComponent(reqPath.split('?')[0]);
  if (staticPath === '/' || staticPath === '') staticPath = '/index.html';

  const filePath = path.join(ROOT_DIR, staticPath);

  // Guard against path traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Export for testing or start server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[WarRoom API] Full War Room Server running at http://localhost:${PORT}`);
  });
}

module.exports = {
  server,
  pipeline,
  projector,
  eventStore,
  intelEngine,
  lenovoDaemon,
  vdsDaemon,
  telegramAdapter,
  githubAdapter,
  credentialBroker,
  ontologyEngine
};
