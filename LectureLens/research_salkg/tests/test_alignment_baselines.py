"""Unit tests for baseline alignment models (Temporal, Semantic, Combined)."""

import pytest
from salkg.alignment_baselines import (
    IndependentCombinedAligner,
    SemanticOnlyAligner,
    TemporalOnlyAligner,
)
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment, VisualEvent


@pytest.fixture
def sample_lecture():
    return LectureData(
        metadata=LectureMetadata(lecture_id="test_align"),
        segments=[
            TranscriptSegment("s1", 10.0, 20.0, "We discuss the Chain Rule in calculus."),
            TranscriptSegment("s2", 100.0, 110.0, "Now we discuss the Power Rule.")
        ],
        visual_events=[
            VisualEvent("v1", 12.0, "slide_text", "Calculus: Chain Rule"),
            VisualEvent("v2", 102.0, "slide_text", "Calculus: Power Rule")
        ]
    )


def test_temporal_only_alignment(sample_lecture):
    aligner = TemporalOnlyAligner(tau=30.0)
    result = aligner.align(sample_lecture)
    assert len(result.matches) == 2
    # s1 should align to v1 (dist 3s vs dist 87s)
    assert result.matches[0].transcript_id == "s1"
    assert result.matches[0].visual_id == "v1"
    # s2 should align to v2
    assert result.matches[1].transcript_id == "s2"
    assert result.matches[1].visual_id == "v2"


def test_semantic_only_alignment(sample_lecture):
    aligner = SemanticOnlyAligner()
    result = aligner.align(sample_lecture)
    assert len(result.matches) == 2
    assert result.matches[0].transcript_id == "s1"
    assert result.matches[0].visual_id == "v1"
    assert result.matches[0].semantic_score > 0.3


def test_combined_weighted_alignment(sample_lecture):
    aligner = IndependentCombinedAligner(weight_temporal=0.6, weight_semantic=0.4)
    result = aligner.align(sample_lecture)
    assert len(result.matches) == 2
    assert result.matches[0].visual_id == "v1"
    assert result.matches[0].raw_composite_score > 0.5
