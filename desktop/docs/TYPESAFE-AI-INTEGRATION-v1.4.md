# TypeSafe AI / Jev integration — War Room v1.4

## Purpose

War Room uses TypeSafe AI's Jev as a **machine-native decision lens**, not as a chatbot and not as an execution authority.

The integration follows Jev's published System One shape:

```text
observed state
   │
   ├── Choice → review route
   ├── Noul   → P(human review needed)
   └── Score  → operational severity
        │
        ▼
War Room UI / ranking context
```

The surrounding Aftergraph code remains authoritative for:

- identity,
- authority,
- budgets,
- execution,
- deterministic evidence,
- verification.

A Jev decision can influence **attention and review routing only**.

## API contract

Direct endpoint:

```text
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <server-side API key>
Content-Type: application/json
```

Model alias: `jev-latest`.

The request carries one bounded Aftergraph system-state object plus three independent questions:

1. `attention_route` — Choice
   - `no_action`
   - `monitor`
   - `human_review`
   - `urgent_review`
2. `human_review_needed` — Noul
3. `operational_severity` — Score
   - Nominal
   - Watch
   - Degraded
   - Critical

## Credential boundary

The TypeSafe key is never embedded in HTML/JS and never returned to the browser.

On Windows it is stored with the same DPAPI current-user vault used for GitHub credentials.

The browser receives only:

- configured/not configured,
- model alias,
- structured decision results,
- token usage,
- evaluation timestamp.

`TYPESAFE_API_KEY` is also accepted as an environment fallback for controlled deployments.

## Cost / action boundary

War Room does **not** call Jev on every refresh. A TypeSafe evaluation is explicit and operator-triggered in v1.4. This prevents silent recurring API spend and avoids treating model output as fresh evidence merely because the UI is live.

## State sent to Jev

The outbound state is a compact projection of already-observed War Room facts:

- GitHub observation source/freshness,
- repo count,
- open PR/issue counts,
- commits / 24h,
- current Needs You count,
- latest failing workflows,
- degraded HTTP probes,
- top operational-intelligence candidate.

Secrets, repository contents, conversation history, API tokens, and raw local files are not included.

## Explicit invariants

```text
TypeSafe output ≠ evidence
TypeSafe output ≠ authority
TypeSafe output ≠ verified outcome
TypeSafe output ≠ permission to execute

Jev may classify / score / route review.
Aftergraph policy decides what may happen next.
```

## Sources reviewed 2026-09-18

- TypeSafe AI, "Introducing System One Models and Jev" (2026-09-14)
- TypeSafe AI home / Jev overview
- TypeSafe Workflow Evals — Noul / Choice / Score workflow decomposition
- Cloudflare Workers AI model documentation for `typesafe/jev`
