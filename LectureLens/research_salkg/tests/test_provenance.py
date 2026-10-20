"""Unit tests for provenance queries and tracing."""

import pytest
from salkg.input_schema import GraphEdge, GraphNode, KnowledgeGraph, LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg.provenance import ProvenanceTracker


def test_provenance_trace_concept():
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_prov"),
        segments=[
            TranscriptSegment("s1", 10.0, 20.0, "The Chain Rule applies to composition.")
        ],
        visual_events=[
            VisualEvent("v1", 12.0, "formula", "\\frac{dy}{dx} = \\frac{dy}{du}\\frac{du}{dx}")
        ]
    )
    kg = KnowledgeGraph(lecture_id="test_prov", subject="mathematics")
    kg.add_node(GraphNode("c1", "Chain Rule", "Concept", "mathematics", provenance_segment_ids=["s1"], provenance_visual_ids=["v1"]))
    kg.add_node(GraphNode("node_v1", "Formula 1", "Formula", "mathematics", provenance_visual_ids=["v1"]))
    kg.add_edge(GraphEdge("c1", "node_v1", "explains", provenance_segment_ids=["s1"], provenance_visual_ids=["v1"]))

    tracker = ProvenanceTracker(lecture, kg)
    trace = tracker.trace_concept("Chain Rule")
    assert trace is not None
    assert len(trace["speech_evidence"]) == 1
    assert trace["speech_evidence"][0]["segment_id"] == "s1"
    assert len(trace["visual_evidence"]) == 1
    assert trace["visual_evidence"][0]["visual_id"] == "v1"
    assert len(trace["outgoing_relations"]) == 1
