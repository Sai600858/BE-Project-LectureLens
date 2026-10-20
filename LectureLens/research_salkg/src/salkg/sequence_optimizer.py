"""Sequence-aware alignment optimization via Dynamic Programming (DP)."""

from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

from salkg.candidate_generation import CandidateGenerator
from salkg.input_schema import AlignmentResult, CandidateMatch, LectureData, VisualEvent
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.similarity import TFIDFScorer


class SequenceAlignmentOptimizer:
    """Dynamic programming sequence optimizer with non-monotonic jump penalties.

    Objective:
        argmax_{y_1...y_N} sum_{i=1}^N A(s_i, v_{y_i}) - sum_{i=2}^N Phi(y_{i-1}, y_i)

    Transition penalty Phi(j_prev, j_curr):
        - Same slide: bonus of -bonus_stay
        - Monotonic next (j_curr == j_prev + 1): penalty 0.0
        - Forward jump (j_curr > j_prev + 1): fwd_penalty * (j_curr - j_prev - 1)
        - Backward jump (j_curr < j_prev): back_penalty * (j_prev - j_curr) + base_back_jump
    """

    def __init__(
        self,
        fwd_jump_penalty: float = 0.12,
        back_jump_penalty: float = 0.25,
        base_back_jump: float = 0.10,
        same_slide_bonus: float = 0.10,
        beam_width: int = 5,
    ):
        self.beam_width = beam_width
        self.fwd_jump_penalty = fwd_jump_penalty
        self.back_jump_penalty = back_jump_penalty
        self.base_back_jump = base_back_jump
        self.same_slide_bonus = same_slide_bonus

    def transition_cost(self, idx_prev: int, idx_curr: int) -> float:
        """Compute transition penalty between visual event sequence indices."""
        if idx_curr == idx_prev:
            return -self.same_slide_bonus
        elif idx_curr == idx_prev + 1:
            return 0.0
        elif idx_curr > idx_prev + 1:
            return self.fwd_jump_penalty * (idx_curr - idx_prev - 1)
        else:  # idx_curr < idx_prev (backward reference)
            return self.base_back_jump + self.back_jump_penalty * (idx_prev - idx_curr)

    def optimize(
        self,
        lecture: LectureData,
        proposed_aligner: ProposedSubjectAdaptiveAligner,
    ) -> Tuple[AlignmentResult, Dict[str, Any]]:
        """Run DP sequence optimization over all transcript segments."""
        start_time = time.perf_counter()

        classification_res = proposed_aligner.classifier.classify(lecture)
        inferred_subject = classification_res["assigned_subject"]

        # Reuse cached TF-IDF index from lecture data if present
        if hasattr(lecture, "_tfidf_cache") and lecture._tfidf_cache is not None:
            tfidf = lecture._tfidf_cache
            vis_vectors = getattr(lecture, "_vis_vectors_cache", None)
            if vis_vectors is None:
                visual_docs = [
                    f"{v.extracted_text} {v.description or ''} {v.formula_latex or ''} {v.code_content or ''}"
                    for v in lecture.visual_events
                ]
                vis_vectors = [tfidf.transform(doc) for doc in visual_docs]
                lecture._vis_vectors_cache = vis_vectors
        else:
            speech_docs = [s.text for s in lecture.segments]
            visual_docs = [
                f"{v.extracted_text} {v.description or ''} {v.formula_latex or ''} {v.code_content or ''}"
                for v in lecture.visual_events
            ]
            tfidf = TFIDFScorer().fit(speech_docs + visual_docs)
            vis_vectors = [tfidf.transform(doc) for doc in visual_docs]
            lecture._tfidf_cache = tfidf
            lecture._vis_vectors_cache = vis_vectors

        candidate_generator = proposed_aligner.candidate_generator
        candidate_pairs = candidate_generator.generate_candidates(lecture.segments, lecture.visual_events)

        N = len(lecture.segments)
        if N == 0 or len(lecture.visual_events) == 0:
            return AlignmentResult(
                lecture_id=lecture.metadata.lecture_id,
                method_name="proposed_sequence_optimized",
                matches=[],
                total_segments=0,
                matched_segments=0,
                coverage=0.0,
                runtime_seconds=0.0,
            ), {}

        vis_index_map = {v.visual_id: idx for idx, v in enumerate(lecture.visual_events)}

        # Precompute emission scores for each candidate
        dp_candidates: List[List[Tuple[VisualEvent, int, float, Dict[str, float]]]] = []
        for seg, candidate_events in candidate_pairs:
            stage_cands = []
            for vis in candidate_events:
                vis_idx = vis_index_map[vis.visual_id]
                v_vec = vis_vectors[vis_idx]
                comp_score, breakdown = proposed_aligner.score_pair(seg, vis, inferred_subject, tfidf, v_vec)
                stage_cands.append((vis, vis_idx, comp_score, breakdown))
            if not stage_cands:
                first_vis = lecture.visual_events[0]
                stage_cands.append((first_vis, 0, 0.0, {"temporal": 0.0, "semantic": 0.0, "content_type": 0.0, "symbol_identifier": 0.0}))
            dp_candidates.append(stage_cands)

        # DP Table initialization
        V: List[List[float]] = []
        backpointer: List[List[int]] = []

        # Stage 0
        V.append([cand[2] for cand in dp_candidates[0]])
        backpointer.append([-1 for _ in dp_candidates[0]])

        # Stages 1 to N-1 with Beam search pruning over previous stage states
        for i in range(1, N):
            curr_v = []
            curr_bp = []
            # Keep top-B states from previous stage to bound transition complexity
            prev_scores = V[i - 1]
            if len(prev_scores) > self.beam_width:
                top_k_prevs = sorted(range(len(prev_scores)), key=lambda k: prev_scores[k], reverse=True)[:self.beam_width]
            else:
                top_k_prevs = list(range(len(prev_scores)))

            for k_curr, (vis_curr, idx_curr, score_curr, _) in enumerate(dp_candidates[i]):
                best_val = -float("inf")
                best_prev_k = 0
                for k_prev in top_k_prevs:
                    vis_prev, idx_prev, _, _ = dp_candidates[i - 1][k_prev]
                    cost = self.transition_cost(idx_prev, idx_curr)
                    candidate_cumulative = V[i - 1][k_prev] + score_curr - cost
                    if candidate_cumulative > best_val:
                        best_val = candidate_cumulative
                        best_prev_k = k_prev
                curr_v.append(best_val)
                curr_bp.append(best_prev_k)
            V.append(curr_v)
            backpointer.append(curr_bp)

        # Backtrack optimal sequence
        best_last_k = max(range(len(V[N - 1])), key=lambda k: V[N - 1][k])
        optimal_indices = [best_last_k]
        for i in range(N - 1, 0, -1):
            optimal_indices.append(backpointer[i][optimal_indices[-1]])
        optimal_indices.reverse()

        # Construct matches
        matches: List[CandidateMatch] = []
        for i, opt_k in enumerate(optimal_indices):
            seg = lecture.segments[i]
            vis, vis_idx, comp_score, breakdown = dp_candidates[i][opt_k]

            # Compute margin relative to other candidates at stage i
            other_scores = [c[2] for idx, c in enumerate(dp_candidates[i]) if idx != opt_k]
            second_score = max(other_scores) if other_scores else 0.0
            margin = comp_score - second_score

            matches.append(
                CandidateMatch(
                    transcript_id=seg.segment_id,
                    visual_id=vis.visual_id,
                    temporal_score=breakdown["temporal"],
                    semantic_score=breakdown["semantic"],
                    content_type_score=breakdown["content_type"],
                    symbol_score=breakdown["symbol_identifier"],
                    raw_composite_score=round(comp_score, 4),
                    calibrated_confidence=round(comp_score, 4),
                    margin=round(margin, 4),
                    status="accepted",
                    method="proposed_sequence_optimized",
                    rationale=(
                        f"SeqDP (vis_idx={vis_idx}) | Comp: {comp_score:.3f} | Margin: {margin:.3f}"
                    ),
                )
            )

        duration = time.perf_counter() - start_time
        total_segments = len(lecture.segments)
        matched = len(matches)
        coverage = matched / total_segments if total_segments > 0 else 0.0

        return AlignmentResult(
            lecture_id=lecture.metadata.lecture_id,
            method_name="proposed_sequence_optimized",
            matches=matches,
            total_segments=total_segments,
            matched_segments=matched,
            coverage=round(coverage, 4),
            runtime_seconds=round(duration, 4),
        ), {
            "optimal_path_score": round(V[N - 1][best_last_k], 4),
            "inferred_subject": inferred_subject,
        }
