"""Unit tests for mathematical metric calculations."""

import pytest
from salkg.metrics import AlignmentEvaluator, ClassificationEvaluator, calculate_prf
from salkg.input_schema import AlignmentResult, CandidateMatch, GoldAnnotation, LectureData, LectureMetadata


def test_calculate_prf_values():
    # 8 TP, 2 FP, 0 FN -> P = 8/10 = 0.8, R = 8/8 = 1.0, F1 = 1.6 / 1.8 = 0.8889
    p, r, f1 = calculate_prf(8, 2, 0)
    assert p == 0.8
    assert r == 1.0
    assert abs(f1 - 0.8889) < 1e-3

    # Zero cases
    p0, r0, f1_0 = calculate_prf(0, 0, 0)
    assert p0 == 0.0 and r0 == 0.0 and f1_0 == 0.0


def test_alignment_evaluator_metrics():
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_m"),
        segments=[],
        visual_events=[],
        gold=GoldAnnotation(
            alignment_pairs=[
                {"transcript_id": "s1", "visual_id": "v1"},
                {"transcript_id": "s2", "visual_id": "v2"},
            ]
        )
    )

    result = AlignmentResult(
        lecture_id="test_m",
        method_name="test_method",
        matches=[
            CandidateMatch("s1", "v1", status="accepted"),  # TP
            CandidateMatch("s2", "v_wrong", status="accepted"),  # FP (v_wrong != v2) -> also FN for v2
        ],
        total_segments=2,
        matched_segments=2,
        coverage=1.0,
    )

    metrics = AlignmentEvaluator.evaluate(result, lecture)
    assert metrics["tp"] == 1
    assert metrics["fp"] == 1
    assert metrics["fn"] == 1
    assert metrics["precision"] == 0.5
    assert metrics["recall"] == 0.5
    assert metrics["f1"] == 0.5


def test_classification_evaluator():
    predictions = [
        {"lecture_id": "l1", "predicted": "mathematics", "true": "mathematics"},
        {"lecture_id": "l2", "predicted": "programming", "true": "programming"},
        {"lecture_id": "l3", "predicted": "mathematics", "true": "programming"},  # Error
    ]
    res = ClassificationEvaluator.evaluate(predictions)
    # 2 correct out of 3 = 0.6667
    assert abs(res["accuracy"] - 0.6667) < 1e-3
    assert res["macro_f1"] > 0.5
    assert "confusion_matrix" in res
