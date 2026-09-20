import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const BASE = process.env.TRUTH_BASE_SHA || '5c0baed576dda766560d2b471cd303c2b02d847a';
const current = fs.readFileSync('desktop/web/app.js', 'utf8');
const baseline = execFileSync('git', ['show', `${BASE}:desktop/web/app.js`], { encoding: 'utf8' });

const helperLines = [
  "function latestObservedWorkflows(d){return latestWorkflowRuns(d.github.workflowRuns||[])}",
  "function isBadProbe(p){return p.status==='down'||p.status==='degraded'}",
  "function countBadWorkflows(runs=[]){return runs.filter(w=>isBadConclusion(w.conclusion)).length}",
  "function isInactiveAgent(x){return['stale','offline'].includes(x.state)}",
  "function repoCount(d){return d.github.repos?.length||0}",
  "function domainCount(d){return d.domains?.length||0}",
  "function needsYouCount(d){return d.needsYou||0}",
];

for (const line of helperLines) {
  if ((current.split(line).length - 1) !== 1) throw new Error(`helper contract mismatch: ${line}`);
}

function canonicalizeBase(src) {
  return src
    .replaceAll("latestWorkflowRuns(d.github.workflowRuns||[])", "__LATEST_WORKFLOWS__")
    .replaceAll("latest.filter(w=>isBadConclusion(w.conclusion)).length", "__BAD_WORKFLOW_COUNT__")
    .replaceAll("latest.filter(x=>isBadConclusion(x.conclusion)).length", "__BAD_WORKFLOW_COUNT__")
    .replaceAll("p.status==='down'||p.status==='degraded'", "__BAD_PROBE_PRED__")
    .replaceAll("['stale','offline'].includes(x.state)", "__INACTIVE_AGENT__")
    .replaceAll("d.github.repos?.length||0", "__REPO_COUNT__")
    .replaceAll("d.domains?.length||0", "__DOMAIN_COUNT__")
    .replaceAll("d.needsYou||0", "__NEEDS_COUNT__");
}

function canonicalizeCurrent(src) {
  let out = src;
  for (const line of helperLines) out = out.replace(line + '\n', '');
  return out
    .replaceAll("latestObservedWorkflows(d)", "__LATEST_WORKFLOWS__")
    .replaceAll("countBadWorkflows(latest)", "__BAD_WORKFLOW_COUNT__")
    .replaceAll("isBadProbe(p)", "__BAD_PROBE_PRED__")
    .replaceAll(".filter(isBadProbe)", ".filter(p=>__BAD_PROBE_PRED__)")
    .replaceAll("isInactiveAgent(x)", "__INACTIVE_AGENT__")
    .replaceAll("repoCount(d)", "__REPO_COUNT__")
    .replaceAll("domainCount(d)", "__DOMAIN_COUNT__")
    .replaceAll("needsYouCount(d)", "__NEEDS_COUNT__");
}

const baseCanon = canonicalizeBase(baseline);
const curCanon = canonicalizeCurrent(current);
if (baseCanon !== curCanon) {
  const max = Math.min(baseCanon.length, curCanon.length);
  let i = 0;
  while (i < max && baseCanon[i] === curCanon[i]) i++;
  throw new Error(`non-refactor source delta at canonical offset ${i}: base=${JSON.stringify(baseCanon.slice(i, i+120))} current=${JSON.stringify(curCanon.slice(i, i+120))}`);
}

const prelude = `
function latestWorkflowRuns(runs=[]){const m=new Map();for(const w of runs){const k=\`${w.repo}\\0${w.name}\`;const prev=m.get(k);if(!prev||new Date(w.createdAt)>new Date(prev.createdAt))m.set(k,w)}return [...m.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}
function isBadConclusion(x=''){return['failure','timed_out','action_required','startup_failure'].includes(x)}
${helperLines.join('\n')}
globalThis.out={latestObservedWorkflows,isBadProbe,countBadWorkflows,isInactiveAgent,repoCount,domainCount,needsYouCount};
`;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(prelude, ctx);
const h = ctx.out;

const statuses = ['up','down','degraded','unknown','stale','offline','running','waiting','failure','success','timed_out','action_required','startup_failure',''];
for (let i = 0; i < 10000; i++) {
  const status = statuses[i % statuses.length];
  if (h.isBadProbe({status}) !== (status === 'down' || status === 'degraded')) throw new Error('isBadProbe mismatch');
  if (h.isInactiveAgent({state:status}) !== (status === 'stale' || status === 'offline')) throw new Error('isInactiveAgent mismatch');

  const conclusions = Array.from({length: i % 9}, (_,j) => ({conclusion: statuses[(i+j) % statuses.length]}));
  const oldBad = conclusions.filter(w => ['failure','timed_out','action_required','startup_failure'].includes(w.conclusion)).length;
  if (h.countBadWorkflows(conclusions) !== oldBad) throw new Error('countBadWorkflows mismatch');

  const d = {
    github: {
      repos: i % 4 === 0 ? undefined : Array.from({length:i%7},()=>({})),
      workflowRuns: Array.from({length:i%6},(_,j)=>({repo:'r'+(j%2),name:'w'+(j%3),createdAt:new Date(1700000000000 + (i+j)*1000).toISOString()})),
    },
    domains: i % 5 === 0 ? undefined : Array.from({length:i%5},()=>({})),
    needsYou: i % 3 === 0 ? undefined : i % 11,
  };
  const oldLatest = h.latestObservedWorkflows({github:{workflowRuns:d.github.workflowRuns}});
  const directLatest = ctx.out.latestObservedWorkflows({github:{workflowRuns:d.github.workflowRuns}});
  if (JSON.stringify(oldLatest) !== JSON.stringify(directLatest)) throw new Error('latestObservedWorkflows mismatch');
  if (h.repoCount(d) !== (d.github.repos?.length || 0)) throw new Error('repoCount mismatch');
  if (h.domainCount(d) !== (d.domains?.length || 0)) throw new Error('domainCount mismatch');
  if (h.needsYouCount(d) !== (d.needsYou || 0)) throw new Error('needsYouCount mismatch');
}

const mutated = current.replace(
  "function isBadProbe(p){return p.status==='down'||p.status==='degraded'}",
  "function isBadProbe(p){return p.status==='down'}"
);
let mutationRejected = false;
try {
  const badCanon = canonicalizeCurrent(mutated);
  mutationRejected = badCanon !== baseCanon;
} catch {
  mutationRejected = true;
}
if (!mutationRejected) throw new Error('negative-control mutation escaped equivalence verifier');

console.log(JSON.stringify({
  base: BASE,
  randomizedCases: 10000,
  canonicalSourceEquivalent: true,
  helperContracts: helperLines.length,
  negativeControlRejected: true
}, null, 2));
