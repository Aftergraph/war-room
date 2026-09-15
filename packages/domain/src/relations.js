/**
 * Aftergraph War Room — Canonical Domain Relations
 * Defines directed edges in the System Reality Graph.
 */

const RELATION_TYPES = {
  OWNS: 'OWNS',                     // Organization OWNS Repository
  IMPLEMENTS: 'IMPLEMENTS',         // Repository/Work IMPLEMENTS Contract
  DEPENDS_ON: 'DEPENDS_ON',         // Repository DEPENDS_ON Repository
  PRODUCES: 'PRODUCES',             // Action PRODUCES Evidence
  CONSUMES: 'CONSUMES',             // Work/Attempt CONSUMES Context/Capsule
  EXECUTES: 'EXECUTES',             // Agent EXECUTES Attempt
  RUNS_ON: 'RUNS_ON',               // Process/Agent RUNS_ON Machine
  PART_OF: 'PART_OF',               // Work PART_OF Mission
  ATTEMPTS: 'ATTEMPTS',             // Attempt ATTEMPTS Work
  AUTHORIZED_BY: 'AUTHORIZED_BY',   // Command/Action AUTHORIZED_BY TrustGateway
  GOVERNED_BY: 'GOVERNED_BY',       // Repository GOVERNED_BY Policy
  OBSERVED_BY: 'OBSERVED_BY',       // Machine OBSERVED_BY Adapter
  SUPPORTED_BY: 'SUPPORTED_BY',     // Service SUPPORTED_BY Integration
  VERIFIED_BY: 'VERIFIED_BY',       // Commit/PR VERIFIED_BY Sentinel
  INVALIDATES: 'INVALIDATES',       // New Commit INVALIDATES Verification
  DEPLOYED_TO: 'DEPLOYED_TO',       // Commit DEPLOYED_TO Environment
  DERIVED_FROM: 'DERIVED_FROM',     // Capsule DERIVED_FROM WorkGraph
  SUPERSEDES: 'SUPERSEDES',         // Commit/Capsule SUPERSEDES Previous
  AFFECTS: 'AFFECTS'                // Incident AFFECTS Repository/Service
};

/**
 * Validates and constructs a Relation edge between two EntityRefs
 */
function createRelation({
  type,
  from,
  to,
  metadata = {},
  timestamp = new Date().toISOString()
}) {
  if (!RELATION_TYPES[type]) {
    throw new Error(`Unknown relation type: ${type}`);
  }
  if (!from || !from.type || !from.id) {
    throw new Error('Missing or invalid "from" EntityRef');
  }
  if (!to || !to.type || !to.id) {
    throw new Error('Missing or invalid "to" EntityRef');
  }

  return {
    id: `${from.type}:${from.id}->${type}->${to.type}:${to.id}`,
    type,
    from: { type: from.type, id: from.id },
    to: { type: to.type, id: to.id },
    metadata,
    createdAt: timestamp
  };
}

module.exports = {
  RELATION_TYPES,
  createRelation
};
