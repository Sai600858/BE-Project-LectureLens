"""Input and data structures for SALKG pipeline."""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


@dataclass
class TranscriptSegment:
    """Represents a discrete timestamped spoken utterance or ASR segment."""
    segment_id: str
    start_time: float
    end_time: float
    text: str
    speaker_id: Optional[str] = None
    confidence: Optional[float] = 1.0

    @property
    def midpoint(self) -> float:
        return (self.start_time + self.end_time) / 2.0

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class VisualEvent:
    """Represents an extracted visual artifact: slide, equation, code snippet, diagram, or table."""
    visual_id: str
    timestamp: float
    visual_type: str  # e.g., 'slide_text', 'formula', 'code_snippet', 'diagram', 'table'
    extracted_text: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    description: Optional[str] = None
    formula_latex: Optional[str] = None
    code_content: Optional[str] = None
    extraction_confidence: Optional[float] = 1.0

    def __post_init__(self):
        if self.start_time is None:
            self.start_time = self.timestamp
        if self.end_time is None:
            self.end_time = self.timestamp + 5.0  # default 5 second persistence if point event

    @property
    def midpoint(self) -> float:
        return (self.start_time + self.end_time) / 2.0

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class LectureMetadata:
    """Metadata describing the lecture source and context."""
    lecture_id: str
    title: str = "Untitled Lecture"
    subject_label: Optional[str] = None  # ground truth subject if known
    topic: Optional[str] = None
    language: str = "en"
    duration: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class GoldAnnotation:
    """Ground truth annotations for evaluation."""
    alignment_pairs: List[Dict[str, str]] = field(default_factory=list)  # [{'transcript_id': ..., 'visual_id': ...}]
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    relations: List[Dict[str, Any]] = field(default_factory=list)
    true_subject: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class LectureData:
    """Container for a complete lecture dataset instance."""
    metadata: LectureMetadata
    segments: List[TranscriptSegment]
    visual_events: List[VisualEvent]
    gold: Optional[GoldAnnotation] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metadata": self.metadata.to_dict(),
            "segments": [s.to_dict() for s in self.segments],
            "visual_events": [v.to_dict() for v in self.visual_events],
            "gold": self.gold.to_dict() if self.gold else None,
        }


@dataclass
class CandidateMatch:
    """Represents an alignment hypothesis between a transcript segment and visual event."""
    transcript_id: str
    visual_id: str
    temporal_score: float = 0.0
    semantic_score: float = 0.0
    content_type_score: float = 0.0
    symbol_score: float = 0.0
    sequence_penalty: float = 0.0
    raw_composite_score: float = 0.0
    calibrated_confidence: float = 0.0
    margin: float = 0.0
    status: str = "accepted"  # 'accepted', 'review', 'rejected'
    method: str = "proposed"
    rationale: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class AlignmentResult:
    """Aggregated output of an alignment execution over a lecture."""
    lecture_id: str
    method_name: str
    matches: List[CandidateMatch]
    total_segments: int
    matched_segments: int
    coverage: float
    runtime_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lecture_id": self.lecture_id,
            "method_name": self.method_name,
            "total_segments": self.total_segments,
            "matched_segments": self.matched_segments,
            "coverage": self.coverage,
            "runtime_seconds": self.runtime_seconds,
            "matches": [m.to_dict() for m in self.matches],
        }


@dataclass
class GraphNode:
    """Entity or content node in the constructed knowledge graph."""
    node_id: str
    label: str
    node_type: str
    subject: str
    provenance_segment_ids: List[str] = field(default_factory=list)
    provenance_visual_ids: List[str] = field(default_factory=list)
    timestamps: List[float] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class GraphEdge:
    """Directed, evidence-grounded relation between knowledge graph nodes."""
    source_id: str
    target_id: str
    relation_type: str
    provenance_segment_ids: List[str] = field(default_factory=list)
    provenance_visual_ids: List[str] = field(default_factory=list)
    timestamps: List[float] = field(default_factory=list)
    alignment_score: float = 1.0
    calibrated_confidence: float = 1.0
    validation_status: str = "accepted"  # 'accepted', 'unresolved', 'rejected', 'inferred'
    is_explicit: bool = True
    validation_issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class KnowledgeGraph:
    """Full evidence-grounded lecture knowledge graph representation."""
    lecture_id: str
    subject: str
    nodes: Dict[str, GraphNode] = field(default_factory=dict)
    edges: List[GraphEdge] = field(default_factory=list)
    validation_summary: Dict[str, Any] = field(default_factory=dict)

    def add_node(self, node: GraphNode) -> None:
        if node.node_id not in self.nodes:
            self.nodes[node.node_id] = node
        else:
            # Merge provenance
            existing = self.nodes[node.node_id]
            for seg in node.provenance_segment_ids:
                if seg not in existing.provenance_segment_ids:
                    existing.provenance_segment_ids.append(seg)
            for vis in node.provenance_visual_ids:
                if vis not in existing.provenance_visual_ids:
                    existing.provenance_visual_ids.append(vis)
            for ts in node.timestamps:
                if ts not in existing.timestamps:
                    existing.timestamps.append(ts)
            existing.attributes.update(node.attributes)

    def add_edge(self, edge: GraphEdge) -> None:
        self.edges.append(edge)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lecture_id": self.lecture_id,
            "subject": self.subject,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
            "validation_summary": self.validation_summary,
        }
