# War Room v1.5 — Reactive / Spatial capability matrix

This matrix maps the supplied 001–300 capability catalogue into the v1.5 implementation. The catalogue is treated as a design vocabulary, not as a mandate to enable 300 simultaneous effects. War Room optimizes for **calm, evidence-bounded operational comprehension**.

Status vocabulary:

- **SHIPPED** — directly implemented and exercised by v1.5 QA.
- **PARTIAL** — foundation exists, but the full capability definition would require richer canonical mission/agent/evidence state.
- **DEFERRED** — deliberately not shipped in v1.5; usually because the data model, hardware proof, or cognitive-load justification is missing.

## SHIPPED — interaction and material

| Catalogue IDs | v1.5 implementation |
|---|---|
| 001, 002, 004–007, 009, 010 | Pointer parallax, cursor depth, specular tracking, perspective/tilt, proximity response and cursor glow through one rAF-throttled interaction field. |
| 012, 015–026 | Spring-like motion tokens, smooth interpolation, restrained glass/specular material, dynamic shadow/blur/focus, progressive disclosure, contextual expansion, hover elevation, magnetic buttons/navigation. |
| 051, 054–056, 059, 060 | State/panel transitions, expandable surfaces, contextual inspector/tooltips, animated command palette/search focus. |
| 061–070 | Reactive grid/ambient field, gradient atmosphere, evidence/data pulses, depth movement, edge glow, glass sheen, pointer-reactive borders/illumination. |
| 071, 072, 078–080 | Micro-interactions, press/release response, touch-safe motion, reduced-motion parity, frame-budget performance governor. |

## SHIPPED — live topology / digital twin

| Catalogue IDs | v1.5 implementation |
|---|---|
| 027–029 | Animated SVG nodes/edges and traveling live data pulses. |
| 039, 041, 043, 044, 046–049 | Live state transitions, metric updates, selected-object focus, zoom/pan, relationship spotlight, focus and heatmap modes. |
| 081–095, 099, 100 | User/state/data/evidence reactive rendering; spatial interaction engine; global pointer field; motion/depth tokens; adaptive intensity; viewport/attention awareness; live system topology; focus context. |
| 151–156 | Semantic zoom, level-of-detail information density, zoom-dependent labels and node aggregation/suppression. |
| 162–164, 166, 167 | Context isolation and dependency/causal path spotlight through relationship-aware hover/focus. |
| 199, 200, 202, 204 | Causal/dependency/evidence flow and state propagation encoded as animated typed graph edges. |
| 205, 206, 208–210 | Live digital twin, topology mirror, observed-vs-canonical/source overlay, drift visualization and divergence highlighting. |
| 281, 283, 284 | Reality Diff mode, canonical/live source distinction and drift styling. |
| 286, 288 | Provenance-on-inspection and source-lineage expansion in the object inspector. |
| 296, 297, 299 | Adaptive camera primitives: fit, focus, context framing and multi-target fit foundation. |

## SHIPPED — intent, attention and performance

| Catalogue IDs | v1.5 implementation |
|---|---|
| 177–180 | Hover/dwell intent detection plus attention decay primitives. |
| 181–185 | Activity/recency/importance visual priority, stale-state decay and severity-aware motion/tint. |
| 186, 188 | Peripheral awareness via persistent Needs You, live context and off-view status indicators. |
| 192, 197, 198 | Confidence/evidence sufficiency, freshness and uncertainty visualization. |
| 223 | Live cursor intent field. |
| 229, 231–234 | Adaptive information/motion density, cognitive-load governor, visual-noise reduction and priority suppression. |
| 235, 236 | Command-to-UI transitions and natural-language focus/navigation into structured views. |
| 247–250 | Spatial/object-aware command palette and context/selection-bound actions. |
| 256, 257, 259–261 | Adaptive/frame-budget/battery/visibility-aware motion and off-screen suspension. |
| 263–265 | Pointer-velocity and dwell-based intent classification. |
| 272, 275, 276 | Ambient system pulse, global-health ambience and risk tint. |

## PARTIAL — intentionally bounded in v1.5

| Catalogue IDs | Why partial |
|---|---|
| 030–038, 095–098 | Execution/mission/agent/evidence animations exist as visual grammar, but War Room does not invent canonical Mission/Agent execution state that is not yet ingested. |
| 101–105, 124–128 | Anchored/context UI is implemented as a stable inspector; true transform-following graph overlays are deferred until selection density warrants it. |
| 106–111 | View transitions and focus continuity exist, but shared-element morphing across every view is not yet universal. |
| 112–123 | Sticky/viewport/container behavior exists; a full component-local container-query system is not yet applied to all surfaces. |
| 168–174 | Temporal horizon filtering exists (1h/6h/24h/7d); full immutable replay/time-travel requires historical event snapshots. |
| 195, 196, 203 | Verification/provenance semantics are visible, but cryptographic evidence propagation awaits canonical receipt ingestion. |
| 229–234 | Governors are heuristic and frame-budget based; they do not infer mental state or claim biometric cognitive load. |
| 252–255 | Responsive desktop/mobile web shell exists; true cross-device continuity requires a shared durable state service. |
| 258 | Effects react to observed frame cadence and battery state, not direct GPU/CPU render telemetry yet. |

## DEFERRED — not faked

- **WebGPU / GPU compute (143–150):** SVG is sufficient for the current 33-repository graph. WebGPU is only justified after measured density/performance pressure.
- **Multi-agent trails/collisions (217–222):** no visualization until authenticated agent-instance/attempt telemetry is ingested.
- **Full temporal replay (168–174):** needs immutable snapshot/event history first.
- **Mission cinematics (241–246, 300):** no cinematic motion without canonical mission milestones; motion must not imply progress that evidence does not support.
- **Directional/spatial audio and haptics (267–271):** basic procedural audio remains opt-in; spatial severity grammar awaits native Windows/iOS surface work.
- **Spatial history / undo (291–295):** deferred until object navigation/history becomes durable state rather than ephemeral view state.

## Invariant

> Motion can reveal a state transition; it may not create the appearance of a state transition.

That invariant is the reason the 300-capability catalogue is curated rather than blindly enabled.
