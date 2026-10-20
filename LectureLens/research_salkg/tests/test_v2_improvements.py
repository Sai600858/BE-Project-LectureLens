"""Tests for v2 correctness, accuracy, and performance improvements in SALKG."""

import pytest
from salkg.confidence import ConfidenceCalibrator, SelectiveAlignmentFilter
from salkg.input_schema import CandidateMatch, LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.sequence_optimizer import SequenceAlignmentOptimizer
from salkg.similarity import (
    TFIDFScorer,
    compute_symbol_overlap,
    extract_math_symbols,
)
from salkg.subject_classifier import SubjectClassifier
from salkg.temporal_scoring import compute_adaptive_taus, interval_aware_temporal_compatibility


def test_similarity_trivial_math_vars_filtered():
    """Trivial single letter english words should be filtered from math symbols."""
    text = "Here is a note on variable a and variable i"
    symbols = extract_math_symbols(text)
    assert "a" not in symbols
    assert "i" not in symbols


def test_similarity_latex_weighted_jaccard():
    """LaTeX macros should carry 3x weight compared to plain single letters."""
    latex_text = "\\int f(x) dx = \\frac{1}{2}"
    plain_text = "x + y = z"
    # Overlap between identical latex formulas should be 1.0
    assert compute_symbol_overlap(latex_text, latex_text) == 1.0
    # Weighted overlap calculation behaves properly
    overlap = compute_symbol_overlap(latex_text, "\\int g(x) dx")
    assert overlap > 0.4


def test_similarity_bm25_tfidf():
    """TFIDFScorer should compute BM25 normalized vectors."""
    docs = [
        "quick brown fox jumps over lazy dog",
        "deep neural networks for computer vision and speech recognition",
        "quick algorithms and binary search on arrays",
    ]
    scorer = TFIDFScorer().fit(docs)
    vec = scorer.transform("quick algorithms")
    assert len(vec) > 0
    # Vector should be L2 normalized (length approximately 1.0)
    norm = sum(v * v for v in vec.values()) ** 0.5
    assert abs(norm - 1.0) < 1e-4


def test_subject_classifier_code_pattern_regex():
    """Code patterns starting with raw regex \\b should match correctly."""
    classifier = SubjectClassifier()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="prog_lec"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "We define a helper function."),
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "code_snippet", "def compute_sum(a, b): return a + b", code_content="def compute_sum(a, b): return a + b")
        ]
    )
    res = classifier.classify(lecture)
    assert res["assigned_subject"] == "programming"
    assert "mixture_weights" in res
    assert res["mixture_weights"]["programming"] > 0.0


def test_temporal_scoring_long_slide_saturation_cap():
    """Slide duration exceeding 30s should decay toward 0.85 instead of sticking at 1.0."""
    # Short slide: 10s duration -> score == 1.0
    short_score = interval_aware_temporal_compatibility(15.0, 10.0, 20.0)
    assert short_score == 1.0

    # Very long slide: 180s duration -> score capped and decayed < 1.0
    long_score = interval_aware_temporal_compatibility(100.0, 0.0, 180.0)
    assert long_score < 1.0
    assert long_score >= 0.85


def test_adaptive_taus_computation():
    """Adaptive taus should scale within bounds based on average slide duration."""
    visuals = [
        VisualEvent("v1", 0.0, "slide", "Intro", start_time=0.0, end_time=60.0),
        VisualEvent("v2", 60.0, "slide", "Details", start_time=60.0, end_time=120.0),
    ]
    tau_lead, tau_lag = compute_adaptive_taus(visuals)
    assert 10.0 <= tau_lead <= 40.0
    assert 25.0 <= tau_lag <= 90.0


def test_proposed_alignment_calibrated_confidence():
    """Proposed alignment should produce calibrated_confidence via calibrator."""
    aligner = ProposedSubjectAdaptiveAligner()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_align"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "In this slide we cover integral calculus."),
            TranscriptSegment("s2", 11.0, 20.0, "Here is the fundamental theorem proof.")
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "formula", "\\int f(x) dx", formula_latex="\\int f(x) dx"),
            VisualEvent("v2", 15.0, "slide_text", "Fundamental Theorem of Calculus")
        ]
    )
    result, _ = aligner.align(lecture)
    assert len(result.matches) == 2
    for m in result.matches:
        assert m.calibrated_confidence > 0.0
        assert m.calibrated_confidence <= 1.0


def test_sequence_optimizer_beam_search():
    """Sequence optimizer should run with beam search and increased same_slide_bonus."""
    aligner = ProposedSubjectAdaptiveAligner()
    optimizer = SequenceAlignmentOptimizer(same_slide_bonus=0.10, beam_width=5)
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_opt"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "Sorting arrays efficiently with quick sort."),
            TranscriptSegment("s2", 11.0, 20.0, "Partitioning array in place with pivots."),
            TranscriptSegment("s3", 21.0, 30.0, "Next we discuss recursion base case.")
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "code_snippet", "def quicksort(arr):", code_content="def quicksort(arr):"),
            VisualEvent("v2", 25.0, "slide_text", "Recursion Termination and Base Cases")
        ]
    )
    result, _ = optimizer.optimize(lecture, aligner)
    assert len(result.matches) == 3


def test_confidence_find_optimal_threshold():
    """find_optimal_threshold should compute best acceptance threshold."""
    matches = [
        CandidateMatch("s1", "v1", 1.0, 0.8, 1.0, 0.5, 0.0, 0.85, 0.90, 0.20, "accepted", "test", ""),
        CandidateMatch("s2", "v2", 0.9, 0.7, 0.8, 0.4, 0.0, 0.65, 0.70, 0.15, "accepted", "test", ""),
        CandidateMatch("s3", "v_wrong", 0.3, 0.2, 0.3, 0.1, 0.0, 0.25, 0.30, 0.02, "accepted", "test", ""),
    ]
    ground_truth = {"s1": "v1", "s2": "v2", "s3": "v3"}
    opt_t = SelectiveAlignmentFilter.find_optimal_threshold(matches, ground_truth)
    assert 0.30 <= opt_t <= 0.85
