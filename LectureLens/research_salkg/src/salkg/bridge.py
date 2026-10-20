"""SALKG Bridge: High-performance adapter bridging LectureLens records with the original SALKG algorithm.

Executes the authentic SALKG pipeline without modification or imitation:
1. Input Normalization & Interval Integrity (InputNormalizer)
2. Discipline & Discourse Entropy Classification (SubjectClassifier)
3. Subject-Adaptive Multimodal Compatibility Scoring (ProposedSubjectAdaptiveAligner)
4. Non-Monotonic DP Sequence Optimization (SequenceAlignmentOptimizer)
5. Risk-Calibrated Confidence Filtering & Abstention (SelectiveAlignmentFilter)
6. Provenance-Grounded Knowledge Graph Generation (KnowledgeGraphBuilder)
7. Topological Prerequisite DAG & Schema Validation (KnowledgeGraphValidator)
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure salkg modules are importable
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from salkg.confidence import SelectiveAlignmentFilter
from salkg.graph_builder import KnowledgeGraphBuilder
from salkg.graph_validator import KnowledgeGraphValidator
from salkg.input_schema import (
    LectureData,
    LectureMetadata,
    TranscriptSegment,
    VisualEvent,
)
from salkg.normalization import InputNormalizer
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.sequence_optimizer import SequenceAlignmentOptimizer
from salkg.subject_classifier import SubjectClassifier


def load_from_sqlite(db_path: str, lecture_id: str) -> LectureData:
    """Extract and normalize lecture data directly from LectureLens persistent SQLite store."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Lecture Metadata
    cursor.execute("SELECT * FROM lectures WHERE id = ? OR room_id = ?", (lecture_id, lecture_id))
    lec_row = cursor.fetchone()
    if not lec_row:
        conn.close()
        raise ValueError(f"Lecture with id/room_id '{lecture_id}' not found in SQLite database.")

    resolved_id = lec_row["id"]
    metadata = LectureMetadata(
        lecture_id=resolved_id,
        title=lec_row["title"] or "Untitled Lecture",
        topic=lec_row["description"] or "",
    )

    # 2. Transcript Segments
    cursor.execute(
        "SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC",
        (resolved_id, lec_row["room_id"] or resolved_id),
    )
    seg_rows = cursor.fetchall()
    segments: List[TranscriptSegment] = []
    for r in seg_rows:
        s_id = str(r["id"]) if r["id"] is not None else f"seg_{len(segments)+1}"
        start_t = float(r["start_time"] or 0.0)
        end_t = float(r["end_time"]) if r["end_time"] is not None else start_t + 3.0
        text = str(r["text"] or "").strip()
        speaker = str(r["speaker_name"] or r["speaker_id"] or "Speaker")
        conf = float(r["confidence"] or 1.0)
        segments.append(
            TranscriptSegment(
                segment_id=s_id,
                start_time=start_t,
                end_time=end_t,
                text=text,
                speaker_id=speaker,
                confidence=conf,
            )
        )

    # 3. Visual Events: Board & Screen contents
    cursor.execute(
        "SELECT * FROM board_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC",
        (resolved_id, lec_row["room_id"] or resolved_id),
    )
    board_rows = cursor.fetchall()

    cursor.execute(
        "SELECT * FROM screen_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC",
        (resolved_id, lec_row["room_id"] or resolved_id),
    )
    screen_rows = cursor.fetchall()
    conn.close()

    visual_events: List[VisualEvent] = []

    # Map Board contents
    for b in board_rows:
        v_id = str(b["id"])
        ts = float(b["timestamp"] or 0.0)
        text = str(b["extracted_text"] or "")
        eq = str(b["equation"] or "")
        diag = str(b["diagram_description"] or "")

        v_type = "formula" if eq else ("diagram" if diag else "slide_text")
        combined_text = f"{text} {eq} {diag}".strip()

        visual_events.append(
            VisualEvent(
                visual_id=v_id,
                timestamp=ts,
                visual_type=v_type,
                extracted_text=combined_text or f"Whiteboard note at {ts:.1f}s",
                formula_latex=eq if eq else None,
                description=diag if diag else None,
            )
        )

    # Map Screen contents
    for s in screen_rows:
        v_id = str(s["id"])
        ts = float(s["timestamp"] or 0.0)
        title = str(s["slide_title"] or "")
        text = str(s["extracted_text"] or "")
        code = str(s["code_snippet"] or "")
        diag = str(s["diagram_description"] or "")

        v_type = "code_snippet" if code else ("diagram" if diag else "slide_text")
        combined_text = f"{title} {text} {code} {diag}".strip()

        visual_events.append(
            VisualEvent(
                visual_id=v_id,
                timestamp=ts,
                visual_type=v_type,
                extracted_text=combined_text or f"Slide content at {ts:.1f}s",
                code_content=code if code else None,
                description=diag if diag else None,
            )
        )

    # Sort visual events chronologically
    visual_events.sort(key=lambda v: v.timestamp)

    # Use InputNormalizer to ensure valid intervals and deduplicated IDs
    normalizer = InputNormalizer()
    raw_dict = {
        "metadata": metadata.to_dict(),
        "segments": [s.to_dict() for s in segments],
        "visual_events": [v.to_dict() for v in visual_events],
    }
    lecture_data, _ = normalizer.normalize_dict(raw_dict)
    return lecture_data


def run_salkg_pipeline(
    lecture: LectureData,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute the original SALKG multimodal alignment and knowledge graph pipeline."""
    cfg = config or {}
    start_time = time.perf_counter()

    # 1. Subject Classifier
    classifier = SubjectClassifier()
    classification_res = classifier.classify(lecture)
    inferred_subject = classification_res["assigned_subject"]

    # 2. Subject-Adaptive Aligner
    aligner = ProposedSubjectAdaptiveAligner(
        classifier=classifier,
        tau_lead=float(cfg.get("tau_lead", 25.0)),
        tau_lag=float(cfg.get("tau_lag", 65.0)),
    )

    # 3. Dynamic Programming Sequence Optimizer
    seq_optimizer = SequenceAlignmentOptimizer(
        fwd_jump_penalty=float(cfg.get("fwd_jump_penalty", 0.12)),
        back_jump_penalty=float(cfg.get("back_jump_penalty", 0.25)),
        base_back_jump=float(cfg.get("base_back_jump", 0.10)),
        same_slide_bonus=float(cfg.get("same_slide_bonus", 0.04)),
    )
    raw_seq_result, dp_meta = seq_optimizer.optimize(lecture, aligner)

    # 4. Risk-Calibrated Confidence Filter (Reject / Review / Accept)
    conf_filter = SelectiveAlignmentFilter(
        acceptance_threshold=float(cfg.get("acceptance_threshold", 0.35)),
        review_threshold=float(cfg.get("review_threshold", 0.50)),
        margin_threshold=float(cfg.get("margin_threshold", 0.04)),
    )
    filtered_alignment, conf_stats = conf_filter.filter_alignment(raw_seq_result)

    # 5. Knowledge Graph Construction with Multimodal Evidence Grounding
    graph_builder = KnowledgeGraphBuilder()
    raw_kg = graph_builder.build_graph(
        lecture=lecture,
        alignment_result=filtered_alignment,
        inferred_subject=inferred_subject,
    )

    # 6. Ontological DAG Validation & Cycle Breaking
    validator = KnowledgeGraphValidator(
        min_evidence_score=float(cfg.get("min_evidence_score", 0.30)),
        concept_similarity_threshold=float(cfg.get("concept_similarity_threshold", 0.85)),
    )
    validated_kg, val_report = validator.validate_and_correct(raw_kg)

    total_time = time.perf_counter() - start_time

    return {
        "success": True,
        "lecture_id": lecture.metadata.lecture_id,
        "runtime_seconds": round(total_time, 4),
        "inferred_subject": inferred_subject,
        "classification": classification_res,
        "confidence_stats": conf_stats,
        "dp_meta": dp_meta,
        "alignment": filtered_alignment.to_dict(),
        "knowledge_graph": validated_kg.to_dict(),
        "validation_report": val_report,
    }


def main():
    parser = argparse.ArgumentParser(description="SALKG Bridge for LectureLens integration.")
    parser.add_argument("--input", type=str, help="Path to input lecture JSON file.")
    parser.add_argument("--db", type=str, help="Path to LectureLens sqlite database.")
    parser.add_argument("--lecture-id", type=str, help="Lecture ID to process from database.")
    parser.add_argument("--config", type=str, help="Optional JSON string of hyperparameters.")
    parser.add_argument("--output", type=str, help="Path to save output JSON. If omitted, prints to stdout.")
    args = parser.parse_args()

    cfg = json.loads(args.config) if args.config else {}

    try:
        if args.db and args.lecture_id:
            lecture = load_from_sqlite(args.db, args.lecture_id)
        elif args.input:
            normalizer = InputNormalizer()
            lecture, _ = normalizer.load_and_validate(Path(args.input))
        else:
            # Read from stdin
            raw_data = json.load(sys.stdin)
            normalizer = InputNormalizer()
            lecture, _ = normalizer.normalize_and_validate(raw_data)

        result = run_salkg_pipeline(lecture, cfg)

        out_json = json.dumps(result, indent=2)
        if args.output:
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out_json)
        else:
            print(out_json)

        sys.exit(0)

    except Exception as e:
        err_res = {
            "success": False,
            "error": str(e),
            "lecture_id": getattr(args, "lecture_id", "unknown"),
        }
        print(json.dumps(err_res), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
