"""Unit tests for input validation and normalization."""

import json
import pytest
from pathlib import Path
from salkg.normalization import InputNormalizer, ValidationError


def test_valid_json_normalization(tmp_path):
    data = {
        "metadata": {"lecture_id": "test_lec_1", "subject_label": "mathematics"},
        "segments": [
            {"segment_id": "s1", "start_time": 0.0, "end_time": 10.0, "text": "Segment one."}
        ],
        "visual_events": [
            {"visual_id": "v1", "timestamp": 5.0, "visual_type": "slide_text", "extracted_text": "Slide one"}
        ]
    }
    p = tmp_path / "valid.json"
    p.write_text(json.dumps(data), encoding="utf-8")

    normalizer = InputNormalizer()
    lecture, report = normalizer.load_and_validate(p)

    assert lecture.metadata.lecture_id == "test_lec_1"
    assert len(lecture.segments) == 1
    assert len(lecture.visual_events) == 1
    assert report["valid"] is True


def test_malformed_intervals_and_swapping(tmp_path):
    data = {
        "metadata": {"lecture_id": "test_lec_swap"},
        "segments": [
            {"segment_id": "s1", "start_time": 20.0, "end_time": 10.0, "text": "Inverted interval."}
        ],
        "visual_events": []
    }
    p = tmp_path / "inverted.json"
    p.write_text(json.dumps(data), encoding="utf-8")

    normalizer = InputNormalizer()
    lecture, report = normalizer.load_and_validate(p)

    # start and end should be swapped
    assert lecture.segments[0].start_time == 10.0
    assert lecture.segments[0].end_time == 20.0
    assert any("Swapping" in w for w in report["warnings"])


def test_duplicate_id_resolution(tmp_path):
    data = {
        "metadata": {"lecture_id": "test_lec_dup"},
        "segments": [
            {"segment_id": "s1", "start_time": 0.0, "end_time": 5.0, "text": "First"},
            {"segment_id": "s1", "start_time": 6.0, "end_time": 10.0, "text": "Second with same id"}
        ],
        "visual_events": []
    }
    p = tmp_path / "dup.json"
    p.write_text(json.dumps(data), encoding="utf-8")

    normalizer = InputNormalizer()
    lecture, report = normalizer.load_and_validate(p)

    ids = [s.segment_id for s in lecture.segments]
    assert len(ids) == 2
    assert ids[0] == "s1"
    assert "dup" in ids[1]
    assert any("Duplicate segment ID" in w for w in report["warnings"])
