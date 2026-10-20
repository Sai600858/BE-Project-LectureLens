"""Independent baseline alignment algorithms for multimodal lecture data."""

from __future__ import annotations

import time
from typing import List, Optional

from salkg.candidate_generation import CandidateGenerator
from salkg.input_schema import AlignmentResult, CandidateMatch, LectureData
from salkg.similarity import TFIDFScorer
from salkg.temporal_scoring import exponential_temporal_decay


class TemporalOnlyAligner:
    """Baseline A: Temporal-only alignment.
    Ranks visual events strictly by temporal proximity:
    Score(i, j) = exp(-|m_i - t_j| / tau)
    """

    def __init__(self, tau: float = 45.0, candidate_generator: Optional[CandidateGenerator] = None):
        self.tau = tau
        self.candidate_generator = candidate_generator or CandidateGenerator()

    def align(self, lecture: LectureData) -> AlignmentResult:
        start_time = time.perf_counter()
        matches: List[CandidateMatch] = []

        candidate_pairs = self.candidate_generator.generate_candidates(lecture.segments, lecture.visual_events)

        for seg, candidate_events in candidate_pairs:
            if not candidate_events:
                continue

            scored_candidates = []
            for vis in candidate_events:
                t_score = exponential_temporal_decay(seg.midpoint, vis.midpoint, tau=self.tau)
                scored_candidates.append((vis, t_score))

            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            best_vis, best_score = scored_candidates[0]
            second_score = scored_candidates[1][1] if len(scored_candidates) > 1 else 0.0
            margin = best_score - second_score

            matches.append(
                CandidateMatch(
                    transcript_id=seg.segment_id,
                    visual_id=best_vis.visual_id,
                    temporal_score=round(best_score, 4),
                    semantic_score=0.0,
                    content_type_score=0.0,
                    symbol_score=0.0,
                    raw_composite_score=round(best_score, 4),
                    calibrated_confidence=round(best_score, 4),
                    margin=round(margin, 4),
                    status="accepted",
                    method="baseline_temporal_only",
                    rationale=f"Temporal score: {best_score:.3f} (delta={abs(seg.midpoint - best_vis.midpoint):.1f}s)",
                )
            )

        duration = time.perf_counter() - start_time
        total_segments = len(lecture.segments)
        matched = len(matches)
        coverage = matched / total_segments if total_segments > 0 else 0.0

        return AlignmentResult(
            lecture_id=lecture.metadata.lecture_id,
            method_name="baseline_temporal_only",
            matches=matches,
            total_segments=total_segments,
            matched_segments=matched,
            coverage=round(coverage, 4),
            runtime_seconds=round(duration, 4),
        )


class SemanticOnlyAligner:
    """Baseline B: Semantic-only alignment.
    Ranks visual events strictly by TF-IDF cosine similarity of utterance text
    against visual extracted text and descriptions:
    Score(i, j) = CosineSim(TFIDF(s_i), TFIDF(v_j))
    """

    def __init__(self, n_min: int = 1, n_max: int = 2, candidate_generator: Optional[CandidateGenerator] = None):
        self.n_min = n_min
        self.n_max = n_max
        self.candidate_generator = candidate_generator or CandidateGenerator(max_temporal_distance=10000.0)  # global search

    def align(self, lecture: LectureData) -> AlignmentResult:
        start_time = time.perf_counter()
        matches: List[CandidateMatch] = []

        # Build corpus
        speech_docs = [s.text for s in lecture.segments]
        visual_docs = [
            f"{v.extracted_text} {v.description or ''} {v.formula_latex or ''} {v.code_content or ''}"
            for v in lecture.visual_events
        ]
        all_docs = speech_docs + visual_docs

        tfidf = TFIDFScorer(n_min=self.n_min, n_max=self.n_max).fit(all_docs)
        vis_vectors = [tfidf.transform(doc) for doc in visual_docs]

        candidate_pairs = self.candidate_generator.generate_candidates(lecture.segments, lecture.visual_events)

        for seg, candidate_events in candidate_pairs:
            if not candidate_events:
                continue

            seg_vec = tfidf.transform(seg.text)
            scored_candidates = []

            for vis in candidate_events:
                vis_idx = lecture.visual_events.index(vis)
                v_vec = vis_vectors[vis_idx]
                sim = tfidf.cosine_similarity(seg_vec, v_vec)
                scored_candidates.append((vis, sim))

            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            best_vis, best_score = scored_candidates[0]
            second_score = scored_candidates[1][1] if len(scored_candidates) > 1 else 0.0
            margin = best_score - second_score

            matches.append(
                CandidateMatch(
                    transcript_id=seg.segment_id,
                    visual_id=best_vis.visual_id,
                    temporal_score=0.0,
                    semantic_score=round(best_score, 4),
                    content_type_score=0.0,
                    symbol_score=0.0,
                    raw_composite_score=round(best_score, 4),
                    calibrated_confidence=round(best_score, 4),
                    margin=round(margin, 4),
                    status="accepted",
                    method="baseline_semantic_only",
                    rationale=f"TF-IDF Cosine Similarity: {best_score:.3f}",
                )
            )

        duration = time.perf_counter() - start_time
        total_segments = len(lecture.segments)
        matched = len(matches)
        coverage = matched / total_segments if total_segments > 0 else 0.0

        return AlignmentResult(
            lecture_id=lecture.metadata.lecture_id,
            method_name="baseline_semantic_only",
            matches=matches,
            total_segments=total_segments,
            matched_segments=matched,
            coverage=round(coverage, 4),
            runtime_seconds=round(duration, 4),
        )


class IndependentCombinedAligner:
    """Baseline C: Independent weighted combination.
    Score(i, j) = w_t * T(i, j) + w_s * M(i, j)
    where w_t + w_s = 1.0, fixed globally.
    """

    def __init__(
        self,
        weight_temporal: float = 0.50,
        weight_semantic: float = 0.50,
        tau: float = 45.0,
        candidate_generator: Optional[CandidateGenerator] = None,
    ):
        self.w_t = weight_temporal
        self.w_s = weight_semantic
        self.tau = tau
        self.candidate_generator = candidate_generator or CandidateGenerator()

    def align(self, lecture: LectureData) -> AlignmentResult:
        start_time = time.perf_counter()
        matches: List[CandidateMatch] = []

        speech_docs = [s.text for s in lecture.segments]
        visual_docs = [
            f"{v.extracted_text} {v.description or ''} {v.formula_latex or ''} {v.code_content or ''}"
            for v in lecture.visual_events
        ]
        all_docs = speech_docs + visual_docs

        tfidf = TFIDFScorer().fit(all_docs)
        vis_vectors = [tfidf.transform(doc) for doc in visual_docs]

        candidate_pairs = self.candidate_generator.generate_candidates(lecture.segments, lecture.visual_events)

        for seg, candidate_events in candidate_pairs:
            if not candidate_events:
                continue

            seg_vec = tfidf.transform(seg.text)
            scored_candidates = []

            for vis in candidate_events:
                t_score = exponential_temporal_decay(seg.midpoint, vis.midpoint, tau=self.tau)
                vis_idx = lecture.visual_events.index(vis)
                v_vec = vis_vectors[vis_idx]
                s_score = tfidf.cosine_similarity(seg_vec, v_vec)

                composite = self.w_t * t_score + self.w_s * s_score
                scored_candidates.append((vis, composite, t_score, s_score))

            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            best_vis, best_composite, best_t, best_s = scored_candidates[0]
            second_composite = scored_candidates[1][1] if len(scored_candidates) > 1 else 0.0
            margin = best_composite - second_composite

            matches.append(
                CandidateMatch(
                    transcript_id=seg.segment_id,
                    visual_id=best_vis.visual_id,
                    temporal_score=round(best_t, 4),
                    semantic_score=round(best_s, 4),
                    content_type_score=0.0,
                    symbol_score=0.0,
                    raw_composite_score=round(best_composite, 4),
                    calibrated_confidence=round(best_composite, 4),
                    margin=round(margin, 4),
                    status="accepted",
                    method="baseline_combined_weighted",
                    rationale=f"Combined: {best_composite:.3f} (Temporal: {best_t:.3f}, Semantic: {best_s:.3f})",
                )
            )

        duration = time.perf_counter() - start_time
        total_segments = len(lecture.segments)
        matched = len(matches)
        coverage = matched / total_segments if total_segments > 0 else 0.0

        return AlignmentResult(
            lecture_id=lecture.metadata.lecture_id,
            method_name="baseline_combined_weighted",
            matches=matches,
            total_segments=total_segments,
            matched_segments=matched,
            coverage=round(coverage, 4),
            runtime_seconds=round(duration, 4),
        )
