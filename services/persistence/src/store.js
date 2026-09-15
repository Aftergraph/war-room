/**
 * Aftergraph War Room — Persistent Event Store & WAL Engine
 * Zero-dependency durable storage using append-only Write-Ahead Log (WAL)
 * and periodic snapshots for deterministic replay and Time Machine reconstruction.
 */
const fs = require('fs');
const path = require('path');
const { computeDigest } = require('../../../packages/contracts/src/observation');

class EventStore {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(__dirname, '../../../data');
    this.walPath = path.join(this.dataDir, 'events.jsonl');
    this.snapshotPath = path.join(this.dataDir, 'snapshot.json');
    this.seenIds = new Set();
    this.seenDigests = new Set();
    this.events = [];
    this.latestSnapshot = null;

    this.ensureDirectory();
    this.initFromDisk();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Initializes state by loading snapshot and replaying remaining WAL events
   */
  initFromDisk() {
    // 1. Load latest snapshot if present
    if (fs.existsSync(this.snapshotPath)) {
      try {
        const raw = fs.readFileSync(this.snapshotPath, 'utf8');
        this.latestSnapshot = JSON.parse(raw);
      } catch (err) {
        console.warn('[EventStore] Warning loading snapshot:', err.message);
      }
    }

    // 2. Replay WAL
    if (fs.existsSync(this.walPath)) {
      try {
        const lines = fs.readFileSync(this.walPath, 'utf8').split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const envelope = JSON.parse(line);
            this.seenIds.add(envelope.id);
            if (envelope.integrity?.digest) {
              this.seenDigests.add(envelope.integrity.digest);
            }
            this.events.push(envelope);
          } catch (e) {
            console.error('[EventStore] Corrupt line in WAL:', e.message);
          }
        }
      } catch (err) {
        console.warn('[EventStore] Error reading WAL:', err.message);
      }
    }
  }

  /**
   * Appends an observation envelope with deduplication and idempotency guarantees
   */
  append(envelope) {
    if (!envelope || !envelope.id) {
      throw new Error('Cannot append null or unidentified envelope');
    }

    // Deduplication check: ID or digest match
    if (this.seenIds.has(envelope.id)) {
      return { appended: false, reason: 'DUPLICATE_ID' };
    }

    const digest = envelope.integrity?.digest || computeDigest(envelope.payload);
    if (this.seenDigests.has(digest)) {
      return { appended: false, reason: 'DUPLICATE_DIGEST' };
    }

    // Append to memory
    this.seenIds.add(envelope.id);
    this.seenDigests.add(digest);
    this.events.push(envelope);

    // Append synchronously to WAL file
    const serialized = JSON.stringify(envelope) + '\n';
    fs.appendFileSync(this.walPath, serialized, 'utf8');

    return { appended: true, id: envelope.id, count: this.events.length };
  }

  /**
   * Replays events up to a given timestamp for Time Machine historical state
   */
  replayUntil(targetTimestamp) {
    const targetMs = new Date(targetTimestamp).getTime();
    if (isNaN(targetMs)) {
      throw new Error(`Invalid timestamp for replay: ${targetTimestamp}`);
    }

    return this.events.filter(env => {
      const occurredMs = new Date(env.event.occurredAt).getTime();
      return occurredMs <= targetMs;
    });
  }

  /**
   * Returns all events since a checkpoint (used by "While You Were Away")
   */
  getEventsSince(lastSeenEventId, lastSeenAt) {
    let index = -1;
    if (lastSeenEventId) {
      index = this.events.findIndex(e => e.id === lastSeenEventId);
    }

    if (index !== -1) {
      return this.events.slice(index + 1);
    }

    if (lastSeenAt) {
      const sinceMs = new Date(lastSeenAt).getTime();
      return this.events.filter(e => new Date(e.event.occurredAt).getTime() > sinceMs);
    }

    return this.events.slice(-50); // Default latest 50
  }

  /**
   * Writes current projected state snapshot atomically
   */
  saveSnapshot(projectedState) {
    const snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      lastEventId: this.events.length > 0 ? this.events[this.events.length - 1].id : null,
      totalEvents: this.events.length,
      state: projectedState
    };

    const tempPath = this.snapshotPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tempPath, this.snapshotPath);
    this.latestSnapshot = snapshot;
  }

  getEventCount() {
    return this.events.length;
  }

  getAllEvents() {
    return [...this.events];
  }
}

module.exports = {
  EventStore
};
