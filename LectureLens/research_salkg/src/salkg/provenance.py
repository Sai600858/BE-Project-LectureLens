"""Provenance tracking and evidence retrieval for SALKG Knowledge Graphs."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from salkg.input_schema import GraphEdge, GraphNode, KnowledgeGraph, LectureData


class ProvenanceTracker:
    """Retrieves and formats complete multimodal evidence for concepts and relations."""

    def __init__(self, lecture: LectureData, kg: KnowledgeGraph):
        self.lecture = lecture
        self.kg = kg
        self.seg_map = {s.segment_id: s for s in lecture.segments}
        self.vis_map = {v.visual_id: v for v in lecture.visual_events}

    def trace_concept(self, concept_name_or_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full evidence trail for a concept."""
        target_node: Optional[GraphNode] = None
        for node in self.kg.nodes.values():
            if (
                node.node_id == concept_name_or_id
                or node.label.lower() == concept_name_or_id.lower()
                or concept_name_or_id.lower() in node.label.lower()
            ):
                target_node = node
                break

        if not target_node:
            return None

        speech_evidence = [
            self.seg_map[s_id].to_dict()
            for s_id in target_node.provenance_segment_ids
            if s_id in self.seg_map
        ]
        visual_evidence = [
            self.vis_map[v_id].to_dict()
            for v_id in target_node.provenance_visual_ids
            if v_id in self.vis_map
        ]

        # Connected relations
        incoming = [e.to_dict() for e in self.kg.edges if e.target_id == target_node.node_id]
        outgoing = [e.to_dict() for e in self.kg.edges if e.source_id == target_node.node_id]

        return {
            "node": target_node.to_dict(),
            "speech_evidence": speech_evidence,
            "visual_evidence": visual_evidence,
            "incoming_relations": incoming,
            "outgoing_relations": outgoing,
        }

    def trace_relation(self, source_label: str, target_label: str, relation_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve evidence backing a specific relationship between concepts."""
        matched_edges = []
        for edge in self.kg.edges:
            src_node = self.kg.nodes.get(edge.source_id)
            tgt_node = self.kg.nodes.get(edge.target_id)
            if not src_node or not tgt_node:
                continue

            src_match = source_label.lower() in src_node.label.lower() or source_label.lower() in edge.source_id.lower()
            tgt_match = target_label.lower() in tgt_node.label.lower() or target_label.lower() in edge.target_id.lower()
            rel_match = relation_type is None or edge.relation_type.lower() == relation_type.lower()

            if src_match and tgt_match and rel_match:
                speech_ev = [self.seg_map[s_id].to_dict() for s_id in edge.provenance_segment_ids if s_id in self.seg_map]
                vis_ev = [self.vis_map[v_id].to_dict() for v_id in edge.provenance_visual_ids if v_id in self.vis_map]

                matched_edges.append({
                    "edge": edge.to_dict(),
                    "source_node": src_node.to_dict(),
                    "target_node": tgt_node.to_dict(),
                    "speech_evidence": speech_ev,
                    "visual_evidence": vis_ev,
                    "validation_status": edge.validation_status,
                    "is_explicit": edge.is_explicit,
                })

        return matched_edges
