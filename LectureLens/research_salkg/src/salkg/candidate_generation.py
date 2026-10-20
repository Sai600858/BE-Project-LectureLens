"""Candidate pair generation module for transcript-to-visual alignment."""

from __future__ import annotations

from typing import List, Tuple

from salkg.input_schema import TranscriptSegment, VisualEvent


class CandidateGenerator:
    """Generates candidate (segment, visual_event) pairs within search horizons."""

    def __init__(self, max_temporal_distance: float = 240.0, top_k_candidates: int = 8):
        self.max_temporal_distance = max_temporal_distance
        self.top_k_candidates = top_k_candidates

    def generate_candidates(
        self,
        segments: List[TranscriptSegment],
        visual_events: List[VisualEvent],
    ) -> List[Tuple[TranscriptSegment, List[VisualEvent]]]:
        """For each transcript segment, find plausible visual event candidates."""
        if not visual_events:
            return [(seg, []) for seg in segments]

        results = []
        for seg in segments:
            seg_mid = seg.midpoint
            # Filter visual events by temporal distance
            candidates = [
                vis for vis in visual_events
                if abs(seg_mid - vis.midpoint) <= self.max_temporal_distance
            ]

            # If no candidates within window, fallback to the 3 temporally closest events
            if not candidates:
                candidates = sorted(visual_events, key=lambda v: abs(seg_mid - v.midpoint))[:3]
            else:
                # Sort by temporal distance and keep top_k
                candidates.sort(key=lambda v: abs(seg_mid - v.midpoint))
                candidates = candidates[: self.top_k_candidates]

            results.append((seg, candidates))

        return results
