"""Comprehensive audit test suite for edge cases, anomalies, and stress scenarios.

Covers:
1. Metric edge cases (all rejected, zero gold pairs, no predictions).
2. Incorrect alignments and unaligned speech distractor rejection.
3. Unsupported graph relations and provenance gap detection.
4. Contradictory evidence detection and modeling.
5. Repeated slides and backward transition tracking.
6. Uncertain subject classification and out-of-domain entropy fallback.
"""

import pytest
from salkg.confidence import ConfidenceCalibrator, SelectiveAlignmentFilter
from salkg.graph_builder import KnowledgeGraphBuilder
from salkg.graph_validator import KnowledgeGraphValidator
from salkg.input_schema import (
    AlignmentResult,
    CandidateMatch,
    GoldAnnotation,
    GraphEdge,
    GraphNode,
    KnowledgeGraph,
    LectureData,
    LectureMetadata,
    TranscriptSegment,
    VisualEvent,
)
from salkg.metrics import AlignmentEvaluator, GraphEvaluator, calculate_prf
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.sequence_optimizer import SequenceAlignmentOptimizer
from salkg.subject_classifier import SubjectClassifier


def test_metric_edge_cases_all_rejected_and_zero_gold():
    """Verify metrics behavior when all predictions are rejected or gold is empty."""
    # 1. Zero gold pairs
    lec_empty_gold = LectureData(
        metadata=LectureMetadata(lecture_id="edge_01", title="Empty Gold"),
        segments=[TranscriptSegment(segment_id="s1", start_time=0.0, end_time=10.0, text="Hello")],
        visual_events=[VisualEvent(visual_id="v1", timestamp=0.0, visual_type="slide_text", extracted_text="Title")],
    )
    res = AlignmentResult(
        lecture_id="edge_01",
        method_name="test_method",
        matches=[CandidateMatch(
            transcript_id="s1", visual_id="v1", temporal_score=1.0, semantic_score=0.0,
            content_type_score=0.0, symbol_score=0.0, raw_composite_score=0.5,
            calibrated_confidence=0.5, margin=0.1, status="accepted", method="test"
        )],
        total_segments=1, matched_segments=1, coverage=1.0, runtime_seconds=0.001
    )
    eval_empty = AlignmentEvaluator.evaluate(res, lec_empty_gold)
    assert eval_empty["precision"] == 0.0
    assert eval_empty["recall"] == 0.0
    assert eval_empty["f1"] == 0.0
    assert "No ground truth" in eval_empty.get("note", "")

    # 2. All predictions rejected
    lec_with_gold = LectureData(
        metadata=LectureMetadata(lecture_id="edge_02", title="With Gold"),
        segments=[
            TranscriptSegment(segment_id="s1", start_time=0.0, end_time=10.0, text="First"),
            TranscriptSegment(segment_id="s2", start_time=10.0, end_time=20.0, text="Second"),
        ],
        visual_events=[VisualEvent(visual_id="v1", timestamp=0.0, visual_type="slide_text", extracted_text="V1")],
        gold=GoldAnnotation(alignment_pairs=[{"transcript_id": "s1", "visual_id": "v1"}]),
    )
    res_rejected = AlignmentResult(
        lecture_id="edge_02",
        method_name="test_method",
        matches=[
            CandidateMatch(
                transcript_id="s1", visual_id="v1", temporal_score=0.1, semantic_score=0.0,
                content_type_score=0.0, symbol_score=0.0, raw_composite_score=0.1,
                calibrated_confidence=0.1, margin=0.0, status="rejected", method="test"
            ),
        ],
        total_segments=2, matched_segments=0, coverage=0.0, runtime_seconds=0.001
    )
    eval_rej = AlignmentEvaluator.evaluate(res_rejected, lec_with_gold)
    assert eval_rej["tp"] == 0
    assert eval_rej["fn"] == 1
    assert eval_rej["precision"] == 0.0
    assert eval_rej["recall"] == 0.0
    assert eval_rej["f1"] == 0.0
    assert eval_rej["coverage"] == 0.0


def test_incorrect_alignments_and_unaligned_distractor():
    """Verify that unaligned chit-chat segments are penalized if accepted, but preserved if rejected."""
    lec = LectureData(
        metadata=LectureMetadata(lecture_id="distractor_01", title="Distractor Test"),
        segments=[
            TranscriptSegment(segment_id="seg_content", start_time=5.0, end_time=25.0, text="Formal theorem content"),
            TranscriptSegment(segment_id="seg_chitchat", start_time=30.0, end_time=45.0, text="Can everyone hear me? Please sit down."),
        ],
        visual_events=[
            VisualEvent(visual_id="vis_slide", timestamp=5.0, visual_type="slide_text", extracted_text="Theorem 1"),
        ],
        gold=GoldAnnotation(alignment_pairs=[{"transcript_id": "seg_content", "visual_id": "vis_slide"}]),
    )

    # Case A: Model incorrectly accepted the distractor segment
    res_with_fp = AlignmentResult(
        lecture_id="distractor_01",
        method_name="forced_full",
        matches=[
            CandidateMatch(
                transcript_id="seg_content", visual_id="vis_slide", temporal_score=1.0,
                semantic_score=0.8, content_type_score=0.8, symbol_score=0.0, raw_composite_score=0.85,
                calibrated_confidence=0.9, margin=0.3, status="accepted", method="test"
            ),
            CandidateMatch(
                transcript_id="seg_chitchat", visual_id="vis_slide", temporal_score=0.4,
                semantic_score=0.0, content_type_score=0.3, symbol_score=0.0, raw_composite_score=0.25,
                calibrated_confidence=0.3, margin=0.05, status="accepted", method="test"
            ),
        ],
        total_segments=2, matched_segments=2, coverage=1.0, runtime_seconds=0.001
    )
    eval_a = AlignmentEvaluator.evaluate(res_with_fp, lec)
    assert eval_a["tp"] == 1
    assert eval_a["fp"] == 1
    assert eval_a["precision"] == 0.5
    assert eval_a["false_match_rate"] == 0.5

    # Case B: Selective filter correctly rejected the distractor segment
    c_filter = SelectiveAlignmentFilter(acceptance_threshold=0.32, margin_threshold=0.03)
    filt_res, stats = c_filter.filter_alignment(res_with_fp)
    eval_b = AlignmentEvaluator.evaluate(filt_res, lec)
    assert eval_b["tp"] == 1
    assert eval_b["fp"] == 0  # distractor rejected!
    assert eval_b["precision"] == 1.0
    assert eval_b["false_match_rate"] == 0.0


def test_unsupported_graph_relations():
    """Verify validator flags relations lacking provenance evidence and calculates unsupported rate."""
    kg = KnowledgeGraph(lecture_id="unsup_01", subject="general_cs")
    n1 = GraphNode(node_id="n1", label="Process", node_type="Concept", subject="general_cs")
    n2 = GraphNode(node_id="n2", label="Thread", node_type="Concept", subject="general_cs")
    kg.add_node(n1)
    kg.add_node(n2)

    # Edge with no provenance IDs
    orphan_edge = GraphEdge(
        source_id="n1",
        target_id="n2",
        relation_type="uses",
        provenance_segment_ids=[],
        provenance_visual_ids=[],
        timestamps=[],
        alignment_score=0.0,
        calibrated_confidence=0.0,
        validation_status="accepted",
        is_explicit=False,
    )
    kg.add_edge(orphan_edge)

    validator = KnowledgeGraphValidator()
    audit = validator.audit_graph(kg)
    assert audit["missing_provenance"] == 1
    assert audit["total_violations"] >= 1

    val_kg, report = validator.validate_and_correct(kg)
    assert report["missing_provenance"] == 1
    assert report["unresolved_edges"] == 1
    assert any("Unsupported relation" in iss for iss in val_kg.edges[0].validation_issues)


def test_contradictory_evidence_detection():
    """Verify that verbal disagreement with visual figures is captured as a contradicts edge."""
    builder = KnowledgeGraphBuilder()
    seg = TranscriptSegment(
        segment_id="s_contra",
        start_time=100.0,
        end_time=130.0,
        text="The spoken explanation claims the curve is strictly increasing, but this contradicts the downward plot.",
    )
    vis = VisualEvent(
        visual_id="v_plot",
        timestamp=100.0,
        visual_type="diagram",
        extracted_text="Decreasing Monotonic Curve f'(x) < 0",
    )
    match = CandidateMatch(
        transcript_id="s_contra", visual_id="v_plot", temporal_score=1.0, semantic_score=0.5,
        content_type_score=1.0, symbol_score=0.0, raw_composite_score=0.7,
        calibrated_confidence=0.8, margin=0.2, status="accepted", method="test"
    )
    kg = KnowledgeGraph(lecture_id="contra_lec", subject="mathematics")
    builder._extract_semantic_relations(seg, vis, ["Increasing Curve"], kg, match, "mathematics")

    contra_edges = [e for e in kg.edges if e.relation_type == "contradicts"]
    assert len(contra_edges) == 1
    assert contra_edges[0].source_id == "node_v_plot"
    assert contra_edges[0].target_id == "concept_increasing_curve"


def test_repeated_slides_and_transition_cost():
    """Verify that SequenceAlignmentOptimizer supports re-referencing previous slides."""
    optimizer = SequenceAlignmentOptimizer(
        fwd_jump_penalty=0.15,
        back_jump_penalty=0.35,
        same_slide_bonus=0.05,
    )
    # Forward adjacent transition should have 0 transition cost
    cost_fwd_adj = optimizer.transition_cost(0, 1)
    assert cost_fwd_adj == 0.0

    # Same slide should receive negative cost (a bonus)
    cost_same = optimizer.transition_cost(1, 1)
    assert cost_same == -0.05

    # Backward jump (repeated slide) has a defined penalty
    cost_back = optimizer.transition_cost(2, 0)
    assert cost_back > 0.30


def test_uncertain_subject_classification_entropy():
    """Verify that out-of-domain text triggers high Shannon entropy and unknown classification."""
    classifier = SubjectClassifier()
    # Lecture about medieval culinary history with zero math, cs, or physics vocabulary
    culinary_lecture = LectureData(
        metadata=LectureMetadata(lecture_id="culinary_01", title="Medieval Culinary Practice"),
        segments=[
            TranscriptSegment(segment_id="c1", start_time=0.0, end_time=30.0, text="In fourteenth century kitchens, saffron and cinnamon were precious seasonings for feasts."),
            TranscriptSegment(segment_id="c2", start_time=35.0, end_time=70.0, text="Roasting over open timber hearths required continuous turning and basting of fowl."),
        ],
        visual_events=[
            VisualEvent(visual_id="v1", timestamp=0.0, visual_type="slide_text", extracted_text="Spices and Herbs of Western Europe"),
        ],
    )
    result = classifier.classify(culinary_lecture)
    assert result["is_unknown"] is True
    assert result["assigned_subject"] == "unknown"
    assert result["normalized_entropy"] > 0.85  # near maximal uncertainty
    assert result["confidence"] < 0.50
