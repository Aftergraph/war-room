# UI/UX Stability Audit

## Scope
- Surface: AFTERGRAPH / WAR ROOM desktop operator environment — Now, Activity, Topology, Agents & workers, Intelligence, Systems, Repositories, Evidence, Services, Connections, command palette, visual controls.
- Version/commit: local release candidate v1.6.8; packaged source is the release reference for this audit.
- Framework/runtime: Go loopback control plane + embedded HTML/CSS/vanilla ES6+ JavaScript; Chromium/Edge app-mode shell.
- Rendering/graph stack: DOM/CSS, SVG topology renderer, Canvas signal field, requestAnimationFrame motion engine, native Web Audio.
- Browsers/devices: deterministic headless Chromium in build environment; Windows x64 binary cross-built. Native Lenovo/high-refresh and assistive-technology gates are listed as unverified.
- Live-data sources: GitHub REST reconciliation, War Room SSE, WORKS SSE, Agent Bridge, service probes, local host telemetry, TypeSafe/Jev projection, grounded assistant projection.
- Audit date: 2026-09-19.

## Executive result
- Verdict: CONDITIONAL PASS
- Critical findings: 0 known after fixes.
- High findings: 5 discovered; all closed with automated regression evidence.
- Medium findings: 7 discovered; all closed or bounded in this pass.
- Low findings: 2 discovered; closed.
- Unverified gates: native Windows 60/120/144 Hz behavior; multi-hour memory/CPU/GPU soak; real screen-reader semantic verification; Windows High Contrast/forced-colors; real coarse-pointer/touch hardware path.

The verdict is intentionally not `PASS`: the supplied skill prohibits upgrading unperformed native/accessibility/performance gates based on visual inspection or headless automation alone.

## System map
- canonical state owners: Go control plane/store and connected canonical providers; the browser is a projection, not an authority.
- event/data sources: GitHub REST snapshots, `/api/stream` SSE, WORKS `/v1/ui/events` SSE, Agent Bridge heartbeat/event API, local probes/telemetry.
- live subscriptions: one War Room EventSource in the browser; WORKS SSE is consumed server-side.
- interaction field: pointer intent/parallax/tilt in `visual-engine.js`; keyboard/touch-equivalent controls remain primary or available.
- motion engines: `visual-engine.js` for global interaction/signal/motion policy; `spatial-engine.js` for topology transform/render policy.
- renderer/graph engine: DOM/CSS + SVG topology + Canvas ambient field.
- token sources: canonical CSS variables and motion/depth tokens in `styles.css`.
- persistence: Go state store/vault; browser persistence is limited to non-secret visual preferences.
- accessibility primitives: native buttons/inputs, visible focus ring, dialog focus manager, semantic SVG group, reduced-motion media preference.
- failure boundaries: source freshness modes, reconnect reconciliation, bounded provider/client failures, local renderer fallbacks, explicit teardown.

## Findings

### WRUI-001 — Recent packaged inventory could visually become LIVE
- Classification: state-truthfulness
- Severity: High
- Status: FIXED
- VERIFIED FACT: frontend connection quality previously treated recency/SSE connectivity as sufficient and did not require a live GitHub REST provenance.
- EVIDENCE: `githubObservationMode()` now requires `GitHub REST API`/REST observation provenance; deterministic QA mutates a current timestamp to `build snapshot` and asserts `Snapshot`, build-snapshot headline, `data-observation-mode=snapshot`, and zero topology edge pulses.
- Root cause: freshness and transport state were conflated with source authority/provenance.
- Violated invariant / standard: PRODUCT INVARIANT — animation and LIVE labels may not manufacture domain truth; live state requires freshness semantics.
- User/system impact: an operator could mistake a packaged snapshot for current system reality.
- Systemic fix: one semantic observation-mode function now derives `unknown|snapshot|stale|offline|reconnecting|connecting|live`; presentation and motion engines consume that mode.
- Verification: Playwright state-truth regression PASS; static first paint now says `Connecting`.
- Regression coverage: `qa/render_shell.py`; `ui_test.go` forbids predeclared `Live topology` / `LIVE VIEW`.
- Remaining risk: provider-level semantic validation remains dependent on the Go source adapters.

### WRUI-002 — Unknown agent state could manufacture active presence
- Classification: correctness / state-truthfulness
- Severity: High
- Status: FIXED
- VERIFIED FACT: `normalizeAgentState` previously returned unknown external state strings unchanged; the summary default branch counted non-idle unknown strings as active.
- EVIDENCE: unrecognized states now normalize to `unknown`; unknown is not counted Active/Running/Waiting/Blocked.
- Root cause: permissive normalization plus an optimistic default counter.
- Violated invariant / standard: PRODUCT INVARIANT — unknown remains unknown and is never coerced into reassuring/active state.
- User/system impact: malformed/new provider states could inflate active agent presence.
- Systemic fix: closed vocabulary projection with fail-unknown semantics.
- Verification: `TestUnknownAgentStateRemainsUnknownAndInactive` PASS under normal/race/shuffled test suites.
- Regression coverage: `agents_test.go`.
- Remaining risk: future state vocabulary additions must be explicitly mapped before they become active semantics.

### WRUI-003 — Reconnect did not force canonical reconciliation
- Classification: reliability / correctness
- Severity: High
- Status: FIXED
- VERIFIED FACT: EventSource `ready` previously restored local connectivity without forcing a canonical summary refresh.
- EVIDENCE: ready handler now calls coalesced `refresh(true)`; QA asserts summary request count increases after ready.
- Root cause: reconnect transport and state reconciliation were separate paths.
- Violated invariant / standard: PRODUCT INVARIANT — reconnect reconciles canonical state rather than blindly resuming local assumptions.
- User/system impact: UI could retain stale local assumptions after stream interruption.
- Systemic fix: canonical refresh is part of reconnect readiness.
- Verification: Playwright reconnect regression PASS.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: real adverse network reorder/latency needs longer provider soak.

### WRUI-004 — Concurrent refreshes could race and overwrite newer projection
- Classification: correctness / reliability
- Severity: High
- Status: FIXED
- VERIFIED FACT: interval, SSE, and manual refresh paths could issue overlapping `/api/summary` work.
- EVIDENCE: refresh is single-flight with one queued follow-up; QA launches three concurrent refreshes and verifies bounded 1–2 summary calls.
- Root cause: refresh triggers had no shared orchestration primitive.
- Violated invariant / standard: PRODUCT INVARIANT — older async work may not overwrite newer user intent.
- User/system impact: nondeterministic state flicker or stale overwrite.
- Systemic fix: coalesced refresh orchestration.
- Verification: deterministic Playwright concurrency regression PASS.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: browser automation tests coalescing, not arbitrary WAN response ordering at provider level.

### WRUI-005 — Modal surfaces lacked complete focus containment/restoration
- Classification: accessibility
- Severity: High
- Status: FIXED
- VERIFIED FACT: command palette/visual controls behaved visually as modal surfaces but did not share a complete focus contract.
- EVIDENCE: shared dialog manager now inerts the app shell, traps Tab, handles Escape, focuses inside, and restores the triggering control.
- Root cause: visual open/close behavior was implemented before a canonical modal interaction primitive.
- Violated invariant / standard: WCAG 2.2 keyboard/focus baseline; WAI-ARIA APG modal-dialog guidance.
- User/system impact: keyboard users could leave the modal context or lose logical focus.
- Systemic fix: one dialog lifecycle manager reused by both surfaces.
- Verification: QA asserts inert state, initial focus, Escape close, and trigger restoration for both modal surfaces.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: Narrator/NVDA announcement quality is UNVERIFIED.

### WRUI-006 — Topology was semantically an image while containing interactive nodes; drag lacked a keyboard equivalent
- Classification: accessibility
- Severity: High
- Status: FIXED
- VERIFIED FACT: topology SVG used `role=img` around interactive descendants and primary camera manipulation emphasized pointer drag/wheel.
- EVIDENCE: SVG is now an interactive group with instructions; Arrow keys pan, +/- zoom, Home/0 fit; visible zoom buttons are present.
- Root cause: graph began as a visualization and evolved into an interaction surface.
- Violated invariant / standard: WCAG 2.1 keyboard accessible; 2.5.7 dragging movements; ARIA role/interaction coherence.
- User/system impact: keyboard users had incomplete graph navigation; accessibility tree semantics were contradictory.
- Systemic fix: explicit non-drag camera controls and group semantics.
- Verification: QA changes scale/translation through keyboard and confirms persisted user-transformed camera.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: full screen-reader graph navigation is UNVERIFIED.

### WRUI-007 — Dynamic inspector URL lacked protocol validation
- Classification: security/privacy
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: topology inspector escaped `htmlUrl` text but did not constrain URL scheme.
- EVIDENCE: `safeURL()` accepts only HTTP(S); QA injects `javascript:alert(1)` and asserts rendered href is `#`.
- Root cause: escaping was treated as equivalent to URL trust validation.
- Violated invariant / standard: PRODUCT INVARIANT — untrusted rendered content has an explicit trust boundary; dynamic URLs are validated.
- User/system impact: hostile/invalid external URLs could become navigable UI actions.
- Systemic fix: scheme validation at rendering boundary.
- Verification: malicious-scheme Playwright regression PASS.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: backend provider URLs should remain normalized/validated independently.

### WRUI-008 — Browser resource lifecycle had no complete teardown path
- Classification: reliability / performance
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: EventSource, ResizeObserver, MutationObserver, rAF loops, timers/listeners, and AudioContext previously had partial/no unified destroy lifecycle.
- EVIDENCE: `AGVisual.destroy`, `AGSpatial.destroy`, application `teardown`, cleanup registries, EventSource close, observer disconnect, rAF cancel, interval clear, and AudioContext close now exist.
- Root cause: feature-by-feature setup accumulated without a top-level lifecycle contract.
- Violated invariant / standard: PRODUCT INVARIANT — resource creation has deterministic cleanup.
- User/system impact: repeated lifecycle transitions could leak resources or leave callbacks acting on stale state.
- Systemic fix: explicit root teardown plus subsystem destroy methods.
- Verification: final QA fires `pagehide` and asserts EventSource closed and modal inert state released.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: multi-hour memory stability is UNVERIFIED.

### WRUI-009 — Reduced-motion mode did not suppress SVG SMIL data pulses
- Classification: accessibility / visual consistency
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: CSS `animation:none` does not stop `<animateMotion>` SMIL.
- EVIDENCE: reduced-motion policy hides `.edge-pulse`; graph controls and topology remain operable.
- Root cause: CSS-animation and SVG-SMIL mechanisms were treated as one motion system.
- Violated invariant / standard: WCAG motion guidance / PRODUCT INVARIANT reduced-motion parity.
- User/system impact: users requesting reduced motion could still see continuous graph pulses.
- Systemic fix: semantic motion policy controls creation/display of the pulse layer.
- Verification: Playwright emulates reduced motion, verifies motion mode and suppressed pulses, then successfully zooms.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: OS-level reduced-motion behavior on native Windows shell is UNVERIFIED.

### WRUI-010 — Resize could overwrite user graph camera intent
- Classification: correctness / interaction reliability
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: topology ResizeObserver previously called unconditional `fit()`, resetting pan/zoom.
- EVIDENCE: camera now tracks `userTransformed`; resize uses `fit(false)` and preserves user scale/translation.
- Root cause: layout reflow and camera intent had no ownership distinction.
- Violated invariant / standard: PRODUCT INVARIANT — older/background work may not overwrite newer user intent.
- User/system impact: inspection context could jump unexpectedly on resize/layout changes.
- Systemic fix: user camera state owns framing until explicit Fit/Home action.
- Verification: QA changes camera by keyboard, resizes viewport, asserts scale is preserved.
- Regression coverage: `qa/render_shell.py`.
- Remaining risk: complex nested resize sequences are bounded by the same invariant but not exhaustively fuzzed.

### WRUI-011 — Pointer intent performed avoidable high-frequency DOM scans
- Classification: performance
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: pointermove previously scanned `.intent-hot` candidates and could retain stale dwell intent.
- EVIDENCE: current engine tracks one intent/dwell target, rAF-throttles pointer presentation, and clears dwell on pointer exit.
- Root cause: convenience query path inside a high-frequency input handler.
- Violated invariant / standard: PRODUCT INVARIANT — high-frequency motion must avoid unnecessary full-surface work.
- User/system impact: avoidable main-thread cost on large/dense interfaces.
- Systemic fix: stateful target tracking rather than global query per move.
- Verification: source inspection + deterministic 200-repository projection with no browser page errors.
- Regression coverage: stress section of `qa/render_shell.py`.
- Remaining risk: native pointer CPU trace remains UNVERIFIED.

### WRUI-012 — Topology retained permanent GPU promotion hint
- Classification: performance
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: topology viewport had permanent `will-change: transform`.
- EVIDENCE: promotion is now applied only during drag.
- Root cause: optimization hint became permanent without measurement.
- Violated invariant / standard: PRODUCT INVARIANT — GPU promotion is measurement-driven and transient.
- User/system impact: unnecessary compositor/GPU memory pressure.
- Systemic fix: drag-scoped `will-change`.
- Verification: CSS/source gate and functional graph QA PASS.
- Regression coverage: release source review.
- Remaining risk: actual GPU memory delta is UNVERIFIED on target hardware.

### WRUI-013 — Dynamic inline style attributes conflicted with strict CSP
- Classification: correctness / security/privacy
- Severity: Medium
- Status: FIXED
- VERIFIED FACT: TypeSafe meters and agent progress were generated as HTML `style="width:..."` attributes while the app uses strict `style-src 'self'` CSP.
- EVIDENCE: generated markup now carries bounded data values and applies width through CSSOM after insertion; release build fails if JS/HTML contains new `style="..."` attributes.
- Root cause: later dynamic UI additions bypassed the earlier CSP-safe rendering convention.
- Violated invariant / standard: PRODUCT INVARIANT — security policy and renderer behavior must agree.
- User/system impact: progress/meter visuals could silently fail under the packaged CSP and future inline-style usage could weaken pressure to keep CSP strict.
- Systemic fix: CSP-safe CSSOM rendering + build gate.
- Verification: grep/build gate PASS; Playwright renders TypeSafe and agent surfaces with no page errors.
- Regression coverage: `scripts/build-release.sh` plus deterministic shell QA.
- Remaining risk: CSSOM remains an imperative rendering path and therefore requires bounded numeric inputs; values are clamped 0–100.

### WRUI-014 — Decorative signal bursts were nondeterministic
- Classification: maintainability / performance
- Severity: Low
- Status: FIXED
- VERIFIED FACT: ambient burst selection used `Math.random()`.
- EVIDENCE: burst allocation now uses deterministic round-robin selection and runs only in semantic live mode.
- Root cause: decorative randomness was introduced before replayable deterministic QA became a goal.
- Violated invariant / standard: PRODUCT INVARIANT — deterministic presentation is preferred for operational/test surfaces.
- User/system impact: harder visual regression/debugging; no domain correctness impact.
- Systemic fix: deterministic bounded selection.
- Verification: source inspection + repeated QA PASS.
- Regression coverage: deterministic QA harness.
- Remaining risk: none material.

## Performance evidence
- Device/environment: Linux build container, headless Chromium; not target Windows hardware.
- Dataset: normal deterministic fixture = 33 repositories / 9 domains / 4 agents; stress projection = 200 repository nodes.
- Refresh rate: headless rAF cadence measurement observed approximately 15 Hz with p95 ~150 ms in this throttled environment. This is explicitly NOT evidence of target-device 60/120/144 Hz performance.
- Before: no trustworthy native before trace captured for this audit.
- After: 200-repository refresh/projection completed in ~20 ms for the measured refresh promise in the deterministic harness; no node multiplication or browser page errors. Native frame behavior remains UNVERIFIED.
- Long tasks: no target-device PerformanceObserver trace captured — UNVERIFIED.
- Memory: no multi-hour heap/GPU soak captured — UNVERIFIED.
- Notes: implementation bounds frame deltas, suspends hidden/non-live decoration, uses rAF for visual loops, removes permanent topology `will-change`, and degrades decorative motion before core operability.

## Accessibility evidence
- Keyboard: automated keyboard graph pan/zoom/fit and dialog Escape path PASS.
- Focus: dialog inert/focus containment + trigger restoration automated PASS; visible `:focus-visible` styling present.
- Reduced motion: automated Chromium `prefers-reduced-motion` path PASS; SMIL edge pulses suppressed while functionality remains.
- Touch/coarse pointer: coarse-pointer CSS target-size policy implemented; real touch hardware path UNVERIFIED.
- Contrast: runtime WCAG contrast analyzer remains available; known authority-violet accent is not used as normal-text claim. Full manual visual audit across every state is not claimed.
- Screen reader / semantic inspection: role conflict in topology fixed; automated semantic attributes inspected. Narrator/NVDA run UNVERIFIED.
- WCAG exceptions or unresolved issues: real AT and Windows forced-colors/High Contrast remain release evidence gaps.

## Live-state truth audit

| Label | Source of truth | Observation/freshness | Stale behavior | Unknown behavior | Replay/history |
| --- | --- | --- | --- | --- | --- |
| Live | GitHub REST provenance + current observation + active War Room stream | TTL = bounded 4x reconcile interval, min 180s / max 1800s | becomes `stale` | `unknown` | N/A; replay not implemented |
| Snapshot | packaged/bootstrap GitHub inventory | timestamp may exist but provenance is not live | remains snapshot until live source replaces it | no inventory -> unknown | distinct from live |
| Stale | last valid GitHub REST observation beyond TTL | retains timestamp/source | explicit stale label; live pulses disabled | N/A | distinct from live |
| Reconnecting | War Room EventSource reconnect state with retained last observation | last observation retained | canonical refresh on ready | if no observation, source semantics remain unknown/connecting | N/A |
| Offline | stream explicitly offline with last observation retained | timestamp remains visible | no live motion | if no observation, unknown | N/A |
| Agent running/waiting/blocked | validated Agent Bridge/WORKS projection + heartbeat age | heartbeat TTL from `agentStaleSeconds` | becomes stale | unrecognized states -> `unknown` and inactive | N/A |
| Verified | not manufactured by this UI; only displayed where external evidence says so | external evidence semantics | no visual inference creates VERIFIED | unknown remains unknown | future replay must be distinct |

## Release gates

### Critical correctness
- No animation or visual activity is used as domain truth — PASS
- LIVE/RUNNING/VERIFIED/CONNECTED/HEALTHY/COMPLETE have explicit evidence — PASS for implemented operational labels
- Fresh/stale/offline/unavailable/snapshot/inferred/unknown distinction where applicable — PASS; replay/history N/A in current product
- External live payloads validated before trusted use — PASS for tested typed adapters/state vocabulary and URL boundary; future provider fields require explicit mapping
- Duplicate/late/out-of-order events cannot corrupt final state — PASS for current event IDs, agent event dedupe, summary coalescing, and canonical reconnect; broader provider fuzzing remains planned
- Older async work cannot overwrite newer user intent — PASS for summary refresh and topology camera
- Reconnect reconciles canonical state — PASS
- Unknown is not converted into reassuring default — PASS

### Interaction and accessibility
- Essential functionality keyboard operable — PASS for audited workflows
- No essential function hover-only — PASS for audited workflows
- Dragging has alternative — PASS
- Focus visible/predictable through structural transitions — PASS in automated keyboard checks
- Modal behavior follows chosen accessible pattern — PASS in automated keyboard checks
- Important states not color-only — PASS for audited operational state labels
- WCAG 2.2 AA minimum target sizes — PASS by CSS inspection for 24px minimum; coarse-pointer policy increases primary controls to 40px
- Reduced-motion preserves functionality — PASS
- Mouse/touch/keyboard checked — keyboard/mouse PASS; real touch hardware UNVERIFIED

### Motion and rendering
- No avoidable full-app rerender for high-frequency motion — PASS by architecture/source inspection
- Refresh-rate-independent animation path — PASS for rAF/time-based engines; native high-refresh result UNVERIFIED
- Large suspension deltas bounded — PASS
- Redundant loops removed/bounded — PASS for audited engines
- hidden/offscreen decorative work stops/degrades — PASS
- no unjustified permanent `will-change` — PASS
- layout-thrashing risks investigated — PASS for audited pointer/topology paths
- motion tokens canonicalized — PASS
- numeric visual inputs finite/bounded — PASS for audited meter/progress/physics inputs

### Lifecycle and reliability
- listeners/observers/timers/sockets/rAF/audio cleanup — PASS for audited frontend subsystems
- repeated lifecycle does not multiply background work — PASS for single EventSource + explicit destroy in audited lifecycle
- long-lived callbacks avoid stale state — PASS for audited refresh/dialog/topology paths
- loading/empty/error/stale/offline/unavailable/unknown distinct — PASS where applicable
- local subsystem failure does not crash whole UI — PASS in deterministic provider/UI error paths
- recoverable failures have deterministic path — PASS for reconnect/refresh

### Performance
- performance targets written down — PASS (8.3 ms @120 Hz, 16.7 ms @60 Hz displayed as budgets)
- normal/worst representative load tested — PASS for 33/200 repo fixture projections
- 60 Hz behavior acceptable — UNVERIFIED on target hardware
- high-refresh behavior inspected — UNVERIFIED on target hardware
- CPU-constrained behavior tested — UNVERIFIED on target hardware
- long-running memory behavior stable — UNVERIFIED
- quality degradation removes decoration first — PASS by policy/source inspection

### Security and privacy
- untrusted rendered content trust boundary — PASS for audited paths
- dynamic URLs validated — PASS
- no intended secret exposed client-side/log/source artifact — PASS in existing secret-scan/DPAPI model; final release scan required
- sensitive persistence intentional/reviewed — PASS for current browser visual preferences; credentials remain server/vault-side

### Verification
- deterministic logic automated tests — PASS
- critical interaction tests — PASS
- visual regression/screenshots practical baseline — PASS for deterministic key views; state-by-state screenshot matrix remains open
- accessibility automated + manual keyboard/reduced-motion — PASS for keyboard/reduced-motion manual-equivalent automation; screen reader UNVERIFIED
- claimed fixes include evidence — PASS
- unperformed gates labeled UNVERIFIED — PASS

## Final verdict

**CONDITIONAL PASS**.

No known critical correctness/accessibility/reliability failure remains in the audited v1.6.8 UI surface after this pass. The release is not called fully UI/UX-stable because native Windows high-refresh/performance, long-running resource behavior, real assistive-technology behavior, forced-colors/High Contrast, and real coarse-pointer hardware remain unverified.
