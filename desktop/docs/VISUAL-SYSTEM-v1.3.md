# AFTERGRAPH / WAR ROOM — Living Surface System v1.3

Evidence cut: 2026-09-18

## Purpose

War Room v1.3 upgrades v1.2 from a calm static operator shell into a **state-driven living interface**. The goal is not decorative animation. Motion, depth, sound and material effects are constrained to one of four jobs:

1. communicate source freshness / presence,
2. preserve spatial context while navigating,
3. acknowledge direct manipulation,
4. draw attention to a newly observed consequential state.

No animation, audio or color is allowed to carry unique operational truth.

## External design evidence

### xAI Grok Bot
Primary: https://x.ai/news/designing-grok-bot

Patterns retained:
- persistent state is visible without opening raw telemetry,
- state is communicated through the same object the user already watches,
- **status → preview → takeover** is more legible than permanent supervision,
- autonomous work should surface exceptions instead of requiring continuous dispatch,
- information shape is part of the product response.

Translation into War Room:
- live status breathes only when the SSE/source state is live,
- `Needs You` receives bounded attention motion only when the count actually increases,
- event updates create a subtle system sweep / signal burst,
- progressive disclosure still controls access to Activity, Intelligence, Evidence and Services.

### Apple HIG / visionOS / Liquid Glass
Primary:
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/motion
- https://developer.apple.com/design/human-interface-guidelines/spatial-layout

Patterns retained:
- material establishes hierarchy,
- glass is most appropriate for controls and navigation rather than the entire content layer,
- depth should communicate hierarchy, not decorate every element,
- motion should communicate status / feedback while avoiding visual fatigue,
- reduced-motion / reduced-transparency preferences must have equivalent UI behavior.

Translation into War Room:
- glass is limited to sidebar, topbar, command composer, command palette and visual-control overlay,
- data surfaces stay opaque enough for deterministic reading,
- 3D tilt is capped to ~2° and only appears on interactive card-like surfaces,
- text never moves in independent depth,
- reduced motion disables tilt, pulse travel, view motion and specular movement.

### WCAG 2.2
Primary: https://www.w3.org/TR/WCAG22/

Relevant gates:
- visible keyboard focus,
- focus must not be obscured,
- target-size minimum,
- interaction motion must have a reduced alternative,
- status meaning must not depend on color alone.

v1.3 adds a runtime contrast calculator for canonical Aftergraph color pairs. The audit identified `authority_violet #7759E8` as unsuitable for small body text on `institution_black #080C14` (about 4.08:1). The canonical token remains available for accents/boundaries, while text uses an accessibility derivative `authority_text #9C8AF1`.

### Web platform performance guidance
Primary:
- https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate
- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API

Performance rules:
- interactive motion animates `transform` and `opacity`, not layout geometry,
- pointer sheen is rAF-throttled,
- the signal field uses one small 2D canvas, DPR capped at 2,
- animation pauses when the document is hidden,
- `content-visibility` / containment localizes expensive rendering,
- the app measures its own actual rAF cadence instead of claiming a universal 120 FPS.

Target budget shown in the UI:
- 120 Hz → 8.3 ms/frame
- 60 Hz → 16.7 ms/frame

## Why no Tailwind CDN

Tailwind's official Play CDN documentation explicitly says it is for development only and is not intended for production. War Room is a packaged security-sensitive desktop surface, so v1.3 keeps **zero-runtime local CSS** instead of adding a production CDN dependency.

A future build-time Tailwind migration is possible, but only if it materially improves maintainability without introducing a second design-token authority.

## Typography

The CSS stack prefers, when installed:
- `Plus Jakarta Sans` — interface text
- `Space Grotesk` — display / section hierarchy
- `JetBrains Mono` — exact SHAs, metrics, cryptographic / technical state

The release does not bundle or redistribute font files. It falls back to Windows/system fonts while preserving all layout and semantics.

## Motion grammar

| Rung | Duration | Curve | Use |
|---|---:|---|---|
| Micro | 120ms | snappy spring approximation | press, hover, focus response |
| State | 190ms | soft spring | badge/status change |
| Surface | 320ms | soft spring | view / palette / inspector transition |
| Reveal | 440ms | settle | larger progressive-disclosure surfaces |

Curves are CSS `cubic-bezier` approximations. They are not presented as physical SwiftUI springs.

## Living elements

### Signal Field
A low-alpha canvas maps the nine observed domain activity levels into a calm moving signal field. It has no labels and carries no unique information; it is a peripheral state cue only.

### Presence breath
Only the live presence dot breathes. `STALE` and `OFFLINE` are static.

### Data-arrival sweep
A new normalized source event causes one ~600ms top-edge sweep and signal burst. Continuous scanning animation is deliberately avoided.

### Specular sheen
Interactive surfaces can show a pointer-positioned low-opacity radial sheen. It exists only on hover/focus-capable surfaces and disappears under reduced motion.

### Spatial response
Interactive cards may tilt by approximately ±1–2° using compositor-only transforms. Tables and long-form reading surfaces do not tilt.

## Sonic feedback

`Web Audio API` procedurally synthesizes small cues with oscillator/gain nodes. There are no audio files.

Rules:
- off by default,
- enabling sound is a user gesture and arms the AudioContext,
- tap / open / success / attention are distinct but quiet,
- no looping ambient sound,
- sound never communicates information that is absent visually,
- background/hidden windows stay quiet.

## Color-vision diagnostics

The Visual drawer includes protanopia, deuteranopia and tritanopia simulation matrices. These are **diagnostic approximations**, not medical models. Operational status continues to include text, shape or symbols so the product does not rely on hue alone.

## Runtime controls

`Visual & ergonomic controls` provides:
- motion: system / full / reduced,
- material: regular glass / reduced transparency,
- sonic feedback: off/on,
- color-vision simulation,
- live WCAG contrast math,
- device-local frame-cadence measurement.

Preferences persist locally in `localStorage` and do not enter canonical system state.

## Non-goals

- no cyberpunk particle field,
- no permanent animated gradient behind every panel,
- no fake network topology,
- no motion that implies health when state is unknown,
- no external JS/CSS CDN dependency,
- no universal “120 FPS” release claim.
