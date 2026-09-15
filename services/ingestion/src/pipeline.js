/**
 * Aftergraph War Room — Ingestion Fabric Pipeline
 * Normalizes, validates, deduplicates, correlates, and persists observation envelopes.
 */
const { validateObservationEnvelope, computeDigest } = require('../../../packages/contracts/src/observation');
const { EPISTEMIC_STATUS } = require('../../../packages/domain/src/entities');

class IngestionPipeline {
  constructor({ eventStore, projector, intelligenceEngine, realtimeHub }) {
    this.eventStore = eventStore;
    this.projector = projector;
    this.intelligenceEngine = intelligenceEngine;
    this.realtimeHub = realtimeHub;
    this.stats = {
      received: 0,
      validated: 0,
      deduped: 0,
      persisted: 0,
      projected: 0,
      rejected: 0,
      errors: []
    };
  }

  /**
   * Ingests a raw event or pre-formed observation envelope through the complete pipeline
   */
  async ingest(raw) {
    this.stats.received++;
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Envelope Normalization & Schema Validation
      const envelope = this.normalizeEnvelope(raw);
      const validation = validateObservationEnvelope(envelope);
      if (!validation.valid) {
        this.stats.rejected++;
        this.recordError('SCHEMA_VALIDATION_FAILED', validation.errors);
        return { success: false, reason: 'SCHEMA_INVALID', errors: validation.errors };
      }
      this.stats.validated++;

      // 2. Clock-skew tolerance check (normalize timestamps)
      const now = Date.now();
      const occurredMs = new Date(envelope.event.occurredAt).getTime();
      if (occurredMs > now + 300000) { // Future clock skew > 5 minutes
        envelope.event.occurredAt = new Date(now).toISOString();
        envelope.metadata = { ...envelope.metadata, clockSkewCorrected: true };
      }

      // 3. Canonical Identity Resolution & Correlation
      this.resolveIdentities(envelope);

      // 4. Deduplication & Append to Persistent Store
      const storeResult = this.eventStore.append(envelope);
      if (!storeResult.appended) {
        this.stats.deduped++;
        return { success: true, status: 'DEDUPLICATED', id: envelope.id };
      }
      this.stats.persisted++;

      // 5. Update State Projections
      let projectionPatch = null;
      if (this.projector) {
        projectionPatch = this.projector.applyObservation(envelope);
        this.stats.projected++;
      }

      // 6. Run Intelligence Engine (Risk, Anomaly, Collision, Stalls)
      let intelVerdict = null;
      if (this.intelligenceEngine) {
        intelVerdict = await this.intelligenceEngine.evaluateObservation(envelope, this.projector?.getState());
      }

      // 7. Realtime Push via SSE Hub
      if (this.realtimeHub) {
        this.realtimeHub.broadcast('observation', {
          traceId,
          envelope,
          patch: projectionPatch,
          intel: intelVerdict
        });
      }

      return {
        success: true,
        id: envelope.id,
        traceId,
        intel: intelVerdict
      };
    } catch (err) {
      this.stats.rejected++;
      this.recordError('INGESTION_ERROR', [err.message]);
      return { success: false, reason: 'INTERNAL_ERROR', error: err.message };
    }
  }

  /**
   * Normalizes raw event payloads into canonical aftergraph.observation/1 envelope
   */
  normalizeEnvelope(raw) {
    if (raw && raw.schema === 'aftergraph.observation/1') {
      return raw;
    }

    const now = new Date().toISOString();
    const id = raw.id || `obs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Inferred subject & type
    let subjectType = 'Repository';
    let subjectId = 'unknown';
    if (raw.repo?.name) {
      subjectType = 'Repository';
      subjectId = raw.repo.name;
    } else if (raw.subject?.type && raw.subject?.id) {
      subjectType = raw.subject.type;
      subjectId = raw.subject.id;
    }

    const payload = raw.payload || raw;
    const digest = computeDigest({ id, subjectType, subjectId, payload });

    return {
      schema: 'aftergraph.observation/1',
      id,
      source: {
        system: raw.source?.system || 'github',
        adapter: raw.source?.adapter || 'github-observer',
        instance: raw.source?.instance || 'default'
      },
      subject: {
        type: subjectType,
        id: subjectId
      },
      event: {
        type: raw.type || raw.event?.type || 'activity.recorded',
        occurredAt: raw.created_at || raw.event?.occurredAt || now,
        observedAt: now
      },
      actor: raw.actor ? { type: 'Agent', id: raw.actor.display_login || raw.actor.login || 'unknown' } : undefined,
      machine: raw.machine ? { type: 'Machine', id: raw.machine.id || 'vds-eu-central-01' } : undefined,
      mission: raw.mission ? { type: 'Mission', id: raw.mission.id } : undefined,
      work: raw.work ? { type: 'Work', id: raw.work.id } : undefined,
      provenance: {
        sourceId: raw.id,
        commitSha: raw.payload?.head || raw.payload?.commitSha || raw.sha,
        sourceUrl: raw.repo?.url
      },
      payload,
      freshness: {
        observedAt: now,
        staleAfter: new Date(Date.now() + 3600000).toISOString()
      },
      integrity: {
        digest
      }
    };
  }

  /**
   * Disentangles and correlates canonical identities
   */
  resolveIdentities(envelope) {
    // Correlate actor
    if (envelope.actor) {
      const login = envelope.actor.id.toLowerCase();
      if (login.includes('bot') || login.includes('codex') || login.includes('sentinel') || login.includes('dependabot') || login.includes('actions')) {
        envelope.actor.type = 'Agent';
      } else {
        envelope.actor.type = 'Agent'; // In War Room, human operators and AI agents share governed agent semantics
      }
    }

    // Bind subject epistemic status
    envelope.epistemicStatus = EPISTEMIC_STATUS.OBSERVED;
  }

  recordError(code, details) {
    this.stats.errors.push({
      code,
      details,
      timestamp: new Date().toISOString()
    });
    if (this.stats.errors.length > 50) {
      this.stats.errors.shift();
    }
  }

  getMetrics() {
    return { ...this.stats };
  }
}

module.exports = {
  IngestionPipeline
};
