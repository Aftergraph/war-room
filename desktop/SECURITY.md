# Security policy — War Room Desktop

## Supported line

Only the latest GitHub-released `desktop-vX.Y.Z` version is considered supported. Locally generated/chat-distributed binaries are not official releases.

## Release security gates

Every official desktop release must pass the exact-binary `govulncheck` gate, secret scan, current toolchain floor, and risk-register review. A later finding that violates a mandatory gate marks the affected version superseded/blocked.

## Reporting

Use the canonical `Aftergraph/war-room` repository's private vulnerability reporting / Security Advisory flow when available. Do not place credentials, exploit secrets, or reusable tokens in public issues.

## Credential boundary

GitHub, TypeSafe, WORKS, and Agent Bridge secrets must never be committed. Windows persistent secrets use DPAPI current-user protection in the local vault. See `docs/CREDENTIALS.md` and `docs/CONFIGURATION.md`.
