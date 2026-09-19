# Local API

The app binds to `127.0.0.1` and chooses port `37621` through `37630`, then an ephemeral port if necessary.

Since v1.6.11 the HTTP boundary is fail-closed: the request `Host` must be the exact bound `127.0.0.1:<numeric-port>` authority. If an `Origin` header is present, it must be a single `http://` origin with the exact same authority and no userinfo, path, query, or fragment. Invalid Host/Origin requests receive HTTP 403 before API/static routing, including `/api/session`.

This is a single-user local desktop boundary, not remote or multi-user authentication. Mutation routes still additionally require the ephemeral `X-WarRoom-Session` capability.

## Read
- `GET /api/health`
- `GET /api/summary`
- `GET /api/settings`
- `GET /api/metrics`
- `GET /api/github/connection`
- `GET /api/stream` (SSE)

## Mutations
Mutation calls require the ephemeral `X-WarRoom-Session` header obtained from `GET /api/session` in the same local browser session.

- `POST /api/github/sync`
- `POST /api/github/connection`
- `DELETE /api/github/connection`
- `PUT /api/settings`
- `POST /api/metrics`
- `POST /api/probes/run`
- `POST /api/shutdown`

Example metric:
```json
{
  "name": "VSR",
  "value": 0.84,
  "unit": "ratio",
  "domain": "Execution & Runtime",
  "source": "MISSION-Bench",
  "evidence": "receipt://study-008/condition-g",
  "observedAt": "2026-09-18T20:00:00Z"
}
```
