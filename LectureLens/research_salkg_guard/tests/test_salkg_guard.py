"""Comprehensive automated tests for SALKG-Guard components and pipeline."""

from __future__ import annotations

import pytest
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg_guard.contradiction_analyzer import ContradictionAndDependencyAnalyzer
from salkg_guard.decomposer import ClaimDecomposer
from salkg_guard.decision_engine import DecisionEngine
from salkg_guard.domain_registry import (
    AlgorithmsProgrammingValidator,
    DatabaseValidator,
    DomainValidatorRegistry,
    ElectronicsSystemsValidator,
    MathematicsValidator,
)
from salkg_guard.dual_axis import DualAxisValidator
from salkg_guard.pipeline import SALKGGuard
from salkg_guard.provenance_resolver import SALKGProvenanceResolver
from salkg_guard.report_schema import (
    ClaimValidationResult,
    DecomposedClaim,
    DomainVerdict,
    EvidencePath,
    FaithfulnessVerdict,
    GuardDecision,
)


@pytest.fixture
def sample_lecture() -> LectureData:
    metadata = LectureMetadata(lecture_id="lec_test", title="Intro to Algorithms & Math", duration=60.0)
    segments = [
        TranscriptSegment(segment_id="s1", start_time=5.0, end_time=12.0, text="First we discuss binary search algorithm."),
        TranscriptSegment(segment_id="s2", start_time=13.0, end_time=25.0, text="The circle area formula is A = pi * r^2."),
    ]
    events = [
        VisualEvent(visual_id="e1", timestamp=14.0, visual_type="formula", extracted_text="A = \\pi r^2", formula_latex="A=\\pi r^2"),
    ]
    return LectureData(metadata=metadata, segments=segments, visual_events=events)


class TestDecomposer:
    def test_text_decomposition_extracts_claims_and_timestamps(self):
        text = "Binary search runs in O(\\log n) time [00:10]. The area of circle is $A = \\pi r^2$ [00:15]."
        claims = ClaimDecomposer.decompose_text(text)
        assert len(claims) >= 2
        assert any(c.cited_seconds == 10.0 for c in claims)
        assert any(c.cited_seconds == 15.0 for c in claims)
        assert any(c.formula_latex is not None for c in claims)

    def test_quiz_decomposition(self):
        quiz = [
            {
                "questionText": "What is circle area?",
                "correctAnswer": "pi * r^2",
                "options": ["pi * r^2", "2 * pi * r"],
                "explanation": "Calculates area.",
            }
        ]
        claims = ClaimDecomposer.decompose_quiz(quiz)
        assert len(claims) == 3  # stem, answer_key, explanation
        assert claims[1].dependencies == [claims[0].claim_id]

    def test_diagram_decomposition(self):
        diag = {
            "title": "Search Steps",
            "nodes": [{"id": "n1", "label": "Start"}, {"id": "n2", "label": "Halve"}],
            "edges": [{"from": "n1", "to": "n2"}],
        }
        claims = ClaimDecomposer.decompose_diagram(diag)
        assert len(claims) >= 4  # title, 2 nodes, 1 edge
        edge_claim = [c for c in claims if c.claim_type == "diagram_edge"][0]
        assert "n1" in edge_claim.text and "n2" in edge_claim.text


class TestDomainValidators:
    def test_mathematics_validator(self):
        mv = MathematicsValidator()
        v_valid, _ = mv.validate(DecomposedClaim(claim_id="c1", text="Circle area is given by r^2", formula_latex="A = \\pi r^2"))
        assert v_valid == DomainVerdict.DOMAIN_VALID

        v_invalid, _ = mv.validate(DecomposedClaim(claim_id="c2", text="Circle area is 2 * pi * r^2", formula_latex="A = 2 * \\pi * r^2"))
        assert v_invalid == DomainVerdict.DOMAIN_INVALID

    def test_algorithms_validator(self):
        av = AlgorithmsProgrammingValidator()
        v_valid, _ = av.validate(DecomposedClaim(claim_id="c1", text="Binary search on sorted array takes O(log n)"))
        assert v_valid == DomainVerdict.DOMAIN_VALID

        v_invalid, _ = av.validate(DecomposedClaim(claim_id="c2", text="Binary search on sorted array takes O(n^2)"))
        assert v_invalid == DomainVerdict.DOMAIN_INVALID

    def test_electronics_validator(self):
        ev = ElectronicsSystemsValidator()
        v_valid, _ = ev.validate(DecomposedClaim(claim_id="c1", text="Voltage divider gives V_out = V_in * (R2 / (R1 + R2))"))
        assert v_valid == DomainVerdict.DOMAIN_VALID

        v_invalid, _ = ev.validate(DecomposedClaim(claim_id="c2", text="Voltage divider gives V_out = V_in * (R1 + R2) / R2"))
        assert v_invalid == DomainVerdict.DOMAIN_INVALID

    def test_database_validator(self):
        dv = DatabaseValidator()
        v_valid, _ = dv.validate(DecomposedClaim(claim_id="c1", text="Transactions require Atomicity and Isolation properties"))
        assert v_valid == DomainVerdict.DOMAIN_VALID


class TestDualAxisValidator:
    def test_preserves_dual_axis_distinction(self, sample_lecture):
        registry = DomainValidatorRegistry()
        dav = DualAxisValidator(registry)

        # Claim missing from lecture but mathematically valid
        c_ext = DecomposedClaim(claim_id="c1", text="Circle area is r^2", formula_latex="A = \\pi r^2")
        result = dav.evaluate_claim(
            claim=c_ext,
            supporting_paths=[],
            conflicting_paths=[],
            citation_valid=True,
            domain_name="mathematics",
        )
        assert result.axis1_faithfulness == FaithfulnessVerdict.MISSING_FROM_LECTURE
        assert result.axis2_domain == DomainVerdict.DOMAIN_VALID


class TestContradictionAnalyzer:
    def test_detects_contradictory_claims(self):
        c1 = DecomposedClaim(claim_id="c1", text="Binary search has time complexity O(log n).", claim_type="complexity")
        c2 = DecomposedClaim(claim_id="c2", text="Binary search has time complexity O(n^2).", claim_type="complexity")
        res1 = ClaimValidationResult(
            claim=c1,
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="",
            axis2_domain=DomainVerdict.DOMAIN_VALID,
            axis2_reason="",
        )
        res2 = ClaimValidationResult(
            claim=c2,
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="",
            axis2_domain=DomainVerdict.DOMAIN_INVALID,
            axis2_reason="",
        )
        confs = ContradictionAndDependencyAnalyzer.check_internal_contradictions([res1, res2])
        assert len(confs) >= 1

    def test_rejects_unsupported_diagram_edge(self, sample_lecture):
        edge_claim = DecomposedClaim(claim_id="e1", text="asserts directed relationship: 'nodeA' -> 'nodeB'", claim_type="diagram_edge")
        res_edge = ClaimValidationResult(
            claim=edge_claim,
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="",
            axis2_domain=DomainVerdict.NOT_APPLICABLE,
            axis2_reason="",
            evidence_paths=[],
        )
        ContradictionAndDependencyAnalyzer.validate_diagram_edges([res_edge], salkg_edges=[])
        assert res_edge.axis1_faithfulness == FaithfulnessVerdict.PARTIALLY_SUPPORTED
        assert "unsupported by lecture evidence" in res_edge.axis1_reason


class TestDecisionEngine:
    def test_decision_engine_hard_failures(self):
        engine = DecisionEngine()

        # Invalid citation triggers REGENERATE
        c_bad_cite = ClaimValidationResult(
            claim=DecomposedClaim(claim_id="c1", text="text [99:99]", cited_timestamp="99:99", cited_seconds=5999.0),
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="",
            axis2_domain=DomainVerdict.NOT_APPLICABLE,
            axis2_reason="",
            citation_valid=False,
        )
        rep = engine.decide(
            request_id="r1",
            lecture_id="lec_1",
            content_type="rag_answer",
            domain="mathematics",
            claim_results=[c_bad_cite],
            internal_contradictions=[],
        )
        assert rep.overall_decision == GuardDecision.REGENERATE

        # Missing material evidence triggers ABSTAIN
        c_missing = ClaimValidationResult(
            claim=DecomposedClaim(claim_id="c2", text="unrelated topic"),
            axis1_faithfulness=FaithfulnessVerdict.MISSING_FROM_LECTURE,
            axis1_reason="",
            axis2_domain=DomainVerdict.NOT_APPLICABLE,
            axis2_reason="",
        )
        rep_m = engine.decide(
            request_id="r2",
            lecture_id="lec_1",
            content_type="rag_answer",
            domain="mathematics",
            claim_results=[c_missing],
            internal_contradictions=[],
        )
        assert rep_m.overall_decision == GuardDecision.ABSTAIN


class TestFullPipeline:
    def test_full_pipeline_accepts_grounded_input(self, sample_lecture):
        guard = SALKGGuard()
        report = guard.validate_generation(
            artifact="We discuss binary search and the circle area formula A = pi * r^2 [00:15].",
            lecture=sample_lecture,
            content_type="rag_answer",
            domain_hint="mathematics",
        )
        assert report.overall_decision == GuardDecision.ACCEPT
        assert report.total_claims >= 1
        assert report.citation_validity_rate == 1.0

    def test_full_pipeline_catches_invalid_citations(self, sample_lecture):
        guard = SALKGGuard()
        report = guard.validate_generation(
            artifact="The instructor explained binary search at timestamp [99:99].",
            lecture=sample_lecture,
            content_type="rag_answer",
        )
        assert report.overall_decision == GuardDecision.REGENERATE
        assert report.citation_validity_rate < 1.0


class TestSQLDiagramValidation:
    def test_decompose_sql_diagram_types(self):
        # 1. COALESCE Flow decomposition
        coalesce_spec = {
            "id": "viz_coalesce",
            "type": "null_coalesce_flow",
            "title": "SQL COALESCE Evaluation Flow",
            "sectionHeading": "Handling Missing Data with COALESCE",
            "topic": "SQL COALESCE Function",
            "domain": "databases",
            "spec": {
                "expression": "SELECT name, COALESCE(dept, 'Unknown') FROM employee;",
                "fallback": "'Unknown'",
            },
        }
        claims = ClaimDecomposer.decompose_diagram(coalesce_spec)
        assert len(claims) >= 2
        assert any("COALESCE" in c.text and "Unknown" in c.text for c in claims)

        # 2. String Transformation decomposition
        str_spec = {
            "id": "viz_str",
            "type": "string_transformation",
            "title": "SQL String Functions",
            "sectionHeading": "SQL String Manipulation Functions",
            "topic": "SQL String Functions",
            "domain": "databases",
            "spec": {
                "input": "  John Doe  ",
                "operations": [{"func": "UPPER(str)", "result": "'  JOHN DOE  '"}],
            },
        }
        str_claims = ClaimDecomposer.decompose_diagram(str_spec)
        assert any("string manipulation" in c.text.lower() for c in str_claims)

        # 3. Date Timeline decomposition
        date_spec = {
            "id": "viz_date",
            "type": "date_timeline",
            "title": "SQL Date Arithmetic Timeline",
            "sectionHeading": "Date and Time Arithmetic Functions",
            "topic": "SQL Date Functions",
            "domain": "databases",
            "spec": {"baseDate": "2020-09-05"},
        }
        date_claims = ClaimDecomposer.decompose_diagram(date_spec)
        assert any("2020-09-05" in c.text for c in date_claims)

    def test_database_validator_cross_domain_rejection(self):
        from salkg_guard.domain_registry import DatabaseValidator

        val = DatabaseValidator()
        # Binary search asserted in database context
        bs_claim = DecomposedClaim(
            claim_id="bad_claim",
            text="Diagram asserts array binary search over elements [2, 5, 8] with target 23 in search interval [4 .. 8].",
            claim_type="complexity",
        )
        verdict, reason = val.validate(bs_claim)
        assert verdict == DomainVerdict.DOMAIN_INVALID
        assert "Cross-domain contradiction" in reason

    def test_database_validator_sql_functions(self):
        from salkg_guard.domain_registry import DatabaseValidator

        val = DatabaseValidator()
        coalesce_claim = DecomposedClaim(
            claim_id="c1",
            text="COALESCE evaluates arguments and returns the first non-null value, substituting 'Unknown' for NULL.",
            claim_type="factual",
        )
        verdict, _ = val.validate(coalesce_claim)
        assert verdict == DomainVerdict.DOMAIN_VALID

        date_claim = DecomposedClaim(
            claim_id="c2",
            text="SQL calendar date arithmetic: base date 2020-09-05 + 10 DAY yields 2020-09-15.",
            claim_type="factual",
        )
        v_date, _ = val.validate(date_claim)
        assert v_date == DomainVerdict.DOMAIN_VALID

    def test_cross_domain_contradiction_detection(self):
        c1 = DecomposedClaim(
            claim_id="sec_1",
            text="Section explains Handling Missing Data with COALESCE in SQL database queries.",
            claim_type="factual",
        )
        c2 = DecomposedClaim(
            claim_id="diag_1",
            text="Diagram asserts array binary search with low [4], mid [5], high [8] on array.",
            claim_type="complexity",
        )
        r1 = ClaimValidationResult(
            claim=c1,
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="supported",
            axis2_domain=DomainVerdict.DOMAIN_VALID,
            axis2_reason="valid",
        )
        r2 = ClaimValidationResult(
            claim=c2,
            axis1_faithfulness=FaithfulnessVerdict.SUPPORTED,
            axis1_reason="supported",
            axis2_domain=DomainVerdict.DOMAIN_VALID,
            axis2_reason="valid",
        )

        contradictions = ContradictionAndDependencyAnalyzer.check_internal_contradictions([r1, r2])
        assert len(contradictions) >= 1
        assert "Cross-domain contradiction" in contradictions[0][2]


class TestDynamicDomainUnderstanding:
    """Tests for metadata-driven dynamic domain understanding on unseen academic disciplines."""

    def test_unseen_domain_resolution_and_validation(self):
        from salkg_guard.domain_registry import DomainValidatorRegistry, DynamicDomainValidator

        reg = DomainValidatorRegistry()
        # 1. Unseen discipline: Organic Chemistry
        resolved = reg.resolve_domain("Organic Chemistry", "Lecture 4: Reaction Mechanisms", None)
        assert resolved == "organic chemistry"

        val = reg.get_validator("organic chemistry")
        assert isinstance(val, DynamicDomainValidator)
        assert val.domain_name == "organic chemistry"

        # 2. Well-formed chemistry claim passes as UNVERIFIABLE (honest calibration, zero fabricated certainty)
        chem_claim = DecomposedClaim(
            claim_id="c_chem",
            text="Electrophilic addition of HBr to an alkene proceeds via a carbocation intermediate.",
            claim_type="factual",
        )
        verdict, reason = val.validate(chem_claim, context={"section_topic": "Alkene Reactions", "domain": "organic chemistry"})
        assert verdict == DomainVerdict.UNVERIFIABLE
        assert "No mechanical prover available" in reason

    def test_dynamic_deterministic_syntax_and_arithmetic_checks(self):
        from salkg_guard.domain_registry import DynamicDomainValidator

        val = DynamicDomainValidator("macroeconomics")

        # Mismatched LaTeX braces
        bad_latex = DecomposedClaim(
            claim_id="bad_eq",
            text="Consumer surplus calculation.",
            claim_type="formula",
            formula_latex="CS = \\int_{0}^{Q} P(q) dq - P \\cdot Q}",  # extra closing brace
        )
        v_bad, reason_bad = val.validate(bad_latex)
        assert v_bad == DomainVerdict.DOMAIN_INVALID
        assert "mismatched curly braces" in reason_bad

        # Bad arithmetic
        bad_arith = DecomposedClaim(
            claim_id="bad_math",
            text="Total revenue with 10 units at price 5: 10 * 5 = 65.",
            claim_type="numerical",
        )
        v_arith, reason_arith = val.validate(bad_arith)
        assert v_arith == DomainVerdict.DOMAIN_INVALID
        assert "Deterministic arithmetic error" in reason_arith

        # Correct arithmetic
        good_arith = DecomposedClaim(
            claim_id="good_math",
            text="Total revenue with 10 units at price 5: 10 * 5 = 50.",
            claim_type="numerical",
        )
        v_good, _ = val.validate(good_arith)
        assert v_good != DomainVerdict.DOMAIN_INVALID

    def test_dynamic_cross_domain_contamination(self):
        from salkg_guard.domain_registry import DynamicDomainValidator

        val = DynamicDomainValidator("cellular_biology")

        # Binary search asserted inside cellular biology
        alien_claim = DecomposedClaim(
            claim_id="alien",
            text="Diagram searches array with low [2] and high [8] using binary search algorithm.",
            claim_type="complexity",
        )
        verdict, reason = val.validate(alien_claim, context={"section_topic": "Mitosis and Cell Division"})
        assert verdict == DomainVerdict.DOMAIN_INVALID
        assert "Cross-domain contamination" in reason

    def test_decision_engine_omit_for_diagrams(self):
        from salkg_guard.decision_engine import DecisionEngine

        de = DecisionEngine()
        # Diagram claim with missing evidence
        c_diag = DecomposedClaim(
            claim_id="d1",
            text="Diagram node illustrating complex ungrounded cellular organelle pathway.",
            claim_type="diagram_node",
        )
        res_diag = ClaimValidationResult(
            claim=c_diag,
            axis1_faithfulness=FaithfulnessVerdict.MISSING_FROM_LECTURE,
            axis1_reason="No visual or spoken evidence found",
            axis2_domain=DomainVerdict.UNVERIFIABLE,
            axis2_reason="unverifiable",
        )

        rep = de.decide(
            request_id="req_d",
            lecture_id="lec_bio",
            content_type="diagram",
            domain="cellular_biology",
            claim_results=[res_diag],
            internal_contradictions=[],
        )
        assert rep.overall_decision == GuardDecision.OMIT
        assert "omitting visualization" in rep.decision_reason


