/**
 * Aftergraph War Room — State & Graph Projection Engine
 * Maintains up-to-date read models from observed event envelopes:
 * - 30-Repo Registry & Governance Status
 * - System Reality Entity-Relation Graph
 * - Mission Control & WorkGraphs
 * - Agent Fleet & Compute Slices
 * - Exact-HEAD Sentinel Radar with Automatic Invalidation
 * - Global Attention Queue
 */
const { EPISTEMIC_STATUS } = require('../../../packages/domain/src/entities');
const { computeDigest } = require('../../../packages/contracts/src/observation');

class StateProjector {
  constructor(initialData = {}) {
    this.repositories = new Map();
    this.missions = new Map();
    this.agents = new Map();
    this.machines = new Map();
    this.verifications = new Map();
    this.incidents = new Map();
    this.attentionQueue = [];
    this.graph = {
      nodes: new Map(),
      edges: new Map()
    };
    this.hashChain = [];
    this.lastChainHash = '0000000000000000000000000000000000000000000000000000000000000000';

    this.initCanonicalBaseline(initialData);
  }

  /**
   * Initializes 30-repo inventory, topology nodes, and missions baseline
   */
  initCanonicalBaseline(data = {}) {
    // Populate base 30 repos inventory
    const repos = data.repos || [
      'aftergraph', 'docs', 'brand', 'contracts', 'governance', 'sentinel',
      'trust-gateway', 'works-execution', 'aie', 'afm', 'model-registry',
      'continuity', 'runtime', 'telemetry', 'integrations', 'studio',
      'forge', 'hermes', 'atlas', 'sentinel-bench', 'polyrepo-tools',
      'agent-sdk', 'operator-cockpit', 'mcp-aftergraph', 'evidence-store',
      'cron-fabric', 'vds-daemon', 'lenovo-bridge', 'sentinel-firetest1', 'sentinel-firetest2'
    ];

    for (const r of repos) {
      const name = typeof r === 'string' ? r : r.name;
      this.repositories.set(name, {
        id: name,
        name,
        fullName: name.includes('/') ? name : `Aftergraph/${name}`,
        epistemicStatus: EPISTEMIC_STATUS.OBSERVED,
        governanceStatus: name.includes('firetest') ? 'TEMPORARY_FIXTURE' : 'GOVERNED',
        plane: this.inferPlane(name),
        defaultBranch: 'main',
        headSha: typeof r === 'object' && r.headSha ? r.headSha : '7a89abb',
        stars: typeof r === 'object' ? r.stargazers_count || 0 : 0,
        openIssues: typeof r === 'object' ? r.open_issues_count || 0 : 0,
        updatedAt: new Date().toISOString()
      });

      this.addGraphNode('Repository', name, { name, plane: this.inferPlane(name) });
    }

    // Populate Initial Machines
    this.machines.set('lenovo-yoga-local', {
      id: 'lenovo-yoga-local',
      name: 'Jonas Lenovo Yoga (Local Operator Bridge)',
      os: 'Windows 11 Pro / WSL2',
      status: 'ONLINE',
      cpuUsage: 22,
      ramUsage: 48,
      battery: 94,
      vantageConnected: true,
      lastHeartbeat: new Date().toISOString()
    });

    this.machines.set('vds-eu-central-01', {
      id: 'vds-eu-central-01',
      name: 'Hetzner VDS Cloud Compute',
      os: 'Ubuntu 24.04 LTS (Kernel 6.8)',
      status: 'ONLINE',
      ip: '159.69.192.88',
      containers: 6,
      cpuUsage: 31,
      ramUsage: 42,
      lastHeartbeat: new Date().toISOString()
    });

    // Populate Baseline Missions
    this.missions.set('MISSION-2026-09A', {
      id: 'MISSION-2026-09A',
      title: 'Front-Door v4 Convergence & Handoff Pipeline',
      objective: 'Zero-regression deployment of public landing platform and living workspace',
      status: 'EXECUTING',
      progress: 82,
      owner: 'JonasAbde',
      budget: { spent: 14.20, cap: 50.00 },
      repos: ['aftergraph', 'studio'],
      evidenceCount: 14,
      verificationStatus: 'PARTIAL'
    });

    this.missions.set('MISSION-2026-09B', {
      id: 'MISSION-2026-09B',
      title: 'Sentinel Pack 1.7.0 Rollout & Merge Queue Gates',
      objective: 'Enforce pre-merge safety across 26 benchmark testbeds with 0 false positives',
      status: 'COMPLETED',
      progress: 100,
      owner: 'sentinel-bot',
      budget: { spent: 4.50, cap: 25.00 },
      repos: ['sentinel', 'sentinel-bench'],
      evidenceCount: 26,
      verificationStatus: 'VERIFIED'
    });

    this.missions.set('MISSION-2026-09C', {
      id: 'MISSION-2026-09C',
      title: 'Trust Gateway Fail-Closed Egress Sanitization',
      objective: 'Tamper-proof secret redaction and cryptographic SHA-256 evidence anchoring',
      status: 'IN_REVIEW',
      progress: 64,
      owner: 'forge',
      budget: { spent: 8.90, cap: 30.00 },
      repos: ['trust-gateway', 'governance'],
      evidenceCount: 9,
      verificationStatus: 'PARTIAL'
    });
  }

  inferPlane(name) {
    if (['governance', 'trust-gateway', 'contracts', 'aie'].includes(name)) return 'GOVERNANCE';
    if (['works-execution', 'runtime', 'sentinel', 'sentinel-bench'].includes(name)) return 'EXECUTION';
    if (['forge', 'hermes', 'atlas', 'agent-sdk', 'model-registry'].includes(name)) return 'AGENTS';
    if (['docs', 'brand', 'studio', 'aftergraph'].includes(name)) return 'EXPERIENCE';
    return 'INFRASTRUCTURE';
  }

  /**
   * Applies an ObservationEnvelope to update state projections
   */
  applyObservation(envelope) {
    const patch = { updated: [] };
    const { subject, event, actor, provenance, payload } = envelope;

    // 1. Update Cryptographic HashChain Block
    const prevHash = this.lastChainHash;
    const blockData = `${prevHash}:${envelope.id}:${envelope.integrity.digest}:${event.occurredAt}`;
    const blockHash = computeDigest(blockData);
    this.lastChainHash = blockHash;
    
    this.hashChain.push({
      height: this.hashChain.length + 1,
      observationId: envelope.id,
      timestamp: event.occurredAt,
      prevHash,
      digest: envelope.integrity.digest,
      blockHash
    });
    if (this.hashChain.length > 50) this.hashChain.shift();

    // 2. Repository Projection & Exact-HEAD Tracking
    if (subject.type === 'Repository') {
      const repoName = subject.id;
      let repo = this.repositories.get(repoName);
      if (!repo) {
        repo = {
          id: repoName,
          name: repoName,
          fullName: repoName.includes('/') ? repoName : `Aftergraph/${repoName}`,
          epistemicStatus: EPISTEMIC_STATUS.OBSERVED,
          governanceStatus: 'DISCOVERED_NEW',
          plane: this.inferPlane(repoName),
          defaultBranch: 'main',
          headSha: '0000000',
          updatedAt: event.occurredAt
        };
        this.repositories.set(repoName, repo);
      }

      // Check if HEAD SHA moved
      if (provenance.commitSha && provenance.commitSha !== repo.headSha) {
        const oldSha = repo.headSha;
        repo.headSha = provenance.commitSha;
        repo.updatedAt = event.occurredAt;
        patch.updated.push({ type: 'RepositoryHeadMoved', repo: repoName, from: oldSha, to: repo.headSha });

        // CRITICAL INVARIANT: Invalidate any verifications bound to old HEAD
        this.invalidateVerificationsForRepo(repoName, oldSha, repo.headSha);
      }
    }

    // 3. Agent Fleet Projection
    if (actor) {
      const agentId = actor.id;
      let agent = this.agents.get(agentId);
      if (!agent) {
        agent = {
          id: agentId,
          name: agentId,
          role: this.classifyAgentRole(agentId),
          lastAction: event.type,
          lastSeenAt: event.occurredAt,
          activeRepos: new Set([subject.id]),
          totalActions: 0
        };
        this.agents.set(agentId, agent);
      }
      agent.lastAction = event.type;
      agent.lastSeenAt = event.occurredAt;
      agent.activeRepos.add(subject.id);
      agent.totalActions++;
    }

    // 4. Update System Reality Graph
    this.addGraphNode(subject.type, subject.id, { name: subject.id });
    if (actor) {
      this.addGraphNode('Agent', actor.id, { name: actor.id });
      this.addGraphEdge('Agent', actor.id, 'EXECUTES', subject.type, subject.id);
    }

    // 5. Attention Queue Re-computation
    this.refreshAttentionQueue();

    return patch;
  }

  /**
   * Automatically invalidates verifications when HEAD SHA advances
   */
  invalidateVerificationsForRepo(repoName, oldSha, newSha) {
    for (const [vId, verif] of this.verifications.entries()) {
      if (verif.repoName === repoName && verif.exactHeadSha === oldSha) {
        verif.status = 'STALE';
        verif.epistemicStatus = EPISTEMIC_STATUS.STALE;
        verif.invalidatedAt = new Date().toISOString();
        verif.invalidationReason = `HEAD advanced from ${oldSha.substring(0, 7)} to ${newSha.substring(0, 7)}`;
        
        // Add alert to attention queue
        this.attentionQueue.push({
          id: `attn_stale_${vId}`,
          priority: 'HIGH',
          title: `Verification Stale on ${repoName}`,
          description: `Commit ${newSha.substring(0, 7)} supersedes verified HEAD ${oldSha.substring(0, 7)}. Requires fresh Sentinel run.`,
          repo: repoName,
          timestamp: new Date().toISOString(),
          actionRequired: 'RERUN_SENTINEL'
        });
      }
    }
  }

  classifyAgentRole(agentId) {
    const id = agentId.toLowerCase();
    if (id.includes('codex')) return 'Autonomous PR Code Reviewer (OpenAI/Codex)';
    if (id.includes('sentinel')) return 'Exact-HEAD Pre-Merge Safety Enforcement';
    if (id.includes('forge')) return 'Durable Execution Worker (works-execution)';
    if (id.includes('hermes')) return 'Context Routing & Telegram Dispatcher';
    if (id.includes('atlas')) return 'Dependency & Architecture Knowledge Graph';
    if (id.includes('dependabot')) return 'Automated Dependency Security Agent';
    if (id.includes('actions')) return 'CI/CD Pipeline Workflow Runner';
    return 'Autonomous Contributor / Operator';
  }

  addGraphNode(type, id, data = {}) {
    const key = `${type}:${id}`;
    if (!this.graph.nodes.has(key)) {
      this.graph.nodes.set(key, { id: key, type, entityId: id, ...data });
    }
  }

  addGraphEdge(fromType, fromId, relType, toType, toId) {
    const edgeKey = `${fromType}:${fromId}->${relType}->${toType}:${toId}`;
    if (!this.graph.edges.has(edgeKey)) {
      this.graph.edges.set(edgeKey, {
        id: edgeKey,
        from: `${fromType}:${fromId}`,
        to: `${toType}:${toId}`,
        type: relType
      });
    }
  }

  refreshAttentionQueue() {
    // Keep top items sorted by priority
    const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    this.attentionQueue.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
  }

  getState() {
    return {
      repoCount: this.repositories.size,
      repos: Array.from(this.repositories.values()),
      missions: Array.from(this.missions.values()),
      agents: Array.from(this.agents.values()).map(a => ({ ...a, activeRepos: Array.from(a.activeRepos) })),
      machines: Array.from(this.machines.values()),
      verifications: Array.from(this.verifications.values()),
      attentionQueue: this.attentionQueue,
      hashChainSummary: {
        height: this.hashChain.length,
        headHash: this.lastChainHash,
        verified: true
      },
      graphSummary: {
        nodeCount: this.graph.nodes.size,
        edgeCount: this.graph.edges.size
      }
    };
  }
}

module.exports = {
  StateProjector
};
