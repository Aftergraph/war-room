import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.TRUTH_BASE_SHA || '5c0baed576dda766560d2b471cd303c2b02d847a';
const EXPECTED_BLOB = '0fed9aa3e968c620d8f1cb383c24a2e7358b6462';

function count(src, needle) {
  return src.split(needle).length - 1;
}
function replaceExact(src, needle, replacement, expected, label) {
  const got = count(src, needle);
  if (got !== expected) throw new Error(`${label}: found ${got}, expected ${expected}`);
  return src.split(needle).join(replacement);
}

let src = execFileSync('git', ['show', `${BASE}:desktop/web/app.js`], {encoding:'utf8'});

const latestWorkflow = "latestWorkflowRuns(d.github.workflowRuns||[])";
const latestAnchor = "function latestWorkflowRuns(runs=[]){const m=new Map();for(const w of runs){const k=\`${w.repo}\\0${w.name}\`;const prev=m.get(k);if(!prev||new Date(w.createdAt)>new Date(prev.createdAt))m.set(k,w)}return [...m.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}";
src = replaceExact(src, latestWorkflow, 'latestObservedWorkflows(d)', 6, 'workflow selection');
src = src.replace(latestAnchor, latestAnchor + "\nfunction latestObservedWorkflows(d){return latestWorkflowRuns(d.github.workflowRuns||[])}");

src = replaceExact(src, "p.status==='down'||p.status==='degraded'", 'isBadProbe(p)', 3, 'bad probe');
src = src.replace(
  "function isGoodConclusion(x=''){return x==='success'}",
  "function isGoodConclusion(x=''){return x==='success'}\nfunction isBadProbe(p){return p.status==='down'||p.status==='degraded'}"
);

const badW = "latest.filter(w=>isBadConclusion(w.conclusion)).length";
const badX = "latest.filter(x=>isBadConclusion(x.conclusion)).length";
if (count(src, badW) + count(src, badX) !== 3) throw new Error('failed workflow count mismatch');
src = src.split(badW).join('countBadWorkflows(latest)').split(badX).join('countBadWorkflows(latest)');
src = src.replace(
  "function isBadProbe(p){return p.status==='down'||p.status==='degraded'}",
  "function isBadProbe(p){return p.status==='down'||p.status==='degraded'}\nfunction countBadWorkflows(runs=[]){return runs.filter(w=>isBadConclusion(w.conclusion)).length}"
);

src = replaceExact(src, "['stale','offline'].includes(x.state)", 'isInactiveAgent(x)', 2, 'inactive agent');
src = src.replace(
  "function countBadWorkflows(runs=[]){return runs.filter(w=>isBadConclusion(w.conclusion)).length}",
  "function countBadWorkflows(runs=[]){return runs.filter(w=>isBadConclusion(w.conclusion)).length}\nfunction isInactiveAgent(x){return['stale','offline'].includes(x.state)}"
);

src = replaceExact(src, 'd.github.repos?.length||0', 'repoCount(d)', 3, 'repo count');
src = src.replace(
  "function isInactiveAgent(x){return['stale','offline'].includes(x.state)}",
  "function isInactiveAgent(x){return['stale','offline'].includes(x.state)}\nfunction repoCount(d){return d.github.repos?.length||0}"
);

src = replaceExact(src, 'd.domains?.length||0', 'domainCount(d)', 3, 'domain count');
src = src.replace(
  "function repoCount(d){return d.github.repos?.length||0}",
  "function repoCount(d){return d.github.repos?.length||0}\nfunction domainCount(d){return d.domains?.length||0}"
);

src = replaceExact(src, 'd.needsYou||0', 'needsYouCount(d)', 4, 'needs-you count');
src = src.replace(
  "function domainCount(d){return d.domains?.length||0}",
  "function domainCount(d){return d.domains?.length||0}\nfunction needsYouCount(d){return d.needsYou||0}"
);

src = replaceExact(src, '.filter(p=>isBadProbe(p))', '.filter(isBadProbe)', 2, 'probe callback');

const current = fs.readFileSync('desktop/web/app.js', 'utf8');
if (src !== current) {
  let i = 0;
  const max = Math.min(src.length, current.length);
  while (i < max && src[i] === current[i]) i++;
  throw new Error(`independent reproduction mismatch at byte ${i}`);
}

const blob = execFileSync('git', ['hash-object', 'desktop/web/app.js'], {encoding:'utf8'}).trim();
if (blob !== EXPECTED_BLOB) throw new Error(`blob ${blob} != expected ${EXPECTED_BLOB}`);

console.log(JSON.stringify({
  baseline: BASE,
  reproducedBytes: src.length,
  exactByteMatch: true,
  blob,
  expectedBlob: EXPECTED_BLOB,
  independentTransformSteps: 8
}, null, 2));
