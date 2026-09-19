# Source alignment — build 1.1.0

This desktop package is an **operator projection**, not a new source of truth for Aftergraph governance, repository topology, verification state, or mission authority.

## Live Aftergraph sources inspected before the build

| Source | Exact observation used | Purpose |
|---|---|---|
| `Aftergraph/brand` | `6abc51be903ffd1041a716d2adeec364de3d68c0` (2026-09-10) | Canonical visual grammar, color tokens, typography, master-brand treatment and Calm Intelligence constraints. |
| `Aftergraph/war-room` | `0313ad91ce9607e3b6ab097851e7352d39c05a62` (2026-09-15) | Existing War Room domain model, API/ingestion direction, EGAC/ontology concepts and operator-surface vocabulary. |
| `Aftergraph/after-graph-governance` | `5cce213a8b74a9d586749bcbdce426811ba5ae57` (2026-09-15) | Governance context and boundary ownership. The desktop app deliberately does not promote its observed state to canonical governance truth. |
| Authenticated GitHub organization inventory | 2026-09-18T20:09:00Z | 33 accessible `Aftergraph/*` repositories captured into the build-time bootstrap inventory. |

The organization inventory is stored in `defaults/repo-inventory.json`. It is an observed build-time snapshot. At runtime, public GitHub data refreshes on the configured cadence even without credentials; previous private inventory is retained with explicit partial-observation provenance until a credentialed sync refreshes it.

## External UI/UX research inspected for v1.1

The shell uses interaction-pattern research, not visual cloning:

| Source | Observation | War Room translation |
|---|---|---|
| xAI — *Designing Grok Bot for a world of persistent agents* (2026-09-03) | Persistent roster/presence, status → preview → takeover, heterogeneous transcript, structured cards, exception-first coordination, disappearing UI. | Persistent `Now` state, live/stale presence, right-side preview, full detail planes, mixed activity timeline, `Needs You`, reduced panel chrome. |
| xAI Grok Bot docs — settings/notifications + bots | Explicit needs-attention/working/unread states and minimal role-level concepts. | Attention state is source-backed and separated from ordinary activity. |
| OpenAI — ChatGPT desktop update (2026-07-16) | Clear global hierarchy, unified recents/projects, focused desktop mode selection. | One calm sidebar and one focused center surface instead of equal-weight dashboard panels. |
| OpenAI — ChatGPT Work (2026-07-09) | Long-running work surfaces progress, questions, intervention and approvals without exposing all machinery. | Live system summary + chronological progress + exception surface + deterministic command composer. |

Exact external links and the design mapping are documented in `docs/UX-RESEARCH-v1.1.md`.

## Canonical Aftergraph visual tokens used

- `institution_black` — `#080C14`
- `graph_midnight` — `#0E1630`
- `evidence_white` — `#F5F7FA`
- `slate` — `#8993A4`
- `control_cyan` — `#42C7E8`
- `evidence_teal` — `#24C4AD`
- `authority_violet` — `#7759E8`
- `decision_amber` — `#F0A64A`
- `system_blue` — `#4C8BD8`

The embedded mark follows the canonical graph-boundary geometry and central execution kernel. No separate War Room sub-brand is invented; the product is rendered as `AFTERGRAPH / WAR ROOM`.

## Research contracts reflected in the UI

The application exposes, without fabricating values:

- Institution surfaces: Identity, Authority, Policy, Budgets, Evidence.
- Outcome/evidence metrics: VSR, FCR, CRR, UAR, CPVO, Control Plane Tax, TVO, Evidence Completeness.
- Human operator priorities: system reality, progress/activity, needs-you attention, risk/failures, cost/evidence and verified outcomes.
- Provenance classes: live GitHub observation, build-time bootstrap snapshot, direct service probe, local evidence/metric sample and local host telemetry.
- Freshness classes: live, stale, local/offline.

`Complete != Verified` remains a presentation invariant: an activity or workflow can be complete without the UI silently promoting it into a verified outcome.
