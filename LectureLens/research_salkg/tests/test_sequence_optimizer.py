"""Unit tests for Dynamic Programming sequence alignment optimizer."""

import pytest
from salkg.input_schema import LectureData, LectureMetadata, TranscriptSegment, VisualEvent
from salkg.proposed_alignment import ProposedSubjectAdaptiveAligner
from salkg.sequence_optimizer import SequenceAlignmentOptimizer


def test_transition_costs():
    opt = SequenceAlignmentOptimizer(fwd_jump_penalty=0.1, back_jump_penalty=0.2, base_back_jump=0.1, same_slide_bonus=0.05)
    # Staying on same slide gives bonus
    assert opt.transition_cost(0, 0) == -0.05
    # Step to next slide has 0 cost
    assert opt.transition_cost(0, 1) == 0.0
    # Forward jump skipping 1 slide: 0.1 * (2 - 0 - 1) = 0.1
    assert opt.transition_cost(0, 2) == 0.1
    # Backward jump: 0.1 + 0.2 * (2 - 1) = 0.3
    assert opt.transition_cost(2, 1) == pytest.approx(0.3)


def test_sequence_optimizer_execution():
    opt = SequenceAlignmentOptimizer()
    aligner = ProposedSubjectAdaptiveAligner()
    lecture = LectureData(
        metadata=LectureMetadata(lecture_id="seq_test"),
        segments=[
            TranscriptSegment("s1", 10.0, 20.0, "Slide one introduction"),
            TranscriptSegment("s2", 22.0, 32.0, "Continuing on slide one"),
            TranscriptSegment("s3", 45.0, 55.0, "Moving to slide two")
        ],
        visual_events=[
            VisualEvent("v1", 12.0, "slide_text", "Slide One Content"),
            VisualEvent("v2", 48.0, "slide_text", "Slide Two Content")
        ]
    )

    result, meta = opt.optimize(lecture, aligner)
    assert len(result.matches) == 3
    # s1 and s2 should both align to v1, s3 to v2
    assert result.matches[0].visual_id == "v1"
    assert result.matches[1].visual_id == "v1"
    assert result.matches[2].visual_id == "v2"
