# AFTERGRAPH / WAR ROOM Desktop v1.6.11 — Reproducibility Report

## Verdict

`desktop-v1.6.11` is bit-for-bit reproducible on an independent Windows builder when the checkout bytes match the released Windows source manifest.

- released source commit: `2d872067a4c866b60ffe205cc609089d72978bdb`
- release workflow: `35423444087` — PASS
- published EXE: `7,982,592` bytes
- published EXE SHA-256: `16382969514446446f291101eb08ca5292dfd4ad77cbf9f52e5baa4eece42d3a`
- independent Lenovo build: `7,982,592` bytes
- independent Lenovo SHA-256: `16382969514446446f291101eb08ca5292dfd4ad77cbf9f52e5baa4eece42d3a`
- binary equality: **PASS**

This closes `WR-REL-004` for the v1.6.11 release line.

## Independent builder

The reproduction was performed outside the GitHub Actions release runner on the Lenovo Windows target using a fresh clone, a separately downloaded official Go toolchain, and the exact tagged source commit.

Toolchain:

- Go: `go1.26.8 windows/amd64`
- official Go archive: `go1.26.8.windows-amd64.zip`
- archive SHA-256: `b92c3b2adae85a11ba71fe7216daf0d84e82af4c8ab6c5625807f28622043a59`
- `GOOS=windows`
- `GOARCH=amd64`
- `CGO_ENABLED=1`
- `GOAMD64=v1`

Source identity:

- fresh repository clone
- `core.autocrlf=true`
- detached checkout of `2d872067a4c866b60ffe205cc609089d72978bdb`
- clean working tree before build
- published `BUILD-MANIFEST.json`: **112 files checked, 0 mismatches**

Build command semantics matched the release workflow:

`go build -trimpath -ldflags="-H=windowsgui -s -w -X main.version=1.6.11" -o dist/Aftergraph-War-Room.exe .`

## Delivered release comparison

The published v1.6.11 release had already been independently read back from GitHub:

- standalone EXE SHA-256: `16382969514446446f291101eb08ca5292dfd4ad77cbf9f52e5baa4eece42d3a`
- ZIP SHA-256: `af05a2c77d6c3fb1e0d1a92473069f15d75b7bf1d56e07ae3840faafae53883b`
- published manifest SHA-256: `e40eac3d69830bd7c24a5bcd558ab44281ec3cd0d045fe9316e0d13ec1a08ee9`
- ZIP-internal EXE matched the standalone EXE and manifest executable hash
- ZIP-internal manifest was byte-identical to the published manifest
- manifest `sourceCommit` bound the artifact to `2d872067a4c866b60ffe205cc609089d72978bdb`

## Important checkout-byte dependency

A first independent clone using LF-normalized checkout bytes did **not** reproduce the release artifact. Comparison against the published v1.6.11 source manifest showed 111/112 source-file mismatches, overwhelmingly explained by line-ending normalization.

A fresh Windows checkout with `core.autocrlf=true` produced:

- 112/112 source-manifest entries matching
- the exact published executable size
- the exact published executable SHA-256

Therefore the v1.6.11 artifact is reproducible, but reproducing this historical release requires the Windows-normalized checkout bytes recorded by its release manifest. PR #9 subsequently hardened release-metadata determinism for future states; that follow-up does not alter the immutable v1.6.11 tag.

## Boundary

This proof establishes reproducibility of the unsigned executable. It does not claim Authenticode signing, updater safety, accessibility validation, connected-resource soak completion, or physical-touch validation. Those remain separately tracked controls.
