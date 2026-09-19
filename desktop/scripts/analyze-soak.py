#!/usr/bin/env python3
"""Analyze native War Room soak evidence without declaring release closure.

The analyzer verifies provenance/completeness, connector liveness, collection quality,
and resource trends. It emits deterministic evidence and flags; it deliberately does
not convert trend heuristics into a WR-QA-001 PASS.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

SCHEMA = "aftergraph.war-room.desktop.soak-analysis/1.0"
RECEIPT_SCHEMA = "aftergraph.war-room.desktop.soak-receipt/1.0"
MIN_DURATION_SEC = 2 * 60 * 60
EXPECTED_INTERVAL_SEC = 30
MAX_GAP_MULTIPLIER = 2.5

RESOURCE_FIELDS = (
    "workingSetBytes",
    "privateBytes",
    "goHeapBytes",
    "handleCount",
    "threadCount",
)


class EvidenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class Sample:
    raw: dict[str, Any]

    @property
    def elapsed(self) -> float:
        return float(self.raw["elapsedSec"])


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EvidenceError(f"cannot read JSON {path}: {exc}") from exc


def load_ndjson(path: Path) -> tuple[list[Sample], list[dict[str, Any]]]:
    valid: list[Sample] = []
    errors: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError as exc:
        raise EvidenceError(f"cannot read NDJSON {path}: {exc}") from exc
    for line_no, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise EvidenceError(f"invalid NDJSON line {line_no}: {exc}") from exc
        if "error" in row:
            errors.append(row)
            continue
        required = {"elapsedSec", *RESOURCE_FIELDS}
        missing = sorted(required - row.keys())
        if missing:
            raise EvidenceError(f"sample line {line_no} missing fields: {', '.join(missing)}")
        valid.append(Sample(row))
    if not valid:
        raise EvidenceError("no valid soak samples")
    valid.sort(key=lambda s: s.elapsed)
    return valid, errors


def quantile_slice(values: list[float], first: bool) -> list[float]:
    if not values:
        return []
    n = max(1, math.ceil(len(values) / 4))
    return values[:n] if first else values[-n:]


def linear_slope_per_hour(samples: list[Sample], field: str) -> float:
    xs = [s.elapsed / 3600.0 for s in samples]
    ys = [float(s.raw[field]) for s in samples]
    if len(xs) < 2:
        return 0.0
    xbar = statistics.fmean(xs)
    ybar = statistics.fmean(ys)
    denom = sum((x - xbar) ** 2 for x in xs)
    if denom == 0:
        return 0.0
    return sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys)) / denom


def consecutive_growth_fraction(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    growth = sum(1 for a, b in zip(values, values[1:]) if b > a)
    return growth / (len(values) - 1)


def summarize_resource(samples: list[Sample], field: str) -> dict[str, Any]:
    values = [float(s.raw[field]) for s in samples]
    first_q = quantile_slice(values, True)
    last_q = quantile_slice(values, False)
    first_med = statistics.median(first_q)
    last_med = statistics.median(last_q)
    overall_med = statistics.median(values)
    delta = last_med - first_med
    return {
        "first": values[0],
        "last": values[-1],
        "min": min(values),
        "max": max(values),
        "median": overall_med,
        "firstQuartileMedian": first_med,
        "lastQuartileMedian": last_med,
        "quartileMedianDelta": delta,
        "quartileMedianDeltaPctOfMedian": (delta / overall_med * 100.0) if overall_med else None,
        "linearSlopePerHour": linear_slope_per_hour(samples, field),
        "consecutiveGrowthFraction": consecutive_growth_fraction(values),
    }


def elapsed_gaps(samples: list[Sample]) -> list[float]:
    return [b.elapsed - a.elapsed for a, b in zip(samples, samples[1:])]


def nonlive_rows(samples: Iterable[Sample]) -> list[dict[str, Any]]:
    bad: list[dict[str, Any]] = []
    for s in samples:
        r = s.raw
        reasons: list[str] = []
        if r.get("githubSource") != "GitHub REST API" or r.get("githubAuthenticated") is not True:
            reasons.append("github")
        if r.get("worksConfigured") is not True or r.get("worksEnabled") is not True or r.get("worksSourceStatus") != "live":
            reasons.append("works")
        if r.get("bridgeSourceStatus") != "live":
            reasons.append("agent-bridge")
        if int(r.get("agentsStale") or 0) != 0:
            reasons.append("stale-agents")
        if reasons:
            bad.append({"sample": r.get("sample"), "elapsedSec": r.get("elapsedSec"), "reasons": reasons})
    return bad


def reconnect_summary(samples: list[Sample]) -> dict[str, Any]:
    transitions = 0
    connecting_samples = 0
    max_recovery = 0
    error_classes: set[str] = set()
    previous_state: str | None = None
    for s in samples:
        raw = s.raw
        states = raw.get("connectorStates") or {}
        github = states.get("github") or {}
        state = github.get("state")
        if state == "connecting":
            connecting_samples += 1
        if previous_state is not None and state != previous_state:
            transitions += 1
        if state:
            previous_state = state
        recovery = github.get("lastRecoveryMs")
        if isinstance(recovery, (int, float)):
            max_recovery = max(max_recovery, int(recovery))
        err = raw.get("githubLastErrorClass")
        if err:
            error_classes.add(str(err))
    return {
        "stateTransitions": transitions,
        "connectingSamples": connecting_samples,
        "maxObservedRecoveryMs": max_recovery,
        "errorClasses": sorted(error_classes),
    }


def analyze(
    receipt: dict[str, Any],
    samples: list[Sample],
    row_errors: list[dict[str, Any]],
    expected_commit: str | None,
    expected_sha256: str | None,
) -> dict[str, Any]:
    if receipt.get("schema") != RECEIPT_SCHEMA:
        raise EvidenceError(f"unexpected receipt schema: {receipt.get('schema')!r}")
    if expected_commit and receipt.get("sourceCommit") != expected_commit:
        raise EvidenceError("receipt sourceCommit does not match expected commit")
    if expected_sha256 and str(receipt.get("appSha256", "")).lower() != expected_sha256.lower():
        raise EvidenceError("receipt appSha256 does not match expected SHA-256")

    duration = float(receipt.get("durationSec") or 0)
    receipt_errors = int(receipt.get("collectionErrors") or 0)
    receipt_nonlive = int(receipt.get("sourceNonLiveSamples") or 0)
    bad_liveness = nonlive_rows(samples)
    gaps = elapsed_gaps(samples)
    max_gap = max(gaps) if gaps else 0.0

    completeness = {
        "durationAtLeast2h": duration >= MIN_DURATION_SEC,
        "receiptCollectionErrorsZero": receipt_errors == 0,
        "ndjsonErrorRowsZero": len(row_errors) == 0,
        "receiptSourceNonLiveSamplesZero": receipt_nonlive == 0,
        "recomputedSourceNonLiveSamplesZero": len(bad_liveness) == 0,
        "sampleCountMatchesReceipt": int(receipt.get("validSamples") or -1) == len(samples),
        "maxSampleGapWithinTolerance": max_gap <= EXPECTED_INTERVAL_SEC * MAX_GAP_MULTIPLIER,
    }
    evidence_complete = all(completeness.values())

    resources = {field: summarize_resource(samples, field) for field in RESOURCE_FIELDS}
    reconnects = reconnect_summary(samples)

    # Heuristics are flags for review, not a closure verdict.
    trend_flags: list[str] = []
    for field, summary in resources.items():
        delta_pct = summary["quartileMedianDeltaPctOfMedian"]
        growth_fraction = summary["consecutiveGrowthFraction"]
        slope = summary["linearSlopePerHour"]
        if delta_pct is not None and delta_pct > 20 and growth_fraction > 0.60 and slope > 0:
            trend_flags.append(
                f"{field}: sustained-growth signal (last-vs-first quartile median {delta_pct:.1f}%, "
                f"growth fraction {growth_fraction:.2f}, slope/hour {slope:.2f})"
            )
    if reconnects["connectingSamples"] > max(3, len(samples) // 10):
        trend_flags.append("github: frequent connecting-state samples require reconnect review")
    if reconnects["errorClasses"]:
        trend_flags.append("github: provider error classes observed")

    return {
        "schema": SCHEMA,
        "targetVersion": receipt.get("targetVersion"),
        "sourceCommit": receipt.get("sourceCommit"),
        "appSha256": receipt.get("appSha256"),
        "durationSec": duration,
        "sampleIntervalSec": receipt.get("intervalSec"),
        "validSamples": len(samples),
        "completeness": completeness,
        "evidenceComplete": evidence_complete,
        "maxSampleGapSec": max_gap,
        "ndjsonErrorRows": row_errors,
        "recomputedNonLiveRows": bad_liveness[:50],
        "recomputedNonLiveRowCount": len(bad_liveness),
        "resources": resources,
        "githubReconnects": reconnects,
        "trendFlags": trend_flags,
        "requiresTrendReview": True,
        "closureVerdict": "NOT_EMITTED",
        "note": (
            "This analyzer verifies evidence completeness and exposes resource/reconnect trends. "
            "WR-QA-001 closure requires exact-state review of these results; trend heuristics do not auto-close the risk."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--samples", required=True, type=Path)
    parser.add_argument("--expected-commit")
    parser.add_argument("--expected-sha256")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    try:
        receipt = load_json(args.receipt)
        samples, row_errors = load_ndjson(args.samples)
        result = analyze(receipt, samples, row_errors, args.expected_commit, args.expected_sha256)
    except EvidenceError as exc:
        print(json.dumps({"schema": SCHEMA, "error": str(exc)}, indent=2))
        return 2

    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.write_text(encoded, encoding="utf-8", newline="\n")
    print(encoded, end="")
    return 0 if result["evidenceComplete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
