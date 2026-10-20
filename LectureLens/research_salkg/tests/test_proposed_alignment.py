"""Unit tests for proposed Subject-Adaptive alignment."""

import pytest
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg.proposed_alignment import ContentTypeCompatibility, ProposedSubjectAdaptiveAligner
from salkg.subject_classifier import SubjectClassifier


def test_content_type_compatibility():
    # Spoken keyword 'equation' with formula visual type
    score_formula = ContentTypeCompatibility.score("Look at this equation for derivative", "formula")
    assert score_formula >= 0.8

    # Spoken keyword 'function' with code_snippet visual type
    score_code = ContentTypeCompatibility.score("This function implements the loop", "code_snippet")
    assert score_code >= 0.8

    # Irrelevant speech with table
    score_neutral = ContentTypeCompatibility.score("Good morning class today", "table")
    assert score_neutral == 0.35


def test_proposed_subject_adaptive_math():
    aligner = ProposedSubjectAdaptiveAligner()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="math_test"),
        segments=[
            TranscriptSegment("s1", 10.0, 25.0, "This formula derives dy by dx equals 2x.")
        ],
        visual_events=[
            VisualEvent("v1", 12.0, "formula", "\\frac{dy}{dx} = 2x", formula_latex="\\frac{dy}{dx} = 2x")
        ]
    )

    result, meta = aligner.align(lecture)
    assert len(result.matches) == 1
    match = result.matches[0]
    assert match.visual_id == "v1"
    assert match.symbol_score > 0.0
    assert match.content_type_score >= 0.8
    assert match.raw_composite_score > 0.45
