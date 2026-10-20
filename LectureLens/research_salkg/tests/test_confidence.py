"""Unit tests for confidence calibration and selective prediction."""

import pytest
from salkg.confidence import ConfidenceCalibrator, SelectiveAlignmentFilter
from salkg.input_schema import AlignmentResult, CandidateMatch


def test_confidence_calibration():
    calibrator = ConfidenceCalibrator(alpha=4.0, beta=2.0, gamma=-2.0)
    # High score and high margin gives high probability
    p_high = calibrator.calibrate(0.85, 0.25)
    assert p_high > 0.80

    # Low score and low margin gives low probability
    p_low = calibrator.calibrate(0.20, 0.01)
    assert p_low < 0.30


def test_selective_alignment_filter():
    filter_mod = SelectiveAlignmentFilter(
        acceptance_threshold=0.45,
        review_threshold=0.60,
        margin_threshold=0.08,
    )

    matches = [
        CandidateMatch("s1", "v1", raw_composite_score=0.80, margin=0.20),  # Accepted
        CandidateMatch("s2", "v2", raw_composite_score=0.50, margin=0.02),  # Review (low margin)
        CandidateMatch("s3", "v3", raw_composite_score=0.25, margin=0.01),  # Rejected (low score)
    ]
    raw_result = AlignmentResult("lec1", "test", matches, 3, 3, 1.0)

    filtered, stats = filter_mod.filter_alignment(raw_result)
    assert stats["accepted"] == 1
    assert stats["review"] == 1
    assert stats["rejected"] == 1

    assert filtered.matches[0].status == "accepted"
    assert filtered.matches[1].status == "review"
    assert filtered.matches[2].status == "rejected"
