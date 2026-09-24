#!/usr/bin/env python3
"""Run the Local AI v0.2 synthetic-prior calibration benchmark.

This is an operator-local, aggregate-only benchmark. It does not create human
labels, does not claim accuracy/ground truth, does not touch Preview/Production,
and does not activate the live app's Local AI path.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from helpers_v02 import (
    APPROVED_SNAPSHOT_ID,
    DEPTH_SCORE_THRESHOLD,
    EXPECTED_PHYSICAL_ROWS,
    EXPECTED_UNIQUE_PAIRS,
    EXPECTED_WORKBOOK_SHA256,
    FAST_TRACK_THRESHOLD,
    HUMAN_LABEL_GATE_STATUS,
    LOCAL_AI_ROOT,
    METRIC_AGREEMENT,
    POLICY_VERSION,
    QWEN_STATUS,
    agreement_with_synthetic_prior,
    count_distribution,
    decide,
    embedding_health,
    percentile,
    score_pair,
    threshold_band,
    verify_workbook_hash,
    HashMismatchError,
)
from poc_bge_m3 import (
    PocBlocked,
    _ensure_dirs,
    _rss_bytes,
    collect_preflight,
    dedupe_unique_pairs,
    embed_texts,
    load_embedder,
    load_workbook_rows,
)

THRESHOLD_SWEEP = (0.35, 0.38, 0.40, 0.45)


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _rate(records: list[dict[str, Any]], category: str, verdict: str) -> float | None:
    selected = [row for row in records if row["category"] == category]
    if not selected:
        return None
    return sum(row["verdict"] == verdict for row in selected) / len(selected)


def summarize_policy(records: list[dict[str, Any]]) -> dict[str, Any]:
    verdicts = [str(row["verdict"]) for row in records]
    labels = [str(row["synthetic_label"]) for row in records]
    non_onboarding = [row for row in records if row["category"] != "ONBOARDING"]
    critical = {
        "ai_styled_review_rate": _rate(records, "AI_STYLED", "REVIEW"),
        "spam_abuse_reject_rate": _rate(records, "SPAM_ABUSE", "REJECT"),
        "onboarding_pass_rate": _rate(records, "ONBOARDING", "PASS"),
    }
    target_checks = {
        "ai_styled_review_rate_gte_0_80": (
            critical["ai_styled_review_rate"] is not None
            and critical["ai_styled_review_rate"] >= 0.80
        ),
        "spam_abuse_reject_rate_gte_0_90": (
            critical["spam_abuse_reject_rate"] is not None
            and critical["spam_abuse_reject_rate"] >= 0.90
        ),
        "onboarding_pass_rate_eq_1_00": critical["onboarding_pass_rate"] == 1.0,
    }
    return {
        "overall": agreement_with_synthetic_prior(verdicts, labels),
        "non_onboarding": agreement_with_synthetic_prior(
            [str(row["verdict"]) for row in non_onboarding],
            [str(row["synthetic_label"]) for row in non_onboarding],
        ),
        "critical_category_rates": critical,
        "candidate_target_checks": target_checks,
        "policy_candidate": all(target_checks.values()),
        "verdict_counts": count_distribution(verdicts),
        "path_counts": count_distribution(str(row["path"]) for row in records),
    }


def build_threshold_sweep(base_records: list[dict[str, Any]]) -> dict[str, Any]:
    sweep: dict[str, Any] = {}
    for threshold in THRESHOLD_SWEEP:
        evaluated: list[dict[str, Any]] = []
        for row in base_records:
            if row["category"] == "ONBOARDING":
                verdict, path = "PASS", "ONBOARDING_PASS"
            else:
                decision = decide(
                    float(row["score"]),
                    int(row["features"]["answer_length"]),
                    row["features"],
                    threshold=threshold,
                )
                verdict, path = decision.verdict, decision.path
            evaluated.append(
                {
                    "category": row["category"],
                    "synthetic_label": row["synthetic_label"],
                    "verdict": verdict,
                    "path": path,
                }
            )
        sweep[f"{threshold:.2f}"] = summarize_policy(evaluated)
    return sweep


def run_calibration(workbook_path: str, out_dir: Path) -> dict[str, Any]:
    if not workbook_path or not Path(workbook_path).is_file():
        raise PocBlocked("BLOCKED_INPUT_FILE_NOT_FOUND", "operator-local workbook path missing")
    try:
        workbook_hash = verify_workbook_hash(workbook_path, EXPECTED_WORKBOOK_SHA256)
    except HashMismatchError as exc:
        raise PocBlocked("BLOCKED_INPUT_HASH_MISMATCH", f"observed_sha256={exc.observed}") from None

    paths = _ensure_dirs()
    preflight = collect_preflight()
    if not preflight["sentence_transformers"]["present"] or not preflight["torch"]["present"]:
        raise PocBlocked("BLOCKED_RUNTIME", "embedding_runtime_absent")

    rows, workbook_meta = load_workbook_rows(workbook_path)
    unique_rows = dedupe_unique_pairs(rows)
    model, model_meta = load_embedder(paths["cache"], paths["models"])

    records: list[dict[str, Any]] = []
    embeddings: list[list[float]] = []
    latencies: list[float] = []
    failures = 0
    rss_before = _rss_bytes()

    for row in unique_rows:
        try:
            started = time.perf_counter()
            question_embedding, answer_embedding = embed_texts(
                model, [row.question, row.answer], batch_size=2
            )
            latencies.append((time.perf_counter() - started) * 1000)
            result = score_pair(
                row.question,
                row.answer,
                question_embedding,
                answer_embedding,
                product_context="ONBOARDING" if row.category == "ONBOARDING" else None,
            )
            records.append(
                {
                    "category": row.category,
                    "synthetic_label": row.recommended_label,
                    "score": result["depth_score"],
                    "verdict": result["verdict"],
                    "path": result["path"],
                    "features": result["features"],
                }
            )
            embeddings.append(answer_embedding)
        except Exception:
            failures += 1

    rss_after = _rss_bytes()
    health = embedding_health(embeddings)
    latencies_sorted = sorted(latencies)
    p95 = percentile(latencies_sorted, 95)
    policy_summary = summarize_policy(records)
    threshold_sweep = build_threshold_sweep(records)

    technical_issues: list[str] = []
    if not records:
        technical_issues.append("zero_successful_pairs")
    if failures:
        technical_issues.append("pair_failures_present")
    if not health["dim_ok"]:
        technical_issues.append("embedding_dim_mismatch")
    if health["nan_count"] or health["inf_count"]:
        technical_issues.append("nan_or_inf_in_embeddings")
    if p95 is not None and p95 > 1200:
        technical_issues.append("p95_latency_gt_1200ms")
    if workbook_meta["physical_rows"] != EXPECTED_PHYSICAL_ROWS:
        technical_issues.append("physical_row_count_unexpected")
    if workbook_meta["unique_pairs"] != EXPECTED_UNIQUE_PAIRS:
        technical_issues.append("unique_pair_count_unexpected")

    if technical_issues:
        verdict = "V0_2_TECHNICAL_OR_INPUT_ISSUES"
    elif policy_summary["policy_candidate"]:
        verdict = "V0_2_SYNTHETIC_PRIOR_CANDIDATE"
    else:
        verdict = "V0_2_NEEDS_TUNING"

    by_category: dict[str, dict[str, Any]] = {}
    for category in sorted({str(row["category"]) for row in records}):
        group = [row for row in records if row["category"] == category]
        scores = sorted(float(row["score"]) for row in group)
        by_category[category] = {
            "n": len(group),
            "score_mean": round(sum(scores) / len(scores), 6) if scores else None,
            "score_p50": percentile(scores, 50),
            "score_p95": percentile(scores, 95),
            "verdict_counts": count_distribution(str(row["verdict"]) for row in group),
            "path_counts": count_distribution(str(row["path"]) for row in group),
        }

    report = {
        "schema_version": "local-ai-v0.2-calibration-v1",
        "generated_at_utc": _utc_now(),
        "verdict": verdict,
        "policy_version": POLICY_VERSION,
        "alpha_readiness": "NOT_CLAIMED",
        "production_scoring": "UNTOUCHED_MOCK_ACTIVE",
        "shadow_mode": "NOT_WIRED",
        "human_label_gate": HUMAN_LABEL_GATE_STATUS,
        "qwen_status": QWEN_STATUS,
        "snapshot": {
            "approved_snapshot_id": APPROVED_SNAPSHOT_ID,
            "workbook_sha256": workbook_hash,
            "hash_matched": True,
        },
        "dataset": {
            **workbook_meta,
            "unique_pairs_scored": len(records),
            "unique_pair_failures": failures,
        },
        "model": model_meta,
        "embedding_health": health,
        "latency_ms": {
            "n": len(latencies_sorted),
            "p50": percentile(latencies_sorted, 50),
            "p95": p95,
            "mean": round(sum(latencies_sorted) / len(latencies_sorted), 3)
            if latencies_sorted
            else None,
        },
        "resources": {
            "rss_before_bytes": rss_before,
            "rss_after_bytes": rss_after,
            "rss_delta_bytes": rss_after - rss_before,
        },
        "canonical_threshold": DEPTH_SCORE_THRESHOLD,
        "fast_track_threshold": FAST_TRACK_THRESHOLD,
        "policy_summary": policy_summary,
        "threshold_sweep": threshold_sweep,
        "by_category": by_category,
        "technical_issues": technical_issues,
        "redaction": {
            "raw_qa_text": "omitted",
            "embeddings": "omitted",
            "row_ids": "omitted",
            "pair_keys": "omitted",
            "secrets": "omitted",
        },
        "notes": [
            "Synthetic design prior only; never report these metrics as human accuracy or ground truth.",
            "Founder waived human review procedurally; the waiver does not validate model quality.",
            "ONBOARDING is a product bypass and is not treated as a depth-model success.",
            "Qwen remains inactive. The live app remains on mock-local-heuristic-v0.0.",
        ],
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = out_dir / f"local_ai_v0_2_calibration_{stamp}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=True, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    report["report_path"] = str(out_path)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workbook",
        default=os.environ.get("UNSTANDARD_LABELING_WORKBOOK_PATH", ""),
    )
    parser.add_argument(
        "--out",
        default=os.environ.get(
            "UNSTANDARD_LOCAL_AI_V02_OUT", str(Path(LOCAL_AI_ROOT) / "reports")
        ),
    )
    args = parser.parse_args()

    try:
        report = run_calibration(args.workbook, Path(args.out))
    except PocBlocked as blocked:
        print(json.dumps({"verdict": blocked.code, "detail": blocked.detail}, ensure_ascii=False))
        return 2

    print(f"verdict={report['verdict']}")
    print(f"policy_version={report['policy_version']}")
    print(f"report_path={report['report_path']}")
    policy = report["policy_summary"]
    overall = policy["overall"]
    print(f"{METRIC_AGREEMENT}={overall.get('rate')} n={overall.get('n')}")
    print(f"candidate_target_checks={policy['candidate_target_checks']}")
    print(f"human_label_gate={report['human_label_gate']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
