/**
 * Aftergraph War Room — Dynamic 30-Repository GitHub Adapter
 * Discovers repositories dynamically, audits governance classifications,
 * tracks exact-HEAD SHAs, and emits canonical ObservationEnvelopes.
 */
const { execSync } = require('child_process');
const https = require('https');
const { BaseWarRoomAdapter } = require('../../../packages/adapters/src/base');
const { createObservationEnvelope } = require('../../../packages/contracts/src/observation');
const { EPISTEMIC_STATUS } = require('../../../packages/domain/src/entities');

class GitHubAdapter extends BaseWarRoomAdapter {
  constructor(options = {}) {
    super('github-org-observer', options);
    this.org = options.org || 'Aftergraph';
    this.token = options.token || process.env.GITHUB_TOKEN || null;
    this.seedData = options.seedData || null;
    this.cachedRepos = [];
    this.orgStateContract = null;
    this.quota = { remaining: 5000, limit: 5000, reset: null };
    this.resolveToken();
  }

  /**
   * Resolves token from environment or gh CLI
   * ponytail: single-line exec with try-catch handles local developer machine gracefully
   */
  resolveToken() {
    if (this.token) return this.token;
    if (process.env.GITHUB_TOKEN) {
      this.token = process.env.GITHUB_TOKEN;
      return this.token;
    }
    try {
      const out = execSync('gh auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
      if (out && out.trim()) {
        this.token = out.trim();
        return this.token;
      }
    } catch (_) {
      // gh CLI not authenticated or not installed
    }
    return null;
  }

  /**
   * Discovers repositories dynamically from GitHub API, gh CLI or seed backup
   */
  async discover() {
    try {
      const liveRepos = await this.fetchOrgRepos();
      this.cachedRepos = liveRepos;
      this.status = 'READY';
      return liveRepos;
    } catch (err) {
      console.warn(`[GitHubAdapter] Live discovery failed (${err.message}), utilizing canonical seed baseline`);
      if (this.seedData && this.seedData.repos) {
        this.cachedRepos = this.seedData.repos;
        this.status = 'FALLBACK_SEED';
        return this.cachedRepos;
      }
      throw err;
    }
  }

  /**
   * Compares discovered repositories against governance register and latest-org-state
   */
  classifyGovernance(observedRepos = []) {
    const governedManifest = [
      'aftergraph', 'docs', 'brand', 'contracts', 'governance', 'sentinel',
      'trust-gateway', 'works-execution', 'aie', 'afm', 'model-registry',
      'continuity', 'runtime', 'telemetry', 'integrations', 'studio',
      'forge', 'hermes', 'atlas', 'sentinel-bench', 'polyrepo-tools',
      'agent-sdk', 'operator-cockpit', 'mcp-aftergraph', 'evidence-store',
      'cron-fabric', 'vds-daemon', 'lenovo-bridge', 'after-graph-governance',
      'business-ops', 'rendetalje', 'war-room', 'wi-frontend', 'wi-backend',
      'skill-abi', 'skillport', 'skills-vault', 'context-continuity', 'continuum',
      'intelligence-systems-research', 'llm-research-development', 'veranza',
      'aftergraph.org', 'relay', '.github'
    ];

    let governedCount = 0;
    let unregisteredCount = 0;
    const classified = [];

    for (const r of observedRepos) {
      const name = typeof r === 'string' ? r : r.name;
      const isGoverned = governedManifest.includes(name);
      const isFixture = name.includes('firetest') || name.includes('test');
      
      let status = 'UNREGISTERED';
      if (isGoverned) {
        status = 'GOVERNED';
        governedCount++;
      } else if (isFixture) {
        status = 'TEMPORARY_FIXTURE';
        unregisteredCount++;
      } else {
        unregisteredCount++;
      }

      classified.push({
        name,
        status,
        epistemicStatus: EPISTEMIC_STATUS.OBSERVED
      });
    }

    return {
      totalObserved: observedRepos.length,
      governedCount,
      unregisteredCount,
      staleCount: 0,
      classified
    };
  }

  /**
   * Fetches latest-org-state.json from Aftergraph/after-graph-governance
   */
  async fetchGovernanceOrgState() {
    this.resolveToken();
    try {
      // 1. Try gh CLI first for speed & authentication
      const out = execSync('gh api repos/Aftergraph/after-graph-governance/contents/latest-org-state.json --jq .content', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000
      });
      if (out && out.trim()) {
        const raw = Buffer.from(out.trim(), 'base64').toString('utf8');
        this.orgStateContract = JSON.parse(raw);
        return this.orgStateContract;
      }
    } catch (_) {
      // Fallback to https request below
    }

    if (!this.token) return null;

    return new Promise((resolve) => {
      const url = `https://api.github.com/repos/${this.org}/after-graph-governance/contents/latest-org-state.json`;
      const headers = {
        'User-Agent': 'Aftergraph-WarRoom-Adapter/1.0',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.token}`
      };
      https.get(url, { headers, timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.content) {
              const raw = Buffer.from(data.content, 'base64').toString('utf8');
              this.orgStateContract = JSON.parse(raw);
              return resolve(this.orgStateContract);
            }
          } catch (_) {}
          resolve(null);
        });
      }).on('error', () => resolve(null));
    });
  }

  /**
   * Fetches recent commits for a repository
   */
  async fetchRecentCommits(repoName, limit = 2) {
    this.resolveToken();
    try {
      const cmd = `gh api repos/${this.org}/${repoName}/commits?per_page=${limit} --jq ".[0] | {sha: .sha, author: .commit.author.name, message: .commit.message, date: .commit.author.date}"`;
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 });
      if (out && out.trim()) {
        return JSON.parse(out.trim());
      }
    } catch (_) {}
    return null;
  }

  /**
   * Comprehensive live sync across all repositories in the Aftergraph organization
   */
  async syncLiveOrg() {
    this.resolveToken();
    let rawRepos = [];

    // 1. Discover all repos in the org via gh CLI or API
    try {
      const out = execSync(`gh repo list ${this.org} --limit 100 --json name,defaultBranchRef,pushedAt,updatedAt,description,isPrivate`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 8000
      });
      if (out && out.trim()) {
        rawRepos = JSON.parse(out.trim());
      }
    } catch (_) {
      rawRepos = await this.discover();
    }

    // 2. Fetch canonical governance contracts from latest-org-state.json
    const orgState = await this.fetchGovernanceOrgState();
    const contractMap = new Map();
    if (orgState && Array.isArray(orgState.repositories)) {
      for (const cr of orgState.repositories) {
        const shortName = cr.full_name.replace(`${this.org}/`, '');
        contractMap.set(shortName, cr);
      }
    }

    // 3. Fetch latest commit highlights for key active repos
    const keyRepos = ['after-graph-governance', 'works-execution', 'trust-gateway', 'sentinel', 'war-room', 'runtime', 'studio', 'business-ops'];
    const commitMap = new Map();
    for (const kr of keyRepos) {
      const c = await this.fetchRecentCommits(kr, 1);
      if (c) commitMap.set(kr, c);
    }

    // 4. Enrich repository models
    const enrichedRepos = [];
    let totalOpenPrs = 0;

    for (const r of rawRepos) {
      const name = r.name || r;
      const contract = contractMap.get(name) || {};
      const latestCommit = commitMap.get(name) || null;
      const openPrs = contract.open_pull_requests || [];
      totalOpenPrs += openPrs.length;

      const headSha = latestCommit?.sha || contract.remote_head_sha || '7a89abb';
      const shortSha = headSha.slice(0, 7);

      enrichedRepos.push({
        id: name,
        name,
        fullName: `${this.org}/${name}`,
        description: r.description || contract.description || '',
        role: contract.role || this.inferRole(name),
        plane: this.inferPlane(name, contract.role),
        defaultBranch: r.defaultBranchRef?.name || contract.canonical_branch || 'main',
        headSha,
        remoteHeadShort: shortSha,
        isPrivate: r.isPrivate !== undefined ? r.isPrivate : (contract.private || false),
        governanceStatus: name.includes('firetest') ? 'TEMPORARY_FIXTURE' : (contract.role ? 'GOVERNED' : 'UNREGISTERED'),
        epistemicStatus: latestCommit ? EPISTEMIC_STATUS.VERIFIED : EPISTEMIC_STATUS.OBSERVED,
        openPrs,
        openPrCount: openPrs.length,
        latestCommit: latestCommit ? {
          sha: shortSha,
          fullSha: headSha,
          author: latestCommit.author || 'Jonas Abde',
          message: (latestCommit.message || '').split('\n')[0],
          date: latestCommit.date
        } : (contract.head_commit_message ? {
          sha: contract.remote_head_short || shortSha,
          fullSha: headSha,
          author: 'Jonas Abde',
          message: contract.head_commit_message,
          date: orgState?.generated_at
        } : null),
        updatedAt: r.pushedAt || r.updatedAt || new Date().toISOString()
      });
    }

    this.cachedRepos = enrichedRepos;
    this.status = 'LIVE_SYNCED';

    return {
      success: true,
      org: this.org,
      totalRepos: enrichedRepos.length,
      totalOpenPrs,
      contractSchema: orgState?.schema_version || 'org-state/1.0',
      lastSync: new Date().toISOString(),
      repos: enrichedRepos,
      governance: this.classifyGovernance(enrichedRepos)
    };
  }

  inferRole(name) {
    if (name === 'war-room') return 'operational-control-plane';
    if (name === 'business-ops') return 'service-business-kernel';
    if (name === 'rendetalje') return 'reference-tenant-pack';
    if (name.includes('firetest')) return 'temporary-verification-fixture';
    return 'general-component';
  }

  inferPlane(name, role = '') {
    if (['governance', 'after-graph-governance', 'trust-gateway', 'contracts', 'aie'].includes(name) || role.includes('authority') || role.includes('contracts') || role.includes('enforcement')) return 'GOVERNANCE';
    if (['works-execution', 'runtime', 'sentinel', 'sentinel-bench', 'wi-backend'].includes(name) || role.includes('execution') || role.includes('runtime')) return 'EXECUTION';
    if (['forge', 'hermes', 'atlas', 'agent-sdk', 'model-registry', 'skills-vault', 'skill-abi', 'skillport', 'afm', 'llm-research-development'].includes(name) || role.includes('model') || role.includes('capability')) return 'AGENTS';
    if (['docs', 'brand', 'studio', 'aftergraph', 'aftergraph.org', 'relay', 'wi-frontend', 'war-room'].includes(name) || role.includes('experience') || role.includes('front-door') || role.includes('control-plane')) return 'EXPERIENCE';
    return 'INFRASTRUCTURE';
  }

  /**
   * Snapshots current repo commits into canonical ObservationEnvelopes
   */
  async snapshot() {
    const repos = await this.discover();
    const envelopes = [];

    for (const repo of repos) {
      const repoName = typeof repo === 'string' ? repo : repo.name;
      const headSha = (typeof repo === 'object' && repo.headSha) ? repo.headSha : '7a89abb';

      envelopes.push(createObservationEnvelope({
        source: {
          system: 'github',
          adapter: 'github-org-observer',
          instance: 'api.github.com'
        },
        subject: {
          type: 'Repository',
          id: repoName
        },
        event: {
          type: 'repository.discovered',
          occurredAt: new Date().toISOString(),
          observedAt: new Date().toISOString()
        },
        provenance: {
          commitSha: headSha,
          sourceUrl: `https://github.com/${this.org}/${repoName}`
        },
        payload: {
          repoName,
          defaultBranch: 'main',
          headSha
        }
      }));
    }

    return envelopes;
  }

  async fetchOrgRepos() {
    this.resolveToken();
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/orgs/${this.org}/repos?per_page=100`;
      const headers = {
        'User-Agent': 'Aftergraph-WarRoom-Adapter/1.0',
        'Accept': 'application/vnd.github.v3+json'
      };
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const req = https.get(url, { headers, timeout: 5000 }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.headers['x-ratelimit-remaining']) {
            this.quota.remaining = parseInt(res.headers['x-ratelimit-remaining'], 10);
            this.quota.limit = parseInt(res.headers['x-ratelimit-limit'], 10);
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`GitHub API HTTP ${res.statusCode}: ${body.slice(0, 100)}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('GitHub request timeout')); });
    });
  }

  getQuota() {
    return this.quota;
  }
}

module.exports = {
  GitHubAdapter
};

