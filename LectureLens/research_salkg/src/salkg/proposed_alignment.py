"""Proposed Subject-Adaptive Multimodal Alignment Algorithm (SALKG Core)."""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Tuple

from salkg.candidate_generation import CandidateGenerator
from salkg.confidence import ConfidenceCalibrator
from salkg.input_schema import AlignmentResult, CandidateMatch, LectureData, TranscriptSegment, VisualEvent
from salkg.similarity import (
    TFIDFScorer,
    compute_identifier_overlap,
    compute_symbol_overlap,
)
from salkg.subject_classifier import SubjectClassifier
from salkg.temporal_scoring import (
    asymmetric_temporal_compatibility,
    compute_adaptive_taus,
    interval_aware_temporal_compatibility,
)


class ContentTypeCompatibility:
    """Evaluates compatibility between verbal speech discourse markers and visual event types."""

    SPEECH_CUE_PATTERNS = {
        "formula": [
            r"\bequation\b", r"\bformula\b", r"\bcalculate\b", r"\bderivative\b",
            r"\bintegral\b", r"\bequal\b", r"\bsolve\b", r"\bexpression\b", r"\bvalue\b"
        ],
        "code_snippet": [
            r"\bcode\b", r"\bfunction\b", r"\bloop\b", r"\breturn\b", r"\bclass\b",
            r"\bvariable\b", r"\bcompile\b", r"\bline\b", r"\bimplements\b", r"\bmethod\b"
        ],
        "diagram": [
            r"\bdiagram\b", r"\bfigure\b", r"\bchart\b", r"\bgraph\b", r"\barchitecture\b",
            r"\billustrates\b", r"\bshows\b", r"\bflow\b", r"\bblock\b", r"\bcircuit\b"
        ],
        "table": [
            r"\btable\b", r"\brow\b", r"\bcolumn\b", r"\bentry\b", r"\bcomparison\b"
        ],
        "slide_text": [
            r"\bdefinition\b", r"\bconcept\b", r"\boverview\b", r"\bsummary\b", r"\bnote\b"
        ],
    }

    @classmethod
    def score(cls, speech_text: str, visual_type: str) -> float:
        """Return compatibility score in [0.0, 1.0]."""
        vtype = visual_type.lower()
        if "diagram" in vtype or "chart" in vtype:
            vtype_norm = "diagram"
        elif "code" in vtype:
            vtype_norm = "code_snippet"
        elif "formula" in vtype or "equation" in vtype or "derivation" in vtype:
            vtype_norm = "formula"
        elif "table" in vtype:
            vtype_norm = "table"
        elif "slide" in vtype or "text" in vtype:
            vtype_norm = "slide_text"
        else:
            vtype_norm = vtype

        patterns = cls.SPEECH_CUE_PATTERNS.get(vtype_norm, [])
        if not patterns:
            return 0.5  # neutral prior for unclassified visual types

        lower_speech = speech_text.lower()
        matched = sum(1 for pat in patterns if re.search(pat, lower_speech))
        if matched >= 2:
            return 1.0
        elif matched == 1:
            return 0.8
        else:
            return 0.35  # baseline compatibility even if no explicit keyword spoken


class ProposedSubjectAdaptiveAligner:
    """SALKG Proposed Subject-Adaptive Multimodal Alignment Method.

    Adapts weights and feature representations based on inferred subject schema:
    - Mathematics: boosts symbol overlap and formula compatibility.
    - Programming: boosts code identifier overlap and code block compatibility.
    - Physics/Electronics: balances circuit/equation compatibility and symbol overlap.
    - General CS: emphasizes architecture component and process semantic flow.
    """

    DEFAULT_ADAPTIVE_WEIGHTS = {
        "mathematics": {
            "weight_temporal": 0.25,
            "weight_semantic": 0.35,
            "weight_content_type": 0.20,
            "weight_symbol_identifier": 0.20,
        },
        "programming": {
            "weight_temporal": 0.25,
            "weight_semantic": 0.30,
            "weight_content_type": 0.25,
            "weight_symbol_identifier": 0.20,
        },
        "physics_electronics": {
            "weight_temporal": 0.30,
            "weight_semantic": 0.30,
            "weight_content_type": 0.20,
            "weight_symbol_identifier": 0.20,
        },
        "general_cs": {
            "weight_temporal": 0.35,
            "weight_semantic": 0.40,
            "weight_content_type": 0.15,
            "weight_symbol_identifier": 0.10,
        },
        "unknown": {
            "weight_temporal": 0.40,
            "weight_semantic": 0.40,
            "weight_content_type": 0.20,
            "weight_symbol_identifier": 0.00,
        },
    }

    def __init__(
        self,
        classifier: Optional[SubjectClassifier] = None,
        candidate_generator: Optional[CandidateGenerator] = None,
        weights_config: Optional[Dict[str, Dict[str, float]]] = None,
        use_subject_conditioning: bool = True,
        tau_lead: float = 25.0,
        tau_lag: float = 65.0,
        weight_overrides: Optional[Dict[str, float]] = None,
    ):
        self.classifier = classifier or SubjectClassifier()
        self.candidate_generator = candidate_generator or CandidateGenerator()
        self.adaptive_weights = weights_config or self.DEFAULT_ADAPTIVE_WEIGHTS
        self.use_subject_conditioning = use_subject_conditioning
        self.tau_lead = tau_lead
        self.tau_lag = tau_lag
        self.weight_overrides = weight_overrides or {}

    def score_pair(
        self,
        seg: TranscriptSegment,
        vis: VisualEvent,
        subject: str,
        tfidf: TFIDFScorer,
        vis_vector: Dict[str, float],
    ) -> Tuple[float, Dict[str, float]]:
        """Compute mathematically defined subject-adaptive compatibility score for a pair."""
        # 1. Interval-aware temporal compatibility
        t_score = interval_aware_temporal_compatibility(
            seg.midpoint, vis.start_time or vis.timestamp, vis.end_time or (vis.timestamp + 5.0),
            tau_lead=self.tau_lead, tau_lag=self.tau_lag
        )

        # 2. Semantic text similarity
        seg_vector = tfidf.transform(seg.text)
        s_score = tfidf.cosine_similarity(seg_vector, vis_vector)

        # 3. Content-type compatibility
        c_score = ContentTypeCompatibility.score(seg.text, vis.visual_type)

        # 4. Specialized symbol or identifier overlap
        if subject in ("mathematics", "physics_electronics"):
            target_repr = f"{vis.extracted_text} {vis.formula_latex or ''}"
            sym_score = compute_symbol_overlap(seg.text, target_repr)
        elif subject in ("programming", "general_cs"):
            target_repr = f"{vis.extracted_text} {vis.code_content or ''}"
            sym_score = compute_identifier_overlap(seg.text, target_repr)
        else:
            sym_score = 0.0

        # Retrieve weights
        subj_key = subject if self.use_subject_conditioning else "unknown"
        weights = dict(self.adaptive_weights.get(subj_key, self.adaptive_weights["unknown"]))

        # Apply any ablation overrides
        for k, v in self.weight_overrides.items():
            if k in weights:
                weights[k] = v

        # Normalize weights to sum to 1.0
        total_w = sum(weights.values())
        if total_w > 0:
            for k in weights:
                weights[k] /= total_w
        else:
            weights = {"weight_temporal": 0.5, "weight_semantic": 0.5, "weight_content_type": 0.0, "weight_symbol_identifier": 0.0}

        composite = (
            weights["weight_temporal"] * t_score
            + weights["weight_semantic"] * s_score
            + weights["weight_content_type"] * c_score
            + weights["weight_symbol_identifier"] * sym_score
        )

        score_breakdown = {
            "temporal": round(t_score, 4),
            "semantic": round(s_score, 4),
            "content_type": round(c_score, 4),
            "symbol_identifier": round(sym_score, 4),
            "composite": round(composite, 4),
        }
        return composite, score_breakdown

    def align(self, lecture: LectureData) -> Tuple[AlignmentResult, Dict[str, Any]]:
        """Run proposed subject-adaptive candidate alignment."""
        start_time = time.perf_counter()

        # Step 1: Pluggable subject and content type classification
        classification_result = self.classifier.classify(lecture)
        inferred_subject = classification_result["assigned_subject"]

        # Step 2: Build or reuse cached TF-IDF index (memoized per lecture)
        if not hasattr(lecture, "_tfidf_cache") or lecture._tfidf_cache is None:
            speech_docs = [s.text for s in lecture.segments]
            visual_docs = [
                f"{v.extracted_text} {v.description or ''} {v.formula_latex or ''} {v.code_content or ''}"
                for v in lecture.visual_events
            ]
            all_docs = speech_docs + visual_docs
            lecture._tfidf_cache = TFIDFScorer().fit(all_docs)
            lecture._vis_vectors_cache = [lecture._tfidf_cache.transform(doc) for doc in visual_docs]
        tfidf = lecture._tfidf_cache
        vis_vectors = getattr(lecture, "_vis_vectors_cache", [])

        calibrator = ConfidenceCalibrator()
        vis_index_map = {v.visual_id: idx for idx, v in enumerate(lecture.visual_events)}
        candidate_pairs = self.candidate_generator.generate_candidates(lecture.segments, lecture.visual_events)
        matches: List[CandidateMatch] = []

        for seg, candidate_events in candidate_pairs:
            if not candidate_events:
                continue

            # Candidate time-window pruning (keep visuals within ±180s when candidate set is large)
            if len(candidate_events) > 8:
                window_cands = [
                    v for v in candidate_events
                    if abs((getattr(v, "start_time", None) or v.timestamp) - seg.midpoint) <= 180.0
                ]
                if window_cands:
                    candidate_events = window_cands

            scored_candidates = []
            for vis in candidate_events:
                vis_idx = vis_index_map.get(vis.visual_id, 0)
                v_vec = vis_vectors[vis_idx]
                comp_score, breakdown = self.score_pair(seg, vis, inferred_subject, tfidf, v_vec)
                scored_candidates.append((vis, comp_score, breakdown))

            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            best_vis, best_score, best_breakdown = scored_candidates[0]
            second_score = scored_candidates[1][1] if len(scored_candidates) > 1 else 0.0
            margin = best_score - second_score
            cal_conf = calibrator.calibrate(best_score, margin)

            matches.append(
                CandidateMatch(
                    transcript_id=seg.segment_id,
                    visual_id=best_vis.visual_id,
                    temporal_score=best_breakdown["temporal"],
                    semantic_score=best_breakdown["semantic"],
                    content_type_score=best_breakdown["content_type"],
                    symbol_score=best_breakdown["symbol_identifier"],
                    raw_composite_score=round(best_score, 4),
                    calibrated_confidence=round(cal_conf, 4),
                    margin=round(margin, 4),
                    status="accepted",
                    method="proposed_salkg",
                    rationale=(
                        f"Subject: {inferred_subject} | Comp: {best_score:.3f} (cal_conf: {cal_conf:.3f}) "
                        f"[T:{best_breakdown['temporal']:.2f}, S:{best_breakdown['semantic']:.2f}, "
                        f"C:{best_breakdown['content_type']:.2f}, Sym:{best_breakdown['symbol_identifier']:.2f}]"
                    ),
                )
            )

        duration = time.perf_counter() - start_time
        total_segments = len(lecture.segments)
        matched = len(matches)
        coverage = matched / total_segments if total_segments > 0 else 0.0

        alignment_result = AlignmentResult(
            lecture_id=lecture.metadata.lecture_id,
            method_name="proposed_salkg",
            matches=matches,
            total_segments=total_segments,
            matched_segments=matched,
            coverage=round(coverage, 4),
            runtime_seconds=round(duration, 4),
        )

        meta_info = {
            "inferred_subject": inferred_subject,
            "classification_details": classification_result,
            "weights_used": self.adaptive_weights.get(
                inferred_subject if self.use_subject_conditioning else "unknown"
            ),
        }

        return alignment_result, meta_info
