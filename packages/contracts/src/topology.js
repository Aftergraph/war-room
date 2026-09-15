/**
 * Aftergraph War Room — Canonical Topology Loader
 *
 * Single source of truth for the repository inventory: the canonical
 * platform-topology/2.0.json contract owned by Aftergraph/after-graph-governance.
 *
 * Never hand-maintain a parallel repo list. Every component that needs the
 * canonical repository set, plane, role, or lifecycle asks this loader.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_TOPOLOGY_CANDIDATES = [
  // explicit override
  process.env.AFTERGRAPH_TOPOLOGY_PATH,
  // vendored alongside war-room (repo root / config)
  path.join(__dirname, '..', '..', '..', 'config', 'platform-topology.json'),
  // local governance checkout next to the war-room tree
  path.join(__dirname, '..', '..', 'after-graph-governance', 'docs', 'platform-topology', '2.0.json'),
  path.resolve(process.env.HOME || '/root', 'after-graph-governance', 'docs', 'platform-topology', '2.0.json')
].filter(Boolean);

let _cache = null;
let _cachePath = null;

function findTopologyPath() {
  for (const candidate of DEFAULT_TOPOLOGY_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Load the canonical topology. Returns:
 *   { schemaVersion, organization, repositories: [{name, canonicalBranch,
 *     visibility, architecturePlane, systemClass, role, lifecycle}], path }
 *
 * Returns null if no topology file is reachable (callers must fall back to
 * seed data, never to a hand-maintained list).
 */
function loadTopology() {
  if (_cache) return _cache;
  const topoPath = findTopologyPath();
  if (!topoPath) return null;
  try {
    const data = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
    if (!data || !Array.isArray(data.repositories) || data.repositories.length === 0) return null;
    _cache = {
      schemaVersion: data.schema_version,
      organization: data.organization,
      path: topoPath,
      repositories: data.repositories.map(r => ({
        name: r.name,
        canonicalBranch: r.canonical_branch || 'main',
        visibility: r.visibility || 'public',
        architecturePlane: r.architecture_plane || null,
        systemClass: r.system_class || null,
        role: r.role || null,
        lifecycle: r.lifecycle || 'active'
      }))
    };
    _cachePath = topoPath;
    return _cache;
  } catch (e) {
    console.warn(`[topology] failed to parse ${topoPath}: ${e.message}`);
    return null;
  }
}

/** Returns the set of canonical repo names (bare names, e.g. "runtime"). */
function canonicalRepoNames() {
  const t = loadTopology();
  return t ? t.repositories.map(r => r.name) : [];
}

/** Map bare repo name -> topology entry, or null if unknown/un-governed. */
function lookup(repoName) {
  const t = loadTopology();
  if (!t) return null;
  return t.repositories.find(r => r.name === repoName) || null;
}

/** True if the repo is part of the canonical topology. */
function isGoverned(repoName) {
  return lookup(repoName) != null;
}

/**
 * Classify a repo against the canonical topology.
 *   GOVERNED          — in the canonical topology
 *   TEMPORARY_FIXTURE — topology lifecycle == "temporary" (e.g. firetest)
 *   UNREGISTERED      — observed live but absent from canonical topology
 */
function classifyStatus(repoName) {
  const entry = lookup(repoName);
  if (!entry) return 'UNREGISTERED';
  if (entry.lifecycle === 'temporary') return 'TEMPORARY_FIXTURE';
  return 'GOVERNED';
}

/** Human-readable plane; falls back to system_class then "UNKNOWN". */
function planeFor(repoName) {
  const entry = lookup(repoName);
  if (!entry) return 'UNKNOWN';
  return (entry.architecturePlane || entry.systemClass || 'UNKNOWN').toUpperCase();
}

function topologyPath() {
  loadTopology();
  return _cachePath;
}

module.exports = {
  loadTopology,
  canonicalRepoNames,
  lookup,
  isGoverned,
  classifyStatus,
  planeFor,
  topologyPath
};
