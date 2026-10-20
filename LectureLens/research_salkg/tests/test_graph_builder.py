"""Unit tests for knowledge graph builder."""

import pytest
from salkg.graph_builder import KnowledgeGraphBuilder
from salkg.input_schema import AlignmentResult, CandidateMatch, LectureData, LectureMetadata, TranscriptSegment, VisualEvent


def test_graph_construction_provenance():
    builder = KnowledgeGraphBuilder()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_kg", subject_label="mathematics"),
        segments=[
            TranscriptSegment(
                "s1", 10.0, 30.0,
                "Before we discuss the Chain Rule, you need to know the Power Rule."
            )
        ],
        visual_events=[
            VisualEvent("v1", 12.0, "formula", "\\frac{dy}{dx} = \\frac{dy}{du}\\frac{du}{dx}", formula_latex="...")
        ]
    )

    alignment = AlignmentResult(
        lecture_id="test_kg",
        method_name="test",
        matches=[
            CandidateMatch("s1", "v1", raw_composite_score=0.85, calibrated_confidence=0.90, status="accepted")
        ],
        total_segments=1,
        matched_segments=1,
        coverage=1.0,
    )

    kg = builder.build_graph(lecture, alignment, inferred_subject="mathematics")

    # Visual node and segment node should exist
    assert "node_v1" in kg.nodes
    assert "node_s1" in kg.nodes

    # Corresponds_to edge
    corr_edges = [e for e in kg.edges if e.relation_type == "corresponds_to"]
    assert len(corr_edges) == 1
    assert corr_edges[0].source_id == "node_s1"
    assert corr_edges[0].target_id == "node_v1"
    assert "s1" in corr_edges[0].provenance_segment_ids
    assert "v1" in corr_edges[0].provenance_visual_ids

    # Prerequisite edge
    prereq_edges = [e for e in kg.edges if e.relation_type == "requires_prerequisite"]
    assert len(prereq_edges) == 1
    assert "power_rule" in prereq_edges[0].source_id
    assert "chain_rule" in prereq_edges[0].target_id
