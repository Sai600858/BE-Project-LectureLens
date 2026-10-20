"""Evaluation metrics calculation for alignment, subject classification, and graph fidelity."""

from __future__ import annotations

import collections
import difflib
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from salkg.input_schema import AlignmentResult, CandidateMatch, KnowledgeGraph, LectureData


def calculate_prf(tp: int, fp: int, fn: int) -> Tuple[float, float, float]:
    """Calculate Precision, Recall, and F1 score with standard zero-division protection."""
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    return round(precision, 4), round(recall, 4), round(f1, 4)


class AlignmentEvaluator:
    """Evaluates alignment accuracy against ground truth annotations."""

    @staticmethod
    def evaluate(result: AlignmentResult, lecture: LectureData) -> Dict[str, Any]:
        """Compute alignment metrics: Precision, Recall, F1, Coverage, False Match Rate."""
        if not lecture.gold or not lecture.gold.alignment_pairs:
            return {
                "precision": 0.0,
                "recall": 0.0,
                "f1": 0.0,
                "coverage": result.coverage,
                "false_match_rate": 0.0,
                "note": "No ground truth alignment pairs available.",
            }

        gold_map: Dict[str, str] = {
            item["transcript_id"]: item["visual_id"]
            for item in lecture.gold.alignment_pairs
        }

        tp = 0
        fp = 0
        fn = 0

        # Map of model matches (accepted ones)
        accepted_matches = {m.transcript_id: m.visual_id for m in result.matches if m.status == "accepted"}

        for t_id, gold_v_id in gold_map.items():
            if t_id in accepted_matches:
                pred_v_id = accepted_matches[t_id]
                if pred_v_id == gold_v_id:
                    tp += 1
                else:
                    fp += 1
                    fn += 1
            else:
                fn += 1  # model abstained or had no match

        # False positives from segments predicted that are not in gold
        for t_id in accepted_matches:
            if t_id not in gold_map:
                fp += 1

        precision, recall, f1 = calculate_prf(tp, fp, fn)
        false_match_rate = fp / (tp + fp) if (tp + fp) > 0 else 0.0
        selective_prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0

        # Unconstrained top-1 match accuracy for forced-choice comparisons
        all_matches = {m.transcript_id: m.visual_id for m in result.matches}
        forced_tp = sum(1 for t_id, g_v_id in gold_map.items() if all_matches.get(t_id) == g_v_id)
        forced_acc = forced_tp / len(gold_map) if gold_map else 0.0

        return {
            "method": result.method_name,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "selective_precision": round(selective_prec, 4),
            "forced_choice_accuracy": round(forced_acc, 4),
            "coverage": result.coverage,
            "false_match_rate": round(false_match_rate, 4),
            "total_gold_pairs": len(gold_map),
            "accepted_matches": len(accepted_matches),
            "runtime_seconds": result.runtime_seconds,
        }


class ClassificationEvaluator:
    """Evaluates subject classification accuracy and macro-F1 across a test corpus."""

    @staticmethod
    def evaluate(predictions: List[Dict[str, str]]) -> Dict[str, Any]:
        """predictions: list of {'lecture_id': ..., 'predicted': ..., 'true': ...}"""
        if not predictions:
            return {"accuracy": 0.0, "macro_f1": 0.0, "confusion_matrix": {}}

        labels = sorted(list(set([p["true"] for p in predictions] + [p["predicted"] for p in predictions])))
        confusion: Dict[str, Dict[str, int]] = {true_lbl: {pred_lbl: 0 for pred_lbl in labels} for true_lbl in labels}

        correct = 0
        total = len(predictions)

        for p in predictions:
            t = p["true"]
            pred = p["predicted"]
            confusion[t][pred] += 1
            if t == pred:
                correct += 1

        accuracy = correct / total if total > 0 else 0.0

        # Calculate per-class F1 and macro-F1
        f1_scores = []
        for lbl in labels:
            tp = confusion[lbl][lbl]
            fp = sum(confusion[other][lbl] for other in labels if other != lbl)
            fn = sum(confusion[lbl][other] for other in labels if other != lbl)
            _, _, f1 = calculate_prf(tp, fp, fn)
            f1_scores.append(f1)

        macro_f1 = sum(f1_scores) / len(f1_scores) if f1_scores else 0.0

        return {
            "accuracy": round(accuracy, 4),
            "macro_f1": round(macro_f1, 4),
            "confusion_matrix": confusion,
            "total_samples": total,
        }


class GraphEvaluator:
    """Evaluates constructed Knowledge Graph fidelity against gold annotations and integrity rules."""

    @staticmethod
    def evaluate(kg: KnowledgeGraph, lecture: LectureData) -> Dict[str, Any]:
        gold = lecture.gold
        node_p, node_r, node_f1 = 0.0, 0.0, 0.0
        edge_p, edge_r, edge_f1 = 0.0, 0.0, 0.0

        if gold and gold.nodes:
            gold_labels = set(n["label"].lower().strip() for n in gold.nodes)
            pred_labels = set(n.label.lower().strip() for n in kg.nodes.values() if n.node_type in ("Concept", "Algorithm", "Prerequisite"))
            tp = len(pred_labels.intersection(gold_labels))
            fp = len(pred_labels - gold_labels)
            fn = len(gold_labels - pred_labels)
            node_p, node_r, node_f1 = calculate_prf(tp, fp, fn)

        if gold and gold.relations:
            # Pedagogical relations (requires_prerequisite, derives, exemplifies)
            gold_triples = [(r["source"].lower().strip(), r["relation"].lower().strip(), r["target"].lower().strip()) for r in gold.relations]

            def concepts_match(pred: str, gold_lbl: str) -> bool:
                if pred == gold_lbl:
                    return True
                # Clean punctuation, possessives, and articles
                p_clean = re.sub(r"^(?:the|a|an)\s+", "", re.sub(r"['’]s?\b", "", pred)).strip()
                g_clean = re.sub(r"^(?:the|a|an)\s+", "", re.sub(r"['’]s?\b", "", gold_lbl)).strip()
                if p_clean == g_clean or p_clean in g_clean or g_clean in p_clean:
                    return True
                if difflib.SequenceMatcher(None, p_clean, g_clean).ratio() >= 0.80:
                    return True
                # Token-level containment (e.g. 'kirchhoff law' in 'kirchhoff voltage law')
                p_words = set(p_clean.split())
                g_words = set(g_clean.split())
                if p_words and g_words:
                    if g_words.issubset(p_words) or p_words.issubset(g_words):
                        return True
                    if len(p_words.intersection(g_words)) / max(len(p_words), len(g_words)) >= 0.50:
                        return True
                return False

            strict_gold = set(gold_triples)
            pred_triples = []
            for e in kg.edges:
                if e.validation_status == "accepted" and e.relation_type in ("requires_prerequisite", "derives", "exemplifies"):
                    s_label = kg.nodes[e.source_id].label.lower().strip() if e.source_id in kg.nodes else e.source_id.lower().strip()
                    t_label = kg.nodes[e.target_id].label.lower().strip() if e.target_id in kg.nodes else e.target_id.lower().strip()
                    pred_triples.append((s_label, e.relation_type.lower(), t_label))

            # Strict Exact String Matching
            strict_pred_set = set(pred_triples)
            tp_strict = len(strict_pred_set.intersection(strict_gold))
            fp_strict = len(strict_pred_set - strict_gold)
            fn_strict = len(strict_gold - strict_pred_set)
            strict_p, strict_r, strict_f1 = calculate_prf(tp_strict, fp_strict, fn_strict)

            # Relaxed Concept Equivalence Matching
            matched_gold_indices = set()
            matched_pred_indices = set()
            for p_idx, (p_s, p_r, p_t) in enumerate(pred_triples):
                for g_idx, (g_s, g_r, g_t) in enumerate(gold_triples):
                    if g_idx in matched_gold_indices:
                        continue
                    if p_r == g_r and concepts_match(p_s, g_s) and concepts_match(p_t, g_t):
                        matched_gold_indices.add(g_idx)
                        matched_pred_indices.add(p_idx)
                        break

            tp_relaxed = len(matched_gold_indices)
            fp_relaxed = len(pred_triples) - len(matched_pred_indices)
            fn_relaxed = len(gold_triples) - len(matched_gold_indices)
            rel_p, rel_r, rel_f1 = calculate_prf(tp_relaxed, fp_relaxed, fn_relaxed)

            edge_p, edge_r, edge_f1 = rel_p, rel_r, rel_f1

        total_edges = len(kg.edges)
        accepted_edges = sum(1 for e in kg.edges if e.validation_status == "accepted")
        unsupported = sum(1 for e in kg.edges if not e.provenance_segment_ids and not e.provenance_visual_ids)
        unsupported_rate = unsupported / total_edges if total_edges > 0 else 0.0

        val_summary = kg.validation_summary or {}
        if not val_summary:
            # If validation was bypassed (e.g. no_graph_validation ablation),
            # run a non-mutating audit to measure actual remaining defects in the unvalidated graph
            from salkg.graph_validator import KnowledgeGraphValidator
            audit = KnowledgeGraphValidator().audit_graph(kg)
            remaining_violations = audit["total_violations"]
            cycles = audit["dag_cycles"]
            violations = audit["schema_violations"]
            duplicates_merged = 0
        else:
            duplicates_merged = val_summary.get("duplicates_merged", 0)
            cycles = val_summary.get("cycles_detected", 0)
            violations = val_summary.get("schema_violations", 0)
            remaining_violations = val_summary.get("remaining_violations", 0)

        # Attribution accuracy: for accepted corresponds_to edges, verify against gold alignment
        gold_align_map = {p["transcript_id"]: p["visual_id"] for p in gold.alignment_pairs} if gold else {}
        attr_correct = 0
        attr_total = 0
        for e in kg.edges:
            if e.relation_type == "corresponds_to" and e.validation_status == "accepted":
                for seg_id in e.provenance_segment_ids:
                    if seg_id in gold_align_map:
                        attr_total += 1
                        if any(vis_id == gold_align_map[seg_id] for vis_id in e.provenance_visual_ids):
                            attr_correct += 1
        attribution_acc = attr_correct / attr_total if attr_total > 0 else 1.0

        return {
            "node_precision": node_p,
            "node_recall": node_r,
            "node_f1": node_f1,
            "edge_precision": edge_p,
            "edge_recall": edge_r,
            "edge_f1": edge_f1,
            "strict_edge_f1": strict_f1 if (gold and gold.relations) else 0.0,
            "relaxed_edge_f1": edge_f1 if (gold and gold.relations) else 0.0,
            "evidence_attribution_accuracy": round(attribution_acc, 4),
            "unsupported_relation_rate": round(unsupported_rate, 4),
            "duplicate_entities_merged": duplicates_merged,
            "dag_cycles_detected": cycles,
            "schema_violations": violations,
            "remaining_violations": remaining_violations,
            "total_nodes": len(kg.nodes),
            "total_edges": total_edges,
            "accepted_edges": accepted_edges,
        }
