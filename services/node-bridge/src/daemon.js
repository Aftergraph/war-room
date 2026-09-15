/**
 * Aftergraph War Room — Compute Plane Node Bridge Daemon
 * Unified abstraction for Lenovo Yoga & Hetzner VDS cloud runner.
 * Enforces signed heartbeats and strictly capability-scoped commands.
 */
const os = require('os');
const { computeDigest, createObservationEnvelope } = require('../../../packages/contracts/src/observation');

// Allowed capability-scoped commands (No arbitrary shell execution!)
const ALLOWED_COMMANDS = new Set([
  'job.inspect',
  'job.stop',
  'agent.restart',
  'service.health',
  'logs.read'
]);

class NodeBridgeDaemon {
  constructor(machineId, role, options = {}) {
    this.machineId = machineId;
    this.role = role; // 'local-operator' | 'cloud-runner'
    this.signingKey = options.signingKey || `secret_${machineId}`;
    this.activeJobs = new Map();
    this.isOnline = true;
    this.mockHardware = options.mockHardware || false;

    // Seed mock active jobs
    this.activeJobs.set('job_forge_412', {
      id: 'job_forge_412',
      agent: 'forge',
      missionId: 'MISSION-2026-09A',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      status: 'RUNNING'
    });
  }

  /**
   * Samples live hardware telemetry from OS
   */
  sampleTelemetry() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    let cpuPercent = 22;
    if (cpus && cpus.length > 0) {
      let totalIdle = 0, totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      cpuPercent = Math.max(5, Math.min(95, Math.round((1 - totalIdle / totalTick) * 100)));
    }

    const payload = {
      machineId: this.machineId,
      role: this.role,
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      cpuUsage: cpuPercent,
      ramUsage: ramPercent,
      ramGb: {
        used: (usedMem / (1024 ** 3)).toFixed(1),
        total: (totalMem / (1024 ** 3)).toFixed(1)
      },
      activeJobCount: this.activeJobs.size,
      online: this.isOnline,
      timestamp: new Date().toISOString()
    };

    const signature = computeDigest(JSON.stringify(payload) + this.signingKey);

    return {
      ...payload,
      signature
    };
  }

  /**
   * Generates a canonical ObservationEnvelope for heartbeats
   */
  generateHeartbeatEnvelope() {
    const telemetry = this.sampleTelemetry();
    return createObservationEnvelope({
      source: {
        system: 'compute',
        adapter: 'node-bridge',
        instance: this.machineId
      },
      subject: {
        type: 'Machine',
        id: this.machineId
      },
      event: {
        type: 'machine.heartbeat',
        occurredAt: telemetry.timestamp,
        observedAt: telemetry.timestamp
      },
      machine: {
        type: 'Machine',
        id: this.machineId,
        name: this.machineId
      },
      payload: telemetry,
      signingKey: this.signingKey
    });
  }

  /**
   * Executes a strictly capability-scoped command with Trust Gateway authorization receipt
   */
  async executeCommand(commandName, params = {}, authReceipt = null) {
    if (!ALLOWED_COMMANDS.has(commandName)) {
      throw new Error(`Capability denied: command '${commandName}' is not in the allowed capability scope`);
    }

    if (!authReceipt || authReceipt.decision !== 'ALLOW') {
      throw new Error('Trust Gateway authorization receipt required to execute capability on machine node');
    }

    const receipt = {
      executedAt: new Date().toISOString(),
      machineId: this.machineId,
      command: commandName,
      authTicket: authReceipt.ticketId
    };

    switch (commandName) {
      case 'service.health':
        return { ...receipt, status: 'HEALTHY', uptimeSeconds: Math.round(os.uptime()) };
      case 'job.inspect':
        return { ...receipt, job: this.activeJobs.get(params.jobId) || null };
      case 'job.stop':
        if (this.activeJobs.has(params.jobId)) {
          this.activeJobs.delete(params.jobId);
          return { ...receipt, stopped: true, jobId: params.jobId };
        }
        return { ...receipt, stopped: false, reason: 'JOB_NOT_FOUND' };
      case 'agent.restart':
        return { ...receipt, restarted: true, agentId: params.agentId };
      case 'logs.read':
        return { ...receipt, lines: ['[daemon] Service healthy', '[daemon] Listening on local socket'] };
      default:
        throw new Error('Unimplemented capability');
    }
  }
}

module.exports = {
  NodeBridgeDaemon,
  ALLOWED_COMMANDS
};
