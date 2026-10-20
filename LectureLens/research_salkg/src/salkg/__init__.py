"""SALKG: Subject-Adaptive Lecture Knowledge Graph Construction
Experimental Research Prototype
"""

__version__ = "0.1.0"
__author__ = "LectureLens Research Team"

from salkg.input_schema import (
    TranscriptSegment,
    VisualEvent,
    LectureMetadata,
    LectureData,
    AlignmentResult,
    CandidateMatch,
    GraphNode,
    GraphEdge,
    KnowledgeGraph,
)

__all__ = [
    "TranscriptSegment",
    "VisualEvent",
    "LectureMetadata",
    "LectureData",
    "AlignmentResult",
    "CandidateMatch",
    "GraphNode",
    "GraphEdge",
    "KnowledgeGraph",
]
