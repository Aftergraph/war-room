# TypeSafe / Jev native decision fabric — v1.5

## Change from v1.4

v1.4 exposed Jev as an operator-triggered decision lens. v1.5 moves it into the **native War Room control loop**.

```text
GitHub / probes / local intelligence
              │
              ▼
      canonical observed state
              │
              ├── deterministic attention ranker
              │
              └── TypeSafe Jev (native auto)
                    ├─ Choice: attention_route
                    ├─ Noul: human_review_needed
                    ├─ Noul: evidence_sufficient
                    ├─ Choice: dominant_signal
                    └─ Score: operational_severity
                              │
                              ▼
                   typed decision projection
                              │
                   UI / review routing only
```

The Jev call is automatically considered after startup, GitHub/probe reconciliation, credential activation and manual sync. Calls are bounded by:

- a stable state fingerprint,
- configurable minimum interval (default 300s),
- a daily request budget (default 60),
- one in-flight evaluation at a time,
- a hard request timeout,
- explicit provider-error state.

A repeated unchanged state inside the minimum interval does not produce another provider call.

## Five typed questions

1. `attention_route` — Choice: `no_action | monitor | human_review | urgent_review`
2. `human_review_needed` — Noul probability
3. `evidence_sufficient` — Noul probability
4. `dominant_signal` — Choice: CI / service / source gap / change risk / none
5. `operational_severity` — Score: Nominal → Critical

## Credential boundary

The API key is never compiled into the executable or shipped in the release archive.

On Windows:

```text
operator enters key once
        ↓
loopback backend
        ↓
CryptProtectData / DPAPI CurrentUser
        ↓
%LOCALAPPDATA%\Aftergraph\WarRoom\vault.json
```

Only ciphertext is persisted. Browser JavaScript receives configured state and typed decisions, never the key.

This is what **native integration** means in v1.5: Jev participates in the runtime control loop and state projection, while its credential remains an operating-system secret rather than application source.

## Authority invariant

```text
Jev decision != evidence
Jev decision != authority
Jev decision != execution permission
Jev decision != verified outcome
```

TypeSafe can route attention. Aftergraph policy, Runtime/WORKS and independent verification keep their separate authority.
