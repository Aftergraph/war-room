from playwright.sync_api import sync_playwright
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT/'web/index.html').read_text()
css = (ROOT/'web/styles.css').read_text()
icons = (ROOT/'web/icons.js').read_text()
visual = (ROOT/'web/visual-engine.js').read_text()
spatial = (ROOT/'web/spatial-engine.js').read_text()
js = (ROOT/'web/app.js').read_text()
html = re.sub(r'<link rel="stylesheet" href="styles.css"\s*/>', '<style>'+css+'</style>', html)
for src in ['icons.js','visual-engine.js','spatial-engine.js','app.js']:
    html = html.replace(f'<script src="{src}"></script>', '')

canon = [
    'Institution & Governance','Execution & Runtime','Evidence & Verification',
    'Integration & Capability','Intelligence & Research','Product & Experience',
    'Infrastructure & Delivery','Business & Operations','Brand & Public Surface'
]

def domain(n):
    n=n.lower()
    if any(x in n for x in ['governance','aie','trust-gateway','authority','policy']): return canon[0]
    if any(x in n for x in ['sentinel','evidence','verification','assurance']): return canon[2]
    if any(x in n for x in ['skill','integration','hub','mcp','capability','connector']): return canon[3]
    if any(x in n for x in ['runtime','works','continuum','cron-fabric','relay','execution']): return canon[1]
    if any(x in n for x in ['research','afm','model-registry','llm','mission-bench']): return canon[4]
    if any(x in n for x in ['studio','fihim','wi-','work-intelligence','veranza']): return canon[5]
    if any(x in n for x in ['forge','infra','runner','deploy','ops-platform']): return canon[6]
    if any(x in n for x in ['business','rendetalje','renos','billing']): return canon[7]
    if any(x in n for x in ['brand','docs','aftergraph.org','.github','website']): return canon[8]
    return canon[1]

def ts(h,m): return f'2026-09-18T{h:02d}:{m:02d}:00Z'

inv=json.load(open(ROOT/'defaults/repo-inventory.json'))['repositories']
push={'fihim':ts(20,23),'wi-backend':ts(19,23),'rendetalje':ts(17,52),'renos':ts(17,42),'after-graph-governance':ts(20,39),'war-room':ts(21,0)}
repos=[]
for x in inv:
    r={
        'name':x['name'],'fullName':'Aftergraph/'+x['name'],'visibility':x['visibility'],
        'private':x['visibility']=='private','archived':False,'defaultBranch':'main',
        'htmlUrl':'https://github.com/Aftergraph/'+x['name'],'openIssues':0,'stars':0,
        'domain':domain(x['name']),'source':'bootstrap snapshot'
    }
    if x['name'] in push:r.update(pushedAt=push[x['name']],source='GitHub live')
    repos.append(r)

acts=[
 {'type':'commit','repo':'fihim','title':'feat(reflex): v0.2 shadow research and calibration','actor':'JonasAbde','url':'https://github.com/Aftergraph/fihim','timestamp':ts(20,23),'sha':'08470638'},
 {'type':'commit','repo':'wi-backend','title':'feat(pocket): support live HeyPocket webhook contract (#89)','actor':'JonasAbde','url':'https://github.com/Aftergraph/wi-backend','timestamp':ts(19,23),'sha':'509325f2'},
 {'type':'pull_request','repo':'after-graph-governance','title':'chore(org-state): refresh 33-repo exact-head snapshot','actor':'JonasAbde','state':'open','url':'https://github.com/Aftergraph/after-graph-governance/pull/171','timestamp':ts(20,39)},
 {'type':'pull_request','repo':'renos','title':'feat(dispatch): render T4 evidence readiness','actor':'JonasAbde','state':'open','url':'https://github.com/Aftergraph/renos/pull/4','timestamp':ts(19,48)},
 {'type':'issue','repo':'wi-backend','title':'governance: remove single-owner review deadlock without weakening merge queue','actor':'JonasAbde','state':'open','url':'https://github.com/Aftergraph/wi-backend/issues/91','timestamp':ts(18,55)},
 {'type':'commit','repo':'rendetalje','title':'fix(observation): prove complete booking read scope (#16)','actor':'JonasAbde','url':'https://github.com/Aftergraph/rendetalje','timestamp':ts(17,52),'sha':'0129f17a'},
]
wf=[
 {'repo':'fihim','name':'Verify','event':'pull_request','status':'completed','conclusion':'success','branch':'feat/reflex-v02','sha':'08470638','url':'https://github.com/Aftergraph/fihim/actions','createdAt':ts(20,24),'updatedAt':ts(20,29)},
 {'repo':'renos','name':'Verify','event':'pull_request','status':'completed','conclusion':'success','branch':'feat/t4-readiness','sha':'1da92cdb','url':'https://github.com/Aftergraph/renos/actions','createdAt':ts(19,52),'updatedAt':ts(19,55)},
 {'repo':'wi-backend','name':'Hosted Verify','event':'pull_request','status':'completed','conclusion':'failure','branch':'feat/pocket-reconcile','sha':'509325f2','url':'https://github.com/Aftergraph/wi-backend/actions','createdAt':ts(19,30),'updatedAt':ts(19,34)},
]

domains=[]
for name in canon:
    rr=[r for r in repos if r['domain']==name]
    names={r['name'] for r in rr}
    failing=sum(w['repo'] in names and w['conclusion']=='failure' for w in wf)
    activity=sum(a['repo'] in names for a in acts)
    domains.append({
        'name':name,'repoCount':len(rr),'privateRepos':sum(r['private'] for r in rr),
        'publicRepos':sum(not r['private'] for r in rr),'openIssues':0,
        'ciHealthy':1 if rr else 0,'ciFailing':failing,'activity24h':activity,
        'status':'attention' if failing else ('observed' if rr else 'unobserved')
    })

type_safe={
 'configured':True,'model':'jev-1.13.0','source':'TypeSafe AI / Jev','evaluatedAt':ts(20,43),
 'route':'human_review','routeConfidence':0.91,
 'routeProbabilities':{'human_review':0.91,'monitor':0.07,'urgent_review':0.02,'no_action':0.0},
 'humanNeeded':0.87,'evidenceSufficient':0.78,
 'dominantSignal':'ci_failure','dominantSignalConfidence':0.89,
 'severityScore':2.1,'severityConfidence':0.82,
 'severityLegend':{'0':'Nominal','1':'Watch','2':'Degraded','3':'Critical'},
 'severityProbabilities':{'0':0.0,'1':0.04,'2':0.80,'3':0.16},
 'inputTokens':123,'outputTokens':7,'latencyMs':118,'fingerprint':'fixture-v15',
 'mode':'native-auto','reason':'startup','callsToday':3,'dailyBudget':60,'budgetRemaining':57
}
agents={
 'observedAt':ts(20,44),'active':3,'running':2,'waiting':1,'blocked':0,'stale':1,
 'sessions':[
  {'id':'works:runner-lenovo','name':'runner-lenovo','kind':'worker','provider':'WORKS','node':'aftergraph-ci','repo':'fihim','workId':'wrk_mobile_v4','state':'running','currentAction':'verify exact head','progress':0.72,'lastHeartbeat':ts(20,44),'source':'WORKS /v1/ui/events','url':'http://works.local/v1/ui/runners'},
  {'id':'hermes:vds','name':'Hermes VDS','kind':'agent','provider':'Hermes','node':'vmi3517816','repo':'after-graph-governance','missionId':'msn_reality','state':'running','currentAction':'reconcile org topology','model':'solver','lastHeartbeat':ts(20,44),'source':'Agent Bridge'},
  {'id':'codex:lenovo','name':'Codex Lenovo','kind':'agent','provider':'Codex','node':'jonas-lenovo','repo':'war-room','state':'waiting','currentAction':'awaiting next bounded work','lastHeartbeat':ts(20,43),'source':'Agent Bridge'},
  {'id':'vibe:old','name':'Vibe worker','kind':'agent','provider':'Vibe','node':'jonas-lenovo','state':'stale','lastHeartbeat':ts(19,40),'source':'Agent Bridge'}],
 'events':[
  {'id':'ae1','agentId':'works:runner-lenovo','kind':'work','title':'wrk_mobile_v4 → RUNNING','state':'RUNNING','repo':'fihim','workId':'wrk_mobile_v4','timestamp':ts(20,44),'source':'WORKS'},
  {'id':'ae2','agentId':'hermes:vds','kind':'heartbeat','title':'Topology reconciliation active','state':'running','repo':'after-graph-governance','timestamp':ts(20,43),'source':'Agent Bridge'}],
 'sources':[
  {'id':'works','name':'WORKS execution fabric','kind':'works-sse','url':'http://works.local','status':'live','lastObservedAt':ts(20,44)},
  {'id':'agent-bridge','name':'Agent Bridge','kind':'heartbeat','status':'live','lastObservedAt':ts(20,44)}]
}
assistant_status={'mode':'grounded-core + local-model','groundedCore':True,'localModelAvailable':True,'localModel':'qwen3:8b','ollamaUrl':'http://127.0.0.1:11434','checkedAt':ts(20,44)}
assistant_response={'id':'asst_fixture','answer':'Three execution principals are active: two running and one waiting. WORKS runner-lenovo is verifying the FIHIM exact head; Hermes VDS is reconciling governance topology.','mode':'grounded-core','confidence':1.0,'sources':['Agent Fabric','GitHub system reality'],'objects':[{'type':'agent','id':'works:runner-lenovo','title':'runner-lenovo','subtitle':'WORKS · aftergraph-ci · fihim','status':'running','fields':{'action':'verify exact head','work':'wrk_mobile_v4'}},{'type':'agent','id':'hermes:vds','title':'Hermes VDS','subtitle':'Hermes · vmi3517816','status':'running','fields':{'action':'reconcile org topology'}}],'actions':[{'label':'Open Agents','kind':'view','target':'agents'},{'label':'Focus FIHIM','kind':'focus','target':'repo:fihim'}],'caveats':['Assistant output is advisory. It cannot grant authority, execute work, or constitute verification evidence.'],'generatedAt':ts(20,45)}
works_connection={'configured':True,'enabled':True,'url':'http://works.local','tokenConfigured':True}

summary={
 'now':ts(20,45),'startedAt':ts(20,0),'version':'1.6.14','needsYou':1,
 'connectionState':'GitHub connected',
 'github':{'observedAt':ts(20,44),'source':'GitHub REST API','authenticated':True,'reconcileSeconds':60,'observationMode':'authenticated-rest','identity':'JonasAbde','repos':repos,'activities':acts,'workflowRuns':wf,'openPrs':18,'openIssues':9,'commits24h':46,'commits7d':181,'prsUpdated24h':21,'issuesUpdated24h':4,'ciSuccess24h':12,'ciFailure24h':1,'rateLimitRemaining':4821,'errors':[]},
 'domains':domains,'metrics':[],
 'probes':[{'id':'aftergraph-org','name':'aftergraph.org','url':'https://aftergraph.org','domain':'Brand & Public Surface','status':'up','httpStatus':200,'latencyMs':121,'observedAt':ts(20,40)},{'id':'aftergraph-docs','name':'docs.aftergraph.org','url':'https://docs.aftergraph.org','domain':'Brand & Public Surface','status':'up','httpStatus':200,'latencyMs':168,'observedAt':ts(20,40)}],
 'host':{'hostname':'JONAS-LENOVO','os':'windows','arch':'amd64','cpuPercent':18.4,'memoryUsedPercent':44.8,'memoryTotalBytes':68719476736,'memoryFreeBytes':37900000000,'diskUsedPercent':61.2,'diskTotalBytes':2000000000000,'diskFreeBytes':776000000000,'goHeapBytes':5800000,'observedAt':ts(20,44),'source':'Windows host observation'},
 'typeSafe':type_safe,'agents':agents,'assistant':assistant_status
}
summary['intelligence']={
 'version':'operational-intelligence/0.1','generatedAt':ts(20,45),'mode':'observe-rank-explain','learningState':'prior-only','feedbackCount':0,
 'top':{'id':'oi_demo','scope':'wi-backend','domain':'Product & Experience','kind':'ci_failure','title':'wi-backend has failing CI','summary':'The latest observed workflow failed; this is the strongest deterministic operational signal in the current feature set.','recommendedAction':'Inspect the failing workflow at its exact SHA, identify the first failing step, then verify the fix before clearing attention.','riskScore':0.88,'priorityScore':94.0,'confidence':1.0,'learningState':'prior-only','features':[{'name':'ci_failure','value':1,'weight':2.6,'contribution':2.6,'evidence':'Latest workflow: Hosted Verify / failure'},{'name':'unverified_change','value':1,'weight':1.35,'contribution':1.35,'evidence':'Recent source change without a recent successful workflow observation'},{'name':'recent_change','value':1,'weight':0.3,'contribution':0.3,'evidence':'Last push observed'}],'evidence':['GitHub live','workflow:Hosted Verify:failure','activity24h:2'],'url':'https://github.com/Aftergraph/wi-backend/actions','generatedAt':ts(20,45)},
 'candidates':[{'id':'oi_demo','scope':'wi-backend','domain':'Product & Experience','kind':'ci_failure','title':'wi-backend has failing CI','summary':'The latest observed workflow failed; this is the strongest deterministic operational signal in the current feature set.','recommendedAction':'Inspect the failing workflow at its exact SHA, identify the first failing step, then verify the fix before clearing attention.','riskScore':0.88,'priorityScore':94.0,'confidence':1.0,'learningState':'prior-only','features':[{'name':'ci_failure','value':1,'weight':2.6,'contribution':2.6,'evidence':'Latest workflow: Hosted Verify / failure'}],'evidence':['GitHub live','workflow:Hosted Verify:failure'],'url':'https://github.com/Aftergraph/wi-backend/actions','generatedAt':ts(20,45)}],
 'domains':[{'name':'Product & Experience','riskScore':0.88,'confidence':1.0,'candidates':1}],
 'model':{'version':'operational-intelligence/0.1','bias':-2.35,'weights':{'ci_failure':2.6},'learningRate':0.08,'feedbackCount':0,'updatedAt':ts(20,45)},
 'guardrails':['ranking-only: no execution authority','unknown is not healthy','model output is not verification evidence','feedback may adapt ranking weights but not authority or policy']
}

ts_connection={
 'configured':True,'native':True,'model':'jev-latest','source':'Windows DPAPI vault',
 'auto':True,'minIntervalSec':300,'dailyBudget':60,'decision':type_safe
}
settings={'githubOrg':'Aftergraph','refreshSeconds':60,'workflowRepoCap':33,'probes':[],'repoDomains':{},'typeSafeAuto':True,'typeSafeMinIntervalSec':300,'typeSafeDailyBudget':60,'worksEnabled':True,'worksUrl':'http://works.local','agentStaleSeconds':45,'assistantLocalModel':True,'assistantOllamaUrl':'http://127.0.0.1:11434','assistantModel':'qwen3:8b'}

init=f"""Date.now=()=>Date.parse('2026-09-18T20:45:00Z');window.__summaryFetches=0;window.__MOCK_SUMMARY__={json.dumps(summary)};window.__MOCK_TYPESAFE__={json.dumps(ts_connection)};window.__MOCK_ASSISTANT__={json.dumps(assistant_response)};window.__MOCK_ASSISTANT_STATUS__={json.dumps(assistant_status)};window.__MOCK_WORKS__={json.dumps(works_connection)};window.fetch=async function(url,opt={{}}){{const p=String(url);let body;if(p.includes('/api/session'))body={{session:'mock-session',version:'1.6.14'}};else if(p.includes('/api/settings'))body={json.dumps(settings)};else if(p.includes('/api/github/connection'))body={{configured:true}};else if(p.includes('/api/typesafe/evaluate'))body=window.__MOCK_TYPESAFE__.decision;else if(p.includes('/api/typesafe/connection'))body=window.__MOCK_TYPESAFE__;else if(p.includes('/api/assistant/status'))body=window.__MOCK_ASSISTANT_STATUS__;else if(p.includes('/api/assistant/query'))body=window.__MOCK_ASSISTANT__;else if(p.includes('/api/works/connection'))body=window.__MOCK_WORKS__;else if(p.includes('/api/agents/bridge'))body={{configured:true,contract:'aftergraph.agent.heartbeat/0.1',heartbeat:'/api/agents/heartbeat',event:'/api/agents/event',token:'mock-bridge-token'}};else{{body=window.__MOCK_SUMMARY__;window.__summaryFetches++}}return{{ok:true,status:200,statusText:'OK',headers:{{get:()=> 'application/json'}},json:async()=>body,text:async()=>JSON.stringify(body)}}}};window.EventSource=class{{constructor(){{this.handlers={{}};this.readyState=0;this.closed=false;window.__lastEventSource=this;setTimeout(()=>{{if(this.closed)return;this.readyState=1;this.handlers.ready?.({{data:'{{}}'}})}},50)}}addEventListener(n,f){{this.handlers[n]=f}}close(){{this.closed=true;this.readyState=2}}}};window.open=()=>{{}};"""

with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':980})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='domcontentloaded')
    page.add_script_tag(content=init)
    page.add_script_tag(content=icons)
    page.add_script_tag(content=visual)
    page.add_script_tag(content=spatial)
    page.add_script_tag(content=js)
    page.wait_for_timeout(900)

    assert page.locator('#navRepoCount').inner_text()=='33'
    assert page.locator('#liveFeed .timeline-item').count()>=6
    assert 'human review' in page.locator('#typesafeDecision').inner_text().lower()
    assert 'native' in page.locator('#typesafeDecision').inner_text().lower()
    assert page.locator('#typesafeEvaluate').is_enabled()
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-now.png'), full_page=True)

    page.locator('#typesafeEvaluate').click(); page.wait_for_timeout(100)
    assert '87%' in page.locator('#typesafeDecision').inner_text()
    assert '57' in page.locator('#typesafeDecision').inner_text()
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-native-typesafe.png'), full_page=True)

    page.locator('[data-view="topology"]').click(); page.wait_for_timeout(350)
    assert page.locator('#topologySvg .graph-node.domain').count()==9
    assert page.locator('#topologySvg .graph-node.repo').count()==33
    assert page.locator('#topologySvg .graph-node.agent').count()==4
    assert page.locator('#topologySvg .graph-node.assistant').count()==1
    assert page.locator('#topologySvg .graph-node.jev').count()==1
    assert page.locator('#topologySvg .graph-edge').count()>=40
    page.locator('#topologyHeat').click(); page.locator('#topologyDiff').click(); page.wait_for_timeout(120)
    assert page.locator('#topologyHeat').get_attribute('aria-pressed')=='true'
    assert page.locator('#topologyDiff').get_attribute('aria-pressed')=='true'
    repo_node=page.locator('#topologySvg [data-node="repo:wi-backend"]')
    repo_node.evaluate("el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))"); page.wait_for_timeout(120)
    assert 'wi-backend' in page.locator('#topologyInspector').inner_text().lower()
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-topology.png'), full_page=True)

    assert page.locator('html').get_attribute('data-visual-engine')=='ready'
    page.locator('#visualBtn').click(); page.wait_for_timeout(120)
    assert page.locator('#contrastReport .contrast-row').count()>=6
    assert '120 Hz target budget' in page.locator('.performance-budget').inner_text()
    cadence=page.evaluate('window.AGVisual.measureCadence()')
    assert cadence['samples']==119 and cadence['p95']>0 and cadence['hz']>0
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-visual-controls.png'), full_page=True)
    page.locator('#visualClose').click(); page.wait_for_timeout(280)

    page.locator('[data-view="agents"]').click(); page.wait_for_timeout(100)
    assert page.locator('#agentRoster .agent-row').count()==4
    assert 'WORKS execution fabric' in page.locator('#agentSources').inner_text()
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-agents.png'), full_page=True)

    page.locator('[data-view="overview"]').click(); page.wait_for_timeout(80)
    page.locator('#askInput').fill('what are the agents doing?'); page.locator('#askForm').evaluate("f=>f.requestSubmit()"); page.wait_for_timeout(120)
    assert 'Three execution principals' in page.locator('#queryThread').inner_text()
    assert page.locator('#queryThread .assistant-object').count()==2
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-assistant.png'), full_page=True)

    page.locator('[data-view="intelligence"]').click(); page.wait_for_timeout(100)
    assert page.locator('#intelligenceCandidates .candidate').count()==1
    assert 'ranking-only' in page.locator('#intelligenceGuardrails').inner_text()
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-intelligence.png'), full_page=True)

    page.locator('[data-view="overview"]').click(); page.wait_for_timeout(100)
    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(180)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.evaluate("document.querySelector('[data-view=\"topology\"]').click()"); page.wait_for_timeout(180)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')

    # UI Stability Track: evidence-honest state labels. A recent packaged snapshot must never render as LIVE.
    page.set_viewport_size({'width':1440,'height':980}); page.wait_for_timeout(120)
    page.locator('[data-view="overview"]').click(); page.wait_for_timeout(80)
    page.evaluate("window.__MOCK_SUMMARY__.github.source='build snapshot';window.__MOCK_SUMMARY__.github.observationMode='build-snapshot';window.__MOCK_SUMMARY__.github.observedAt='2026-09-18T20:45:00Z'")
    page.evaluate('refresh(true)'); page.wait_for_timeout(80)
    assert page.locator('#sidebarLive span:last-child').inner_text()=='Snapshot'
    assert 'build snapshot' in page.locator('#briefMode').inner_text().lower()
    assert 'build snapshot' in page.locator('#systemHeadline').inner_text().lower()
    assert page.locator('.workspace').get_attribute('data-observation-mode')=='snapshot'
    page.locator('[data-view="topology"]').click(); page.wait_for_timeout(80)
    assert page.evaluate('window.AGSpatial.state.mode')=='snapshot'
    assert page.locator('#topologySvg .edge-pulse').count()==0
    page.locator('[data-view="overview"]').click(); page.wait_for_timeout(40)
    page.evaluate("window.__MOCK_SUMMARY__.github.source='GitHub REST API';window.__MOCK_SUMMARY__.github.observationMode='authenticated-rest';window.__MOCK_SUMMARY__.github.observedAt='2026-09-18T20:44:00Z'")
    page.evaluate('refresh(true)'); page.wait_for_timeout(80)

    # Reconnect must reconcile canonical state, and refreshes must coalesce rather than race.
    before=page.evaluate('window.__summaryFetches')
    page.evaluate("window.__lastEventSource.handlers.ready({data:'{}'})"); page.wait_for_timeout(80)
    assert page.evaluate('window.__summaryFetches')>before
    before=page.evaluate('window.__summaryFetches')
    page.evaluate('Promise.all([refresh(true),refresh(true),refresh(true)])'); page.wait_for_timeout(120)
    assert 1 <= page.evaluate('window.__summaryFetches')-before <= 2

    # Modal focus contract: background inert, focus contained, and focus restored to trigger.
    page.locator('#commandBtn').focus(); page.locator('#commandBtn').click(); page.wait_for_timeout(50)
    assert page.evaluate('document.querySelector("#appShell").inert === true')
    assert page.evaluate('document.activeElement.id')=='paletteInput'
    page.keyboard.press('Escape'); page.wait_for_timeout(40)
    assert page.locator('#palette').get_attribute('class').find('hidden') >= 0
    assert page.evaluate('document.querySelector("#appShell").inert === false')
    assert page.evaluate('document.activeElement.id')=='commandBtn'
    page.locator('#visualBtn').focus(); page.locator('#visualBtn').click(); page.wait_for_timeout(80)
    assert page.evaluate('document.querySelector("#appShell").inert === true')
    assert page.evaluate('document.activeElement.closest("#visualDrawer") !== null')
    page.keyboard.press('Escape'); page.wait_for_timeout(280)
    assert page.evaluate('document.querySelector("#appShell").inert === false')
    assert page.evaluate('document.activeElement.id')=='visualBtn'

    # Topology has a non-drag keyboard path and preserves user camera state across ResizeObserver activity.
    page.locator('[data-view="topology"]').click(); page.wait_for_timeout(120)
    assert page.locator('#topologySvg').get_attribute('role')=='group'
    assert page.locator('#topologyZoomIn').count()==1 and page.locator('#topologyZoomOut').count()==1
    page.locator('#topologySvg').focus(); before_state=page.evaluate('window.AGSpatial.state')
    page.keyboard.press('+'); page.keyboard.press('ArrowRight'); page.wait_for_timeout(60)
    after_state=page.evaluate('window.AGSpatial.state')
    assert after_state['scale'] > before_state['scale'] and after_state['tx'] != before_state['tx'] and after_state['userTransformed']
    page.set_viewport_size({'width':1280,'height':900}); page.wait_for_timeout(120)
    resized_state=page.evaluate('window.AGSpatial.state')
    assert abs(resized_state['scale']-after_state['scale']) < 0.001

    # Dynamic external URLs are scheme-validated before they enter an inspector link.
    page.evaluate("window.__MOCK_SUMMARY__.github.repos.find(r=>r.name==='wi-backend').htmlUrl='javascript:alert(1)'")
    page.evaluate('refresh(true)'); page.wait_for_timeout(80)
    node=page.locator('#topologySvg [data-node="repo:wi-backend"]'); node.evaluate("el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))"); page.wait_for_timeout(40)
    assert page.locator('#topologyInspector a').get_attribute('href')=='#'
    page.evaluate("window.__MOCK_SUMMARY__.github.repos.find(r=>r.name==='wi-backend').htmlUrl='https://github.com/Aftergraph/wi-backend'")

    # Reduced-motion parity must suppress SMIL edge pulses while preserving graph operability.
    page.emulate_media(reduced_motion='reduce'); page.wait_for_timeout(80)
    assert page.locator('html').get_attribute('data-motion')=='reduce'
    pulse=page.locator('#topologySvg .edge-pulse').first
    if pulse.count(): assert pulse.evaluate("el=>getComputedStyle(el).display")=='none'
    page.locator('#topologyZoomIn').click(); page.wait_for_timeout(20)
    page.emulate_media(reduced_motion='no-preference'); page.wait_for_timeout(80)

    # Deterministic topology scale gates: preserve semantic truth while bounding SVG growth.
    page.evaluate("window.__origRepos=structuredClone(window.__MOCK_SUMMARY__.github.repos);window.__stressBase=window.__origRepos[0]")
    scale_results={}
    for count, tier, expected_repos, expected_clusters, pulses in [
        (200,'full',200,0,True),
        (500,'full',500,0,False),
        (1000,'compact',1000,0,False),
        (5000,'aggregate',540,9,False),
        (5001,'summary',0,9,False),
    ]:
        page.evaluate("""count=>{const base=window.__stressBase,domains=['Institution & Governance','Execution & Runtime','Evidence & Verification','Integration & Capability','Intelligence & Research','Product & Experience','Infrastructure & Delivery','Business & Operations','Brand & Public Surface'];window.__MOCK_SUMMARY__.github.repos=Array.from({length:count},(_,i)=>({...base,name:'stress-'+i,fullName:'Aftergraph/stress-'+i,htmlUrl:'https://github.com/Aftergraph/stress-'+i,domain:domains[i%domains.length]}))}""", count)
        stress_ms=page.evaluate("async()=>{const t=performance.now();await refresh(true);return performance.now()-t}"); page.wait_for_timeout(180)
        metrics=page.evaluate('window.AGSpatial.metrics()')
        assert stress_ms < 2500, (count,stress_ms)
        assert metrics['tier']==tier, (count,metrics)
        assert metrics['pulses']==pulses, (count,metrics)
        assert page.locator('#topologySvg .graph-node.repo').count()==expected_repos, (count,metrics)
        assert page.locator('#topologySvg .graph-node.cluster').count()==expected_clusters, (count,metrics)
        if count>1000: assert metrics['omittedRepos']==count-expected_repos, (count,metrics)
        scale_results[count]=round(stress_ms,2)
    page.evaluate('window.__MOCK_SUMMARY__.github.repos=window.__origRepos'); page.evaluate('refresh(true)'); page.wait_for_timeout(100)

    # Windows forced-colors parity: essential controls/content stay visible and decorative motion is removed.
    page.emulate_media(forced_colors='active'); page.wait_for_timeout(100)
    assert page.evaluate("matchMedia('(forced-colors: active)').matches")
    assert page.locator('#topologySvg .edge-pulse').count()==0 or page.locator('#topologySvg .edge-pulse').first.evaluate("el=>getComputedStyle(el).display")=='none'
    assert page.locator('#topologyFit').evaluate("el=>getComputedStyle(el).color") != page.locator('#topologyFit').evaluate("el=>getComputedStyle(el).backgroundColor")
    page.screenshot(path=str(ROOT/'assets/war-room-v1.6-forced-colors.png'), full_page=True)
    page.emulate_media(forced_colors='none'); page.wait_for_timeout(60)

    # Lifecycle cleanup: pagehide closes the EventSource and releases transient dialog state.
    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))"); page.wait_for_timeout(30)
    assert page.evaluate('window.__lastEventSource.closed === true')
    assert page.evaluate('document.querySelector("#appShell").inert === false')

    print('headline:', page.locator('#systemHeadline').inner_text())
    print('events:', page.locator('#liveFeed .timeline-item').count())
    print('graph_domains:', page.locator('#topologySvg .graph-node.domain').count())
    print('graph_repos:', page.locator('#topologySvg .graph-node.repo').count())
    print('graph_agents:', page.locator('#topologySvg .graph-node.agent').count())
    print('cadence_hz:', round(cadence['hz'],1), 'cadence_p95_ms:', round(cadence['p95'],2))
    print('scale_refresh_ms:', scale_results)
    print('errors:', errors)
    assert not errors, errors
    b.close()
