# Native Aftergraph Assistant — v1.6

## Role

The assistant is the conversational lens over War Room system reality. It is not an execution principal, verifier or policy authority.

## Grounded core

Deterministic handlers answer common operational questions from structured state: GitHub, CI, repositories, services, Agent Fabric, TypeSafe/Jev and Operational Intelligence. Responses can include structured objects and safe UI actions (`view`, `focus`, `url`).

## Optional local model

When enabled and observed at the configured Ollama endpoint, a local model may synthesize prose for questions not handled by the deterministic core. The prompt contains a bounded JSON context and explicit instructions to state when information is unobserved.

Local-model output is advisory and receives lower confidence than deterministic grounded responses.

## Safety / authority

The assistant cannot:

- grant authority,
- execute shell/GitHub/WORKS actions,
- mutate canonical state,
- mark work verified,
- treat Jev confidence as evidence.

Consequential actions must continue through canonical Runtime/WORKS/authority/evidence flows outside this assistant surface.
