/**
 * Aftergraph War Room — Base Adapter Contract
 * Defines the standard adapter interface for all external systems.
 */

class BaseWarRoomAdapter {
  constructor(id, options = {}) {
    if (!id) throw new Error('Adapter ID is required');
    this.id = id;
    this.options = options;
    this.status = 'INITIALIZED';
    this.lastObservedAt = null;
    this.lastError = null;
    this.subscribers = new Set();
  }

  /**
   * Health check for adapter connection, rate limits, and latency
   */
  async health() {
    return {
      adapterId: this.id,
      status: this.status,
      healthy: this.status === 'READY' || this.status === 'STREAMING',
      lastObservedAt: this.lastObservedAt,
      lastError: this.lastError,
      quota: this.getQuota(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Discovers first-class entities managed or observed by this adapter
   */
  async discover() {
    throw new Error(`discover() not implemented on adapter ${this.id}`);
  }

  /**
   * Produces an array of ObservationEnvelopes representing current state snapshot
   */
  async snapshot() {
    throw new Error(`snapshot() not implemented on adapter ${this.id}`);
  }

  /**
   * Subscribes to realtime updates, invoking callback with ObservationEnvelope
   */
  async subscribe(emitCallback) {
    if (typeof emitCallback !== 'function') {
      throw new Error('Callback must be a function');
    }
    this.subscribers.add(emitCallback);
    this.status = 'STREAMING';

    return {
      unsubscribe: () => {
        this.subscribers.delete(emitCallback);
        if (this.subscribers.size === 0) {
          this.status = 'READY';
        }
      }
    };
  }

  /**
   * Emits an ObservationEnvelope to all active subscribers
   */
  async emit(envelope) {
    this.lastObservedAt = new Date().toISOString();
    for (const sub of this.subscribers) {
      try {
        await sub(envelope);
      } catch (err) {
        console.error(`[Adapter:${this.id}] Error in subscriber callback:`, err);
      }
    }
  }

  /**
   * Capabilities provided by this adapter
   */
  capabilities() {
    return ['discover', 'snapshot', 'subscribe'];
  }

  /**
   * Returns adapter quota and rate limits
   */
  getQuota() {
    return { remaining: 100, limit: 100, reset: null };
  }
}

module.exports = {
  BaseWarRoomAdapter
};
