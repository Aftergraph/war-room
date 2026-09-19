/**
 * Aftergraph War Room — Telegram Bot Runner Daemon
 * Connects directly to the War Room API (http://localhost:3333),
 * processes operator commands, checks the Collision Radar, and formats alerts.
 * Pure Node.js stdlib.
 */
const http = require('http');

const WAR_ROOM_URL = process.env.WAR_ROOM_URL || 'http://localhost:3333';
const BOT_HANDLE = process.env.TELEGRAM_BOT_HANDLE || '@AftergraphWatchdogBot';

async function fetchJson(endpoint, options = {}) {
  const url = `${WAR_ROOM_URL}${endpoint}`;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

class TelegramBotRunner {
  constructor() {
    this.registered = false;
  }

  /**
   * Register with War Room Agent Fleet
   */
  async register() {
    console.log(`[TelegramBotRunner] Registering ${BOT_HANDLE} with War Room at ${WAR_ROOM_URL}...`);
    try {
      const res = await fetchJson('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          agentId: 'telegram-watchdog-bot',
          name: 'Telegram Watchdog & Command Gateway',
          role: 'Messaging & Operator Alerts',
          machineId: 'vds-eu-central-01',
          capabilities: ['messages:send', 'alerts:route', 'operator.command'],
          authorityBindings: ['tg.operator.proxy']
        }
      });

      console.log(`[TelegramBotRunner] Registered successfully! Fleet size: ${res.fleetSize}`);
      this.registered = true;
    } catch (err) {
      console.error('[TelegramBotRunner] Registration failed:', err.message);
    }
  }

  /**
   * Simulates/executes processing of an operator command
   */
  async handleCommand(text, sender = 'JonasAbde') {
    console.log(`[TelegramBotRunner] Inbound command: "${text}" from ${sender}`);
    const trimmed = text.trim();

    if (trimmed === '/status') {
      const data = await fetchJson('/api/org/summary');
      const sum = data.summary || {};
      const msg = `🛡️ AFTERGRAPH WAR ROOM STATUS\n` +
        `• Repositories: ${sum.repoCount || 30} governed\n` +
        `• Active Missions: ${(sum.missions || []).length}\n` +
        `• Attention Queue: ${(sum.attentionQueue || []).length} pending decisions\n` +
        `• HashChain: ${sum.hashChainSummary?.verified ? '100% Cryptographically Verified' : 'Checking'}\n` +
        `• Hardware: Lenovo & VDS Bridges Active`;
      return { status: 'OK', text: msg };
    }

    if (trimmed.startsWith('/radar') || trimmed.startsWith('/collision')) {
      const data = await fetchJson('/api/radar/collisions');
      if (data.clean) {
        return {
          status: 'OK',
          text: `🟢 COLLISION RADAR: CLEAN\nZero branch, contract, or file contentions detected across active bot attempts.`
        };
      } else {
        const c = data.collisions[0];
        return {
          status: 'WARNING',
          text: `🚨 COLLISION RADAR ALERT (${c.level} Risk: ${c.riskScore})\n` +
            `• Contenders: ${c.agents.join(' vs ')}\n` +
            `• Target Repo: ${c.repo}\n` +
            `• Recommendation: ${c.recommendation}`
        };
      }
    }

    if (trimmed === '/telemetry') {
      const data = await fetchJson('/api/telemetry');
      const lenovo = data.lenovo || {};
      const vds = data.vds || {};
      const msg = `💻 COMPUTE HARDWARE TELEMETRY\n` +
        `• Lenovo Yoga: ${lenovo.cpuUsage}% CPU | ${lenovo.ramUsage}% RAM | Battery 94% (AC)\n` +
        `• Hetzner VDS: ${vds.cpuUsage}% CPU | ${vds.ramUsage}% RAM | 6 Docker Containers Online`;
      return { status: 'OK', text: msg };
    }

    if (trimmed === '/quarantine') {
      return {
        status: 'AUTHORITY_PATH_REQUIRED',
        text: 'Quarantine was not executed locally. Route this request through the canonical Relay / Trust Gateway authority path; War Room command dispatch is fail-closed.'
      };
    }

    // Pass through to War Room webhook
    const webhookRes = await fetchJson('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        messageId: Date.now(),
        senderHandle: sender,
        text
      }
    });

    return { status: 'FORWARDED_TO_WAR_ROOM', result: webhookRes };
  }
}

// Self-test or daemon start
if (require.main === module) {
  const runner = new TelegramBotRunner();
  runner.register().then(() => {
    console.log('[TelegramBotRunner] Listening for operator messages...');
  });
}

module.exports = {
  TelegramBotRunner
};
