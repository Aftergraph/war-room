# Conversational Operations Shell v1.4

## Design goal

Move War Room away from a monitoring-dashboard mental model and toward a calm, understandable **operational workspace**:

```text
ROSTER / NAV     CONVERSATION / WORK          LIVE INSPECTOR
────────────     ────────────────────          ──────────────
Now              system brief                 system context
Activity         observed events              TypeSafe decision lens
Intelligence     operator questions           Needs You
Systems          result cards                 next move
Repos            composer                     routines
Evidence                                      institution boundary
Services
```

The layout is informed by current agent-product patterns where the main surface is conversation/work and secondary operational context is progressively disclosed in an inspector.

It deliberately does not copy another product's branding, avatars, colors or interaction assets.

## Visual semantics

- **Center is primary.** Human intent and the work stream dominate the viewport.
- **Right rail is contextual.** It answers “what is happening around this work?” without competing with the work itself.
- **Left rail is roster-like.** Domains use compact state-bearing avatars rather than looking like a settings menu.
- **Bubbles are semantic.** User queries and system observations have different geometry and material.
- **Motion is causal.** Arrival, live presence, attention and confidence transitions animate; unknown state does not.

## Living behavior

The shell retains the v1.3 Living Surface engine:

- requestAnimationFrame signal field,
- state-driven arrival sweep,
- live/stale presence,
- 3D pointer sheen,
- spring-like cubic-bezier curves,
- Web Audio cues,
- reduced motion/transparency,
- WCAG contrast diagnostics,
- color-vision simulation.

v1.4 moves these effects into the new conversation/inspector hierarchy rather than adding more ambient decoration.

## Mobile collapse

At narrow widths:

1. global navigation becomes a drawer,
2. the conversation remains primary,
3. the inspector stacks below it,
4. TypeSafe moves before lower-priority inspector cards,
5. quick-prompt chrome is removed before core controls are hidden.

## Performance discipline

No frontend framework was added.

The shell remains:

- local Vanilla ES6+,
- local CSS,
- local SVG icons,
- one bounded canvas,
- no Tailwind CDN,
- no external font/runtime dependency,
- strict CSP compatible.
