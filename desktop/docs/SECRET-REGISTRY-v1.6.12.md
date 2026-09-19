# AFTERGRAPH / WAR ROOM Desktop v1.6.12 — Secret Registry

## Purpose

The registry is the single source of truth for credentials that must be removed from logs and diagnostics. It does not own credential authorization or storage; those remain with the existing vault, connector, and session boundaries.

## Registered credential surfaces

| Registry ID | Durable vault key | Detection context |
|---|---|---|
| `github-token` | `github.token` | GitHub/gh token labels; `github_pat_`; `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` formats |
| `works-token` | `works.token` | WORKS token labels, including opaque values |
| `typesafe-api-key` | `typesafe.api_key` | TypeSafe API-key labels; `apikey_` format |
| `agent-bridge-token` | `agents.bridge_token` | Agent Bridge token labels, including the generated opaque token |
| `war-room-session` | — | `X-WarRoom-Session` / War Room session label contexts |
| `bearer-transport` | — | HTTP Bearer credentials |
| `generic-named-secret` | — | defensive `token`, `api key`, and `authorization` label fallback |

## Coverage invariant

`TestSecretRegistryCoversEveryVaultCredentialKeyUsedBySource` scans production Go files for direct vault `Get`, `Set`, and `Delete` calls. A new durable credential key therefore makes the suite fail until the secret registry is extended.

`TestSecretRegistryRedactionCorpus` exercises every currently supported credential family, including arbitrary opaque connector values where format-only detection is impossible.

## Boundary

No redactor can infer that an arbitrary unlabeled opaque string is a secret. War Room therefore guarantees coverage for recognizable registered token formats and for opaque credentials when they appear in registered credential-label contexts. Raw credentials must not be deliberately logged without their semantic label.

The registry is a log/diagnostic safety control only. It does not replace DPAPI storage, Trust Gateway authority, connector authentication, session admission, or repository secret scanning.
