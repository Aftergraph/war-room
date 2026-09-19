'use strict';
(() => {
  const ROOT = document.documentElement;
  const STORE_KEY = 'aftergraph.visual.v1';
  const DEFAULTS = Object.freeze({
    motion: 'auto',
    transparency: 'regular',
    audio: false,
    cvd: 'none',
    performanceHud: false,
  });

  const safeParse = (raw, fallback) => {
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const readPrefs = () => {
    try { return { ...DEFAULTS, ...safeParse(localStorage.getItem(STORE_KEY), {}) }; }
    catch { return { ...DEFAULTS }; }
  };
  const savePrefs = prefs => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch {}
  };

  const state = {
    prefs: readPrefs(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    moreContrast: matchMedia('(prefers-contrast: more)').matches,
    pointerFine: matchMedia('(pointer: fine)').matches,
    data: null,
    latestEventKey: '',
    lastNeeds: null,
    initialized: false,
    cleanup: [],
    mutationObserver: null,
    observationMode: 'unknown',
  };

  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return () => {};
    target.addEventListener(type, handler, options);
    const off = () => { try { target.removeEventListener(type, handler, options); } catch {} };
    state.cleanup.push(off);
    return off;
  }

  function effectiveMotion() {
    if (state.prefs.motion === 'reduce') return 'reduce';
    if (state.prefs.motion === 'full') return 'full';
    return state.reducedMotion ? 'reduce' : 'full';
  }

  function applyPrefs() {
    ROOT.dataset.motion = effectiveMotion();
    ROOT.dataset.transparency = state.prefs.transparency;
    ROOT.dataset.cvd = state.prefs.cvd;
    ROOT.dataset.audio = state.prefs.audio ? 'on' : 'off';
    ROOT.dataset.contrast = state.moreContrast ? 'more' : 'normal';
    ROOT.dataset.visualEngine = 'ready';
    const sound = document.querySelector('#soundBtn');
    if (sound) {
      sound.classList.toggle('active', state.prefs.audio);
      sound.setAttribute('aria-pressed', String(state.prefs.audio));
      sound.setAttribute('title', state.prefs.audio ? 'Sound feedback on' : 'Sound feedback off');
      sound.innerHTML = window.AGIcons?.icon(state.prefs.audio ? 'volume2' : 'volumeX', 15) || (state.prefs.audio ? '♪' : '∅');
    }
    const motion = document.querySelector('#visualMotion');
    if (motion) motion.value = state.prefs.motion;
    const transparency = document.querySelector('#visualTransparency');
    if (transparency) transparency.value = state.prefs.transparency;
    const cvd = document.querySelector('#visualCvd');
    if (cvd) cvd.value = state.prefs.cvd;
    const audio = document.querySelector('#visualAudio');
    if (audio) audio.checked = state.prefs.audio;
    signalField.setMotion(effectiveMotion());
  }

  const audio = (() => {
    let ctx = null;
    let master = null;
    function context() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC({ latencyHint: 'interactive' });
        master = ctx.createGain();
        master.gain.value = 0.045;
        master.connect(ctx.destination);
      }
      return ctx;
    }
    async function arm() {
      const c = context();
      if (c?.state === 'suspended') {
        try { await c.resume(); } catch {}
      }
    }
    function tone(freq, duration = 0.045, type = 'sine', delay = 0, gain = 0.55) {
      const c = context(); if (!c || !master) return;
      const now = c.currentTime + delay;
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp); amp.connect(master);
      osc.start(now); osc.stop(now + duration + 0.01);
    }
    async function play(kind = 'tap') {
      if (!state.prefs.audio || document.hidden) return;
      await arm();
      if (kind === 'success') { tone(520, .055, 'sine', 0, .45); tone(780, .07, 'sine', .035, .32); return; }
      if (kind === 'attention') { tone(330, .07, 'triangle', 0, .42); tone(247, .09, 'triangle', .055, .32); return; }
      if (kind === 'open') { tone(420, .045, 'sine', 0, .25); tone(610, .05, 'sine', .018, .16); return; }
      tone(390, .032, 'sine', 0, .17);
    }
    async function destroy(){const c=ctx;ctx=null;master=null;if(c&&c.state!=='closed'){try{await c.close()}catch{}}}
    return { arm, play, destroy };
  })();

  const contrast = (() => {
    const palette = {
      institution_black: '#080C14', graph_midnight: '#0E1630', evidence_white: '#F5F7FA',
      slate: '#8993A4', control_cyan: '#42C7E8', evidence_teal: '#24C4AD',
      authority_violet: '#7759E8', authority_text: '#9C8AF1', decision_amber: '#F0A64A', system_blue: '#4C8BD8',
      danger: '#EF6A78',
    };
    const pairs = [
      ['Evidence white', 'evidence_white', 'institution_black'],
      ['Control cyan', 'control_cyan', 'institution_black'],
      ['Evidence teal', 'evidence_teal', 'institution_black'],
      ['Decision amber', 'decision_amber', 'institution_black'],
      ['Slate', 'slate', 'institution_black'],
      ['System blue', 'system_blue', 'institution_black'],
      ['Authority violet · accent only', 'authority_violet', 'institution_black'],
      ['Authority text', 'authority_text', 'institution_black'],
      ['Danger', 'danger', 'institution_black'],
    ];
    function rgb(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const linear = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
    function luminance(hex) { const [r,g,b] = rgb(hex).map(linear); return .2126*r + .7152*g + .0722*b; }
    function ratio(a,b) { const [x,y] = [luminance(a), luminance(b)].sort((m,n)=>n-m); return (x+.05)/(y+.05); }
    function report() {
      return pairs.map(([label, fg, bg]) => {
        const value = ratio(palette[fg], palette[bg]);
        return { label, foreground: palette[fg], background: palette[bg], ratio: value, aa: value >= 4.5, aaa: value >= 7 };
      });
    }
    return { ratio, report };
  })();

  const signalField = (() => {
    let canvas, ctx, resizeObserver, raf = 0, motion = 'full', observationMode = 'unknown', nodes = [], bursts = [], lastW = 0, lastH = 0, burstIndex = 0, fallbackResize = null;
    const colors = ['#42C7E8','#24C4AD','#7759E8','#F0A64A','#4C8BD8'];
    function attach() {
      canvas = document.querySelector('#signalField');
      if (!canvas) return;
      ctx = canvas.getContext('2d', { alpha: true });
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas.parentElement);
      } else {
        fallbackResize = resize;
        listen(window, 'resize', fallbackResize, { passive: true });
      }
      listen(document, 'visibilitychange', syncLoop);
      resize(); syncLoop();
    }
    function resize() {
      if (!canvas || !ctx) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      lastW = Math.max(1, r.width); lastH = Math.max(1, r.height);
      canvas.width = Math.round(lastW*dpr); canvas.height = Math.round(lastH*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      layout(); draw(performance.now());
    }
    function layout() {
      const n = Math.max(1, nodes.length || 9);
      nodes = Array.from({length:n},(_,i)=>({
        ...(nodes[i]||{}),
        x: lastW*(.08 + ((i*0.117)%0.84)),
        y: lastH*(.22 + ((i*0.293)%0.58)),
        phase:(i*1.7)%6.28,
        color:colors[i%colors.length],
      }));
    }
    function setData(data) {
      const domains = data?.domains || [];
      nodes = domains.map((d,i)=>({
        label:d.name,
        activity:+d.activity24h||0,
        failing:+d.ciFailing||0,
        intensity:Math.min(1,.15+(+d.activity24h||0)/12+(+d.ciFailing||0)*.35),
        phase:(i*1.7)%6.28,
        color:colors[i%colors.length],
      }));
      layout(); burst('update');
      if (motion === 'reduce' || observationMode!=='live') draw(performance.now());
    }
    function burst(kind='update') {
      if (motion === 'reduce' || observationMode!=='live' || !lastW) return;
      const source = nodes.length ? nodes[burstIndex++ % nodes.length] : {x:lastW*.5,y:lastH*.5,color:'#42C7E8'};
      const x=Number.isFinite(+source.x)?Math.max(0,Math.min(lastW,+source.x)):lastW*.5;
      const y=Number.isFinite(+source.y)?Math.max(0,Math.min(lastH,+source.y)):lastH*.5;
      bursts.push({x,y,color:source.color||'#42C7E8',born:performance.now(),kind});
      bursts = bursts.slice(-7);
    }
    function draw(t) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0,0,lastW,lastH);
      const gradient = ctx.createRadialGradient(lastW*.62,lastH*.05,0,lastW*.62,lastH*.05,Math.max(lastW,lastH)*.72);
      gradient.addColorStop(0,'rgba(66,199,232,.055)'); gradient.addColorStop(.55,'rgba(119,89,232,.018)'); gradient.addColorStop(1,'rgba(8,12,20,0)');
      ctx.fillStyle=gradient; ctx.fillRect(0,0,lastW,lastH);
      const time=t/1000;
      for (const n of nodes) {
        const pulse = motion==='reduce' ? 0 : (Math.sin(time*.85+n.phase)+1)*.5;
        const rad = 2.1 + (n.intensity||.2)*2.3 + pulse*.65;
        ctx.beginPath();ctx.arc(n.x,n.y,rad*3.2,0,Math.PI*2);ctx.fillStyle=hexAlpha(n.color,.018+(n.intensity||.2)*.025);ctx.fill();
        ctx.beginPath();ctx.arc(n.x,n.y,rad,0,Math.PI*2);ctx.fillStyle=hexAlpha(n.color,.26+(n.intensity||.2)*.42);ctx.fill();
      }
      bursts = bursts.filter(b=>t-b.born<950);
      for (const b of bursts) {
        const p=Math.max(0,Math.min(1,(t-b.born)/950)), radius=7+p*42;
        ctx.beginPath();ctx.arc(b.x,b.y,radius,0,Math.PI*2);ctx.strokeStyle=hexAlpha(b.color,(1-p)*.24);ctx.lineWidth=1;ctx.stroke();
      }
    }
    function loop(t){draw(t);raf=requestAnimationFrame(loop)}
    function syncLoop(){cancelAnimationFrame(raf);raf=0;if(motion==='full'&&observationMode==='live'&&!document.hidden)raf=requestAnimationFrame(loop);else draw(performance.now())}
    function setMotion(m){motion=m;syncLoop()}
    function setObservationMode(m){observationMode=m||'unknown';syncLoop()}
    function destroy(){cancelAnimationFrame(raf);raf=0;resizeObserver?.disconnect?.();resizeObserver=null;canvas=null;ctx=null;bursts=[];nodes=[]}
    function hexAlpha(hex,a){const h=hex.replace('#','');const n=parseInt(h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`}
    return { attach, setData, burst, setMotion, setObservationMode, destroy };
  })();

  function decorate(root=document) {
    root.querySelectorAll('.context-card,.pulse-metric,.candidate,.timeline-item,.surface.interactive,.query-card,.command-trigger,.composer,.palette-option').forEach(el=>{
      if (!el.hasAttribute('data-sheen')) el.setAttribute('data-sheen','');
    });
    root.querySelectorAll('.context-card,.pulse-metric,.candidate').forEach(el=>{
      if (!el.hasAttribute('data-tilt')) el.setAttribute('data-tilt','');
    });
    root.querySelectorAll('.icon-action,.attention-button,.composer-send,.composer-plus,.text-action,.primary-button,.secondary-button,.nav-item').forEach(el=>{
      if (!el.hasAttribute('data-magnetic')) el.setAttribute('data-magnetic','');
    });
  }

  let pointerFrame = 0, pointerEvent = null, lastPointer={x:0,y:0,t:performance.now()}, dwellTimer=0, intentHot=null, dwellTarget=null;
  function clearIntent(target=null) {
    clearTimeout(dwellTimer); dwellTimer=0;
    if (intentHot && (!target || intentHot!==target)) intentHot.classList.remove('intent-hot');
    if (!target) { intentHot=null; dwellTarget=null; }
  }
  function pointerMove(ev) {
    const now=performance.now(), dt=Math.max(1,now-lastPointer.t), vx=(ev.clientX-lastPointer.x)/dt, vy=(ev.clientY-lastPointer.y)/dt;
    const speed=Number.isFinite(Math.hypot(vx,vy))?Math.hypot(vx,vy):0;lastPointer={x:ev.clientX,y:ev.clientY,t:now};
    const gx=Math.max(0,Math.min(1,ev.clientX/Math.max(1,innerWidth))),gy=Math.max(0,Math.min(1,ev.clientY/Math.max(1,innerHeight)));
    ROOT.style.setProperty('--global-x',gx.toFixed(4));ROOT.style.setProperty('--global-y',gy.toFixed(4));
    const intentTarget=ev.target.closest?.('button,a,[role="button"],.timeline-item,.graph-node')||null;
    if(intentHot&&intentHot!==intentTarget){intentHot.classList.remove('intent-hot');intentHot=null}
    clearTimeout(dwellTimer);dwellTimer=0;dwellTarget=intentTarget;
    if(intentTarget&&speed<.14)dwellTimer=setTimeout(()=>{if(dwellTarget!==intentTarget||!intentTarget.isConnected)return;intentHot?.classList.remove('intent-hot');intentHot=intentTarget;intentTarget.classList.add('intent-hot');intentTarget.dispatchEvent(new CustomEvent('warroom:intent',{bubbles:true,detail:{speed}}))},130);
    if (effectiveMotion()==='reduce' || !state.pointerFine) return;
    const magnetic=ev.target.closest?.('[data-magnetic]');
    if(magnetic){const r=magnetic.getBoundingClientRect(),dx=ev.clientX-(r.left+r.width/2),dy=ev.clientY-(r.top+r.height/2),dist=Math.hypot(dx,dy),max=Math.max(r.width,r.height)*1.15;if(dist<max){const k=(1-dist/max)*.09;magnetic.style.setProperty('--magnetic-x',`${(dx*k).toFixed(2)}px`);magnetic.style.setProperty('--magnetic-y',`${(dy*k).toFixed(2)}px`)}}
    const el = ev.target.closest?.('[data-sheen]'); if (!el) return;
    pointerEvent = {ev,el};
    if (pointerFrame) return;
    pointerFrame=requestAnimationFrame(()=>{
      pointerFrame=0; const p=pointerEvent; if (!p?.el?.isConnected) return;
      const r=p.el.getBoundingClientRect(); if(!r.width||!r.height)return;
      const x=Math.max(0,Math.min(1,(p.ev.clientX-r.left)/r.width)), y=Math.max(0,Math.min(1,(p.ev.clientY-r.top)/r.height));
      p.el.style.setProperty('--mx',`${(x*100).toFixed(1)}%`);p.el.style.setProperty('--my',`${(y*100).toFixed(1)}%`);
      if (p.el.matches('[data-tilt]')) {
        const rx=(.5-y)*1.6, ry=(x-.5)*2.0;
        p.el.style.setProperty('--rx',`${rx.toFixed(2)}deg`);p.el.style.setProperty('--ry',`${ry.toFixed(2)}deg`);
      }
    });
  }
  function pointerOut(ev) {
    const magnetic=ev.target.closest?.('[data-magnetic]');if(magnetic&&!magnetic.contains(ev.relatedTarget)){magnetic.style.setProperty('--magnetic-x','0px');magnetic.style.setProperty('--magnetic-y','0px')}
    if(dwellTarget&&!dwellTarget.contains(ev.relatedTarget)){clearTimeout(dwellTimer);dwellTimer=0;dwellTarget=null}
    if(intentHot&&!intentHot.contains(ev.relatedTarget)){intentHot.classList.remove('intent-hot');intentHot=null}
    const el=ev.target.closest?.('[data-sheen]'); if(!el||el.contains(ev.relatedTarget))return;
    el.style.setProperty('--mx','50%');el.style.setProperty('--my','-20%');el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');
  }

  function eventKey(data) {
    const a=data?.github?.activities?.[0]; const w=data?.github?.workflowRuns?.[0];
    return [a?.timestamp,a?.repo,a?.title,w?.createdAt,w?.repo,w?.conclusion].filter(Boolean).join('|');
  }
  function setData(data,observationMode='unknown') {
    state.data=data;state.observationMode=observationMode;signalField.setObservationMode(observationMode);signalField.setData(data);
    const key=eventKey(data);
    if(observationMode==='live'&&state.latestEventKey && key && key!==state.latestEventKey){
      signalField.burst('event');
      document.querySelector('.workspace')?.classList.add('data-arrival');
      setTimeout(()=>document.querySelector('.workspace')?.classList.remove('data-arrival'),620);
    }
    state.latestEventKey=key||state.latestEventKey;
    const needs=+data?.needsYou||0;
    if(observationMode==='live'&&state.lastNeeds!==null && needs>state.lastNeeds){
      bump('#needsCountTop'); audio.play('attention');
    }
    state.lastNeeds=needs;
    const workspace=document.querySelector('.workspace');if(workspace){const route=data?.typeSafe?.route||'';workspace.dataset.attention=needs>2||route==='urgent_review'?'critical':needs>0||route==='human_review'?'elevated':'nominal';workspace.dataset.observationMode=observationMode}
    document.querySelectorAll('.timeline-item').forEach(el=>{const idx=+el.dataset.eventIndex;const host=el.closest('.timeline');const item=host?._events?.[idx];if(!item?.when)return;const age=Math.max(0,Date.now()-new Date(item.when).getTime()),rec=Math.max(.08,Math.exp(-age/(36*3600*1000)));el.style.setProperty('--recency',rec.toFixed(3))});
  }

  function bump(selector){const el=document.querySelector(selector);if(!el)return;el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');setTimeout(()=>el.classList.remove('bump'),650)}
  function transition(fn) {
    if (effectiveMotion()==='reduce' || !document.startViewTransition) { fn(); return null; }
    let applied = false;
    const apply = () => { if (applied) return; applied = true; fn(); };
    try {
      const vt = document.startViewTransition(apply);
      queueMicrotask(apply); // correctness must never wait on animation scheduling
      return vt;
    } catch {
      apply();
      return null;
    }
  }
  function pulse(kind='update'){signalField.burst(kind);const el=document.querySelector('#sidebarLive');if(el){el.classList.remove('signal-pulse');void el.offsetWidth;el.classList.add('signal-pulse');setTimeout(()=>el.classList.remove('signal-pulse'),700)}}

  async function measureCadence() {
    const out=document.querySelector('#visualPerformanceResult'); if(out)out.textContent='Measuring…';
    const samples=[]; let last=0, count=0;
    return new Promise(resolve=>{
      const step=t=>{if(last)samples.push(t-last);last=t;if(++count<120)requestAnimationFrame(step);else{
        const sorted=[...samples].sort((a,b)=>a-b);const median=sorted[Math.floor(sorted.length*.5)]||0,p95=sorted[Math.floor(sorted.length*.95)]||0,hz=median?1000/median:0;
        const result={hz,p95,median,samples:samples.length};if(out)out.textContent=`${hz.toFixed(0)} Hz cadence · p95 ${p95.toFixed(1)} ms/frame`;resolve(result);
      }};requestAnimationFrame(step);
    });
  }

  function renderContrast() {
    const host=document.querySelector('#contrastReport'); if(!host)return;
    const rows=contrast.report();host.innerHTML=rows.map((r,i)=>`<div class="contrast-row"><span><i data-swatch="${i}"></i>${r.label}</span><b>${r.ratio.toFixed(2)}:1</b><em class="${r.aa?'pass':'fail'}">${r.aaa?'AAA':r.aa?'AA':'FAIL'}</em></div>`).join('');host.querySelectorAll('[data-swatch]').forEach(i=>{const r=rows[+i.dataset.swatch];if(r)i.style.setProperty('--swatch',r.foreground)});
  }

  const dialogManager=(()=>{
    let active=null,returnFocus=null,closeFn=null;
    const focusables=el=>[...el.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.closest('.hidden')&&x.getClientRects().length>0);
    function onKey(e){if(!active)return;if(e.key==='Escape'){e.preventDefault();closeFn?.();return}if(e.key!=='Tab')return;const list=focusables(active);if(!list.length){e.preventDefault();active.focus?.();return}const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
    function activate(el,trigger,onClose){if(!el)return;if(active&&active!==el)deactivate(active,false);active=el;returnFocus=trigger instanceof HTMLElement?trigger:document.activeElement;closeFn=onClose||null;const shell=document.querySelector('#appShell');if(shell)shell.inert=true;el.dataset.dialogActive='true';requestAnimationFrame(()=>{const first=focusables(el)[0];(first||el).focus?.({preventScroll:true})})}
    function deactivate(el,restore=true){if(!active||el&&active!==el)return;const shell=document.querySelector('#appShell');if(shell)shell.inert=false;const target=returnFocus;active?.removeAttribute('data-dialog-active');active=null;returnFocus=null;closeFn=null;if(restore&&target?.isConnected)queueMicrotask(()=>target.focus?.({preventScroll:true}))}
    return{activate,deactivate,onKey,get active(){return active}};
  })();

  function openPanel() {
    const panel=document.querySelector('#visualDrawer');if(!panel)return;const trigger=document.activeElement;panel.classList.remove('hidden');applyPrefs();renderContrast();audio.play('open');
    dialogManager.activate(panel,trigger,closePanel);requestAnimationFrame(()=>panel.classList.add('open'));
  }
  function closePanel() {
    const panel=document.querySelector('#visualDrawer');if(!panel)return;panel.classList.remove('open');const delay=effectiveMotion()==='reduce'?0:220;setTimeout(()=>{panel.classList.add('hidden');dialogManager.deactivate(panel)},delay);
  }

  function bindPanel() {
    listen(document.querySelector('#visualBtn'),'click',openPanel);
    listen(document.querySelector('#visualClose'),'click',closePanel);
    listen(document.querySelector('#visualDrawer'),'click',e=>{if(e.target.id==='visualDrawer')closePanel()});
    listen(document.querySelector('#visualMotion'),'change',e=>{state.prefs.motion=e.target.value;savePrefs(state.prefs);applyPrefs();audio.play('tap')});
    listen(document.querySelector('#visualTransparency'),'change',e=>{state.prefs.transparency=e.target.value;savePrefs(state.prefs);applyPrefs();audio.play('tap')});
    listen(document.querySelector('#visualCvd'),'change',e=>{state.prefs.cvd=e.target.value;savePrefs(state.prefs);applyPrefs()});
    listen(document.querySelector('#visualAudio'),'change',async e=>{state.prefs.audio=e.target.checked;savePrefs(state.prefs);applyPrefs();if(e.target.checked){await audio.arm();audio.play('success')}});
    listen(document.querySelector('#soundBtn'),'click',async()=>{state.prefs.audio=!state.prefs.audio;savePrefs(state.prefs);applyPrefs();if(state.prefs.audio){await audio.arm();audio.play('success')}});
    listen(document.querySelector('#measurePerformance'),'click',measureCadence);
  }
  function bindMedia() {
    const rm=matchMedia('(prefers-reduced-motion: reduce)'),pc=matchMedia('(prefers-contrast: more)');
    listen(rm,'change',e=>{state.reducedMotion=e.matches;applyPrefs()});
    listen(pc,'change',e=>{state.moreContrast=e.matches;applyPrefs()});
  }

  const performanceGovernor=(()=>{
    let timer=0,warmup=0,running=false,battery=null,sampleRaf=0,batterySync=null,longTaskObserver=null;
    const metrics={lastSampleAt:0,p95:0,median:0,hz:0,tier:'unknown',longTasks:0,longTaskTotalMs:0,longTaskMaxMs:0};
    async function batteryState(){try{battery=await navigator.getBattery?.();if(battery){batterySync=()=>ROOT.dataset.battery=(battery.charging||battery.level>.2)?'normal':'low';batterySync();listen(battery,'levelchange',batterySync);listen(battery,'chargingchange',batterySync)}}catch{}}
    function recordLongTasks(){try{if(!('PerformanceObserver' in window))return;const supported=PerformanceObserver.supportedEntryTypes||[];if(!supported.includes('longtask'))return;longTaskObserver=new PerformanceObserver(list=>{for(const e of list.getEntries()){const d=Math.max(0,Number(e.duration)||0);metrics.longTasks++;metrics.longTaskTotalMs+=d;metrics.longTaskMaxMs=Math.max(metrics.longTaskMaxMs,d)}});longTaskObserver.observe({type:'longtask',buffered:true})}catch{longTaskObserver=null}}
    function sample(){if(running||document.hidden||effectiveMotion()==='reduce')return;running=true;const d=[],n=36;let last=0,c=0;const step=t=>{if(last)d.push(Math.min(250,Math.max(0,t-last)));last=t;if(++c<n)sampleRaf=requestAnimationFrame(step);else{sampleRaf=0;running=false;const sorted=d.sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length*.5)]||0,p95=sorted[Math.floor(sorted.length*.95)]||16.7,hz=median?1000/median:0;let tier=p95>24?'eco':p95>12?'balanced':'high';if(ROOT.dataset.battery==='low')tier='eco';metrics.lastSampleAt=Date.now();metrics.p95=p95;metrics.median=median;metrics.hz=hz;metrics.tier=tier;ROOT.dataset.performanceTier=tier;ROOT.style.setProperty('--observed-frame-p95',`${p95.toFixed(1)}ms`)}};sampleRaf=requestAnimationFrame(step)}
    function init(){batteryState();recordLongTasks();timer=setInterval(sample,12000);warmup=setTimeout(sample,1800);listen(document,'visibilitychange',()=>{if(!document.hidden)warmup=setTimeout(sample,400)})}
    function destroy(){clearInterval(timer);clearTimeout(warmup);cancelAnimationFrame(sampleRaf);longTaskObserver?.disconnect?.();longTaskObserver=null;timer=warmup=sampleRaf=0;running=false}
    function snapshot(){return{...metrics,battery:ROOT.dataset.battery||'unknown'}}
    return{init,sample,destroy,snapshot};
  })();

  function init() {
    if(state.initialized)return;state.initialized=true;
    applyPrefs();bindPanel();bindMedia();signalField.attach();performanceGovernor.init();
    listen(document,'pointermove',pointerMove,{passive:true});listen(document,'pointerout',pointerOut,{passive:true});listen(document,'keydown',dialogManager.onKey,true);
    if('MutationObserver' in window){state.mutationObserver=new MutationObserver(m=>{for(const item of m){for(const n of item.addedNodes){if(n.nodeType===1)decorate(n)}}});state.mutationObserver.observe(document.body,{subtree:true,childList:true})}decorate();
  }
  function destroy(){if(!state.initialized)return;state.initialized=false;dialogManager.deactivate(null,false);signalField.destroy();performanceGovernor.destroy();audio.destroy();state.mutationObserver?.disconnect?.();state.mutationObserver=null;cancelAnimationFrame(pointerFrame);pointerFrame=0;clearTimeout(dwellTimer);dwellTimer=0;intentHot?.classList.remove('intent-hot');intentHot=null;dwellTarget=null;for(const off of state.cleanup.splice(0)){try{off()}catch{}}}

  window.AGVisual={init,destroy,setData,decorate,transition,pulse,bump,audio:kind=>audio.play(kind),openPanel,closePanel,activateDialog:dialogManager.activate,deactivateDialog:dialogManager.deactivate,contrastReport:contrast.report,measureCadence,samplePerformance:performanceGovernor.sample,performanceMetrics:performanceGovernor.snapshot,get prefs(){return {...state.prefs}}};
})();
