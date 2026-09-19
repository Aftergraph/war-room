# AFTERGRAPH / WAR ROOM — UI/UX Research Pass v1.1

Evidence cut: 2026-09-18

This redesign deliberately borrows **interaction patterns**, not visual cloning, from current agentic desktop products. Aftergraph keeps its own canonical design tokens, semantics, and evidence rules.

## External patterns studied

### xAI Grok Bot — persistent-agent interaction model
Primary source: https://x.ai/news/designing-grok-bot (2026-09-03)

Relevant findings:
- Persistent actors should be easier to scan than a long chat-history list.
- Presence should communicate identity + current state without adding a second dashboard vocabulary.
- Workspace visibility is progressive: **status → preview → takeover**, instead of continuously forcing users to supervise the computer.
- The response format is part of the answer: structured cards/widgets are used when prose would make the user reconstruct the information.
- Conversation, system events, interactive objects, and visualizations can coexist in one heterogeneous timeline.
- Autonomous work should surface exceptions and consequential decisions, rather than require the human to dispatch every step.
- The final UI should remove controls/metadata that do not materially help delegation or intervention.

Supporting product/docs:
- https://x.ai/news/introducing-grok-bot
- https://docs.x.ai/grok-bot/settings-and-notifications
- https://docs.x.ai/grok-bot/bots

### ChatGPT desktop / Work — focused desktop hierarchy
Primary sources:
- https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes (2026-07-16 desktop update)
- https://help.openai.com/en/articles/20001275/ (ChatGPT Work and Codex)
- https://openai.com/index/chatgpt-for-your-most-ambitious-work/ (2026-07-09)

Relevant findings:
- Desktop mode benefits from a clear global hierarchy rather than exposing every subsystem equally.
- Chat/Work distinction makes the primary user intent obvious while deeper machinery stays below it.
- Long-running work exposes progress, questions, direction changes, and approval points without turning the interface into raw telemetry.
- Projects/recents use a calm, scannable sidebar while the center remains a focused work surface.
- Browser/desktop work is accessible from the task surface rather than permanently occupying the main canvas.

## Canonical Aftergraph constraints retained

Source: `Aftergraph/brand` / `DESIGN-SYSTEM.md`.

- Calm Intelligence: no decorative AI noise.
- Every state color has semantics.
- `#080C14` institution black remains the base canvas.
- `#42C7E8` control cyan = active controls / live telemetry.
- `#24C4AD` evidence teal = healthy verified/observed state.
- `#7759E8` authority violet = governance / policy context.
- `#F0A64A` decision amber = attention / human checkpoint.
- Unknown and unobserved states remain visually distinct from success.

## Resulting War Room interaction model

### 1. `Now` is the default object
The old version opened as a dashboard of panels. v1.1 opens as a **current system picture**:
- one evidence-bounded headline,
- a compact system pulse,
- one chronological live feed,
- one exception surface (`Needs You`),
- one contextual preview.

### 2. Live activity is a heterogeneous transcript
Commits, pull requests, issues, and CI runs occupy the same timeline. The user no longer has to infer causality from separate cards.

### 3. Progressive disclosure
- **Status:** sidebar presence, system headline, compact pulse.
- **Preview:** right-side live context and event inspector.
- **Full plane:** Activity / Systems / Repositories / Evidence / Services.

This mirrors the useful part of Grok Bot's status → preview → takeover hierarchy without pretending War Room is an agent computer.

### 4. Attention is exception-first
`Needs You` contains only observed blockers or degraded probes. No yellow/red decorative counters are produced from heuristics that lack source evidence.

### 5. Conversational entry without fake AI
The bottom composer and command palette accept plain-language requests such as:
- `what needs attention?`
- `what changed today?`
- `show failing CI`
- `show newest repositories`

v1.1 answers these **deterministically from the local observed state**. It does not pretend an LLM exists where none is configured.

### 6. Freshness is first-class
The shell distinguishes live, stale, and local/offline state using actual observation timestamps and SSE connection health.

### 7. Desktop shell is deliberately calm
Windows uses Microsoft Edge `--app=<loopback URL>` when available. This removes tabs/address chrome and presents War Room as a dedicated application surface while keeping the backend loopback-only.

## Non-goals
- Do not visually clone Grok Bot or ChatGPT.
- Do not introduce synthetic agents/avatars just to resemble another product.
- Do not turn every Aftergraph repository into a primary navigation item.
- Do not infer health from absence of evidence.
- Do not display private GitHub state as live unless authenticated evidence supports it.
