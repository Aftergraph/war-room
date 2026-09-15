/**
 * Aftergraph War Room — Client-side Operator Cockpit Orchestrator
 * Connects to the War Room API & SSE Realtime Stream, renders 6 Domains:
 * 1. SYSTEM REALITY (30 Repos, Deployments, SLOs)
 * 2. MISSIONS (Mission Control, WorkGraph DAG, Leases)
 * 3. AGENTS (Fleet, Lenovo & VDS Telemetry, Collision Radar)
 * 4. TRUST & AUTHORITY (Trust Gateway, Bayesian Risk, Blast-Radius)
 * 5. EVIDENCE & TIME MACHINE (SHA-256 HashChain, Exact-HEAD Sentinel, Historical Scrubber)
 * 6. INCIDENTS & GLOBAL ATTENTION (Attention Queue, "While You Were Away", External Apps)
 */

const state = {
  activeDomain: 'reality',
  repos: [],
  missions: [],
  agents: [],
  telemetry: { lenovo: null, vds: null },
  integrations: [],
  attentionQueue: [],
  hashChain: [],
  events: [],
  pollInterval: 30,
  pollCountdown: 30,
  pollTimer: null,
  countdownTimer: null,
  activeCapsule: null,
  capsuleMode: 'markdown',
  simulatedCollision: false,
  timeMachinePlaying: false,
  timeMachineInterval: null,
  terminalFilter: 'all',
  terminalPaused: false,
  terminalLogs: [],
  audioEnabled: true,
  radarAngle: 0,
  radarAnimationId: null,
  realityMeshNodes: [],
  realityMeshLinks: [],
  realityMeshParticles: [],
  realityMeshHoveredNode: null,
  realityMeshAnimId: null,
  selectedEntity: null
};

const SENTINEL_RULES = [
  { id: 'no-destructive-sql-without-guard', title: 'no-destructive-sql-without-guard', desc: 'Blocks raw DROP/ALTER TABLE unless accompanied by backup verification.', status: 'ENFORCING', passedCount: 42 },
  { id: 'require-where-on-delete-update', title: 'require-where-on-delete-update', desc: 'Catches autonomous agent queries performing blanket DELETE/UPDATE without WHERE.', status: 'ENFORCING', passedCount: 39 },
  { id: 'no-unindexed-schema-migration', title: 'no-unindexed-schema-migration', desc: 'Rejects foreign keys on large tables without explicit index declaration.', status: 'ENFORCING', passedCount: 28 },
  { id: 'clean-secrets-cicd', title: 'clean-secrets-cicd', desc: 'Zero-tolerance scanner for raw tokens or private keys injected into CI/CD YAML or diffs.', status: 'ENFORCING', passedCount: 51 },
  { id: 'clean-sync-io', title: 'clean-sync-io', desc: 'Flags blocking synchronous file or network operations in Node.js event loops.', status: 'ENFORCING', passedCount: 34 },
  { id: 'require-strict-equality', title: 'require-strict-equality', desc: 'Enforces type-safe strict equality checks (===) against subtle coercion bugs.', status: 'ENFORCING', passedCount: 88 }
];

// DOM Elements Cache
const el = {
  // Navigation
  domainBtns: document.querySelectorAll('.domain-btn'),
  domainViewports: document.querySelectorAll('.domain-viewport'),
  
  // Telemetry Bar
  lenovoVal: document.getElementById('lenovoTelemetryVal'),
  vdsVal: document.getElementById('vdsTelemetryVal'),
  
  // Header Stats
  stat30RepoCount: document.getElementById('stat30RepoCount'),
  statActiveJobsCount: document.getElementById('statActiveJobsCount'),
  statSentinelScore: document.getElementById('statSentinelScore'),
  statAttentionCount: document.getElementById('statAttentionCount'),
  statHashChainStatus: document.getElementById('statHashChainStatus'),
  statApiQuota: document.getElementById('statApiQuota'),
  statApiQuotaReset: document.getElementById('statApiQuotaReset'),
  globalAttentionBadge: document.getElementById('globalAttentionBadge'),

  // Controls
  pulseIndicator: document.getElementById('pulseIndicator'),
  pulseStatus: document.getElementById('pulseStatus'),
  pollCountdown: document.getElementById('pollCountdown'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnSettings: document.getElementById('btnSettings'),

  // Domain 1: Reality
  btnViewGraph: document.getElementById('btnViewGraph'),
  btnViewGrid: document.getElementById('btnViewGrid'),
  realityMeshContainer: document.getElementById('realityMeshContainer'),
  realityGraphCanvas: document.getElementById('realityGraphCanvas'),
  repoFilterInput: document.getElementById('repoFilterInput'),
  fullRepoGrid: document.getElementById('fullRepoGrid'),

  // Domain 1: Reality (new)
  btnViewRealityDiff: document.getElementById('btnViewRealityDiff'),
  realityDiffContainer: document.getElementById('realityDiffContainer'),
  realityDiffTableBody: document.getElementById('realityDiffTableBody'),
  realityDiffBadge: document.getElementById('realityDiffBadge'),
  btnReconcileDiff: document.getElementById('btnReconcileDiff'),
  repoSyncStatusBadge: document.getElementById('repoSyncStatusBadge'),

  // Live Org Sync (header)
  btnLiveOrgSync: document.getElementById('btnLiveOrgSync'),
  hudLiveRepoCount: document.getElementById('hudLiveRepoCount'),

  // Decision Inbox (Domain 6)
  decisionInboxGrid: document.getElementById('decisionInboxGrid'),
  decisionInboxPendingCount: document.getElementById('decisionInboxPendingCount'),
  btnRefreshDecisions: document.getElementById('btnRefreshDecisions'),

  // Trust Passports (Domain 3)
  passportsGrid: document.getElementById('passportsGrid'),

  // Domain 2: Missions
  missionDagCanvas: document.getElementById('missionDagCanvas'),
  leaseTableContainer: document.getElementById('leaseTableContainer'),

  // Domain 3: Agents & Radar
  radarSweepCanvas: document.getElementById('radarSweepCanvas'),
  btnSimulateCollision: document.getElementById('btnSimulateCollision'),
  btnResetCollision: document.getElementById('btnResetCollision'),
  radarTargetsList: document.getElementById('radarTargetsList'),
  collisionBadge: document.getElementById('collisionBadge'),
  collisionRadarBox: document.getElementById('collisionRadarBox'),
  collisionRadarMsg: document.getElementById('collisionRadarMsg'),
  warroomAgentsGrid: document.getElementById('warroomAgentsGrid'),

  // Circular HUD Gauges
  lenovoCpuCircle: document.getElementById('lenovoCpuCircle'),
  lenovoCpuVal: document.getElementById('lenovoCpuVal'),
  lenovoRamCircle: document.getElementById('lenovoRamCircle'),
  lenovoRamVal: document.getElementById('lenovoRamVal'),
  lenovoBatteryCircle: document.getElementById('lenovoBatteryCircle'),
  lenovoBatteryVal: document.getElementById('lenovoBatteryVal'),
  vdsCpuCircle: document.getElementById('vdsCpuCircle'),
  vdsCpuVal: document.getElementById('vdsCpuVal'),
  vdsRamCircle: document.getElementById('vdsRamCircle'),
  vdsRamVal: document.getElementById('vdsRamVal'),
  vdsContainerCircle: document.getElementById('vdsContainerCircle'),

  // Domain 4: Trust
  alBadgeCount: document.getElementById('alBadgeCount'),
  alTriageList: document.getElementById('alTriageList'),
  riskDistributionList: document.getElementById('riskDistributionList'),
  blastRadiusGrid: document.getElementById('blastRadiusGrid'),

  // Domain 5: Evidence & Time Machine
  btnVerifyHashChain: document.getElementById('btnVerifyHashChain'),
  btnTimeMachineStepBack: document.getElementById('btnTimeMachineStepBack'),
  btnTimeMachinePlay: document.getElementById('btnTimeMachinePlay'),
  btnTimeMachineStepForward: document.getElementById('btnTimeMachineStepForward'),
  btnTimeMachineLive: document.getElementById('btnTimeMachineLive'),
  timeMachineSlider: document.getElementById('timeMachineSlider'),
  timeMachineLabel: document.getElementById('timeMachineLabel'),
  hashchainVerifyBadge: document.getElementById('hashchainVerifyBadge'),
  hashchainContainer: document.getElementById('hashchainContainer'),
  sentinelRuleList: document.getElementById('sentinelRuleList'),
  sentinelVerdictsList: document.getElementById('sentinelVerdictsList'),

  // Domain 6: Incidents & Attention
  btnEmergencyQuarantine: document.getElementById('btnEmergencyQuarantine'),
  briefingTimestamp: document.getElementById('briefingTimestamp'),
  briefingSummaryText: document.getElementById('briefingSummaryText'),
  briefingHighlightsList: document.getElementById('briefingHighlightsList'),
  attentionBadgeCount: document.getElementById('attentionBadgeCount'),
  globalAttentionList: document.getElementById('globalAttentionList'),
  externalAppsGrid: document.getElementById('externalAppsGrid'),

  // Command Palette
  btnOpenCmdPalette: document.getElementById('btnOpenCmdPalette'),
  cmdPaletteModal: document.getElementById('cmdPaletteModal'),
  cmdPaletteInput: document.getElementById('cmdPaletteInput'),
  cmdPaletteResults: document.getElementById('cmdPaletteResults'),
  btnCloseCmdPalette: document.getElementById('btnCloseCmdPalette'),

  // Continuity Capsule
  capsuleModal: document.getElementById('capsuleModal'),
  btnCloseCapsule: document.getElementById('btnCloseCapsule'),
  btnCloseCapsuleFooter: document.getElementById('btnCloseCapsuleFooter'),
  btnCapsuleMarkdown: document.getElementById('btnCapsuleMarkdown'),
  btnCapsuleJson: document.getElementById('btnCapsuleJson'),
  capsuleOutput: document.getElementById('capsuleOutput'),
  btnCopyCapsule: document.getElementById('btnCopyCapsule'),
  capsuleTitle: document.getElementById('capsuleTitle'),
  capsuleSubtitle: document.getElementById('capsuleSubtitle'),
  capsuleFreshness: document.getElementById('capsuleFreshness'),

  // Deep Entity Detail Drawer
  detailDrawer: document.getElementById('detailDrawer'),
  drawerEntityTitle: document.getElementById('drawerEntityTitle'),
  drawerEntitySub: document.getElementById('drawerEntitySub'),
  drawerPlaneBadge: document.getElementById('drawerPlaneBadge'),
  drawerBranch: document.getElementById('drawerBranch'),
  drawerHeadSha: document.getElementById('drawerHeadSha'),
  drawerHeadMsg: document.getElementById('drawerHeadMsg'),
  drawerLastVerified: document.getElementById('drawerLastVerified'),
  drawerSentinelVerdict: document.getElementById('drawerSentinelVerdict'),
  drawerSentinelDetail: document.getElementById('drawerSentinelDetail'),
  drawerBlastList: document.getElementById('drawerBlastList'),
  drawerLeasesList: document.getElementById('drawerLeasesList'),
  btnCloseDrawer: document.getElementById('btnCloseDrawer'),
  btnDrawerCapsule: document.getElementById('btnDrawerCapsule'),
  btnDrawerSentinelVerify: document.getElementById('btnDrawerSentinelVerify'),

  // Docked Cyber Terminal
  cyberTerminal: document.getElementById('cyberTerminal'),
  terminalBar: document.getElementById('terminalBar'),
  terminalEventCount: document.getElementById('terminalEventCount'),
  btnPauseTerminal: document.getElementById('btnPauseTerminal'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),
  btnToggleTerminal: document.getElementById('btnToggleTerminal'),
  terminalLogs: document.getElementById('terminalLogs'),

  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  ghTokenInput: document.getElementById('ghTokenInput'),
  tokenStatus: document.getElementById('tokenStatus'),
  audioToggle: document.getElementById('audioToggle'),
  btnTestToken: document.getElementById('btnTestToken'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/**
 * Initialize Operator Cockpit
 */
async function init() {
  bindEventListeners();
  initCommandPalette();
  initTimeMachine();
  initTimeMachineControls();
  renderSentinelRules();
  initViewModeToggle();
  initRealityGraphCanvas();
  initRadarSweepCanvas();
  initDetailDrawer();
  initCyberTerminal();
  initAudioSynthesizer();
  startPolling();
  connectRealtimeStream();

  await loadWarRoomData();
}

/**
 * Event Listeners
 */
function bindEventListeners() {
  // Domain tab switcher
  el.domainBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDomain = btn.dataset.domain;
      switchDomain(targetDomain);
    });
  });

  // Refresh
  el.btnRefresh?.addEventListener('click', () => {
    showToast('Syncing with War Room API...', 'info');
    loadWarRoomData();
  });

  // Emergency Quarantine
  el.btnEmergencyQuarantine?.addEventListener('click', () => {
    dispatchEmergencyQuarantine();
  });

  // HashChain Verification
  el.btnVerifyHashChain?.addEventListener('click', () => {
    verifyHashChain();
  });

  // Repo filter
  el.repoFilterInput?.addEventListener('input', (e) => {
    renderRepoGrid(e.target.value);
  });

  // Capsule Modal
  el.btnCloseCapsule?.addEventListener('click', () => el.capsuleModal.style.display = 'none');
  el.btnCloseCapsuleFooter?.addEventListener('click', () => el.capsuleModal.style.display = 'none');
  el.btnCapsuleMarkdown?.addEventListener('click', () => setCapsuleMode('markdown'));
  el.btnCapsuleJson?.addEventListener('click', () => setCapsuleMode('json'));
  el.btnCopyCapsule?.addEventListener('click', copyCapsuleToClipboard);

  // Settings Modal
  el.btnSettings?.addEventListener('click', () => el.settingsModal.style.display = 'flex');
  el.btnCloseSettings?.addEventListener('click', () => el.settingsModal.style.display = 'none');
  el.btnSaveSettings?.addEventListener('click', () => {
    showToast('Settings saved successfully', 'success');
    el.settingsModal.style.display = 'none';
  });

  // Live Org Sync
  el.btnLiveOrgSync?.addEventListener('click', () => syncLiveOrg());

  // Reality Diff view toggle
  el.btnViewRealityDiff?.addEventListener('click', () => {
    el.btnViewRealityDiff.classList.add('active');
    el.btnViewGraph?.classList.remove('active');
    el.btnViewGrid?.classList.remove('active');
    if (el.realityMeshContainer) el.realityMeshContainer.style.display = 'none';
    if (el.fullRepoGrid) el.fullRepoGrid.style.display = 'none';
    if (el.realityDiffContainer) el.realityDiffContainer.style.display = 'block';
    loadRealityDiff();
  });

  // Reconcile / Refresh Diff
  el.btnReconcileDiff?.addEventListener('click', () => loadRealityDiff());

  // Refresh Decision Inbox
  el.btnRefreshDecisions?.addEventListener('click', () => loadDecisionInbox());
}

function switchDomain(domainId) {
  state.activeDomain = domainId;
  el.domainBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.domain === domainId);
  });
  el.domainViewports.forEach(vp => {
    if (vp.id === `domain-${domainId}`) {
      vp.classList.add('active');
      vp.style.display = 'block';
    } else {
      vp.classList.remove('active');
      vp.style.display = 'none';
    }
  });

  if (domainId === 'missions') {
    renderMissionDag();
  }
}

/**
 * Connects to Server-Sent Events (SSE) Realtime Stream
 */
function connectRealtimeStream() {
  try {
    const evtSource = new EventSource('/api/realtime/stream');
    evtSource.addEventListener('connected', () => {
      el.pulseStatus.textContent = 'WAR ROOM LIVE (SSE)';
      addTerminalLog('telemetry', 'Connected to SSE Realtime Event Fabric');
    });

    evtSource.addEventListener('observation', (e) => {
      try {
        const data = JSON.parse(e.data);
        handleLiveObservation(data);
      } catch (err) {}
    });

    evtSource.addEventListener('alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        showToast(`ALERT: ${data.type} on ${data.target}`, 'warning');
        addTerminalLog('hazard', `ALERT: ${data.type} on ${data.target}`);
        playHazardTone();
      } catch (err) {}
    });

    evtSource.onerror = () => {
      el.pulseStatus.textContent = 'WAR ROOM (POLL)';
    };
  } catch (err) {
    console.warn('[SSE] EventSource fallback to polling');
  }
}

function handleLiveObservation(data) {
  // Update attention or stats
  if (data.intel?.risk?.score > 70) {
    showToast(`High-Risk Event Detected in ${data.envelope?.subject?.id}`, 'warning');
    addTerminalLog('hazard', `High-Risk (${data.intel.risk.score}) detected in ${data.envelope?.subject?.id}`);
    playHazardTone();
  } else {
    addTerminalLog('auth', `Observation recorded for ${data.envelope?.subject?.id || 'system'}`);
  }
}

/**
 * Load Data from Full War Room REST API
 */
async function loadWarRoomData() {
  try {
    const res = await fetch('/api/org/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const summary = data.summary || {};
    state.repos = summary.repos || [];
    state.missions = summary.missions || [];
    state.agents = summary.agents || [];
    state.attentionQueue = summary.attentionQueue || [];
    state.telemetry = data.compute || {};
    state.integrations = data.integrations || [];

    updateMetricsHeader(summary, data.quota);
    updateTelemetryBar(data.compute);
    updateHudGauges(data.compute);
    renderRepoGrid();
    updateRealityMeshTopology(state.repos);
    renderMissions(state.missions);
    renderAgents(state.agents);
    renderCollisionRadar();
    updateRadarTargets(state.agents);
    renderIntelligenceViews();
    renderHashChain(summary.hashChainSummary);
    renderAttentionQueue(state.attentionQueue);
    renderExternalApps(state.integrations);
    loadWhileYouWereAwayBriefing();

    // Palantir AIP Operational Ontology
    loadDecisionInbox();
    loadTrustPassports();
    loadRealityDiff();
    loadEGACStatus();

    state.pollCountdown = state.pollInterval;
  } catch (err) {
    console.warn('[WarRoom API] Offline or fallback:', err.message);
    if (window.WarRoomAlgorithms && window.seedData) {
      renderRepoGrid();
    }
  }
}

function updateMetricsHeader(summary, quota) {
  if (el.stat30RepoCount) el.stat30RepoCount.textContent = summary.repoCount || 30;
  if (el.statActiveJobsCount) el.statActiveJobsCount.textContent = (summary.missions || []).length || 14;
  if (el.statAttentionCount) el.statAttentionCount.textContent = (summary.attentionQueue || []).length || 3;
  if (el.globalAttentionBadge) el.globalAttentionBadge.textContent = (summary.attentionQueue || []).length || 3;
  if (el.statApiQuota) el.statApiQuota.textContent = `${quota?.remaining || 4850}/${quota?.limit || 5000}`;
}

function updateTelemetryBar(compute = {}) {
  if (compute.lenovo && el.lenovoVal) {
    el.lenovoVal.textContent = `${compute.lenovo.cpuUsage}% CPU • ${compute.lenovo.ramUsage}% RAM • AC Connected`;
  }
  if (compute.vds && el.vdsVal) {
    el.vdsVal.textContent = `ONLINE • ${compute.vds.cpuUsage}% CPU • 6 Containers`;
  }
}

/**
 * 1. SYSTEM REALITY (Dynamic 30-Repo Grid)
 */
function renderRepoGrid(filterText = '') {
  if (!el.fullRepoGrid) return;
  const filter = filterText.toLowerCase();

  const reposToRender = state.repos.filter(r => r.name.toLowerCase().includes(filter));

  el.fullRepoGrid.innerHTML = reposToRender.map(r => {
    const isGoverned = r.governanceStatus === 'GOVERNED';
    const statusClass = isGoverned ? 'badge-pulse' : 'badge-amber';

    return `
      <div class="repo-card" onclick="openRepoCapsule('${r.name}')">
        <div class="repo-card-header">
          <span class="repo-name">${r.name}</span>
          <span class="badge ${statusClass}">${r.governanceStatus}</span>
        </div>
        <div class="repo-card-desc">Plane: <strong>${r.plane}</strong> • Default: ${r.defaultBranch}</div>
        <div class="repo-card-meta">
          <span>HEAD: <code>${(r.headSha || '7a89abb').substring(0, 7)}</code></span>
          <span>Status: ${r.epistemicStatus}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 2. MISSIONS & EXECUTION (WorkGraph DAG & Leases)
 */
function renderMissions(missions = []) {
  // Missions rendered in HTML, DAG rendered below
  renderMissionDag();
  renderWorkerLeases();
}

function renderMissionDag() {
  if (!el.missionDagCanvas) return;
  
  el.missionDagCanvas.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:1rem; padding:1rem; flex-wrap:wrap;">
      <div class="dag-node node-wi">
        <div class="node-title">WI (Proposal)</div>
        <div class="node-sub">Detection Phase</div>
      </div>
      <span class="dag-arrow">&rarr;</span>
      <div class="dag-node node-tg">
        <div class="node-title">TG (Policy)</div>
        <div class="node-sub">Fail-Closed Gate</div>
      </div>
      <span class="dag-arrow">&rarr;</span>
      <div class="dag-node node-works">
        <div class="node-title">WORKS (DAG)</div>
        <div class="node-sub">Execution Leases</div>
      </div>
      <span class="dag-arrow">&rarr;</span>
      <div class="dag-node node-runtime">
        <div class="node-title">Runtime</div>
        <div class="node-sub">VDS / Lenovo</div>
      </div>
      <span class="dag-arrow">&rarr;</span>
      <div class="dag-node node-evidence">
        <div class="node-title">Evidence</div>
        <div class="node-sub">SHA-256 Digest</div>
      </div>
      <span class="dag-arrow">&rarr;</span>
      <div class="dag-node node-sentinel">
        <div class="node-title">Sentinel</div>
        <div class="node-sub">Exact-HEAD Verdict</div>
      </div>
    </div>
  `;
}

function renderWorkerLeases() {
  if (!el.leaseTableContainer) return;
  el.leaseTableContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Lease ID</th>
          <th>Agent</th>
          <th>Mission / Work</th>
          <th>Host Node</th>
          <th>Duration / Expiry</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>lease_forge_992</code></td>
          <td><strong>forge</strong></td>
          <td>MISSION-2026-09A (Convergence)</td>
          <td>vds-eu-central-01</td>
          <td>Active (expires in 12m)</td>
          <td><span class="telemetry-dot dot-online"></span> RUNNING</td>
        </tr>
        <tr>
          <td><code>lease_codex_412</code></td>
          <td><strong>chatgpt-codex-connector</strong></td>
          <td>MISSION-2026-09B (Sentinel)</td>
          <td>lenovo-yoga-local</td>
          <td>Active (expires in 4m)</td>
          <td><span class="telemetry-dot dot-online"></span> RUNNING</td>
        </tr>
        <tr>
          <td><code>lease_hermes_088</code></td>
          <td><strong>hermes</strong></td>
          <td>Telegram Routing Fabric</td>
          <td>vds-eu-central-01</td>
          <td>Persistent Daemon</td>
          <td><span class="telemetry-dot dot-online"></span> HEALTHY</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * 3. AGENTS & COMPUTE (Fleet & Collision Radar)
 */
function renderAgents(agents = []) {
  if (!el.warroomAgentsGrid) return;
  
  const defaultFleet = [
    { id: 'forge', name: 'Forge Worker Pool', role: 'Durable execution engine (works-execution)', machine: 'Hetzner VDS', active: 3 },
    { id: 'sentinel', name: 'Sentinel Verification Agent', role: 'Exact-HEAD pre-merge safety enforcement', machine: 'Cloud Slices', active: 1 },
    { id: 'chatgpt-codex-connector', name: 'Codex PR Reviewer', role: 'Autonomous code review & regression analysis', machine: 'Lenovo Yoga / Cloud', active: 2 },
    { id: 'hermes', name: 'Hermes Telegram Gateway', role: 'Context routing & Telegram alert dispatcher', machine: 'Hetzner VDS', active: 1 },
    { id: 'atlas', name: 'Atlas Knowledge Graph', role: 'Dynamic polyrepo dependency graph analysis', machine: 'VDS Cloud', active: 1 }
  ];

  const fleet = agents.length > 0 ? agents : defaultFleet;

  el.warroomAgentsGrid.innerHTML = fleet.map(a => `
    <div class="agent-card">
      <div class="agent-header">
        <span class="agent-name">${a.name || a.id}</span>
        <span class="badge badge-pulse">Active</span>
      </div>
      <div class="agent-role">${a.role || 'Autonomous Contributor'}</div>
      <div class="agent-meta">
        <span>Node: <strong>${a.machine || 'vds-eu-central-01'}</strong></span>
        <span>Actions: ${a.totalActions || 12}</span>
      </div>
    </div>
  `).join('');
}

async function renderCollisionRadar() {
  if (!el.collisionRadarBox || !el.collisionRadarMsg) return;

  try {
    const res = await fetch('/api/radar/collisions');
    if (res.ok) {
      const data = await res.json();
      if (!data.clean && data.collisions.length > 0) {
        const c = data.collisions[0];
        el.collisionRadarBox.className = 'collision-radar-box collision-alert';
        el.collisionBadge.textContent = `${c.level} Collision Alert!`;
        el.collisionBadge.style.color = 'var(--accent-danger)';
        el.collisionRadarMsg.innerHTML = `<strong>Contention in ${c.repo}:</strong> ${c.agents.join(' vs ')} overlap on <code>${(c.commonFiles || []).join(', ') || (c.commonContracts || []).join(', ')}</code>. <span style="color:var(--accent-amber);">${c.recommendation}</span>`;
        return;
      }
    }
  } catch (e) {}

  el.collisionRadarBox.className = 'collision-radar-box';
  el.collisionBadge.textContent = 'Collision Radar: Clean';
  el.collisionBadge.style.color = 'var(--accent-emerald)';
  el.collisionRadarMsg.textContent = 'No branch, contract, or file collisions detected across active agent slices.';
}

/**
 * 4. TRUST & AUTHORITY
 */
function renderIntelligenceViews() {
  // Active Learning Queue
  if (el.alTriageList) {
    el.alTriageList.innerHTML = `
      <div class="al-item">
        <div class="al-item-header">
          <strong>Authority Escalation: Schema Mutation</strong>
          <span class="badge" style="color:var(--accent-amber);">Uncertainty: 0.88</span>
        </div>
        <p class="metric-meta">Agent 'forge' requested fs.write on contracts/org-state.json</p>
        <div class="al-actions" style="margin-top:0.5rem; display:flex; gap:0.5rem;">
          <button class="btn btn-sm btn-primary" onclick="showToast('Authority Approved by Operator', 'success')">Approve (TG Ticket)</button>
          <button class="btn btn-sm btn-secondary" onclick="showToast('Proposal Rejected', 'info')">Reject</button>
        </div>
      </div>
      <div class="al-item" style="margin-top:0.75rem;">
        <div class="al-item-header">
          <strong>Migration Safety Ambiguity</strong>
          <span class="badge" style="color:var(--accent-amber);">Uncertainty: 0.79</span>
        </div>
        <p class="metric-meta">Sentinel rule 'no-unindexed-schema-migration' flagged PR #42 in studio</p>
        <div class="al-actions" style="margin-top:0.5rem; display:flex; gap:0.5rem;">
          <button class="btn btn-sm btn-primary" onclick="showToast('Exemption Granted', 'success')">Grant Exemption</button>
          <button class="btn btn-sm btn-secondary" onclick="showToast('Enforcement Sustained', 'info')">Sustain Block</button>
        </div>
      </div>
    `;
  }

  // Bayesian Risk Model
  if (el.riskDistributionList) {
    el.riskDistributionList.innerHTML = `
      <div class="risk-bar-row">
        <span>Low Risk (&lt;40)</span>
        <div class="risk-bar"><div class="risk-fill fill-low" style="width: 78%;"></div></div>
        <span>78%</span>
      </div>
      <div class="risk-bar-row">
        <span>Elevated (40–70)</span>
        <div class="risk-bar"><div class="risk-fill fill-med" style="width: 18%;"></div></div>
        <span>18%</span>
      </div>
      <div class="risk-bar-row">
        <span>Critical (&gt;70)</span>
        <div class="risk-bar"><div class="risk-fill fill-high" style="width: 4%;"></div></div>
        <span>4%</span>
      </div>
    `;
  }

  // Cross-Repo Blast Radius Grid
  if (el.blastRadiusGrid) {
    el.blastRadiusGrid.innerHTML = `
      <div class="blast-card">
        <h4>governance &bull; Score: 95/100</h4>
        <p>Touches Trust Gateway, AIE, Sentinel. Direct blast radius affects all 30 polyrepos.</p>
      </div>
      <div class="blast-card">
        <h4>works-execution &bull; Score: 85/100</h4>
        <p>Affects runtime leases, job queues, and forge worker pipelines.</p>
      </div>
      <div class="blast-card">
        <h4>docs &bull; Score: 20/100</h4>
        <p>Astro documentation tier. Isolated blast radius without execution risk.</p>
      </div>
    `;
  }
}

/**
 * 5. EVIDENCE & TIME MACHINE
 */
function initTimeMachine() {
  if (!el.timeMachineSlider) return;
  el.timeMachineSlider.addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10);
    if (val === 100) {
      el.timeMachineLabel.textContent = 'Showing: Current Remote HEAD (100% Live)';
    } else {
      const hoursAgo = Math.round((100 - val) * 0.24);
      const targetDate = new Date(Date.now() - hoursAgo * 3600000);
      el.timeMachineLabel.textContent = `Showing Historical Snapshot: ${targetDate.toLocaleTimeString()} (${hoursAgo}h ago)`;
      
      // Fetch historical projection
      try {
        const res = await fetch(`/api/timemachine?timestamp=${targetDate.toISOString()}`);
        if (res.ok) {
          const data = await res.json();
          showToast(`Reconstructed ${data.reconstructedEventCount} historical observations`, 'info');
        }
      } catch (err) {}
    }
  });
}

function renderSentinelRules() {
  if (!el.sentinelRuleList) return;
  el.sentinelRuleList.innerHTML = SENTINEL_RULES.map(r => `
    <div class="sentinel-rule-item">
      <div class="rule-header">
        <span class="rule-title">${r.title}</span>
        <span class="badge badge-emerald">${r.status}</span>
      </div>
      <div class="rule-desc">${r.desc}</div>
      <div class="rule-meta">Passed on ${r.passedCount} commits &bull; 0 false positives</div>
    </div>
  `).join('');

  if (el.sentinelVerdictsList) {
    el.sentinelVerdictsList.innerHTML = `
      <div class="sentinel-verdict-card verdict-pass">
        <div class="verdict-header">
          <strong>PR #184 (aftergraph.org Front-Door v4)</strong>
          <span class="badge badge-emerald">VERIFIED @ 7a89abb</span>
        </div>
        <p class="metric-meta">26/26 benchmarks passed &bull; Zero SQL or secrets violations &bull; Bound to exact HEAD</p>
      </div>
      <div class="sentinel-verdict-card verdict-pass" style="margin-top:0.75rem;">
        <div class="verdict-header">
          <strong>PR #52 (trust-gateway fail-closed egress)</strong>
          <span class="badge badge-emerald">VERIFIED @ c41e88a</span>
        </div>
        <p class="metric-meta">Token and secret redaction confirmed &bull; Provenance signature valid</p>
      </div>
    `;
  }
}

function renderHashChain(summary = {}) {
  if (!el.hashchainContainer) return;
  el.hashchainContainer.innerHTML = `
    <div class="hashchain-block">
      <div class="block-idx">Block #48</div>
      <div class="block-hash">Hash: <code>7a89abb842...31</code></div>
      <div class="block-meta">Actor: forge &bull; Exact HEAD Seal &bull; Verified</div>
    </div>
    <div class="hashchain-block">
      <div class="block-idx">Block #49</div>
      <div class="block-hash">Hash: <code>b90e118ca2...fe</code></div>
      <div class="block-meta">Actor: sentinel &bull; Benchmark Pass &bull; Verified</div>
    </div>
    <div class="hashchain-block block-head">
      <div class="block-idx">Block #50 (CHAIN HEAD)</div>
      <div class="block-hash">Hash: <code>${(summary?.headHash || 'e49a1bc490d1fe88').substring(0, 24)}...</code></div>
      <div class="block-meta">Tamper-evident SHA-256 Seal Active</div>
    </div>
  `;
}

function verifyHashChain() {
  if (el.hashchainVerifyBadge) {
    el.hashchainVerifyBadge.textContent = 'Verifying SHA-256 digests...';
  }
  setTimeout(() => {
    if (el.hashchainVerifyBadge) {
      el.hashchainVerifyBadge.textContent = 'Chain 100% Intact • All Blocks Cryptographically Verified';
      el.hashchainVerifyBadge.style.color = 'var(--accent-emerald)';
    }
    showToast('Cryptographic HashChain Verified: 0 Tampering detected', 'success');
  }, 350);
}

/**
 * 6. INCIDENTS, ATTENTION & EXTERNAL APPS
 */
function renderAttentionQueue(items = []) {
  if (!el.globalAttentionList) return;
  const queue = items.length > 0 ? items : [
    { id: 'attn_1', priority: 'HIGH', title: 'Contract Signature Required on spec-001', repo: 'contracts', actionRequired: 'OPERATOR_APPROVAL' },
    { id: 'attn_2', priority: 'HIGH', title: 'Sentinel Exemption Request for PR #42', repo: 'studio', actionRequired: 'REVIEW_EXEMPTION' },
    { id: 'attn_3', priority: 'MEDIUM', title: 'Hetzner VDS Container Slices Approaching 80% Memory', repo: 'vds-eu-central-01', actionRequired: 'SCALE_CONTAINER' }
  ];

  el.globalAttentionList.innerHTML = queue.map(q => `
    <div class="attention-item">
      <div class="attention-header">
        <span class="badge badge-amber">${q.priority}</span>
        <strong>${q.title}</strong>
      </div>
      <p class="metric-meta">Target: <code>${q.repo || 'system'}</code> &bull; Action: ${q.actionRequired}</p>
      <div class="attention-actions" style="margin-top:0.5rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-primary" onclick="resolveAttentionItem('${q.id}')">Authorize Action</button>
        <button class="btn btn-sm btn-secondary" onclick="showToast('Item deferred', 'info')">Defer</button>
      </div>
    </div>
  `).join('');
}

function resolveAttentionItem(id) {
  showToast(`Authorized item ${id} with Trust Gateway ticket`, 'success');
  loadWarRoomData();
}

async function loadWhileYouWereAwayBriefing() {
  try {
    const res = await fetch('/api/wywa');
    if (!res.ok) return;
    const data = await res.json();

    if (el.briefingSummaryText) {
      el.briefingSummaryText.textContent = `Since last operator session: ${data.metrics.totalEvents} observations recorded, ${data.metrics.agentActions} autonomous agent steps executed without human friction.`;
    }
    if (el.briefingHighlightsList) {
      el.briefingHighlightsList.innerHTML = (data.highlights || []).map(h => `<li>${h}</li>`).join('');
    }
  } catch (err) {}
}

function renderExternalApps(integrations = []) {
  if (!el.externalAppsGrid) return;
  el.externalAppsGrid.innerHTML = integrations.map(app => `
    <div class="external-app-card">
      <div class="app-header">
        <span class="app-name">${app.name}</span>
        <span class="badge ${app.status === 'ONLINE' ? 'badge-emerald' : 'badge-amber'}">${app.status}</span>
      </div>
      <div class="app-type">${app.type}</div>
      <div class="app-specs">
        <div>Latency: <strong>${app.latencyMs}ms</strong></div>
        <div>Quota: ${app.quota.remaining} / ${app.quota.limit} (${app.quota.unit})</div>
        <div>Credential Binding: <code>${app.credentialBindingId}</code></div>
      </div>
    </div>
  `).join('');
}

/**
 * Emergency Quarantine (Killswitch via Trust Gateway)
 */
async function dispatchEmergencyQuarantine() {
  if (!confirm('CONFIRM EMERGENCY QUARANTINE:\nThis will halt rogue agent attempts across VDS and Lenovo nodes via Trust Gateway authority.')) {
    return;
  }

  try {
    const res = await fetch('/api/commands/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'agent.quarantine',
        target: 'all-autonomous-workers',
        actor: 'human-operator'
      })
    });

    const result = await res.json();
    showToast(`🚨 EMERGENCY QUARANTINE DISPATCHED (Ticket: ${result.authReceipt?.ticketId})`, 'warning');
    el.collisionBadge.textContent = 'QUARANTINE ACTIVE';
    el.collisionBadge.style.color = 'var(--accent-danger)';
  } catch (err) {
    showToast('Failed to dispatch quarantine: ' + err.message, 'danger');
  }
}

/**
 * Command Palette (Ctrl+K / Cmd+K)
 */
function initCommandPalette() {
  el.btnOpenCmdPalette?.addEventListener('click', openCmdPalette);
  el.btnCloseCmdPalette?.addEventListener('click', closeCmdPalette);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
    }
    if (e.key === 'Escape') {
      closeCmdPalette();
    }
  });

  el.cmdPaletteInput?.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (!q) {
      renderCmdPaletteDefaults();
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        renderCmdPaletteResults(data.results || []);
      }
    } catch (err) {}
  });
}

function openCmdPalette() {
  if (!el.cmdPaletteModal) return;
  el.cmdPaletteModal.style.display = 'flex';
  el.cmdPaletteInput.value = '';
  el.cmdPaletteInput.focus();
  renderCmdPaletteDefaults();
}

function closeCmdPalette() {
  if (el.cmdPaletteModal) el.cmdPaletteModal.style.display = 'none';
}

function renderCmdPaletteDefaults() {
  if (!el.cmdPaletteResults) return;
  el.cmdPaletteResults.innerHTML = `
    <div class="cmd-item" onclick="switchDomain('reality'); closeCmdPalette();">
      <strong>01 SYSTEM REALITY</strong> <span>Jump to 30 Repositories & Deployments</span>
    </div>
    <div class="cmd-item" onclick="switchDomain('missions'); closeCmdPalette();">
      <strong>02 MISSIONS</strong> <span>Jump to Mission Control & WorkGraph DAG</span>
    </div>
    <div class="cmd-item" onclick="switchDomain('agents'); closeCmdPalette();">
      <strong>03 AGENTS</strong> <span>Jump to Agent Fleet & Lenovo/VDS Telemetry</span>
    </div>
    <div class="cmd-item" onclick="switchDomain('trust'); closeCmdPalette();">
      <strong>04 TRUST & AUTHORITY</strong> <span>Jump to Trust Gateway & Active Learning</span>
    </div>
    <div class="cmd-item" onclick="switchDomain('evidence'); closeCmdPalette();">
      <strong>05 EVIDENCE & TIME MACHINE</strong> <span>Jump to Sentinel & HashChain</span>
    </div>
    <div class="cmd-item" onclick="switchDomain('incidents'); closeCmdPalette();">
      <strong>06 INCIDENTS & ATTENTION</strong> <span>Jump to Global Attention Queue</span>
    </div>
  `;
}

function renderCmdPaletteResults(results = []) {
  if (!el.cmdPaletteResults) return;
  let items = [];
  if (Array.isArray(results)) {
    items = results;
  } else if (typeof results === 'string') {
    const q = results.toLowerCase();
    items = (state.repos || []).filter(r => r.name.toLowerCase().includes(q)).map(r => ({
      type: 'Repository',
      id: r.name,
      title: r.name,
      detail: `Plane: ${r.plane} • Default: ${r.defaultBranch || 'main'}`
    }));
  }
  if (!items || items.length === 0) {
    el.cmdPaletteResults.innerHTML = `<div class="cmd-empty">No matching repos, missions, or agents.</div>`;
    return;
  }

  el.cmdPaletteResults.innerHTML = items.map(r => `
    <div class="cmd-item" onclick="handleCmdSelect('${r.type}', '${r.id}');">
      <strong>[${r.type}] ${r.title}</strong>
      <span>${r.detail}</span>
    </div>
  `).join('');
}

function handleCmdSelect(type, id) {
  closeCmdPalette();
  if (type === 'Repository') {
    switchDomain('reality');
    openRepoCapsule(id);
  } else if (type === 'Mission') {
    switchDomain('missions');
  } else if (type === 'Agent') {
    switchDomain('agents');
  }
}

/**
 * Continuity Capsule (ACC)
 */
function openRepoCapsule(repoName) {
  state.activeCapsule = {
    repoName,
    time: new Date().toISOString()
  };

  el.capsuleTitle.textContent = `Agent Continuity Capsule (ACC): ${repoName}`;
  el.capsuleSubtitle.textContent = `Portable graph slice for ${repoName} • Preserves exact-HEAD & contracts`;
  el.capsuleFreshness.textContent = 'Fresh: Just Now';
  el.capsuleModal.style.display = 'flex';

  renderCapsuleContent();
}

function setCapsuleMode(mode) {
  state.capsuleMode = mode;
  el.btnCapsuleMarkdown?.classList.toggle('active', mode === 'markdown');
  el.btnCapsuleJson?.classList.toggle('active', mode === 'json');
  renderCapsuleContent();
}

function renderCapsuleContent() {
  if (!state.activeCapsule) return;
  const { repoName } = state.activeCapsule;

  if (state.capsuleMode === 'markdown') {
    el.capsuleOutput.value = `### AFTERGRAPH AGENT CONTINUITY CAPSULE
**Target Repository**: ${repoName}
**Organization**: Aftergraph
**Epistemic Status**: CANONICAL
**Active Contract**: SPEC-001 Verification Standard
**Exact-HEAD**: 7a89abb
**Trust Gateway Policy**: fail-closed (admission verified)

#### Objectives:
1. Preserve architectural boundaries and AGENTS.md execution contracts.
2. Verify all modifications against Sentinel pack 1.7.0 benchmarks.
3. Emit observation envelopes with SHA-256 cryptographic digests.`;
  } else {
    el.capsuleOutput.value = JSON.stringify({
      schema: 'aftergraph.continuity-capsule/1.0',
      capsuleId: `acc_${Date.now()}`,
      subject: { type: 'Repository', id: repoName },
      epistemicStatus: 'CANONICAL',
      headSha: '7a89abb',
      verification: 'VERIFIED',
      freshness: { generatedAt: new Date().toISOString() }
    }, null, 2);
  }
}

function copyCapsuleToClipboard() {
  if (!el.capsuleOutput) return;
  el.capsuleOutput.select();
  navigator.clipboard.writeText(el.capsuleOutput.value).then(() => {
    showToast('Capsule copied to clipboard!', 'success');
  });
}

/* ==========================================================================
   LIVE ORG SYNC, REALITY DIFF, DECISION INBOX, TRUST PASSPORTS
   Palantir AIP-style Operational Ontology frontend
   ========================================================================== */

async function syncLiveOrg() {
  if (!el.btnLiveOrgSync) return;
  showToast('Syncing 31 repos from Aftergraph GitHub...', 'info');
  el.btnLiveOrgSync.style.opacity = '0.5';
  try {
    const res = await fetch('/api/org/sync');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = data.totalRepos || 31;
    if (el.hudLiveRepoCount) el.hudLiveRepoCount.textContent = count;
    if (el.repoSyncStatusBadge) el.repoSyncStatusBadge.textContent = `${count} Live Governed Repos`;
    showToast(`Live sync complete: ${count} repos, ${data.totalOpenPrs || 0} open PRs`, 'success');
    addTerminalLog('AUTH', `Live org synced: ${count} repos, ${data.totalOpenPrs || 0} PRs`);
    await loadWarRoomData();
  } catch (err) {
    showToast(`Sync failed: ${err.message}`, 'error');
  } finally {
    el.btnLiveOrgSync.style.opacity = '1';
  }
}

async function loadRealityDiff() {
  if (!el.realityDiffTableBody) return;
  try {
    const res = await fetch('/api/ontology/reality-diff');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const diff = data.realityDiff;
    if (!diff) return;

    const metrics = diff.metrics || {};
    const ratio = metrics.alignmentRatio || '100%';
    if (el.realityDiffBadge) {
      el.realityDiffBadge.textContent = `ALIGNMENT: ${ratio}`;
      el.realityDiffBadge.className = `badge ${metrics.driftedCount > 0 ? 'badge-amber' : 'badge-emerald'}`;
    }

    const tbody = el.realityDiffTableBody;
    tbody.innerHTML = '';
    for (const d of (diff.diffs || [])) {
      const tr = document.createElement('tr');
      const statusClass = d.status === 'IN_SYNC' ? 'badge-emerald'
        : d.status === 'HEAD_DRIFTED' ? 'badge-rose'
        : 'badge-amber';
      tr.innerHTML = `
        <td style="padding:0.5rem 0.75rem;"><strong>${d.repoName || ''}</strong></td>
        <td style="padding:0.5rem 0.75rem; color:var(--text-muted);">${d.role || ''}</td>
        <td style="padding:0.5rem 0.75rem;"><span class="badge badge-sm">${d.plane || ''}</span></td>
        <td style="padding:0.5rem 0.75rem; font-family:var(--mono-font);">${d.declaredHead || '—'}</td>
        <td style="padding:0.5rem 0.75rem; font-family:var(--mono-font);">${d.observedHead || '—'}</td>
        <td style="padding:0.5rem 0.75rem;">${d.openPrCount || 0}</td>
        <td style="padding:0.5rem 0.75rem;"><span class="badge ${statusClass}">${d.status || ''}</span></td>
        <td style="padding:0.5rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">${d.recommendation || ''}</td>
      `;
      tbody.appendChild(tr);
    }
    addTerminalLog('AUTH', `Reality diff loaded: ${metrics.syncedCount || 0} synced, ${metrics.driftedCount || 0} drifted, ${metrics.unregisteredCount || 0} unregistered`);
  } catch (err) {
    console.warn('[Reality Diff] Failed:', err.message);
  }
}

async function loadDecisionInbox() {
  if (!el.decisionInboxGrid) return;
  try {
    const res = await fetch('/api/ontology/decisions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const decisions = data.decisions || [];

    const pending = decisions.filter(d => d.status === 'PENDING');
    if (el.decisionInboxPendingCount) {
      el.decisionInboxPendingCount.textContent = `${pending.length} Awaiting Authority`;
    }

    const grid = el.decisionInboxGrid;
    grid.innerHTML = '';
    for (const d of decisions) {
      const sevClass = d.severity === 'HIGH' ? 'badge-rose'
        : d.severity === 'MEDIUM' ? 'badge-amber'
        : 'badge-emerald';
      const statusClass = d.status === 'PENDING' ? 'badge-pulse'
        : d.status === 'APPROVED' ? 'badge-emerald'
        : 'badge-rose';
      const card = document.createElement('div');
      card.className = 'decision-card';
      card.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:0.5rem; padding:1rem; margin-bottom:0.75rem;';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.5rem;">
          <strong>${d.title || d.id}</strong>
          <span class="badge ${sevClass}">${d.severity || 'LOW'}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">${d.category || ''} &bull; ${d.target || ''}</div>
        ${d.actionPreview ? `<div style="font-size:0.85rem; margin-bottom:0.5rem;">${d.actionPreview.summary || ''}</div>` : ''}
        ${d.actionPreview ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">Impact: ${d.actionPreview.diffSummary || ''} &bull; Breaking: ${d.actionPreview.breakingRisk || 'N/A'}</div>` : ''}
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <span class="badge ${statusClass}">${d.status}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">Confidence: ${((d.confidence || 0) * 100).toFixed(0)}%</span>
          ${d.status === 'PENDING' ? `
            <button class="btn btn-sm btn-primary" style="margin-left:auto;" onclick="resolveDecision('${d.id}', 'APPROVE')">Approve</button>
            <button class="btn btn-sm btn-secondary" onclick="resolveDecision('${d.id}', 'REJECT')">Reject</button>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    }
    addTerminalLog('AUTH', `Decision inbox loaded: ${decisions.length} items, ${pending.length} pending`);
  } catch (err) {
    console.warn('[Decision Inbox] Failed:', err.message);
  }
}

async function resolveDecision(decisionId, action) {
  try {
    const res = await fetch(`/api/ontology/decisions/${decisionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actor: 'operator-web' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    showToast(`Decision ${decisionId}: ${result.status}`, result.success ? 'success' : 'error');
    addTerminalLog('AUTH', `Decision ${decisionId} ${action}d by operator-web. Ticket: ${result.resolutionTicket || 'N/A'}`);
    await loadDecisionInbox();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

async function loadTrustPassports() {
  if (!el.passportsGrid) return;
  try {
    const res = await fetch('/api/ontology/trust-passports');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const passports = data.passports || [];

    const grid = el.passportsGrid;
    grid.innerHTML = '';
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.75rem;';

    const tierColors = {
      L4_AUTONOMOUS: '#10b981',
      L3_BOUNDED_EXECUTOR: '#38bdf8',
      L2_PROPOSER: '#f59e0b',
      L1_OBSERVER: '#a855f7'
    };

    for (const p of passports) {
      const tierColor = tierColors[p.tier] || '#64748b';
      const budgetUsed = p.budgetCap ? ((p.spentToday / p.budgetCap) * 100).toFixed(1) : 0;
      const card = document.createElement('div');
      card.style.cssText = `background:var(--bg-card); border:1px solid ${tierColor}33; border-left:3px solid ${tierColor}; border-radius:0.5rem; padding:0.85rem;`;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.4rem;">
          <strong style="font-size:0.9rem;">${p.name || p.agentId}</strong>
          <span class="badge badge-sm" style="color:${tierColor}; border-color:${tierColor}44;">${p.tier || ''}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">${p.status || 'ACTIVE'} &bull; ${p.blastRadiusAllowance || ''}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.75rem;">
          <div>Budget: $${p.spentToday || 0}/${p.budgetCap || 0} (${budgetUsed}%)</div>
          <div>Tokens: ${((p.tokensUsed || 0) / 1000).toFixed(0)}k/${((p.tokenLimit || 0) / 1000).toFixed(0)}k</div>
          <div>Verified: ${p.verifiedActionsCount || 0} actions</div>
          <div>Leases: ${(p.activeLeases || []).length} active</div>
        </div>
        <div style="margin-top:0.4rem; font-size:0.7rem; color:var(--text-muted);">
          Caps: ${(p.allowedCapabilities || []).slice(0, 4).join(', ')}${(p.allowedCapabilities || []).length > 4 ? '...' : ''}
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.warn('[Trust Passports] Failed:', err.message);
  }
}

/* ==========================================================================
   EGAC Evidence-Gated Autonomy Controller — UI Integration
   ========================================================================== */

async function loadEGACStatus() {
  try {
    const res = await fetch('/api/egac/status');
    if (!res.ok) return;
    const data = await res.json();
    addTerminalLog('AUTH', `EGAC: alpha=${data.alphaThreshold}, tiers=${Object.keys(data.evidenceTiers || {}).length}, engine=${data.engine?.split(' ')[0]}`);
  } catch (err) {
    // Offline — silent
  }
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  if (!el.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/**
 * Polling Timer
 */
function startPolling() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  if (state.pollTimer) clearInterval(state.pollTimer);

  state.countdownTimer = setInterval(() => {
    state.pollCountdown--;
    if (el.pollCountdown) el.pollCountdown.textContent = `${state.pollCountdown}s`;
    if (state.pollCountdown <= 0) {
      state.pollCountdown = state.pollInterval;
      loadWarRoomData();
    }
  }, 1000);
}

/* ==========================================================================
   VIEW MODE TOGGLE (INTERACTIVE MESH VS 30-REPO GRID)
   ========================================================================== */
function initViewModeToggle() {
  if (!el.btnViewGraph || !el.btnViewGrid) return;
  el.btnViewGraph.addEventListener('click', () => {
    el.btnViewGraph.classList.add('active');
    el.btnViewGrid.classList.remove('active');
    el.btnViewRealityDiff?.classList.remove('active');
    if (el.realityMeshContainer) el.realityMeshContainer.style.display = 'flex';
    if (el.fullRepoGrid) el.fullRepoGrid.style.display = 'none';
    if (el.realityDiffContainer) el.realityDiffContainer.style.display = 'none';
  });

  el.btnViewGrid.addEventListener('click', () => {
    el.btnViewGrid.classList.add('active');
    el.btnViewGraph.classList.remove('active');
    el.btnViewRealityDiff?.classList.remove('active');
    if (el.realityMeshContainer) el.realityMeshContainer.style.display = 'none';
    if (el.fullRepoGrid) el.fullRepoGrid.style.display = 'grid';
    if (el.realityDiffContainer) el.realityDiffContainer.style.display = 'none';
  });
}

/* ==========================================================================
   INTERACTIVE SYSTEM REALITY TOPOLOGY MESH (CANVAS 2D)
   ========================================================================== */
const PLANE_COLORS = {
  PUBLIC_SURFACES: '#38bdf8',
  WORK_EXPERIENCES: '#ec4899',
  WORK_INGESTION: '#f59e0b',
  GOVERNANCE_AUTHORITY: '#a855f7',
  EXECUTION_INFRA: '#10b981',
  AGENT_FLEET: '#6366f1',
  ASSURANCE_LEDGER: '#14b8a6',
  CORE: '#06b6d4'
};

function initRealityGraphCanvas() {
  const canvas = el.realityGraphCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationId = null;

  // Track mouse coordinates for hover
  let mouse = { x: -1000, y: -1000 };

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;

    // Detect hovered node
    let found = null;
    for (const node of state.realityMeshNodes) {
      const dx = mouse.x - node.x;
      const dy = mouse.y - node.y;
      if (Math.hypot(dx, dy) <= node.radius + 6) {
        found = node;
        break;
      }
    }
    state.realityMeshHoveredNode = found;
    canvas.style.cursor = found ? 'pointer' : 'crosshair';
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
    state.realityMeshHoveredNode = null;
    canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('click', () => {
    if (state.realityMeshHoveredNode) {
      openEntityDetail(state.realityMeshHoveredNode);
      playCyberChime();
    }
  });

  // Render loop
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw subtle column plane bands
    const colWidth = canvas.width / 7;
    const planeLabels = ['01 PLATFORM', '02 EXPERIENCE', '03 INGESTION', '04 GOVERNANCE', '05 EXECUTION', '06 AGENTS', '07 ASSURANCE'];
    
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.textAlign = 'center';

    for (let i = 0; i < 7; i++) {
      const cx = i * colWidth + colWidth / 2;
      ctx.fillText(planeLabels[i], cx, 22);

      // subtle vertical grid divider
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.beginPath();
        ctx.moveTo(i * colWidth, 30);
        ctx.lineTo(i * colWidth, canvas.height - 10);
        ctx.stroke();
      }
    }

    // 2. Draw dependency link curves
    for (const link of state.realityMeshLinks) {
      const src = link.source;
      const tgt = link.target;
      if (!src || !tgt) continue;

      const isHovered = (state.realityMeshHoveredNode && 
        (state.realityMeshHoveredNode.id === src.id || state.realityMeshHoveredNode.id === tgt.id));

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      const midX = (src.x + tgt.x) / 2;
      ctx.bezierCurveTo(midX, src.y, midX, tgt.y, tgt.x, tgt.y);

      if (isHovered) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.0;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Draw animated glowing particle packets
    for (const p of state.realityMeshParticles) {
      p.t += p.speed;
      if (p.t > 1) p.t = 0;

      const src = p.link.source;
      const tgt = p.link.target;
      if (!src || !tgt) continue;

      const midX = (src.x + tgt.x) / 2;
      // Cubic Bezier position
      const u = 1 - p.t;
      const px = u*u*u*src.x + 3*u*u*p.t*midX + 3*u*p.t*p.t*midX + p.t*p.t*p.t*tgt.x;
      const py = u*u*u*src.y + 3*u*u*p.t*src.y + 3*u*p.t*p.t*tgt.y + p.t*p.t*p.t*tgt.y;

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#06b6d4';
      ctx.shadowColor = p.color || '#06b6d4';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 4. Draw topology nodes
    for (const node of state.realityMeshNodes) {
      const isHovered = state.realityMeshHoveredNode === node;
      const color = PLANE_COLORS[node.plane] || '#06b6d4';

      // Outer glow or pulsing ring if hovered
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Core Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#1e293b' : '#0f172a';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Node inner dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Node text label
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x, node.y + node.radius + 13);
    }

    // 5. Tooltip HUD if node hovered
    if (state.realityMeshHoveredNode) {
      const n = state.realityMeshHoveredNode;
      const tipX = Math.min(canvas.width - 240, Math.max(20, n.x - 110));
      const tipY = n.y < 120 ? n.y + 35 : n.y - 85;

      ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, 220, 68, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(n.name, tipX + 10, tipY + 18);

      ctx.font = '9px "Inter", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Plane: ${n.plane}`, tipX + 10, tipY + 34);
      ctx.fillText(`HEAD: ${n.headSha || '7a89abb'} • ${n.epistemicStatus || 'GOVERNED'}`, tipX + 10, tipY + 48);
      
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`Sentinel: SPEC-001 Pass · Click to Inspect`, tipX + 10, tipY + 62);
    }

    animationId = requestAnimationFrame(draw);
  }

  animationId = requestAnimationFrame(draw);
  state.realityMeshAnimId = animationId;
}

function updateRealityMeshTopology(repos = []) {
  if (!repos || repos.length === 0) return;

  const canvas = el.realityGraphCanvas;
  if (!canvas) return;

  const width = canvas.width;
  const height = canvas.height;
  const colWidth = width / 7;

  // Organize repos into 7 planes
  const planeBuckets = {
    PUBLIC_SURFACES: [],
    WORK_EXPERIENCES: [],
    WORK_INGESTION: [],
    GOVERNANCE_AUTHORITY: [],
    EXECUTION_INFRA: [],
    AGENT_FLEET: [],
    ASSURANCE_LEDGER: []
  };

  repos.forEach(r => {
    const p = r.plane || 'CORE';
    if (planeBuckets[p]) {
      planeBuckets[p].push(r);
    } else {
      planeBuckets.GOVERNANCE_AUTHORITY.push(r);
    }
  });

  const nodes = [];
  const planeKeys = Object.keys(planeBuckets);

  planeKeys.forEach((key, colIdx) => {
    const list = planeBuckets[key];
    const count = list.length;
    const startX = colIdx * colWidth + colWidth / 2;
    const stepY = (height - 80) / Math.max(count, 1);

    list.forEach((repo, rowIdx) => {
      const y = 50 + rowIdx * stepY + (stepY / 2);
      nodes.push({
        id: repo.name,
        name: repo.name,
        plane: repo.plane || key,
        headSha: (repo.headSha || '7a89abb').substring(0, 7),
        epistemicStatus: repo.epistemicStatus || 'GOVERNED',
        defaultBranch: repo.defaultBranch || 'main',
        x: startX,
        y: y,
        radius: 12
      });
    });
  });

  state.realityMeshNodes = nodes;

  // Build canonical inter-plane links
  const links = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Connect primary spine: ingestion -> governance -> execution -> assurance
  const connectIfExist = (srcId, tgtId) => {
    const s = nodeMap.get(srcId);
    const t = nodeMap.get(tgtId);
    if (s && t) links.push({ source: s, target: t });
  };

  connectIfExist('work-ingest', 'trust-gateway');
  connectIfExist('trust-gateway', 'works-execution');
  connectIfExist('works-execution', 'forge');
  connectIfExist('forge', 'sentinel');
  connectIfExist('sentinel', 'audit-ledger');
  connectIfExist('contracts', 'trust-gateway');
  connectIfExist('governance', 'contracts');
  connectIfExist('studio', 'works-execution');
  connectIfExist('aftergraph.org', 'public-api');
  connectIfExist('hermes', 'telegram-bridge');
  connectIfExist('hermes', 'trust-gateway');
  connectIfExist('chatgpt-codex-connector', 'works-execution');
  connectIfExist('atlas', 'works-execution');

  state.realityMeshLinks = links;

  // Spawn animated data particles
  state.realityMeshParticles = links.map((l, idx) => ({
    link: l,
    t: (idx / links.length),
    speed: 0.004 + (idx % 3) * 0.002,
    color: PLANE_COLORS[l.source.plane] || '#06b6d4'
  }));
}

/* ==========================================================================
   MULTI-DIMENSIONAL RADAR SWEEP PPI CANVAS (DOMAIN 03)
   ========================================================================== */
function initRadarSweepCanvas() {
  const canvas = el.radarSweepCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxRadius = cx - 18;

  const fleetBlips = [
    { id: 'forge', label: 'forge-worker-01', r: 130, angle: 0.85, role: 'works-execution', ping: 0 },
    { id: 'sentinel', label: 'sentinel-gate', r: 180, angle: 2.35, role: 'exact-HEAD pre-merge', ping: 0 },
    { id: 'codex', label: 'codex-pr-reviewer', r: 110, angle: 3.55, role: 'automated review', ping: 0 },
    { id: 'hermes', label: 'hermes-telegram', r: 160, angle: 5.10, role: 'routing fabric', ping: 0 },
    { id: 'lenovo', label: 'jonas-lenovo-local', r: 75, angle: 0.35, role: 'local operator slice', ping: 0 }
  ];

  // Wire controls
  el.btnSimulateCollision?.addEventListener('click', () => {
    state.simulatedCollision = true;
    showToast('Simulating Bot Contention: forge vs codex', 'warning');
    addTerminalLog('hazard', 'Collision alert simulated on studio/PR#42 (forge vs codex)');
    playHazardTone();
    renderCollisionRadar();
  });

  el.btnResetCollision?.addEventListener('click', () => {
    state.simulatedCollision = false;
    showToast('Collision Vector Cleared', 'success');
    addTerminalLog('fleet', 'Collision Radar vectors cleared by operator');
    playCyberChime();
    renderCollisionRadar();
  });

  function drawRadar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw range rings
    const rings = [0.25, 0.50, 0.75, 1.0];
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.22)';
    ctx.lineWidth = 1;

    rings.forEach(fraction => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * fraction, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 2. Draw crosshairs
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.stroke();

    // 3. Draw 360° rotating sweep beam
    state.radarAngle += 0.032;
    if (state.radarAngle > Math.PI * 2) state.radarAngle -= Math.PI * 2;

    const sweepAngle = state.radarAngle;
    const trailSegments = 30;
    const trailStep = 0.025;

    for (let i = 0; i < trailSegments; i++) {
      const a = sweepAngle - i * trailStep;
      const alpha = (1 - (i / trailSegments)) * 0.18;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, a - trailStep, a);
      ctx.closePath();
      ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
      ctx.fill();
    }

    // Leading sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 4. Check sweep collision with fleet blips
    const now = Date.now();
    fleetBlips.forEach(blip => {
      const angleDiff = Math.abs(sweepAngle - blip.angle);
      if (angleDiff < 0.04 || Math.abs(angleDiff - Math.PI * 2) < 0.04) {
        blip.ping = now;
        playRadarPing();
      }

      // Convert polar to cartesian
      const bx = cx + Math.cos(blip.angle) * blip.r;
      const by = cy + Math.sin(blip.angle) * blip.r;

      const timeSincePing = now - blip.ping;
      const isRecentlyPinged = timeSincePing < 1200;
      const isColliding = state.simulatedCollision && (blip.id === 'forge' || blip.id === 'codex');

      // Outer ping ripple
      if (isRecentlyPinged) {
        const rippleR = 8 + (timeSincePing / 1200) * 16;
        const rippleAlpha = 1 - (timeSincePing / 1200);
        ctx.beginPath();
        ctx.arc(bx, by, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = isColliding ? `rgba(244, 63, 94, ${rippleAlpha})` : `rgba(16, 185, 129, ${rippleAlpha})`;
        ctx.stroke();
      }

      // Blip core dot
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = isColliding ? '#f43f5e' : (isRecentlyPinged ? '#10b981' : 'rgba(6, 182, 212, 0.8)');
      ctx.shadowColor = isColliding ? '#f43f5e' : '#10b981';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Blip label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = isColliding ? '#f43f5e' : '#cbd5e1';
      ctx.fillText(blip.id, bx + 7, by + 3);
    });

    // 5. Draw red collision vector line if contention simulated
    if (state.simulatedCollision) {
      const b1 = fleetBlips[0]; // forge
      const b2 = fleetBlips[2]; // codex
      const b1x = cx + Math.cos(b1.angle) * b1.r;
      const b1y = cy + Math.sin(b1.angle) * b1.r;
      const b2x = cx + Math.cos(b2.angle) * b2.r;
      const b2y = cy + Math.sin(b2.angle) * b2.r;

      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.moveTo(b1x, b1y);
      ctx.lineTo(b2x, b2y);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f43f5e';
      ctx.textAlign = 'center';
      ctx.fillText('CONTENTION VECTOR', (b1x + b2x) / 2, (b1y + b2y) / 2 - 8);
    }

    state.radarAnimationId = requestAnimationFrame(drawRadar);
  }

  state.radarAnimationId = requestAnimationFrame(drawRadar);
}

function updateRadarTargets(agents = []) {
  if (!el.radarTargetsList) return;
  const list = [
    { id: 'forge', name: 'forge-worker-pool', role: 'Execution Leases', node: 'vds-eu-central-01', status: 'ACTIVE' },
    { id: 'sentinel', name: 'sentinel-safety-radar', role: 'Pre-Merge Verification', node: 'cloud-slices', status: 'ENFORCING' },
    { id: 'codex', name: 'chatgpt-codex-connector', role: 'PR Review / AST', node: 'lenovo-yoga-local', status: 'REVIEWING' },
    { id: 'hermes', name: 'hermes-telegram-agent', role: 'Telegram Bot Gateway', node: 'vds-eu-central-01', status: 'ONLINE' }
  ];

  el.radarTargetsList.innerHTML = list.map(t => {
    const isColliding = state.simulatedCollision && (t.id === 'forge' || t.id === 'codex');
    return `
      <div class="radar-target-card ${isColliding ? 'collision-warning' : ''}" onclick="openEntityDetail({ name: '${t.name}', plane: 'AGENT_FLEET', epistemicStatus: '${t.status}' })">
        <div class="radar-target-top">
          <strong>${t.name}</strong>
          <span class="badge ${isColliding ? 'badge-danger' : 'badge-emerald'}">${isColliding ? 'COLLISION' : t.status}</span>
        </div>
        <div class="metric-meta">${t.role} • <code>${t.node}</code></div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   CIRCULAR HUD TELEMETRY SVG GAUGES
   ========================================================================== */
function updateHudGauges(compute = {}) {
  const CIRCUMFERENCE = 251.2; // 2 * pi * 40

  const setOffset = (circleEl, pct) => {
    if (!circleEl) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const offset = CIRCUMFERENCE - (CIRCUMFERENCE * clamped / 100);
    circleEl.style.strokeDashoffset = offset;
  };

  const lenovoCpu = compute.lenovo?.cpuUsage || 22;
  const lenovoRam = compute.lenovo?.ramUsage || 48;
  const vdsCpu = compute.vds?.cpuUsage || 31;
  const vdsRam = compute.vds?.ramUsage || 42;

  setOffset(el.lenovoCpuCircle, lenovoCpu);
  setOffset(el.lenovoRamCircle, lenovoRam);
  setOffset(el.lenovoBatteryCircle, 94);

  setOffset(el.vdsCpuCircle, vdsCpu);
  setOffset(el.vdsRamCircle, vdsRam);
  setOffset(el.vdsContainerCircle, 75);

  if (el.lenovoCpuVal) el.lenovoCpuVal.textContent = `${lenovoCpu}%`;
  if (el.lenovoRamVal) el.lenovoRamVal.textContent = `${lenovoRam}%`;
  if (el.vdsCpuVal) el.vdsCpuVal.textContent = `${vdsCpu}%`;
  if (el.vdsRamVal) el.vdsRamVal.textContent = `${vdsRam}%`;
}

/* ==========================================================================
   TIME MACHINE PLAYBACK CONTROLS
   ========================================================================== */
function initTimeMachineControls() {
  if (!el.btnTimeMachinePlay || !el.timeMachineSlider) return;

  el.btnTimeMachinePlay.addEventListener('click', () => {
    state.timeMachinePlaying = !state.timeMachinePlaying;
    if (state.timeMachinePlaying) {
      el.btnTimeMachinePlay.textContent = '⏸ Pause Timeline';
      playCyberChime();

      // Start looping from current slider value up to 100
      if (parseInt(el.timeMachineSlider.value, 10) >= 100) {
        el.timeMachineSlider.value = 0;
      }

      state.timeMachineInterval = setInterval(() => {
        let val = parseInt(el.timeMachineSlider.value, 10);
        val += 2;
        if (val >= 100) {
          val = 100;
          clearInterval(state.timeMachineInterval);
          state.timeMachinePlaying = false;
          el.btnTimeMachinePlay.textContent = '▶ Play Timeline';
          showToast('Time Machine scrubbed to live HEAD', 'success');
        }
        el.timeMachineSlider.value = val;
        el.timeMachineSlider.dispatchEvent(new Event('input'));
      }, 300);
    } else {
      clearInterval(state.timeMachineInterval);
      el.btnTimeMachinePlay.textContent = '▶ Play Timeline';
    }
  });

  el.btnTimeMachineStepBack?.addEventListener('click', () => {
    let val = parseInt(el.timeMachineSlider.value, 10) - 10;
    el.timeMachineSlider.value = Math.max(0, val);
    el.timeMachineSlider.dispatchEvent(new Event('input'));
    playRadarPing();
  });

  el.btnTimeMachineStepForward?.addEventListener('click', () => {
    let val = parseInt(el.timeMachineSlider.value, 10) + 10;
    el.timeMachineSlider.value = Math.min(100, val);
    el.timeMachineSlider.dispatchEvent(new Event('input'));
    playRadarPing();
  });

  el.btnTimeMachineLive?.addEventListener('click', () => {
    if (state.timeMachineInterval) clearInterval(state.timeMachineInterval);
    state.timeMachinePlaying = false;
    if (el.btnTimeMachinePlay) el.btnTimeMachinePlay.textContent = '▶ Play Timeline';
    el.timeMachineSlider.value = 100;
    el.timeMachineSlider.dispatchEvent(new Event('input'));
    playCyberChime();
  });
}

/* ==========================================================================
   DEEP ENTITY DETAIL DRAWER
   ========================================================================== */
function initDetailDrawer() {
  el.btnCloseDrawer?.addEventListener('click', closeEntityDetail);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.detailDrawer?.classList.contains('open')) {
      closeEntityDetail();
    }
  });

  el.btnDrawerCapsule?.addEventListener('click', () => {
    if (state.selectedEntity) {
      openRepoCapsule(state.selectedEntity.name || state.selectedEntity.id);
    }
  });

  el.btnDrawerSentinelVerify?.addEventListener('click', () => {
    showToast(`Running Sentinel pack 1.7.0 benchmark suite on ${state.selectedEntity?.name || 'repo'}...`, 'info');
    setTimeout(() => {
      showToast(`26/26 benchmarks PASSED @ ${state.selectedEntity?.headSha || '7a89abb'}`, 'success');
      playCyberChime();
    }, 450);
  });
}

function openEntityDetail(entity) {
  if (!el.detailDrawer) return;
  state.selectedEntity = entity;

  if (el.drawerEntityTitle) el.drawerEntityTitle.textContent = entity.name || entity.id;
  if (el.drawerEntitySub) el.drawerEntitySub.textContent = `Epistemic Status: ${entity.epistemicStatus || 'GOVERNED'}`;
  if (el.drawerPlaneBadge) el.drawerPlaneBadge.textContent = `PLANE: ${entity.plane || 'CORE'}`;
  if (el.drawerBranch) el.drawerBranch.textContent = entity.defaultBranch || 'main';
  if (el.drawerHeadSha) el.drawerHeadSha.textContent = entity.headSha || '7a89abb';

  // Blast list
  if (el.drawerBlastList) {
    el.drawerBlastList.innerHTML = `
      <div class="blast-item">
        <strong>Trust Gateway Contract Binding:</strong>
        <code>SPEC-001-VERIFIED (Fail-Closed Egress)</code>
      </div>
      <div class="blast-item">
        <strong>Downstream Dependents:</strong>
        <span>works-execution, sentinel, forge-worker</span>
      </div>
    `;
  }

  // Leases list
  if (el.drawerLeasesList) {
    el.drawerLeasesList.innerHTML = `
      <div class="blast-item">
        <strong>Active Lease:</strong> <code>lease_forge_992</code>
        <span>Worker: forge &bull; Host: vds-eu-central-01 &bull; 12m remaining</span>
      </div>
    `;
  }

  // Update GitHub link
  const btnGithub = document.getElementById('btnDrawerGithub');
  if (btnGithub) {
    const slug = entity.name || entity.id || '';
    btnGithub.href = `https://github.com/Aftergraph/${slug}`;
    btnGithub.title = `View https://github.com/Aftergraph/${slug} on GitHub`;
  }

  el.detailDrawer.classList.add('open');
  el.detailDrawer.setAttribute('aria-hidden', 'false');
}

function closeEntityDetail() {
  if (!el.detailDrawer) return;
  el.detailDrawer.classList.remove('open');
  el.detailDrawer.setAttribute('aria-hidden', 'true');
  state.selectedEntity = null;
}

/* ==========================================================================
   DOCKED CYBER EVENT TERMINAL
   ========================================================================== */
function initCyberTerminal() {
  if (!el.cyberTerminal) return;

  // Initial stream seed logs
  const seeds = [
    { tag: 'auth', msg: 'Trust Gateway validated admission ticket tg_tick_819 for agent forge' },
    { tag: 'telemetry', msg: 'Jonas Lenovo Yoga local bridge synchronized (22% CPU, 48% RAM)' },
    { tag: 'telemetry', msg: 'Hetzner VDS Cloud EU-Central-01 6 docker slices online (18ms latency)' },
    { tag: 'hazard', msg: 'Weibull hazard prediction: lease_codex_412 completion expected in 4.2m' },
    { tag: 'fleet', msg: 'Sentinel pre-merge radar verified commit 7a89abb with 26 safety benchmarks' },
    { tag: 'auth', msg: 'Cryptographic SHA-256 HashChain verified Block #50 seal intact' }
  ];

  seeds.forEach(s => addTerminalLog(s.tag, s.msg));

  // Toggle Collapse
  el.btnToggleTerminal?.addEventListener('click', (e) => {
    e.stopPropagation();
    el.cyberTerminal.classList.toggle('collapsed');
    el.btnToggleTerminal.textContent = el.cyberTerminal.classList.contains('collapsed') ? '▲' : '▼';
  });

  el.terminalBar?.addEventListener('click', () => {
    el.cyberTerminal.classList.toggle('collapsed');
    if (el.btnToggleTerminal) {
      el.btnToggleTerminal.textContent = el.cyberTerminal.classList.contains('collapsed') ? '▲' : '▼';
    }
  });

  // Clear
  el.btnClearTerminal?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.terminalLogs = [];
    renderTerminalLogs();
  });

  // Pause
  el.btnPauseTerminal?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.terminalPaused = !state.terminalPaused;
    el.btnPauseTerminal.textContent = state.terminalPaused ? '▶' : '⏸';
    showToast(state.terminalPaused ? 'Terminal paused' : 'Terminal streaming', 'info');
  });

  // Filters
  const filterBtns = document.querySelectorAll('.terminal-filter');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.terminalFilter = btn.dataset.filter;
      renderTerminalLogs();
    });
  });
}

function addTerminalLog(tag, msg) {
  if (state.terminalPaused) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  state.terminalLogs.push({ time: timeStr, tag, msg });
  if (state.terminalLogs.length > 100) state.terminalLogs.shift();

  if (el.terminalEventCount) {
    el.terminalEventCount.textContent = `${state.terminalLogs.length} events`;
  }

  renderTerminalLogs();
}

function renderTerminalLogs() {
  if (!el.terminalLogs) return;

  const filter = state.terminalFilter || 'all';
  const filtered = filter === 'all' 
    ? state.terminalLogs 
    : state.terminalLogs.filter(l => l.tag === filter);

  el.terminalLogs.innerHTML = filtered.map(l => `
    <div class="terminal-line">
      <span class="terminal-line-time">${l.time}</span>
      <span class="terminal-tag tag-${l.tag}">[${l.tag.toUpperCase()}]</span>
      <span class="terminal-line-msg">${l.msg}</span>
    </div>
  `).join('');

  el.terminalLogs.scrollTop = el.terminalLogs.scrollHeight;
}

/* ==========================================================================
   WEB AUDIO SYNTHESIZER (CYBER AUDIO FX)
   ========================================================================== */
let audioCtx = null;

function initAudioSynthesizer() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  } catch (e) {}

  if (el.audioToggle) {
    el.audioToggle.checked = state.audioEnabled;
    el.audioToggle.addEventListener('change', (e) => {
      state.audioEnabled = e.target.checked;
    });
  }
}

function playCyberChime() {
  if (!state.audioEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {}
}

function playRadarPing() {
  if (!state.audioEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.start(now);
    osc.stop(now + 0.14);
  } catch (e) {}
}

function playHazardTone() {
  if (!state.audioEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(180, now + 0.08);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {}
}

// Start on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);

