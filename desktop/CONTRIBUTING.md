# Contributing — War Room Desktop

The desktop line follows evidence-first stabilization rules.

## Source of truth

Canonical source is `Aftergraph/war-room/desktop`. Do not maintain a competing standalone War Room repository or treat local ZIPs as canonical history.

## Before opening a PR

Run the source gates in `scripts/build-release.sh` where possible. Update `CHANGELOG.md` for user/release-visible changes. Update the configuration contract when settings/env/defaults change. Add or revise a weakness/risk entry when a change introduces, closes, or defers a known limitation.

## Evidence language

- observed != inferred
- model output != evidence
- completion != verification
- UI projection != authority
- unavailable test/tool != PASS

## Release changes

Release PRs must follow `docs/RELEASE-POLICY.md` and the GitHub release template. Do not commit production credentials or release binaries into the source tree.
