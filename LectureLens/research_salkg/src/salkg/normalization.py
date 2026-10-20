"""Input normalization and validation module for SALKG."""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from salkg.input_schema import (
    GoldAnnotation,
    LectureData,
    LectureMetadata,
    TranscriptSegment,
    VisualEvent,
)

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when an unrecoverable validation defect is found in input data."""
    pass


class InputNormalizer:
    """Normalizes and validates multi-format lecture transcripts and visual events."""

    def __init__(self, strict: bool = False):
        self.strict = strict
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def load_and_validate(self, file_path: Union[str, Path]) -> Tuple[LectureData, Dict[str, Any]]:
        """Load and normalize a lecture dataset from JSON, JSONL, or CSV format."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")

        self.warnings = []
        self.errors = []

        suffix = path.suffix.lower()
        if suffix == ".json":
            data_dict = self._load_json(path)
        elif suffix == ".jsonl":
            data_dict = self._load_jsonl(path)
        elif suffix == ".csv":
            data_dict = self._load_csv(path)
        else:
            raise ValidationError(f"Unsupported file format '{suffix}'. Supported: .json, .jsonl, .csv")

        lecture_data = self._normalize_dict(data_dict)
        report = {
            "file": str(path),
            "valid": len(self.errors) == 0,
            "segment_count": len(lecture_data.segments),
            "visual_event_count": len(lecture_data.visual_events),
            "warnings": list(self.warnings),
            "errors": list(self.errors),
        }
        return lecture_data, report

    def normalize_dict(self, data: Dict[str, Any]) -> Tuple[LectureData, Dict[str, Any]]:
        """Normalize in-memory dictionary representation of a lecture."""
        self.warnings = []
        self.errors = []
        lecture_data = self._normalize_dict(data)
        report = {
            "valid": len(self.errors) == 0,
            "segment_count": len(lecture_data.segments),
            "visual_event_count": len(lecture_data.visual_events),
            "warnings": list(self.warnings),
            "errors": list(self.errors),
        }
        return lecture_data, report

    def _load_json(self, path: Path) -> Dict[str, Any]:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_jsonl(self, path: Path) -> Dict[str, Any]:
        records = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        # If records contain a single aggregated object or a sequence of segments
        if len(records) == 1 and "segments" in records[0]:
            return records[0]
        # Otherwise interpret list as segments or events
        return {"segments": records, "visual_events": [], "metadata": {"lecture_id": path.stem}}

    def _load_csv(self, path: Path) -> Dict[str, Any]:
        segments = []
        visual_events = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if "segment_id" in row or "text" in row:
                    segments.append(row)
                elif "visual_id" in row or "visual_type" in row:
                    visual_events.append(row)
        return {
            "metadata": {"lecture_id": path.stem},
            "segments": segments,
            "visual_events": visual_events,
        }

    def _normalize_dict(self, data: Dict[str, Any]) -> LectureData:
        # 1. Normalize Metadata
        raw_meta = data.get("metadata", {})
        lecture_id = str(raw_meta.get("lecture_id") or "lecture_001")
        title = str(raw_meta.get("title") or "Untitled Lecture")
        subject_label = raw_meta.get("subject_label")
        topic = raw_meta.get("topic")
        language = str(raw_meta.get("language") or "en")
        duration = float(raw_meta["duration"]) if "duration" in raw_meta and raw_meta["duration"] is not None else None

        metadata = LectureMetadata(
            lecture_id=lecture_id,
            title=title,
            subject_label=subject_label,
            topic=topic,
            language=language,
            duration=duration,
        )

        # 2. Normalize Transcript Segments
        raw_segments = data.get("segments", [])
        validated_segments: List[TranscriptSegment] = []
        seen_seg_ids = set()

        for idx, seg in enumerate(raw_segments):
            seg_id = str(seg.get("segment_id") or f"seg_{idx + 1:04d}")
            if seg_id in seen_seg_ids:
                new_id = f"{seg_id}_dup_{idx}"
                self.warnings.append(f"Duplicate segment ID '{seg_id}' detected. Renamed to '{new_id}'.")
                seg_id = new_id
            seen_seg_ids.add(seg_id)

            try:
                start_t = float(seg.get("start_time", 0.0))
            except (ValueError, TypeError):
                self.errors.append(f"Segment {seg_id}: invalid start_time '{seg.get('start_time')}'. Defaulted to 0.0.")
                start_t = 0.0

            try:
                end_t = float(seg.get("end_time", start_t + 5.0))
            except (ValueError, TypeError):
                self.errors.append(f"Segment {seg_id}: invalid end_time '{seg.get('end_time')}'. Defaulted to start + 5.0.")
                end_t = start_t + 5.0

            if start_t < 0:
                self.warnings.append(f"Segment {seg_id}: negative start_time {start_t} clamped to 0.0.")
                start_t = 0.0

            if end_t < start_t:
                self.warnings.append(f"Segment {seg_id}: end_time ({end_t}) < start_time ({start_t}). Swapping.")
                start_t, end_t = end_t, start_t

            text = str(seg.get("text", "")).strip()
            if not text:
                self.warnings.append(f"Segment {seg_id}: empty utterance text.")

            speaker_id = str(seg["speaker_id"]) if "speaker_id" in seg and seg["speaker_id"] is not None else None
            conf = float(seg.get("confidence", 1.0))

            validated_segments.append(
                TranscriptSegment(
                    segment_id=seg_id,
                    start_time=start_t,
                    end_time=end_t,
                    text=text,
                    speaker_id=speaker_id,
                    confidence=conf,
                )
            )

        # Sort segments chronologically by start_time
        validated_segments.sort(key=lambda s: s.start_time)

        # 3. Normalize Visual Events
        raw_events = data.get("visual_events", [])
        validated_events: List[VisualEvent] = []
        seen_vis_ids = set()

        for idx, ev in enumerate(raw_events):
            vis_id = str(ev.get("visual_id") or f"vis_{idx + 1:04d}")
            if vis_id in seen_vis_ids:
                new_id = f"{vis_id}_dup_{idx}"
                self.warnings.append(f"Duplicate visual event ID '{vis_id}'. Renamed to '{new_id}'.")
                vis_id = new_id
            seen_vis_ids.add(vis_id)

            ts = float(ev.get("timestamp", 0.0))
            start_t = float(ev["start_time"]) if "start_time" in ev and ev["start_time"] is not None else ts
            end_t = float(ev["end_time"]) if "end_time" in ev and ev["end_time"] is not None else max(ts + 5.0, start_t + 5.0)

            if end_t < start_t:
                start_t, end_t = end_t, start_t

            vtype = str(ev.get("visual_type") or "slide_text").lower().strip()
            text = str(ev.get("extracted_text", "")).strip()
            desc = str(ev["description"]).strip() if "description" in ev and ev["description"] is not None else None
            latex = str(ev["formula_latex"]).strip() if "formula_latex" in ev and ev["formula_latex"] is not None else None
            code = str(ev["code_content"]).strip() if "code_content" in ev and ev["code_content"] is not None else None
            conf = float(ev.get("extraction_confidence", 1.0))

            validated_events.append(
                VisualEvent(
                    visual_id=vis_id,
                    timestamp=ts,
                    visual_type=vtype,
                    extracted_text=text,
                    start_time=start_t,
                    end_time=end_t,
                    description=desc,
                    formula_latex=latex,
                    code_content=code,
                    extraction_confidence=conf,
                )
            )

        validated_events.sort(key=lambda v: (v.timestamp, v.start_time or 0.0))

        # 4. Normalize Optional Gold Annotations
        gold_annot = None
        if "gold" in data and data["gold"] is not None:
            raw_gold = data["gold"]
            gold_annot = GoldAnnotation(
                alignment_pairs=raw_gold.get("alignment_pairs", []),
                nodes=raw_gold.get("nodes", []),
                relations=raw_gold.get("relations", []),
                true_subject=raw_gold.get("true_subject"),
            )

        if self.strict and self.errors:
            raise ValidationError(f"Strict validation failed with errors: {self.errors}")

        return LectureData(
            metadata=metadata,
            segments=validated_segments,
            visual_events=validated_events,
            gold=gold_annot,
        )
