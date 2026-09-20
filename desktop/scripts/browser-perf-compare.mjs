const BASE_URL = process.env.BASE_URL;
const HEAD_URL = process.env.HEAD_URL;
if (!BASE_URL || !HEAD_URL) throw new Error('BASE_URL and HEAD_URL are required');

const DEBUG = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9223';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

async function waitForDevTools() {
  for (let i = 0; i < 100; i++) {
    try { return await getJSON(DEBUG + '/json/version'); } catch {}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}

async function newTarget(url) {
  return getJSON(DEBUG + '/json/new?' + encodeURIComponent(url), {method:'PUT'});
}

async function closeTarget(id) {
  try { await fetch(DEBUG + '/json/close/' + id); } catch {}
}

async function measure(url) {
  const target = await newTarget('about:blank');
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
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
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
    await send('Network.enable');
    await send('Network.setCacheDisabled', {cacheDisabled:true});
    await send('Performance.enable');
    await send('Page.navigate', {url});
    for (let i = 0; i < 80; i++) {
      const r = await send('Runtime.evaluate', {
        expression: "document.readyState === 'complete' && !!document.querySelector('#askInput')",
        returnByValue:true
      });
      if (r.result?.value === true) break;
      await sleep(100);
      if (i === 79) throw new Error('page did not become complete');
    }
    await sleep(500);
    if (exceptions.length) throw new Error('browser exceptions: ' + JSON.stringify(exceptions));

    const nav = await send('Runtime.evaluate', {
      expression: `(() => {
        const n=performance.getEntriesByType('navigation')[0];
        return {
          domContentLoadedMs:n?.domContentLoadedEventEnd||0,
          loadEventEndMs:n?.loadEventEnd||0,
          durationMs:n?.duration||0,
          resourceCount:performance.getEntriesByType('resource').length,
          jsHeapUsed:performance.memory?.usedJSHeapSize||0
        };
      })()`,
      returnByValue:true
    });
    const perf = await send('Performance.getMetrics');
    const m = Object.fromEntries((perf.metrics||[]).map(x=>[x.name,x.value]));
    return {
      ...nav.result.value,
      taskDurationMs:(m.TaskDuration||0)*1000,
      scriptDurationMs:(m.ScriptDuration||0)*1000,
      layoutDurationMs:(m.LayoutDuration||0)*1000,
      recalcStyleDurationMs:(m.RecalcStyleDuration||0)*1000,
      nodes:m.Nodes||0,
      documents:m.Documents||0,
    };
  } finally {
    try { ws.close(); } catch {}
    await closeTarget(target.id);
  }
}

function median(xs) {
  const a=[...xs].sort((x,y)=>x-y);
  const n=a.length;
  return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;
}
function pct(xs,q) {
  const a=[...xs].sort((x,y)=>x-y);
  const p=(a.length-1)*q, lo=Math.floor(p), hi=Math.min(lo+1,a.length-1), f=p-lo;
  return a[lo]*(1-f)+a[hi]*f;
}
function summarize(rows) {
  const keys=Object.keys(rows[0]);
  return Object.fromEntries(keys.map(k=>{
    const xs=rows.map(r=>r[k]);
    return [k,{median:median(xs),p95:pct(xs,0.95),min:Math.min(...xs),max:Math.max(...xs)}];
  }));
}
function delta(after,before) {
  if (before===0) return after===0?0:null;
  return (after-before)/before*100;
}

await waitForDevTools();
const rows={base:[],head:[]};
const iterations=8;
for(let i=0;i<iterations;i++){
  const order=i%2===0?['base','head']:['head','base'];
  for(const label of order){
    rows[label].push(await measure(label==='base'?BASE_URL:HEAD_URL));
  }
}
const summary={base:summarize(rows.base),head:summarize(rows.head)};
const compare={};
for(const k of ['domContentLoadedMs','loadEventEndMs','durationMs','jsHeapUsed','taskDurationMs','scriptDurationMs','layoutDurationMs','recalcStyleDurationMs','nodes']){
  compare[k]={
    baseMedian:summary.base[k].median,
    headMedian:summary.head[k].median,
    deltaPct:delta(summary.head[k].median,summary.base[k].median)
  };
}
const gross=[];
const checks=[
  ['domContentLoadedMs',1.5,100],
  ['loadEventEndMs',1.5,100],
  ['taskDurationMs',1.5,20],
  ['scriptDurationMs',1.5,15],
  ['layoutDurationMs',1.5,10],
  ['recalcStyleDurationMs',1.5,10],
  ['jsHeapUsed',1.25,5*1024*1024],
];
for(const [k,mult,abs] of checks){
  const b=compare[k].baseMedian, h=compare[k].headMedian;
  if(h>Math.max(b*mult,b+abs)) gross.push(k);
}
const result={iterationsPerVariant:iterations,cacheDisabled:true,interleavedOrder:true,summary,compare,grossRegressions:gross,grossRegressionGate:gross.length===0};
console.log(JSON.stringify(result,null,2));
if(gross.length) process.exitCode=1;
