/**
 * Aftergraph War Room — Canonical Domain Entities & Epistemic Foundations
 * Defines first-class entities and state classification.
 */

const EPISTEMIC_STATUS = {
  CANONICAL: 'CANONICAL', // Authoritative ground truth
  OBSERVED: 'OBSERVED',   // Received via direct telemetry/adapter observation
  INFERRED: 'INFERRED',   // Derived via intelligence/correlation engines
  PROPOSED: 'PROPOSED',   // Generated as a proposal (e.g. Work Intelligence WI)
  VERIFIED: 'VERIFIED',   // Passed strict verification benchmarks
  STALE: 'STALE',         // Verification or state expired (e.g. HEAD moved)
  CONFLICT: 'CONFLICT',   // Contention/divergent state detected
  UNKNOWN: 'UNKNOWN'      // Unregistered or untrusted state
};

const ENTITY_TYPES = {
  Organization: 'Organization',
  Repository: 'Repository',
  Branch: 'Branch',
  Commit: 'Commit',
  PullRequest: 'PullRequest',
  Issue: 'Issue',
  Deployment: 'Deployment',
  Environment: 'Environment',

  Mission: 'Mission',
  Work: 'Work',
  Attempt: 'Attempt',
  Action: 'Action',

  Agent: 'Agent',
  Model: 'Model',
  Skill: 'Skill',
  Capability: 'Capability',
  Lease: 'Lease',
  Machine: 'Machine',
  Process: 'Process',
  Job: 'Job',

  Integration: 'Integration',
  CredentialBinding: 'CredentialBinding',
  Policy: 'Policy',
  AuthorityDecision: 'AuthorityDecision',

  Contract: 'Contract',
  Artifact: 'Artifact',
  Evidence: 'Evidence',
  Verification: 'Verification',

  Incident: 'Incident',
  Alert: 'Alert',
  Decision: 'Decision',
  Capsule: 'Capsule',
  ResearchClaim: 'ResearchClaim',
  Experiment: 'Experiment'
};

/**
 * Creates a normalized Entity Reference
 */
function createEntityRef(type, id, name = id) {
  if (!ENTITY_TYPES[type]) {
    throw new Error(`Unknown entity type: ${type}`);
  }
  return {
    type,
    id: String(id),
    name: String(name)
  };
}

/**
 * Canonical Entity Builder
 */
function createEntity({
  type,
  id,
  name = id,
  epistemicStatus = EPISTEMIC_STATUS.OBSERVED,
  metadata = {},
  observedAt = new Date().toISOString()
}) {
  if (!ENTITY_TYPES[type]) {
    throw new Error(`Invalid entity type: ${type}`);
  }
  if (!EPISTEMIC_STATUS[epistemicStatus]) {
    throw new Error(`Invalid epistemic status: ${epistemicStatus}`);
  }

  return {
    type,
    id: String(id),
    name: String(name),
    epistemicStatus,
    metadata,
    createdAt: metadata.createdAt || observedAt,
    updatedAt: observedAt
  };
}

module.exports = {
  EPISTEMIC_STATUS,
  ENTITY_TYPES,
  createEntityRef,
  createEntity
};
