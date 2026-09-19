# AFTERGRAPH / WAR ROOM — v1.6.8 Stabilization Pass VIII + UI Stability Track I

v1.6.8 remains stabilization-first. It adds no new operator feature surface. This pass starts a dedicated UI Stability Track using the supplied `war-room-ui-stability` skill while preserving the existing runtime/code stabilization line.

## Closed in this pass

1. Source provenance and freshness now jointly determine the semantic observation mode; a recent build snapshot can no longer become LIVE.
2. Unknown agent/worker states now project as `unknown` and do not count as active presence.
3. War Room SSE reconnect now triggers canonical summary reconciliation.
4. Concurrent summary refreshes are single-flight/coalesced to prevent stale overwrite races.
5. Command palette and visual controls share an accessible modal focus manager with inert background, Tab containment, Escape close, and focus restoration.
6. Topology semantics and camera controls now provide a complete keyboard/non-drag alternative.
7. Dynamic topology URLs are restricted to HTTP(S).
8. Global visual/spatial/browser resources have explicit teardown; pagehide closes the EventSource and AudioContext/observers/rAF loops are released.
9. Reduced-motion suppresses SVG SMIL edge pulses without removing graph functionality.
10. User-modified topology camera state survives ResizeObserver activity.
11. Pointer intent no longer performs a global DOM scan on each pointermove; dwell state is cleared on exit.
12. Permanent topology `will-change` promotion is removed; promotion is transient while dragging.
13. Signal-field bursts are deterministic and live-mode-gated.
14. Dynamic meter/progress widths no longer emit inline `style=` attributes that conflict with strict CSP; the build now rejects such regressions.
15. Coarse-pointer ergonomics increase target sizes for primary controls.
16. A deterministic 200-repository projection stress test and frontend lifecycle teardown test are part of the visual QA harness.

## Skill verdict

The required report is `docs/UI-UX-STABILITY-AUDIT-v1.6.8.md`.

Verdict: **CONDITIONAL PASS** — no known critical failure remains, but target-device 60/120/144 Hz, multi-hour resource soak, Windows High Contrast/forced-colors, Narrator/NVDA, and real touch hardware remain UNVERIFIED.

## Invariants preserved

- UI state remains a projection of source-backed system reality.
- Animation/motion never upgrades a snapshot/unknown/stale state to live truth.
- TypeSafe/Jev output is not authority, execution, evidence, or verification.
- Assistant output remains advisory/read-only unless a governed external execution path is introduced.
- Unknown remains unknown unless a domain contract explicitly maps it.
- Credentials remain outside browser state/source artifacts.
