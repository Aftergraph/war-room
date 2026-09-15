/**
 * Aftergraph War Room — Secrets-Safe Credential Broker (Section 11)
 * Eliminates raw tokens from the browser.
 * Issues short-lived, cryptographically signed ephemeral authority tickets.
 */
const crypto = require('crypto');

class CredentialBroker {
  constructor(masterSecret = 'aftergraph_master_seal_2026') {
    this.masterSecret = masterSecret;
    this.bindings = new Map();
    this.activeTickets = new Map();

    this.initDefaultBindings();
  }

  initDefaultBindings() {
    this.registerBinding({
      id: 'cb_gh_pat_scoped',
      provider: 'github',
      scope: ['repo:read', 'pull_requests'],
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      status: 'ACTIVE'
    });

    this.registerBinding({
      id: 'cb_tg_bot_token',
      provider: 'telegram',
      scope: ['messages:send'],
      expiresAt: new Date(Date.now() + 86400000 * 90).toISOString(),
      status: 'ACTIVE'
    });

    this.registerBinding({
      id: 'cb_vds_runner_key',
      provider: 'hetzner-vds',
      scope: ['compute.slice', 'lease.manage'],
      expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
      status: 'ACTIVE'
    });
  }

  registerBinding({ id, provider, scope = [], expiresAt, status = 'ACTIVE' }) {
    this.bindings.set(id, {
      credentialId: id,
      provider,
      scope,
      expiresAt,
      status,
      registeredAt: new Date().toISOString()
    });
  }

  /**
   * Safe view of all credentials (omits any underlying private keys)
   */
  listBindings() {
    return Array.from(this.bindings.values()).map(b => ({
      credentialId: b.credentialId,
      provider: b.provider,
      scope: b.scope,
      expiresAt: b.expiresAt,
      status: b.status
    }));
  }

  /**
   * Issues a short-lived scoped ticket for an agent or adapter
   */
  requestScopedTicket({ actorId, capability, ttlSeconds = 300 }) {
    const ticketId = `tkt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const signature = crypto
      .createHmac('sha256', this.masterSecret)
      .update(`${ticketId}:${actorId}:${capability}:${expiresAt}`)
      .digest('hex');

    const ticket = {
      ticketId,
      actorId,
      capability,
      expiresAt,
      decision: 'ALLOW',
      signature
    };

    this.activeTickets.set(ticketId, ticket);
    return ticket;
  }

  /**
   * Verifies an incoming authorization ticket
   */
  verifyTicket(ticketId) {
    const ticket = this.activeTickets.get(ticketId);
    if (!ticket) {
      return { valid: false, reason: 'TICKET_NOT_FOUND' };
    }

    if (new Date(ticket.expiresAt).getTime() < Date.now()) {
      this.activeTickets.delete(ticketId);
      return { valid: false, reason: 'TICKET_EXPIRED' };
    }

    return { valid: true, ticket };
  }
}

module.exports = {
  CredentialBroker
};
