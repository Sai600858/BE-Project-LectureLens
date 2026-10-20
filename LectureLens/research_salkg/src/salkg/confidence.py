"""Confidence calibration and selective prediction (abstention/rejection) for SALKG."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

from salkg.input_schema import AlignmentResult, CandidateMatch


class ConfidenceCalibrator:
    """Calibrates composite scores and margins into empirical correctness probabilities.

    Uses a parametric logistic calibration:
        P(correct | score, margin) = 1 / (1 + exp(-(alpha * score + beta * margin + gamma)))
    Parameters tuned on development set.
    """

    def __init__(self, alpha: float = 4.5, beta: float = 3.2, gamma: float = -2.8):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma

    def calibrate(self, composite_score: float, margin: float) -> float:
        """Calculate calibrated probability in [0.0, 1.0]."""
        logit = self.alpha * composite_score + self.beta * margin + self.gamma
        prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, logit))))
        return round(prob, 4)


class SelectiveAlignmentFilter:
    """Implements selective prediction with reject and review options.

    Policy:
        - If score < threshold_accept: REJECT (low evidence)
        - Else If margin < threshold_margin: REVIEW (ambiguity between competing visual events)
        - Else: ACCEPT (confident unambiguous alignment)
    """

    def __init__(
        self,
        acceptance_threshold: float = 0.45,
        review_threshold: float = 0.60,
        margin_threshold: float = 0.06,
        calibrator: Optional[ConfidenceCalibrator] = None,
    ):
        self.acceptance_threshold = acceptance_threshold
        self.review_threshold = review_threshold
        self.margin_threshold = margin_threshold
        self.calibrator = calibrator or ConfidenceCalibrator()

    def filter_alignment(self, result: AlignmentResult) -> Tuple[AlignmentResult, Dict[str, Any]]:
        """Filter and assign calibrated confidence and status to each candidate match."""
        filtered_matches: List[CandidateMatch] = []
        accepted_count = 0
        review_count = 0
        rejected_count = 0

        for match in result.matches:
            calibrated_p = self.calibrator.calibrate(match.raw_composite_score, match.margin)

            # Decision rule
            if match.raw_composite_score < self.acceptance_threshold:
                status = "rejected"
                rationale = (
                    f"REJECTED: Composite score {match.raw_composite_score:.3f} below acceptance threshold "
                    f"{self.acceptance_threshold:.2f}."
                )
                rejected_count += 1
            elif match.margin < self.margin_threshold and match.raw_composite_score < self.review_threshold:
                status = "review"
                rationale = (
                    f"REVIEW: Ambiguous match. Margin {match.margin:.3f} below threshold {self.margin_threshold:.2f} "
                    f"with score {match.raw_composite_score:.3f}."
                )
                review_count += 1
            else:
                status = "accepted"
                rationale = (
                    f"ACCEPTED: High confidence ({calibrated_p:.3f}), score={match.raw_composite_score:.3f}, "
                    f"margin={match.margin:.3f}."
                )
                accepted_count += 1

            new_match = CandidateMatch(
                transcript_id=match.transcript_id,
                visual_id=match.visual_id,
                temporal_score=match.temporal_score,
                semantic_score=match.semantic_score,
                content_type_score=match.content_type_score,
                symbol_score=match.symbol_score,
                sequence_penalty=match.sequence_penalty,
                raw_composite_score=match.raw_composite_score,
                calibrated_confidence=calibrated_p,
                margin=match.margin,
                status=status,
                method=match.method,
                rationale=rationale,
            )
            filtered_matches.append(new_match)

        total = len(result.matches)
        effective_coverage = accepted_count / total if total > 0 else 0.0

        filtered_result = AlignmentResult(
            lecture_id=result.lecture_id,
            method_name=f"{result.method_name}_selective",
            matches=filtered_matches,
            total_segments=result.total_segments,
            matched_segments=accepted_count,
            coverage=round(effective_coverage, 4),
            runtime_seconds=result.runtime_seconds,
        )

        stats = {
            "total_candidates": total,
            "accepted": accepted_count,
            "review": review_count,
            "rejected": rejected_count,
            "coverage": round(effective_coverage, 4),
            "rejection_rate": round(rejected_count / total, 4) if total > 0 else 0.0,
            "review_rate": round(review_count / total, 4) if total > 0 else 0.0,
        }

        return filtered_result, stats

    @staticmethod
    def compute_risk_coverage_curve(
        matches: List[CandidateMatch],
        ground_truth_map: Dict[str, str],
        thresholds: Optional[List[float]] = None,
    ) -> List[Dict[str, float]]:
        """Compute Risk vs Coverage curve points over a sweep of rejection thresholds."""
        if thresholds is None:
            thresholds = [i * 0.05 for i in range(2, 19)]  # 0.10 to 0.90

        curve = []
        total_items = len(matches)
        if total_items == 0:
            return curve

    @staticmethod
    def find_optimal_threshold(
        matches: List[CandidateMatch],
        ground_truth_map: Dict[str, str],
        metric: str = "f1",
    ) -> float:
        """Find data-driven optimal acceptance threshold maximizing F1 on validation data."""
        best_t, best_score = 0.45, 0.0
        for t in [i * 0.05 for i in range(4, 18)]:
            accepted = [m for m in matches if m.raw_composite_score >= t]
            tp = sum(1 for m in accepted if ground_truth_map.get(m.transcript_id) == m.visual_id)
            fp = len(accepted) - tp
            fn = sum(
                1 for m in matches
                if ground_truth_map.get(m.transcript_id) == m.visual_id and m.raw_composite_score < t
            )
            precision = tp / max(1, tp + fp)
            recall = tp / max(1, tp + fn)
            f1 = 2 * precision * recall / max(1e-9, precision + recall)
            if f1 > best_score:
                best_score, best_t = f1, t
        return round(best_t, 2)

        for th in thresholds:
            accepted = [m for m in matches if m.raw_composite_score >= th]
            coverage = len(accepted) / total_items
            if not accepted:
                risk = 0.0
            else:
                errors = sum(1 for m in accepted if ground_truth_map.get(m.transcript_id) != m.visual_id)
                risk = errors / len(accepted)

            curve.append({
                "threshold": round(th, 2),
                "coverage": round(coverage, 4),
                "risk": round(risk, 4),
                "accepted_count": len(accepted),
            })

        return curve

    @staticmethod
    def find_optimal_threshold(
        matches: List[CandidateMatch],
        ground_truth_map: Dict[str, str],
        metric: str = "f1",
    ) -> float:
        """Find data-driven optimal acceptance threshold maximizing F1 on validation data."""
        best_t, best_score = 0.45, 0.0
        for t in [i * 0.05 for i in range(4, 18)]:
            accepted = [m for m in matches if m.raw_composite_score >= t]
            tp = sum(1 for m in accepted if ground_truth_map.get(m.transcript_id) == m.visual_id)
            fp = len(accepted) - tp
            fn = sum(
                1 for m in matches
                if ground_truth_map.get(m.transcript_id) == m.visual_id and m.raw_composite_score < t
            )
            precision = tp / max(1, tp + fp)
            recall = tp / max(1, tp + fn)
            f1 = 2 * precision * recall / max(1e-9, precision + recall)
            if f1 > best_score:
                best_score, best_t = f1, t
        return round(best_t, 2)
