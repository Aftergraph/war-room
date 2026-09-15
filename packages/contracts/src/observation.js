/**
 * Aftergraph War Room — Canonical Observation Contract
 * Schema: aftergraph.observation/1
 * Implements the universal observation envelope for all adapters.
 */
const crypto = require('crypto');

const OBSERVATION_SCHEMA = 'aftergraph.observation/1';

/**
 * Calculates SHA-256 hex digest for an envelope payload or canonical representation
 */
function computeDigest(data) {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Validates whether an object adheres to aftergraph.observation/1 schema
 */
function validateObservationEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, errors: ['Envelope must be an object'] };
  }
  if (envelope.schema !== OBSERVATION_SCHEMA) {
    errors.push(`Invalid schema: expected ${OBSERVATION_SCHEMA}, got ${envelope.schema}`);
  }
  if (!envelope.id || typeof envelope.id !== 'string') {
    errors.push('Missing or invalid envelope id (must be string)');
  }
  if (!envelope.source || !envelope.source.system || !envelope.source.adapter) {
    errors.push('Missing envelope.source with system and adapter');
  }
  if (!envelope.subject || !envelope.subject.type || !envelope.subject.id) {
    errors.push('Missing envelope.subject with type and id');
  }
  if (!envelope.event || !envelope.event.type || !envelope.event.occurredAt || !envelope.event.observedAt) {
    errors.push('Missing envelope.event with type, occurredAt, and observedAt');
  }
  if (!envelope.freshness || !envelope.freshness.observedAt) {
    errors.push('Missing envelope.freshness.observedAt');
  }
  if (!envelope.integrity || !envelope.integrity.digest) {
    errors.push('Missing envelope.integrity.digest');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Factory to create a fully canonical ObservationEnvelope
 */
function createObservationEnvelope({
  id = crypto.randomUUID(),
  source,
  subject,
  event,
  actor,
  machine,
  mission,
  work,
  provenance = {},
  payload = {},
  freshness = {},
  signingKey = null
}) {
  const now = new Date().toISOString();
  const observedAt = freshness.observedAt || now;
  const occurredAt = event?.occurredAt || observedAt;

  const partialEnvelope = {
    schema: OBSERVATION_SCHEMA,
    id,
    source: {
      system: source?.system || 'aftergraph',
      adapter: source?.adapter || 'generic',
      instance: source?.instance || 'default'
    },
    subject: {
      type: subject?.type || 'GenericEntity',
      id: subject?.id || 'unknown'
    },
    event: {
      type: event?.type || 'observation.recorded',
      occurredAt,
      observedAt
    },
    actor: actor || undefined,
    machine: machine || undefined,
    mission: mission || undefined,
    work: work || undefined,
    provenance: {
      sourceId: provenance.sourceId,
      sourceUrl: provenance.sourceUrl,
      commitSha: provenance.commitSha,
      immutableRef: provenance.immutableRef
    },
    payload,
    freshness: {
      observedAt,
      staleAfter: freshness.staleAfter || new Date(Date.now() + 3600000).toISOString()
    }
  };

  // Compute canonical SHA-256 digest
  const digest = computeDigest({
    id: partialEnvelope.id,
    subject: partialEnvelope.subject,
    event: partialEnvelope.event,
    payload: partialEnvelope.payload,
    provenance: partialEnvelope.provenance
  });

  partialEnvelope.integrity = {
    digest,
    signature: signingKey ? `sig_${computeDigest(digest + signingKey)}` : undefined
  };

  return partialEnvelope;
}

module.exports = {
  OBSERVATION_SCHEMA,
  computeDigest,
  validateObservationEnvelope,
  createObservationEnvelope
};
