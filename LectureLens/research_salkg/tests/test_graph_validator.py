"""Unit tests for knowledge graph validation, cycle detection, and deduplication."""

import pytest
from salkg.graph_validator import KnowledgeGraphValidator
from salkg.input_schema import GraphEdge, GraphNode, KnowledgeGraph


def test_merge_duplicate_concepts():
    validator = KnowledgeGraphValidator(concept_similarity_threshold=0.85)
    kg = KnowledgeGraph(lecture_id="test_dup", subject="mathematics")

    # Add near identical concept nodes
    kg.add_node(GraphNode("c1", "Chain Rule", "Concept", "mathematics", provenance_segment_ids=["s1"]))
    kg.add_node(GraphNode("c2", "The Chain Rule", "Concept", "mathematics", provenance_segment_ids=["s2"]))

    # Edge from c2 to some target
    kg.add_node(GraphNode("v1", "Formula 1", "Formula", "mathematics"))
    kg.add_edge(GraphEdge("c2", "v1", "explains", provenance_segment_ids=["s2"]))

    validated_kg, report = validator.validate_and_correct(kg)
    assert report["duplicates_merged"] == 1
    # Only one concept should remain
    concepts = [n for n in validated_kg.nodes.values() if n.node_type == "Concept"]
    assert len(concepts) == 1
    # Edge source should have been rewired to c1
    assert validated_kg.edges[0].source_id == "c1"


def test_dag_cycle_detection_and_resolution():
    validator = KnowledgeGraphValidator()
    kg = KnowledgeGraph(lecture_id="test_cycle", subject="mathematics")

    kg.add_node(GraphNode("c1", "Concept A", "Concept", "mathematics"))
    kg.add_node(GraphNode("c2", "Concept B", "Concept", "mathematics"))

    # Circular prerequisite: c1 requires c2, and c2 requires c1
    kg.add_edge(
        GraphEdge("c1", "c2", "requires_prerequisite", provenance_segment_ids=["s1"], alignment_score=0.9, calibrated_confidence=0.95)
    )
    kg.add_edge(
        GraphEdge("c2", "c1", "requires_prerequisite", provenance_segment_ids=["s2"], alignment_score=0.6, calibrated_confidence=0.60)
    )

    validated_kg, report = validator.validate_and_correct(kg)
    assert report["cycles_detected"] >= 1
    # The weaker edge (c2 -> c1) should be marked as unresolved
    edge_21 = [e for e in validated_kg.edges if e.source_id == "c2" and e.target_id == "c1"][0]
    assert edge_21.validation_status == "unresolved"
