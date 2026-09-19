# AFTERGRAPH / WAR ROOM Desktop — Configuration Contract

This document is the canonical human-readable configuration reference for the desktop line. Runtime settings are persisted as a versioned `aftergraph.war-room.state` envelope in `%LOCALAPPDATA%\Aftergraph\WarRoom\settings.json` on Windows. Secrets are not settings and must never be committed.

## Runtime settings

| Field | Type | Default | Validation / semantics |
|---|---|---:|---|
| `githubOrg` | string | `Aftergraph` | Required, non-empty. Organization used for GitHub reconciliation. |
| `refreshSeconds` | integer | `60` | Clamped to minimum 60 seconds. |
| `workflowRepoCap` | integer | `33` | Clamped to 1..60. Limits workflow reconciliation scope. |
| `probes` | array | aftergraph.org + docs.aftergraph.org | Each item: `id`, `name`, `url`, `domain`, `enabled`. |
| `repoDomains` | object | `{}` | Optional repo-name -> domain override map. |
| `typeSafeAuto` | boolean | `true` | Enables bounded automatic TypeSafe/Jev evaluation. |
| `typeSafeMinIntervalSec` | integer | `300` | Minimum 60 seconds. |
| `typeSafeDailyBudget` | integer | `60` | Clamped to 1..1000 provider evaluations/day. |
| `worksEnabled` | boolean | `false` | Enables read-only WORKS SSE projection after a valid endpoint is configured. |
| `worksUrl` | string | empty | Must be HTTP(S) when configured. |
| `agentStaleSeconds` | integer | `45` | Clamped to 15..3600. Controls observed-presence expiry. |
| `assistantLocalModel` | boolean | `true` | Allows optional local Ollama synthesis. Grounded core remains available independently. |
| `assistantOllamaUrl` | string | `http://127.0.0.1:11434` | Local model base URL. Empty input is reset to default. |
| `assistantModel` | string | empty | Optional local Ollama model name. |

`config/settings.example.json` mirrors these defaults for documentation/tooling only. The runtime remains authoritative and validates/clamps values before durable publication.

## Secret configuration

| Secret | Preferred source | Alternate source | Storage/notes |
|---|---|---|---|
| GitHub token | Connections UI / local API | none | Windows DPAPI current-user scope in `vault.json`; plaintext is never returned after submission. |
| TypeSafe API key | Connections UI / local API | `TYPESAFE_API_KEY` | DPAPI when stored in vault; environment fallback is intended for controlled deployments. |
| WORKS token | Connections UI / local API | none | DPAPI current-user scope. |
| Agent Bridge token | generated/rotated locally | none | DPAPI current-user scope; reveal requires current War Room session. |

Never place secrets in `settings.json`, `config/settings.example.json`, GitHub Actions YAML, source code, screenshots, release notes, or test fixtures.

## Environment variables

### Supported runtime/deployment controls
- `LOCALAPPDATA` — Windows base directory. Runtime appends `Aftergraph\WarRoom`. Non-Windows fallback is `$HOME/.aftergraph/Aftergraph/WarRoom`.
- `TYPESAFE_API_KEY` — optional controlled-deployment fallback for TypeSafe/Jev.
- `WAR_ROOM_NO_BROWSER=1` — start backend without launching the app-mode browser window; used by automation and smoke tests.
- `AFTERGRAPH_NO_BROWSER=1` — compatibility/no-browser path used by the non-Windows browser shim.

### Test-only variables — never production configuration
- `WARROOM_CRASH_HELPER`, `WARROOM_CRASH_DIR`, `WARROOM_CRASH_PHASE` — persistence crash/fault harness.
- `WAR_ROOM_PROCESS_HELPER`, `WAR_ROOM_PROCESS_BASE` — child-process lifecycle test harness.

## Runtime files

Under `%LOCALAPPDATA%\Aftergraph\WarRoom\`:
- `settings.json` + `.bak` — versioned settings state.
- `github-snapshot.json` + `.bak` — reconciled GitHub projection.
- `metrics.json` + `.bak` — observed metric ledger.
- `probes.json` + `.bak` — probe results.
- `agents.json` + `.bak` — observed Agent Bridge/WORKS projection.
- `.persistence-journal.json` — transient durable-write journal; invalid journals are quarantined, not trusted.
- `vault.json` — encrypted DPAPI ciphertext map on Windows.
- `war-room.log` + rotated backups — bounded/redacted operational log.

## Build/release controls

- `VERSION` — release version embedded through Go ldflags; defaults to the version declared by `scripts/build-release.sh`.
- `MIN_RELEASE_GO` — compiler floor; defaults to `1.25.13` in v1.6.10. Raising this value is allowed; lowering it requires an explicit security review and changelog entry.

Release builds must also have `staticcheck` and `govulncheck` available on PATH.
