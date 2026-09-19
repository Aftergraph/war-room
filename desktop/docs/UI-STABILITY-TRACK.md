# AFTERGRAPH / WAR ROOM — UI Stability Track

This track runs in parallel with runtime/code stabilization. It follows the supplied `war-room-ui-stability` skill and treats the interface as a projection of system reality:

`domain truth -> semantic UI state -> presentation policy -> motion policy -> renderer`

The track does not create a second design system or a second state authority. It repairs the existing `app.js`, `visual-engine.js`, `spatial-engine.js`, CSS/token system, and Go-backed state projections.

## Track U0 — truth and state semantics — v1.6.8

Status: implemented and regression-tested.

- LIVE is now restricted to fresh GitHub REST observation plus an active War Room stream.
- Packaged/bootstrap inventory projects as `snapshot`, even when recently timestamped.
- stale / reconnecting / offline / connecting / unknown remain distinct.
- unknown agent states normalize to `unknown` and do not manufacture active presence.
- reconnect performs canonical summary reconciliation.
- concurrent summary refreshes are single-flight/coalesced.
- static first paint starts at `Connecting`, not `Live`.
- topology and signal motion receive the semantic observation mode; snapshot/stale/offline cannot inherit live pulses.

## Track U1 — input and accessibility — v1.6.8 baseline

Status: implemented, automated keyboard checks pass; assistive-technology hardware verification remains open.

- command palette and visual controls use a shared dialog focus manager.
- modal background becomes inert, Tab stays contained, Escape closes, trigger focus is restored.
- topology is an interactive group rather than an `img` containing interactive descendants.
- topology has keyboard zoom/pan/fit controls in addition to pointer drag/wheel.
- coarse-pointer CSS raises primary target sizes without removing keyboard/mouse paths.
- reduced-motion preserves graph operability and suppresses decorative SMIL edge pulses.

## Track U2 — motion, rendering, and lifecycle — v1.6.8 baseline

Status: implemented and headless regression-tested; native high-refresh measurement remains open.

- pointer intent no longer queries all interactive candidates on every pointermove.
- dwell intent is cleared on pointer exit.
- visual physics inputs and frame deltas are bounded.
- permanent topology `will-change` promotion was removed; it is transient while dragging.
- resize no longer overwrites a user-modified graph camera.
- hidden/snapshot/non-live signal-field motion is suspended or static.
- visual engine, spatial engine, observers, rAF loops, intervals, EventSource, and AudioContext have explicit cleanup paths.
- pagehide cleanup is regression-tested.
- dynamic meter/progress widths use CSSOM rather than CSP-blocked inline style attributes.
- release build rejects new `style="..."` attributes in JS/HTML under the strict CSP.

## Track U3 — native evidence gates — next

Status: open.

- native Windows 60/120/144 Hz traces on the target Lenovo.
- CPU/GPU/idle-vs-active capture on representative topology sizes.
- multi-hour memory/resource soak with GitHub + WORKS + Agent Bridge connected.
- Windows High Contrast / forced-colors review.
- NVDA/Narrator semantic + focus verification.
- coarse-pointer/touch verification on real touch hardware.
- screenshot/diff baselines for snapshot, live, stale, reconnecting, offline, reduced-motion, and high-contrast states.

## Track U4 — event/order and scale hardening — next

Status: open.

- property/fuzz tests for late/duplicate/out-of-order UI event projections.
- explicit replay/history mode when temporal replay is introduced.
- graph degradation thresholds for 500 / 1,000 / 5,000 projected objects before adopting WebGPU.
- long-task instrumentation and interaction latency budgets on target hardware.

## Release rule

The UI Stability Track uses the supplied skill verdict vocabulary only: `PASS`, `CONDITIONAL PASS`, `FAIL`, or `UNVERIFIED`.

A visually attractive result is not sufficient. Any unperformed gate stays `UNVERIFIED`.
