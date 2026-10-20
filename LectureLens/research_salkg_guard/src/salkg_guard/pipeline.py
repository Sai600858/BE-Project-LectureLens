"""SALKG-Guard Pipeline Orchestrator.

Integrates Modules A-E into an end-to-end verification engine for educational generation.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Add parent path to sys.path
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from salkg.bridge import load_from_sqlite, run_salkg_pipeline
from salkg.input_schema import LectureData
from salkg_guard.contradiction_analyzer import ContradictionAndDependencyAnalyzer
from salkg_guard.decomposer import ClaimDecomposer
from salkg_guard.decision_engine import DecisionEngine
from salkg_guard.domain_registry import DomainValidatorRegistry
from salkg_guard.dual_axis import DualAxisValidator
from salkg_guard.provenance_resolver import SALKGProvenanceResolver
from salkg_guard.report_schema import ValidationReport


class SALKGGuard:
    """Master SALKG-Guard validation engine."""

    def __init__(self, domain_registry: Optional[DomainValidatorRegistry] = None):
        self.registry = domain_registry or DomainValidatorRegistry()
        self.dual_axis = DualAxisValidator(self.registry)
        self.decision_engine = DecisionEngine()

    def validate_generation(
        self,
        artifact: Union[str, Dict[str, Any], List[Dict[str, Any]]],
        lecture: LectureData,
        salkg_result: Optional[Dict[str, Any]] = None,
        content_type: str = "rag_answer",
        domain_hint: Optional[str] = None,
        request_id: Optional[str] = None,
        retry_count: int = 0,
    ) -> ValidationReport:
        """Run complete claim decomposition, provenance path resolution, dual-axis validation,
        relationship analysis, and risk-calibrated decision.
        """
        req_id = request_id or f"req_{uuid.uuid4().hex[:8]}"
        lecture_id = lecture.metadata.lecture_id

        # 1. Resolve Academic Domain
        inferred_subj = salkg_result.get("inferred_subject") if salkg_result else None
        resolved_domain = self.registry.resolve_domain(
            explicit_domain=domain_hint,
            lecture_title=lecture.metadata.title,
            inferred_subject=inferred_subj,
        )

        # 2. Module A: Decompose Artifact into Atomic Claims
        if content_type == "quiz":
            claims = ClaimDecomposer.decompose_quiz(artifact)
        elif content_type == "flashcard":
            claims = ClaimDecomposer.decompose_flashcards(artifact if isinstance(artifact, list) else [artifact])
        elif content_type == "diagram":
            claims = ClaimDecomposer.decompose_diagram(artifact if isinstance(artifact, dict) else {})
        else:  # text, rag_answer, study_notes
            text_str = artifact if isinstance(artifact, str) else json.dumps(artifact)
            claims = ClaimDecomposer.decompose_text(text_str)

        # 3. Module B: Resolve Provenance Paths via SALKG
        resolver = SALKGProvenanceResolver(lecture=lecture, salkg_result=salkg_result)
        claim_results = []

        for claim in claims:
            sup_paths, conf_paths, cite_valid = resolver.resolve_claim(claim)

            # 4. Module C & E: Dual-Axis Validation
            sec_top = getattr(claim, "section_topic", None) or lecture.metadata.topic or ""
            cr = self.dual_axis.evaluate_claim(
                claim=claim,
                supporting_paths=sup_paths,
                conflicting_paths=conf_paths,
                citation_valid=cite_valid,
                domain_name=resolved_domain,
                context={"domain": resolved_domain, "section_topic": sec_top, "lecture_title": lecture.metadata.title},
            )
            claim_results.append(cr)

        # 5. Module D: Contradiction & Dependency Analysis
        contradictions = ContradictionAndDependencyAnalyzer.check_internal_contradictions(claim_results)
        ContradictionAndDependencyAnalyzer.propagate_dependencies(claim_results)

        if content_type == "diagram" and salkg_result:
            kg_edges = salkg_result.get("knowledge_graph", {}).get("edges", [])
            ContradictionAndDependencyAnalyzer.validate_diagram_edges(claim_results, kg_edges)

        # 6. Phase 5: Risk-Calibrated Decision Engine
        coverage = salkg_result.get("alignment", {}).get("coverage", 0.0) if salkg_result else 0.0
        report = self.decision_engine.decide(
            request_id=req_id,
            lecture_id=lecture_id,
            content_type=content_type,
            domain=resolved_domain,
            claim_results=claim_results,
            internal_contradictions=contradictions,
            retry_count=retry_count,
            salkg_coverage=coverage,
        )

        report.executed_checks = [
            "claim_decomposition",
            "salkg_provenance_path_resolution",
            "citation_validity_check",
            "dual_axis_lecture_faithfulness",
            f"dual_axis_domain_{resolved_domain}",
            "internal_contradiction_analysis",
            "dependency_failure_propagation",
            "risk_calibrated_decision",
        ]

        if resolved_domain == "unknown":
            report.unavailable_checks.append("domain_specific_deterministic_validation")

        return report


def main():
    parser = argparse.ArgumentParser(description="SALKG-Guard verification CLI.")
    parser.add_argument("--db", type=str, help="Path to sqlite database.")
    parser.add_argument("--lecture-id", type=str, required=True, help="Lecture ID.")
    parser.add_argument("--content-type", type=str, default="rag_answer", help="rag_answer, study_notes, quiz, flashcard, diagram.")
    parser.add_argument("--domain", type=str, help="Domain override (e.g. mathematics, programming).")
    parser.add_argument("--artifact-file", type=str, help="File containing generated artifact text/JSON.")
    parser.add_argument("--artifact-text", type=str, help="Direct string of generated artifact.")
    parser.add_argument("--output", type=str, help="Path to output JSON.")
    args = parser.parse_args()

    # Read artifact
    if args.artifact_file:
        with open(args.artifact_file, "r", encoding="utf-8") as f:
            artifact_content = f.read().strip()
            try:
                artifact = json.loads(artifact_content)
            except json.JSONDecodeError:
                artifact = artifact_content
    elif args.artifact_text:
        try:
            artifact = json.loads(args.artifact_text)
        except json.JSONDecodeError:
            artifact = args.artifact_text
    else:
        # Read from stdin
        raw = sys.stdin.read().strip()
        try:
            artifact = json.loads(raw)
        except json.JSONDecodeError:
            artifact = raw

    # Load lecture data
    if args.db:
        lecture = load_from_sqlite(args.db, args.lecture_id)
    else:
        raise ValueError("Must provide --db")

    # Run SALKG alignment
    salkg_res = run_salkg_pipeline(lecture)

    # Run SALKG-Guard
    guard = SALKGGuard()
    report = guard.validate_generation(
        artifact=artifact,
        lecture=lecture,
        salkg_result=salkg_res,
        content_type=args.content_type,
        domain_hint=args.domain,
    )

    out_json = json.dumps(report.to_dict(), indent=2)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_json)
    else:
        print(out_json)


if __name__ == "__main__":
    main()
