/**
 * Aftergraph War Room — Palantir AIP-Style Operational Ontology Engine
 * Unifies Data + Logic + Actions + Security into an operational substrate:
 * 1. Decision Objects & Decision Inbox (1-click governed authority execution)
 * 2. Expected vs. Observed Reality Diff (Contract declared vs. Live observed)
 * 3. Why Graph (Causal explainability DAG from root cause to remedy)
 * 4. Agent Trust Passports & Autonomy Frontier (L1-L4 bounded agency)
 * 5. Action Preview (Pre-flight blast radius simulation)
 */
const { computeDigest } = require('../../contracts/src/observation');

class OperationalOntologyEngine {
  constructor(options = {}) {
    this.decisions = new Map();
    this.trustPassports = new Map();
    if (options.seedFixtures === true) {
      this.initDefaultPassports();
      this.initCanonicalDecisions();
    }
  }

  /**
   * Initializes Agent Trust Passports across autonomy tiers
   */
  initDefaultPassports() {
    const defaultPassports = [
      {
        agentId: 'human-operator-jonas',
        name: 'Jonas Abde (Human Lead Operator)',
        tier: 'L4_AUTONOMOUS',
        status: 'ACTIVE',
        budgetCap: 1000.0,
        spentToday: 14.20,
        tokenLimit: 5000000,
        tokensUsed: 420100,
        blastRadiusAllowance: 'UNRESTRICTED',
        verifiedActionsCount: 428,
        activeLeases: ['lease-gov-master-01', 'lease-war-room-deploy'],
        allowedCapabilities: ['*'],
        lastAuditSha: '5cce213a'
      },
      {
        agentId: 'sentinel-bot',
        name: 'Sentinel Code Review Safety Guardian',
        tier: 'L3_BOUNDED_EXECUTOR',
        status: 'ACTIVE',
        budgetCap: 100.0,
        spentToday: 4.50,
        tokenLimit: 1000000,
        tokensUsed: 182300,
        blastRadiusAllowance: 'REPOSITORIES_SCOPED',
        verifiedActionsCount: 312,
        activeLeases: ['lease-sentinel-pr-93'],
        allowedCapabilities: ['github.review', 'github.check_run', 'pr.verdict', 'evidence.sign'],
        lastAuditSha: 'b9e6d927'
      },
      {
        agentId: 'forge',
        name: 'Forge Autonomous Service Engineer',
        tier: 'L3_BOUNDED_EXECUTOR',
        status: 'ACTIVE',
        budgetCap: 250.0,
        spentToday: 24.80,
        tokenLimit: 2000000,
        tokensUsed: 780400,
        blastRadiusAllowance: 'SANDBOXED_BRANCHES',
        verifiedActionsCount: 189,
        activeLeases: ['lease-forge-api-refactor'],
        allowedCapabilities: ['code.generate', 'test.run', 'pr.draft', 'sandbox.deploy'],
        lastAuditSha: 'cd504fcd'
      },
      {
        agentId: 'hermes',
        name: 'Hermes Cross-Repo Skill Coordinator',
        tier: 'L2_PROPOSER',
        status: 'ACTIVE',
        budgetCap: 50.0,
        spentToday: 1.10,
        tokenLimit: 500000,
        tokensUsed: 45000,
        blastRadiusAllowance: 'READ_ONLY_PLUS_PROPOSALS',
        verifiedActionsCount: 84,
        activeLeases: [],
        allowedCapabilities: ['skill.inspect', 'intent.propose', 'telemetry.query'],
        lastAuditSha: 'aecd24a1'
      },
      {
        agentId: 'cron-fabric-sensor',
        name: 'Aftergraph Cron Fabric Drift Sensor',
        tier: 'L1_OBSERVER',
        status: 'ACTIVE',
        budgetCap: 10.0,
        spentToday: 0.05,
        tokenLimit: 100000,
        tokensUsed: 12000,
        blastRadiusAllowance: 'ZERO_EGRESS_READONLY',
        verifiedActionsCount: 1420,
        activeLeases: [],
        allowedCapabilities: ['system.observe', 'metric.sample', 'envelope.emit'],
        lastAuditSha: '7c4bee32'
      }
    ];

    for (const p of defaultPassports) {
      this.trustPassports.set(p.agentId, { ...p, sourceKind: 'synthetic_fixture' });
    }
  }

  /**
   * Initializes live Decision Objects for the Decision Inbox
   */
  initCanonicalDecisions() {
    const items = [
      {
        id: 'DEC-2026-0915-PR93',
        title: 'Authorize Sentinel Review Engine Re-Pinning (PR #93 in works-execution)',
        severity: 'HIGH',
        category: 'GOVERNED_PR_GATE',
        objectType: 'PullRequest',
        target: 'Aftergraph/works-execution#93',
        requestedBy: 'JonasAbde',
        urgency: 'HIGH',
        confidence: 0.98,
        status: 'PENDING',
        deadline: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        proposedAction: {
          type: 'PR_AUTHORIZE_MERGE',
          capability: 'github.merge',
          targetRepo: 'works-execution',
          prNumber: 93
        },
        actionPreview: {
          summary: 'Fast-forward merge of PR #93 into works-execution:main',
          diffSummary: '+14 / -2 lines in .github/workflows/sentinel.yml',
          contractImpact: 'Re-pins reusable review engine action to trusted immutable SHA b9e6d92',
          downstreamServices: ['Aftergraph/sentinel', 'Aftergraph/runtime', 'Aftergraph/trust-gateway'],
          breakingRisk: 'ZERO_BREAKING_CHANGES',
          rollbackFeasibility: 'INSTANT_REVERT_READY'
        },
        causalChain: [
          { step: 1, type: 'ROOT_CAUSE', label: 'Sentinel engine release 1.7.0 tagged in sentinel repo' },
          { step: 2, type: 'INTENT_SUBMISSION', label: 'JonasAbde submitted PR #93 updating workflow pointer' },
          { step: 3, type: 'VERIFICATION_PASSED', label: '17/17 automated testbed runs completed with 0 errors' },
          { step: 4, type: 'OPERATIONAL_GATE', label: 'Trust Gateway fail-closed policy requires operator authorization ticket' }
        ],
        whyGraph: {
          nodes: [
            { id: 'root', label: 'Sentinel v1.7.0 Release', category: 'CAUSE' },
            { id: 'pr93', label: 'PR #93 in works-execution', category: 'TRIGGER' },
            { id: 'tests', label: '17/17 Tests Verified', category: 'EVIDENCE' },
            { id: 'gate', label: 'Trust Gateway Policy Gate', category: 'BARRIER' },
            { id: 'action', label: 'Operator Authority Signature', category: 'REMEDY' }
          ],
          edges: [
            { from: 'root', to: 'pr93', relation: 'TRIGGERED_BY' },
            { from: 'pr93', to: 'tests', relation: 'EVIDENCE_FOR' },
            { from: 'tests', to: 'gate', relation: 'AWAITS' },
            { from: 'gate', to: 'action', relation: 'RESOLVED_BY' }
          ]
        }
      },
      {
        id: 'DEC-2026-0915-GOV167',
        title: 'Ratify Business Ops Domain Kernel Registration (#167)',
        severity: 'MEDIUM',
        category: 'GOVERNANCE_REGISTRATION',
        objectType: 'Repository',
        target: 'Aftergraph/after-graph-governance#167',
        requestedBy: 'JonasAbde',
        urgency: 'MEDIUM',
        confidence: 0.95,
        status: 'PENDING',
        deadline: new Date(Date.now() + 65 * 60 * 1000).toISOString(),
        proposedAction: {
          type: 'RATIFY_GOVERNANCE_ROLE',
          capability: 'governance.register_role',
          targetRepo: 'after-graph-governance',
          role: 'service-business-kernel'
        },
        actionPreview: {
          summary: 'Registers Business Ops domain owner and updates latest-org-state.json role registry',
          diffSummary: '+22 lines in latest-org-state.json, GOVERNANCE.md',
          contractImpact: 'Formalizes Aftergraph/business-ops as tenant-neutral domain kernel',
          downstreamServices: ['Aftergraph/rendetalje', 'Aftergraph/wi-frontend'],
          breakingRisk: 'ZERO_BREAKING_CHANGES',
          rollbackFeasibility: 'SAFE_ROLLBACK'
        },
        causalChain: [
          { step: 1, type: 'ROOT_CAUSE', label: 'Business Ops domain split from legacy mono-package' },
          { step: 2, type: 'INTENT_SUBMISSION', label: 'Commit 5cce213 authored by Jonas Abde' },
          { step: 3, type: 'VERIFICATION_PASSED', label: 'Clean RBOM and schema conformance verified' },
          { step: 4, type: 'OPERATIONAL_GATE', label: 'War Room classification awaiting operator endorsement' }
        ],
        whyGraph: {
          nodes: [
            { id: 'root', label: 'Domain Kernel Architecture Spec', category: 'CAUSE' },
            { id: 'commit', label: 'Commit 5cce213 in governance', category: 'TRIGGER' },
            { id: 'rbom', label: 'RBOM & Conformance Validated', category: 'EVIDENCE' },
            { id: 'endorse', label: 'War Room Ratification', category: 'REMEDY' }
          ],
          edges: [
            { from: 'root', to: 'commit', relation: 'TRIGGERED_BY' },
            { from: 'commit', to: 'rbom', relation: 'EVIDENCE_FOR' },
            { from: 'rbom', to: 'endorse', relation: 'RESOLVED_BY' }
          ]
        }
      },
      {
        id: 'DEC-2026-0915-STALE-RADAR',
        title: 'Re-Baseline Exact-HEAD Sentinel Safety Radar Cache',
        severity: 'LOW',
        category: 'CACHE_RECONCILIATION',
        objectType: 'Verification',
        target: 'Aftergraph/sentinel:HEAD',
        requestedBy: 'sentinel-bot',
        urgency: 'LOW',
        confidence: 0.99,
        status: 'PENDING',
        deadline: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
        proposedAction: {
          type: 'RECONCILE_STALE_VERDICT',
          capability: 'sentinel.rebaseline',
          targetRepo: 'sentinel'
        },
        actionPreview: {
          summary: 'Prunes 2 invalid exact-HEAD signatures invalidated by recent master merges',
          diffSummary: '0 code changes; cache invalidation',
          contractImpact: 'Guarantees 100% precision score on pre-merge evaluation pipeline',
          downstreamServices: ['All 31 repositories'],
          breakingRisk: 'ZERO_RISK',
          rollbackFeasibility: 'IDEMPOTENT'
        },
        causalChain: [
          { step: 1, type: 'ROOT_CAUSE', label: 'Recent commit ac6b194 advanced remote HEAD' },
          { step: 2, type: 'STALE_TRIGGER', label: 'Previous verification cryptographic SHA no longer matches exact HEAD' },
          { step: 3, type: 'SAFETY_HOLD', label: 'Sentinel marked previous safety verdict STALE' },
          { step: 4, type: 'OPERATIONAL_GATE', label: 'Approval to refresh baseline SHA on VDS runner' }
        ],
        whyGraph: {
          nodes: [
            { id: 'adv', label: 'Commit ac6b194 Pushed', category: 'CAUSE' },
            { id: 'mismatch', label: 'SHA Verification Mismatch', category: 'TRIGGER' },
            { id: 'stale', label: 'Epistemic Status -> STALE', category: 'STATE' },
            { id: 'refresh', label: 'Re-Baseline Signature', category: 'REMEDY' }
          ],
          edges: [
            { from: 'adv', to: 'mismatch', relation: 'CAUSED_BY' },
            { from: 'mismatch', to: 'stale', relation: 'PROPAGATES_TO' },
            { from: 'stale', to: 'refresh', relation: 'RESOLVED_BY' }
          ]
        }
      }
    ];

    for (const it of items) {
      this.decisions.set(it.id, { ...it, sourceKind: 'synthetic_fixture' });
    }
  }

  /**
   * Computes Expected vs Observed Reality Diff across declared contracts & live GitHub
   */
  computeRealityDiff(declaredOrgState, observedRepos = []) {
    const declaredRepos = (declaredOrgState && Array.isArray(declaredOrgState.repositories))
      ? declaredOrgState.repositories
      : [];

    const declaredMap = new Map();
    for (const dr of declaredRepos) {
      const name = dr.full_name.replace(/^Aftergraph\//, '');
      declaredMap.set(name, dr);
    }

    const diffs = [];
    let syncedCount = 0;
    let driftedCount = 0;
    let unregisteredCount = 0;

    for (const obs of observedRepos) {
      const name = obs.name;
      const decl = declaredMap.get(name);

      if (!decl) {
        unregisteredCount++;
        diffs.push({
          repoName: name,
          fullName: `Aftergraph/${name}`,
          role: obs.role || 'unregistered-component',
          plane: obs.plane || 'INFRASTRUCTURE',
          status: 'UNREGISTERED_IN_CONTRACT',
          declaredHead: null,
          observedHead: obs.remoteHeadShort || obs.headSha?.slice(0, 7) || 'unknown',
          openPrCount: obs.openPrCount || 0,
          driftStatus: 'NOT_IN_LATEST_ORG_STATE',
          recommendation: 'Register role and domain boundary in after-graph-governance/latest-org-state.json'
        });
      } else {
        const declaredSha = decl.remote_head_short || decl.remote_head_sha?.slice(0, 7) || '';
        const observedSha = obs.remoteHeadShort || obs.headSha?.slice(0, 7) || '';
        const isMatched = (declaredSha === observedSha) || (!declaredSha);

        if (isMatched) {
          syncedCount++;
          diffs.push({
            repoName: name,
            fullName: decl.full_name,
            role: decl.role,
            plane: obs.plane,
            status: 'IN_SYNC',
            declaredHead: declaredSha,
            observedHead: observedSha,
            openPrCount: (decl.open_pull_requests || []).length,
            driftStatus: 'PERFECT_MATCH',
            recommendation: 'Nominal operation: contract and observed state coincide.'
          });
        } else {
          driftedCount++;
          diffs.push({
            repoName: name,
            fullName: decl.full_name,
            role: decl.role,
            plane: obs.plane,
            status: 'HEAD_DRIFTED',
            declaredHead: declaredSha,
            observedHead: observedSha,
            openPrCount: (decl.open_pull_requests || []).length,
            driftStatus: `Contract declares ${declaredSha}, observed live commit ${observedSha}`,
            recommendation: 'Run after-graph-governance org-state-verify.sh to reconcile declared state.'
          });
        }
      }
    }

    return {
      schemaVersion: declaredOrgState?.schema_version || 'org-state/1.0',
      timestamp: new Date().toISOString(),
      totalObserved: observedRepos.length,
      totalDeclared: declaredRepos.length,
      metrics: {
        syncedCount,
        driftedCount,
        unregisteredCount,
        alignmentRatio: observedRepos.length > 0 ? ((syncedCount / observedRepos.length) * 100).toFixed(1) + '%' : '100%'
      },
      diffs
    };
  }

  /**
   * Resolves a Decision Object with an authorized Action
   */
  resolveDecision(decisionId, action, actorId, ticket) {
    if (!this.decisions.has(decisionId)) {
      throw new Error(`Decision Object ${decisionId} not found`);
    }

    if (!ticket || ticket.canonical !== true || typeof ticket.reference !== 'string' || !ticket.reference) {
      throw new Error('CANONICAL_AUTHORITY_REQUIRED');
    }

    const decision = this.decisions.get(decisionId);
    if (decision.status !== 'PENDING') {
      throw new Error(`Decision ${decisionId} is already ${decision.status}`);
    }

    decision.status = action === 'APPROVE' ? 'APPROVED' : (action === 'REJECT' ? 'REJECTED' : 'EXECUTED');
    decision.resolvedAt = new Date().toISOString();
    decision.resolvedBy = actorId || 'human-operator-jonas';
    decision.resolutionTicket = ticket.reference;

    return {
      success: true,
      decisionId,
      status: decision.status,
      resolvedAt: decision.resolvedAt,
      resolvedBy: decision.resolvedBy,
      resolutionTicket: decision.resolutionTicket,
      auditDigest: computeDigest(`${decisionId}:${decision.status}:${decision.resolvedAt}`)
    };
  }

  getDecisions() {
    return Array.from(this.decisions.values());
  }

  getTrustPassports() {
    return Array.from(this.trustPassports.values());
  }

  getWhyGraph(targetId) {
    for (const d of this.decisions.values()) {
      if (d.id === targetId || d.target === targetId) {
        return d.whyGraph;
      }
    }
    // Fallback causal DAG for any general object
    return {
      nodes: [
        { id: '1', label: 'Canonical Contract Ingestion', category: 'CAUSE' },
        { id: '2', label: 'Live GitHub Event Trigger', category: 'TRIGGER' },
        { id: '3', label: 'Observation Envelope Correlated', category: 'STATE' },
        { id: '4', label: 'Trust Gateway Policy Verified', category: 'REMEDY' }
      ],
      edges: [
        { from: '1', to: '2', relation: 'GOVERNS' },
        { from: '2', to: '3', relation: 'OBSERVED_AS' },
        { from: '3', to: '4', relation: 'VERIFIED_BY' }
      ]
    };
  }
}

module.exports = {
  OperationalOntologyEngine
};
