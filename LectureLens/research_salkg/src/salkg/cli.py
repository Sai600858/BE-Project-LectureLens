"""Command-Line Interface (CLI) for SALKG research prototype."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from salkg.alignment_baselines import (
    IndependentCombinedAligner,
    SemanticOnlyAligner,
    TemporalOnlyAligner,
)
from salkg.confidence import SelectiveAlignmentFilter
from salkg.graph_builder import KnowledgeGraphBuilder
from salkg.graph_validator import KnowledgeGraphValidator
from salkg.input_schema import GraphEdge, GraphNode, KnowledgeGraph
from salkg.metrics import AlignmentEvaluator, ClassificationEvaluator, GraphEvaluator
from salkg.normalization import InputNormalizer
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.provenance import ProvenanceTracker
from salkg.sequence_optimizer import SequenceAlignmentOptimizer
from salkg.subject_classifier import SubjectClassifier
from salkg.visualization import KnowledgeGraphVisualizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("salkg.cli")


def cmd_validate_input(args: argparse.Namespace) -> int:
    """Validate raw lecture input file."""
    input_path = Path(args.input)
    normalizer = InputNormalizer(strict=args.strict)
    try:
        lecture, report = normalizer.load_and_validate(input_path)
        print(f"Validation successful for: {input_path}")
        print(f"  Segments: {report['segment_count']}")
        print(f"  Visual Events: {report['visual_event_count']}")
        print(f"  Warnings: {len(report['warnings'])}")
        for w in report["warnings"][:5]:
            print(f"    - [WARN] {w}")
        print(f"  Errors: {len(report['errors'])}")
        for e in report["errors"]:
            print(f"    - [ERROR] {e}")
        return 0 if report["valid"] else 1
    except Exception as ex:
        print(f"Validation failed with exception: {ex}")
        return 1


def _get_split_items(manifest: Dict[str, Any], split: str = "test") -> List[Dict[str, str]]:
    """Retrieve lecture items for a specified partition ('dev', 'test', or 'all')."""
    if split == "dev":
        return manifest.get("dev_lectures", [])
    elif split == "all":
        dev = manifest.get("dev_lectures", [])
        test = manifest.get("test_lectures", [])
        seen = set()
        res = []
        for it in dev + test:
            if it["lecture_id"] not in seen:
                seen.add(it["lecture_id"])
                res.append(it)
        return res
    return manifest.get("test_lectures", [])


def cmd_run_baselines(args: argparse.Namespace) -> int:
    """Run all baseline alignment methods on dataset files."""
    config_path = Path(args.config)
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    manifest_path = Path(args.manifest or "research_salkg/experiments/manifests/dataset_manifest.json")
    if not manifest_path.exists():
        print(f"Dataset manifest not found at: {manifest_path}. Please create datasets first.")
        return 1

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    normalizer = InputNormalizer()
    temporal_aligner = TemporalOnlyAligner(tau=config.get("baselines", {}).get("temporal", {}).get("tau", 45.0))
    semantic_aligner = SemanticOnlyAligner()
    combined_aligner = IndependentCombinedAligner(
        weight_temporal=config.get("baselines", {}).get("combined", {}).get("weight_temporal", 0.5),
        weight_semantic=config.get("baselines", {}).get("combined", {}).get("weight_semantic", 0.5),
        tau=config.get("baselines", {}).get("combined", {}).get("tau", 45.0),
    )

    out_dir = Path(args.output or "research_salkg/results/raw")
    out_dir.mkdir(parents=True, exist_ok=True)

    split = getattr(args, "split", "test")
    split_items = _get_split_items(manifest, split)
    all_results = []
    for item in split_items:
        file_path = Path(item["file"])
        if not file_path.exists():
            continue
        lecture, _ = normalizer.load_and_validate(file_path)

        res_temp = temporal_aligner.align(lecture)
        res_sem = semantic_aligner.align(lecture)
        res_comb = combined_aligner.align(lecture)

        eval_temp = AlignmentEvaluator.evaluate(res_temp, lecture)
        eval_sem = AlignmentEvaluator.evaluate(res_sem, lecture)
        eval_comb = AlignmentEvaluator.evaluate(res_comb, lecture)

        record = {
            "lecture_id": lecture.metadata.lecture_id,
            "temporal": eval_temp,
            "semantic": eval_sem,
            "combined": eval_comb,
        }
        all_results.append(record)

    out_file = out_dir / "baselines_output.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print(f"Baselines successfully evaluated across {len(all_results)} test lectures.")
    print(f"Results written to: {out_file}")
    return 0


def cmd_run_proposed(args: argparse.Namespace) -> int:
    """Run proposed SALKG method (Subject-Adaptive + SeqDP + Confidence Rejection + KG)."""
    config_path = Path(args.config)
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    manifest_path = Path(args.manifest or "research_salkg/experiments/manifests/dataset_manifest.json")
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}")
        return 1

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    normalizer = InputNormalizer()
    classifier = SubjectClassifier()
    proposed_aligner = ProposedSubjectAdaptiveAligner(classifier=classifier)
    seq_optimizer = SequenceAlignmentOptimizer(
        fwd_jump_penalty=config.get("sequence_optimizer", {}).get("transition_penalty", 0.15),
        back_jump_penalty=config.get("sequence_optimizer", {}).get("backward_jump_penalty", 0.35),
        same_slide_bonus=config.get("sequence_optimizer", {}).get("same_slide_bonus", 0.05),
    )
    conf_filter = SelectiveAlignmentFilter(
        acceptance_threshold=config.get("confidence", {}).get("acceptance_threshold", 0.32),
        review_threshold=config.get("confidence", {}).get("review_threshold", 0.45),
        margin_threshold=config.get("confidence", {}).get("margin_threshold", 0.03),
    )
    builder = KnowledgeGraphBuilder()
    validator = KnowledgeGraphValidator(
        min_evidence_score=config.get("graph", {}).get("min_evidence_score", 0.30),
        concept_similarity_threshold=config.get("graph", {}).get("fuzzy_concept_match_threshold", 0.85),
    )

    out_dir = Path(args.output or "research_salkg/results/processed")
    out_dir.mkdir(parents=True, exist_ok=True)

    summary_records = []
    subject_predictions = []

    split = getattr(args, "split", "test")
    split_items = _get_split_items(manifest, split)
    for item in split_items:
        file_path = Path(item["file"])
        if not file_path.exists():
            continue
        lecture, _ = normalizer.load_and_validate(file_path)

        # 1. Subject Classification
        class_res = classifier.classify(lecture)
        inferred_subject = class_res["assigned_subject"]
        if lecture.metadata.subject_label:
            subject_predictions.append({
                "lecture_id": lecture.metadata.lecture_id,
                "predicted": inferred_subject,
                "true": lecture.metadata.subject_label,
            })

        # 2. Sequence-Aware Proposed Alignment
        seq_result, _ = seq_optimizer.optimize(lecture, proposed_aligner)

        # 3. Confidence Filtering
        filtered_result, conf_stats = conf_filter.filter_alignment(seq_result)
        align_metrics = AlignmentEvaluator.evaluate(filtered_result, lecture)

        # 4. Knowledge Graph Construction
        raw_kg = builder.build_graph(lecture, filtered_result, inferred_subject=inferred_subject)

        # 5. Graph Validation & DAG verification
        validated_kg, val_report = validator.validate_and_correct(raw_kg)
        graph_metrics = GraphEvaluator.evaluate(validated_kg, lecture)

        # 6. Export outputs
        kg_json_path = out_dir / f"{lecture.metadata.lecture_id}_kg.json"
        with open(kg_json_path, "w", encoding="utf-8") as f:
            json.dump(validated_kg.to_dict(), f, indent=2)

        summary_md_path = out_dir / f"{lecture.metadata.lecture_id}_summary.md"
        KnowledgeGraphVisualizer.export_summary_markdown(validated_kg, summary_md_path)

        dot_path = out_dir / f"{lecture.metadata.lecture_id}_graph.dot"
        KnowledgeGraphVisualizer.export_dot(validated_kg, dot_path)

        html_path = out_dir / f"{lecture.metadata.lecture_id}_viewer.html"
        KnowledgeGraphVisualizer.export_interactive_html(validated_kg, html_path)

        summary_records.append({
            "lecture_id": lecture.metadata.lecture_id,
            "inferred_subject": inferred_subject,
            "alignment_metrics": align_metrics,
            "graph_metrics": graph_metrics,
            "confidence_stats": conf_stats,
            "validation_report": val_report,
        })

    class_metrics = ClassificationEvaluator.evaluate(subject_predictions)

    final_payload = {
        "lectures": summary_records,
        "subject_classification_metrics": class_metrics,
    }

    out_file = out_dir / "proposed_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_payload, f, indent=2)

    print(f"Proposed SALKG successfully executed on {len(summary_records)} lectures.")
    print(f"Subject Classification Accuracy: {class_metrics.get('accuracy', 0.0):.3f}")
    print(f"Processed results and graph artifacts saved in: {out_dir}")
    return 0


def cmd_run_ablation(args: argparse.Namespace) -> int:
    """Run systematic ablation study over all configured variants."""
    config_path = Path(args.config)
    with open(config_path, "r", encoding="utf-8") as f:
        exp_config = yaml.safe_load(f)

    manifest_path = Path("research_salkg/experiments/manifests/dataset_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    normalizer = InputNormalizer()
    lectures = []
    split = getattr(args, "split", "test")
    split_items = _get_split_items(manifest, split)
    for item in split_items:
        p = Path(item["file"])
        if p.exists():
            lec, _ = normalizer.load_and_validate(p)
            lectures.append(lec)

    classifier = SubjectClassifier()
    ablation_results = {}
    for ab in exp_config.get("ablations", []):
        ab_name = ab["name"]
        print(f"Running ablation: {ab_name} - {ab['description']}")
        override = ab.get("override", {})

        # Configure aligner
        use_subj = override.get("proposed", {}).get("use_subject_conditioning", True)
        w_overrides = {}
        if "weight_temporal_override" in override.get("proposed", {}):
            w_overrides["weight_temporal"] = override["proposed"]["weight_temporal_override"]
        if "weight_semantic_override" in override.get("proposed", {}):
            w_overrides["weight_semantic"] = override["proposed"]["weight_semantic_override"]
        if "weight_content_type_override" in override.get("proposed", {}):
            w_overrides["weight_content_type"] = override["proposed"]["weight_content_type_override"]
        if "weight_symbol_identifier_override" in override.get("proposed", {}):
            w_overrides["weight_symbol_identifier"] = override["proposed"]["weight_symbol_identifier_override"]

        aligner = ProposedSubjectAdaptiveAligner(
            use_subject_conditioning=use_subj,
            weight_overrides=w_overrides,
        )

        use_seq = override.get("sequence_optimizer", {}).get("enabled", True)
        seq_opt = SequenceAlignmentOptimizer() if use_seq else None

        accept_th = override.get("confidence", {}).get("acceptance_threshold", 0.32)
        margin_th = override.get("confidence", {}).get("margin_threshold", 0.03)
        c_filter = SelectiveAlignmentFilter(acceptance_threshold=accept_th, margin_threshold=margin_th)

        enable_val = override.get("graph", {}).get("enable_validation", True)
        builder = KnowledgeGraphBuilder()
        validator = KnowledgeGraphValidator(min_evidence_score=0.30, concept_similarity_threshold=0.85)

        scores_list = []
        for lec in lectures:
            if seq_opt:
                raw_res, _ = seq_opt.optimize(lec, aligner)
            else:
                raw_res, _ = aligner.align(lec)

            filt_res, _ = c_filter.filter_alignment(raw_res)
            align_eval = AlignmentEvaluator.evaluate(filt_res, lec)

            inferred_subj = classifier.classify(lec)["assigned_subject"] if use_subj else "unknown"
            kg = builder.build_graph(lec, filt_res, inferred_subject=inferred_subj)
            if enable_val:
                kg, _ = validator.validate_and_correct(kg)
            graph_eval = GraphEvaluator.evaluate(kg, lec)

            scores_list.append({
                "alignment_f1": align_eval["f1"],
                "alignment_precision": align_eval["precision"],
                "alignment_recall": align_eval["recall"],
                "edge_f1": graph_eval["edge_f1"],
                "violations": graph_eval["remaining_violations"],
            })

        avg_align_f1 = sum(s["alignment_f1"] for s in scores_list) / len(scores_list) if scores_list else 0.0
        avg_edge_f1 = sum(s["edge_f1"] for s in scores_list) / len(scores_list) if scores_list else 0.0
        avg_violations = sum(s["violations"] for s in scores_list) / len(scores_list) if scores_list else 0.0

        ablation_results[ab_name] = {
            "description": ab["description"],
            "alignment_f1": round(avg_align_f1, 4),
            "edge_f1": round(avg_edge_f1, 4),
            "avg_violations": round(avg_violations, 2),
        }

    out_file = Path("research_salkg/results/tables/ablation_study.json")
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(ablation_results, f, indent=2)

    print(f"Ablation study completed. Results saved to: {out_file}")
    return 0


def cmd_query(args: argparse.Namespace) -> int:
    """Query constructed knowledge graph for concepts, prerequisites, or provenance."""
    graph_path = Path(args.graph)
    if not graph_path.exists():
        print(f"Knowledge graph file not found: {graph_path}")
        return 1

    with open(graph_path, "r", encoding="utf-8") as f:
        kg_dict = json.load(f)

    # Reconstruct KnowledgeGraph object
    nodes = {n["node_id"]: GraphNode(**n) for n in kg_dict.get("nodes", [])}
    edges = [GraphEdge(**e) for e in kg_dict.get("edges", [])]
    kg = KnowledgeGraph(
        lecture_id=kg_dict.get("lecture_id", "query_lecture"),
        subject=kg_dict.get("subject", "unknown"),
        nodes=nodes,
        edges=edges,
        validation_summary=kg_dict.get("validation_summary", {}),
    )

    if args.concept:
        print(f"\n=== Query: Concept '{args.concept}' ===")
        found = False
        for node in kg.nodes.values():
            if args.concept.lower() in node.label.lower():
                found = True
                print(f"Node ID: {node.node_id} | Label: {node.label} | Type: {node.node_type}")
                print(f"  Timestamps: {node.timestamps}")
                print(f"  Speech Provenance Segments: {node.provenance_segment_ids}")
                print(f"  Visual Provenance Events: {node.provenance_visual_ids}")

                # Find edges
                incoming = [e for e in kg.edges if e.target_id == node.node_id]
                outgoing = [e for e in kg.edges if e.source_id == node.node_id]
                print(f"  Incoming Relations ({len(incoming)}):")
                for e in incoming:
                    src_lbl = kg.nodes[e.source_id].label if e.source_id in kg.nodes else e.source_id
                    print(f"    <- [{e.relation_type}] from '{src_lbl}' (status: {e.validation_status}, conf: {e.calibrated_confidence:.2f})")
                print(f"  Outgoing Relations ({len(outgoing)}):")
                for e in outgoing:
                    tgt_lbl = kg.nodes[e.target_id].label if e.target_id in kg.nodes else e.target_id
                    print(f"    -> [{e.relation_type}] to '{tgt_lbl}' (status: {e.validation_status}, conf: {e.calibrated_confidence:.2f})")
        if not found:
            print(f"No concept matching '{args.concept}' found in graph.")

    if args.prerequisites:
        print("\n=== Query: Prerequisite Relationships ===")
        prereqs = [e for e in kg.edges if e.relation_type == "requires_prerequisite"]
        if not prereqs:
            print("No prerequisite relationships identified.")
        for e in prereqs:
            src = kg.nodes[e.source_id].label if e.source_id in kg.nodes else e.source_id
            tgt = kg.nodes[e.target_id].label if e.target_id in kg.nodes else e.target_id
            print(f"  - '{src}' is required before learning '{tgt}' [status: {e.validation_status}]")

    return 0


def cmd_generate_report(args: argparse.Namespace) -> int:
    """Generate final technical reports in Markdown and PDF."""
    from salkg.report_generator import generate_all_reports
    print("Generating comprehensive research report and PDF...")
    generate_all_reports()
    print("Reports successfully generated in research_salkg/reports/")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="SALKG: Subject-Adaptive Lecture Knowledge Graph CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # validate-input
    p_val = subparsers.add_parser("validate-input", help="Validate raw input file")
    p_val.add_argument("--input", required=True, help="Path to lecture JSON/JSONL/CSV")
    p_val.add_argument("--strict", action="store_true", help="Raise on validation warnings")
    p_val.set_defaults(func=cmd_validate_input)

    # run-baselines
    p_base = subparsers.add_parser("run-baselines", help="Execute baseline alignment methods")
    p_base.add_argument("--config", default="research_salkg/configs/default.yaml")
    p_base.add_argument("--manifest", default="research_salkg/experiments/manifests/dataset_manifest.json")
    p_base.add_argument("--output", default="research_salkg/results/raw")
    p_base.add_argument("--split", choices=["test", "dev", "all"], default="test", help="Dataset split to evaluate")
    p_base.set_defaults(func=cmd_run_baselines)

    # run-proposed
    p_prop = subparsers.add_parser("run-proposed", help="Execute proposed SALKG pipeline")
    p_prop.add_argument("--config", default="research_salkg/configs/default.yaml")
    p_prop.add_argument("--manifest", default="research_salkg/experiments/manifests/dataset_manifest.json")
    p_prop.add_argument("--output", default="research_salkg/results/processed")
    p_prop.add_argument("--split", choices=["test", "dev", "all"], default="test", help="Dataset split to evaluate")
    p_prop.set_defaults(func=cmd_run_proposed)

    # run-ablation
    p_abl = subparsers.add_parser("run-ablation", help="Execute ablation study")
    p_abl.add_argument("--config", default="research_salkg/configs/experiment.yaml")
    p_abl.add_argument("--split", choices=["test", "dev", "all"], default="test", help="Dataset split to evaluate")
    p_abl.set_defaults(func=cmd_run_ablation)

    # query
    p_qry = subparsers.add_parser("query", help="Query knowledge graph with provenance")
    p_qry.add_argument("--graph", required=True, help="Path to knowledge graph JSON")
    p_qry.add_argument("--concept", help="Concept label or ID to query")
    p_qry.add_argument("--prerequisites", action="store_true", help="List all prerequisite relations")
    p_qry.set_defaults(func=cmd_query)

    # generate-report
    p_rep = subparsers.add_parser("generate-report", help="Generate final technical reports")
    p_rep.set_defaults(func=cmd_generate_report)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
