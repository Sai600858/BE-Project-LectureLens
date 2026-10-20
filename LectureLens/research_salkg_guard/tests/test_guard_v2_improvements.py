"""Tests for v2 correctness, accuracy, and performance improvements in SALKG-Guard."""

import pytest
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment
from salkg_guard.contradiction_analyzer import ContradictionAndDependencyAnalyzer
from salkg_guard.decomposer import ClaimDecomposer
from salkg_guard.decision_engine import DecisionEngine
from salkg_guard.domain_registry import DomainValidatorRegistry
from salkg_guard.dual_axis import DualAxisValidator
from salkg_guard.provenance_resolver import EvidencePath, SALKGProvenanceResolver
from salkg_guard.report_schema import (
    ClaimValidationResult,
    DecomposedClaim,
    DomainVerdict,
    FaithfulnessVerdict,
    GuardDecision,
)


def test_provenance_tightened_citation_buffer():
    """Citation buffer +5s should reject timestamp at max_time + 6s."""
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="test_cite"),
        segments=[
            TranscriptSegment("s1", 0.0, 80.0, "Lecture intro."),
            TranscriptSegment("s2", 80.0, 100.0, "Lecture conclusion and concepts.")
        ],
        visual_events=[]
    )
    resolver = SALKGProvenanceResolver(
        lecture=lecture,
        salkg_result={"alignment": {"matches": []}, "knowledge_graph": {"edges": []}}
    )
    assert resolver.max_time == 100.0

    # Cited timestamp 104s is within +5s buffer and within 25s of s2 midpoint (90s) -> valid
    c_valid = DecomposedClaim(claim_id="c1", text="Lecture conclusion and concepts", cited_seconds=104.0)
    _, _, val1 = resolver.resolve_claim(c_valid)
    assert val1 is True

    # Cited timestamp 106s is outside +5s buffer -> invalid citation hallucination
    c_invalid = DecomposedClaim(claim_id="c2", text="Lecture conclusion and concepts", cited_seconds=106.0)
    _, _, val2 = resolver.resolve_claim(c_invalid)
    assert val2 is False


def test_dual_axis_higher_support_threshold():
    """Alignment confidence below 0.55 should yield PARTIALLY_SUPPORTED, not SUPPORTED."""
    registry = DomainValidatorRegistry()
    dav = DualAxisValidator(registry)
    claim = DecomposedClaim(claim_id="c1", text="Derivative formula", formula_latex="\\frac{df}{dx}")

    # Path with 0.45 confidence (previously would have passed at 0.35 threshold)
    path_low = EvidencePath("c1", "s1", "TRANSCRIPT", 10.0, "derivative formula", 0.45, "DIRECT")
    res_low = dav.evaluate_claim(claim, [path_low], [], True, "mathematics")
    assert res_low.axis1_faithfulness == FaithfulnessVerdict.PARTIALLY_SUPPORTED

    # Path with 0.65 confidence -> SUPPORTED
    path_high = EvidencePath("c1", "s1", "TRANSCRIPT", 10.0, "derivative formula", 0.65, "DIRECT")
    res_high = dav.evaluate_claim(claim, [path_high], [], True, "mathematics")
    assert res_high.axis1_faithfulness == FaithfulnessVerdict.SUPPORTED


def test_dual_axis_soft_vs_direct_contradiction():
    """Only direct/cross-modal conflicting paths trigger hard CONTRADICTED verdict."""
    registry = DomainValidatorRegistry()
    dav = DualAxisValidator(registry)
    claim = DecomposedClaim(claim_id="c1", text="Algorithm time complexity O(n)")

    # Soft conflict (DERIVED directness)
    soft_path = EvidencePath("c1", "e1", "KG_RELATION", 20.0, "conflict snippet", 0.8, "DERIVED", is_conflicting=True)
    res_soft = dav.evaluate_claim(claim, [], [soft_path], True, "algorithms")
    assert res_soft.axis1_faithfulness == FaithfulnessVerdict.PARTIALLY_SUPPORTED
    assert res_soft.decision == GuardDecision.NEEDS_REVIEW

    # Hard conflict (DIRECT directness)
    hard_path = EvidencePath("c1", "s1", "TRANSCRIPT", 20.0, "conflict snippet", 0.8, "DIRECT", is_conflicting=True)
    res_hard = dav.evaluate_claim(claim, [], [hard_path], True, "algorithms")
    assert res_hard.axis1_faithfulness == FaithfulnessVerdict.CONTRADICTED
    assert res_hard.decision == GuardDecision.ABSTAIN


def test_decision_engine_min_support_ratio():
    """When support ratio is below min_support_ratio, ACCEPT is gated."""
    engine = DecisionEngine(min_support_ratio=0.65)
    c1 = ClaimValidationResult(
        claim=DecomposedClaim(claim_id="c1", text="Statement 1"),
        axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
        axis1_reason="", axis2_domain=DomainVerdict.DOMAIN_VALID, axis2_reason=""
    )
    c2 = ClaimValidationResult(
        claim=DecomposedClaim(claim_id="c2", text="Statement 2"),
        axis1_faithfulness=FaithfulnessVerdict.PARTIALLY_SUPPORTED,
        axis1_reason="", axis2_domain=DomainVerdict.DOMAIN_VALID, axis2_reason=""
    )
    # Total 2, supported 1 -> support_ratio = 0.50 < 0.65
    report = engine.decide("r1", "lec1", "rag_answer", "general_cs", [c1, c2], [])
    assert report.overall_decision == GuardDecision.NEEDS_REVIEW


def test_contradiction_analyzer_expanded_algos():
    """Contradiction analyzer should detect complexity conflicts for Dijkstra and BFS."""
    cr1 = ClaimValidationResult(
        claim=DecomposedClaim(claim_id="c1", text="Dijkstra algorithm runs in O((V+E) log V)", claim_type="complexity"),
        axis1_faithfulness=FaithfulnessVerdict.SUPPORTED, axis1_reason="", axis2_domain=DomainVerdict.DOMAIN_VALID, axis2_reason=""
    )
    cr2 = ClaimValidationResult(
        claim=DecomposedClaim(claim_id="c2", text="Dijkstra algorithm takes O(n^2) worst case", claim_type="complexity"),
        axis1_faithfulness=FaithfulnessVerdict.SUPPORTED, axis1_reason="", axis2_domain=DomainVerdict.DOMAIN_VALID, axis2_reason=""
    )
    conflicts = ContradictionAndDependencyAnalyzer.check_internal_contradictions([cr1, cr2])
    assert len(conflicts) >= 1
    assert any("dijkstra" in c[2].lower() for c in conflicts)


def test_decomposer_abbreviation_protection_and_dedup():
    """Abbreviations like e.g. and Fig. should not be split, and duplicate claims deduplicated."""
    text = (
        "We examine sorting algorithms, e.g. quicksort and mergesort. "
        "Next we review recursion depth. "
        "Next we review recursion depth."
    )
    claims = ClaimDecomposer.decompose_text(text)
    # Should not split 'e.g.' into two claims
    assert any("e.g." in c.text for c in claims)
    # Duplicate sentence should be deduplicated
    recursion_claims = [c for c in claims if "recursion depth" in c.text.lower()]
    assert len(recursion_claims) == 1
