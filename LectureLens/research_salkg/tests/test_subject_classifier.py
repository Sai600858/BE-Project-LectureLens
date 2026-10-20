"""Unit tests for subject classification and uncertainty estimation."""

import pytest
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg.subject_classifier import SubjectClassifier


def test_classify_mathematics_lecture():
    classifier = SubjectClassifier()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_math"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "Let us prove this theorem using derivative and integral calculus."),
            TranscriptSegment("s2", 11.0, 20.0, "The eigenvalue and eigenvector satisfy this matrix equation.")
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "formula", "\\int f(x) dx = F(x)", formula_latex="\\int f(x) dx = F(x)")
        ]
    )

    res = classifier.classify(lecture)
    assert res["assigned_subject"] == "mathematics"
    assert res["is_unknown"] is False
    assert res["confidence"] > 0.4
    assert res["entropy"] >= 0.0


def test_classify_programming_lecture():
    classifier = SubjectClassifier()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_prog"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "This function implements binary search with log n complexity."),
            TranscriptSegment("s2", 11.0, 20.0, "Notice the while loop iterating over the array indices.")
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "code_snippet", "def binary_search(arr):\n    while low <= high:", code_content="def binary_search(arr):\n    while low <= high:")
        ]
    )

    res = classifier.classify(lecture)
    assert res["assigned_subject"] == "programming"
    assert res["is_unknown"] is False


def test_classify_unknown_out_of_domain():
    classifier = SubjectClassifier()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_unknown"),
        segments=[
            TranscriptSegment("s1", 0.0, 10.0, "The Renaissance artists utilized perspective and vivid pigment."),
            TranscriptSegment("s2", 11.0, 20.0, "Sculpture in classical antiquity captured mythological narratives.")
        ],
        visual_events=[
            VisualEvent("v1", 5.0, "slide_text", "Art History Overview: Florence and Rome")
        ]
    )

    res = classifier.classify(lecture)
    assert res["assigned_subject"] == "unknown"
    assert res["is_unknown"] is True
