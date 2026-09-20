const baseURL = process.env.WAR_ROOM_URL;
if (!baseURL) throw new Error('WAR_ROOM_URL is required');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

async function waitForDevTools() {
  for (let i = 0; i < 80; i++) {
    try { return await getJSON('http://127.0.0.1:9222/json/version'); } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}

async function openTarget(url) {
  return getJSON('http://127.0.0.1:9222/json/new?' + encodeURIComponent(url), {method:'PUT'});
}

async function closeTarget(id) {
  try { await fetch('http://127.0.0.1:9222/json/close/' + id); } catch {}
}

async function inspect(url, expectedTitle) {
  const target = await openTarget(url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  let seq = 0;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP websocket open timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
    ws.addEventListener('error', e => { clearTimeout(timer); reject(e); }, {once:true});
  });

  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const {resolve, reject} = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    }
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params?.exceptionDetails);
  });

  const send = (method, params={}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params}));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`CDP timeout for ${method}`));
    }, 15000);
  });

  try {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', {url});
    await sleep(5000);
    const result = await send('Runtime.evaluate', {
      expression: `(() => ({
        title: document.querySelector('#viewTitle')?.textContent?.trim() || '',
        bootFailure: document.body?.innerText?.includes('Boot failure:') || false,
        hasComposer: document.querySelector('#commandBtn')?.getAttribute('aria-label') === 'Search or ask War Room' && !!document.querySelector('#askInput'),
        activeViews: [...document.querySelectorAll('.view.active')].map(x => x.id),
        readyState: document.readyState
      }))()`,
      returnByValue: true
    });
    const value = result.result?.value;
    if (!value) throw new Error('No browser evaluation result');
    if (exceptions.length) throw new Error('Browser exceptions: ' + JSON.stringify(exceptions));
    if (value.bootFailure) throw new Error('Boot failure rendered');
    if (!value.hasComposer) throw new Error('Composer surface missing');
    if (value.title !== expectedTitle) throw new Error(`viewTitle=${JSON.stringify(value.title)}, want ${JSON.stringify(expectedTitle)}`);
    if (value.activeViews.length !== 1) throw new Error('Expected exactly one active view: ' + JSON.stringify(value));
    return value;
  } finally {
    try { ws.close(); } catch {}
    await closeTarget(target.id);
  }
}

await waitForDevTools();
const cases = [
  ['', 'Now'],
  ['#repositories', 'Repositories'],
  ['#agents', 'Agents & workers'],
  ['#verification', 'Verification'],
];
const results = [];
for (const [hash, title] of cases) {
  results.push({hash: hash || '#overview', ...(await inspect(baseURL + hash, title))});
}
console.log(JSON.stringify({browser:'chromium-cdp', cases:results}, null, 2));
