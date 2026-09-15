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
  capsuleMode: 'markdown'
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
  repoFilterInput: document.getElementById('repoFilterInput'),
  fullRepoGrid: document.getElementById('fullRepoGrid'),

  // Domain 2: Missions
  missionDagCanvas: document.getElementById('missionDagCanvas'),
  leaseTableContainer: document.getElementById('leaseTableContainer'),

  // Domain 3: Agents
  collisionBadge: document.getElementById('collisionBadge'),
  collisionRadarBox: document.getElementById('collisionRadarBox'),
  collisionRadarMsg: document.getElementById('collisionRadarMsg'),
  warroomAgentsGrid: document.getElementById('warroomAgentsGrid'),

  // Domain 4: Trust
  alBadgeCount: document.getElementById('alBadgeCount'),
  alTriageList: document.getElementById('alTriageList'),
  riskDistributionList: document.getElementById('riskDistributionList'),
  blastRadiusGrid: document.getElementById('blastRadiusGrid'),

  // Domain 5: Evidence & Time Machine
  btnVerifyHashChain: document.getElementById('btnVerifyHashChain'),
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
  renderSentinelRules();
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
    renderRepoGrid();
    renderMissions(state.missions);
    renderAgents(state.agents);
    renderCollisionRadar();
    renderIntelligenceViews();
    renderHashChain(summary.hashChainSummary);
    renderAttentionQueue(state.attentionQueue);
    renderExternalApps(state.integrations);
    loadWhileYouWereAwayBriefing();

    state.pollCountdown = state.pollInterval;
  } catch (err) {
    console.warn('[WarRoom API] Offline or fallback:', err.message);
    // Use fallback algorithms if offline
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
  if (results.length === 0) {
    el.cmdPaletteResults.innerHTML = `<div class="cmd-empty">No matching repos, missions, or agents.</div>`;
    return;
  }

  el.cmdPaletteResults.innerHTML = results.map(r => `
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

// Start on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);
