"""Knowledge Graph construction module with complete evidence grounding."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

from salkg.input_schema import (
    AlignmentResult,
    CandidateMatch,
    GraphEdge,
    GraphNode,
    KnowledgeGraph,
    LectureData,
    TranscriptSegment,
    VisualEvent,
)
from salkg.subject_schemas import SubjectSchemaManager


class KnowledgeGraphBuilder:
    """Builds evidence-grounded lecture knowledge graphs from aligned multimodal signals."""

    def __init__(self, schema_manager: Optional[SubjectSchemaManager] = None):
        self.schema_manager = schema_manager or SubjectSchemaManager()

    def build_graph(
        self,
        lecture: LectureData,
        alignment_result: AlignmentResult,
        inferred_subject: str = "unknown",
    ) -> KnowledgeGraph:
        """Construct the knowledge graph from lecture segments, visual events, and alignment."""
        kg = KnowledgeGraph(
            lecture_id=lecture.metadata.lecture_id,
            subject=inferred_subject,
        )

        vis_map: Dict[str, VisualEvent] = {v.visual_id: v for v in lecture.visual_events}
        seg_map: Dict[str, TranscriptSegment] = {s.segment_id: s for s in lecture.segments}

        # 1. Add structural visual nodes
        for v in lecture.visual_events:
            node_type = self._map_visual_type_to_node_type(v.visual_type, inferred_subject)
            vis_node = GraphNode(
                node_id=f"node_{v.visual_id}",
                label=v.extracted_text[:60] if v.extracted_text else f"{node_type}_{v.visual_id}",
                node_type=node_type,
                subject=inferred_subject,
                provenance_visual_ids=[v.visual_id],
                timestamps=[v.timestamp],
                attributes={
                    "visual_type": v.visual_type,
                    "extracted_text": v.extracted_text,
                    "formula_latex": v.formula_latex,
                    "code_content": v.code_content,
                    "description": v.description,
                },
            )
            kg.add_node(vis_node)

        # 2. Extract concepts and relations from accepted alignments
        # Filter accepted matches only
        accepted_matches = [m for m in alignment_result.matches if m.status == "accepted"]

        for match in accepted_matches:
            seg = seg_map.get(match.transcript_id)
            vis = vis_map.get(match.visual_id)
            if not seg or not vis:
                continue

            vis_node_id = f"node_{vis.visual_id}"

            # Add Transcript segment node
            seg_node_id = f"node_{seg.segment_id}"
            seg_node = GraphNode(
                node_id=seg_node_id,
                label=seg.text[:50] + "..." if len(seg.text) > 50 else seg.text,
                node_type="LectureSegment",
                subject=inferred_subject,
                provenance_segment_ids=[seg.segment_id],
                timestamps=[seg.start_time, seg.end_time],
                attributes={"speaker": seg.speaker_id, "text": seg.text},
            )
            kg.add_node(seg_node)

            # Multimodal correspondence edge
            corr_edge = GraphEdge(
                source_id=seg_node_id,
                target_id=vis_node_id,
                relation_type="corresponds_to",
                provenance_segment_ids=[seg.segment_id],
                provenance_visual_ids=[vis.visual_id],
                timestamps=[seg.start_time, vis.timestamp],
                alignment_score=match.raw_composite_score,
                calibrated_confidence=match.calibrated_confidence,
                validation_status="accepted",
                is_explicit=True,
            )
            kg.add_edge(corr_edge)

            # Concept Extraction from segment & visual
            extracted_concepts = self._extract_concepts_from_segment(seg, inferred_subject)
            for concept_label in extracted_concepts:
                c_id = self._canonical_concept_id(concept_label)
                concept_node = GraphNode(
                    node_id=c_id,
                    label=concept_label,
                    node_type="Concept",
                    subject=inferred_subject,
                    provenance_segment_ids=[seg.segment_id],
                    provenance_visual_ids=[vis.visual_id],
                    timestamps=[seg.start_time],
                    attributes={"canonical_name": concept_label.lower()},
                )
                kg.add_node(concept_node)

                # Explains edge: segment/concept explains visual event
                expl_edge = GraphEdge(
                    source_id=c_id,
                    target_id=vis_node_id,
                    relation_type="explains",
                    provenance_segment_ids=[seg.segment_id],
                    provenance_visual_ids=[vis.visual_id],
                    timestamps=[seg.start_time],
                    alignment_score=match.raw_composite_score,
                    calibrated_confidence=match.calibrated_confidence,
                    validation_status="accepted",
                    is_explicit=True,
                )
                kg.add_edge(expl_edge)

            # Relation extraction: prerequisite, definition, derivation, exemplifies, contradicts
            self._extract_semantic_relations(seg, vis, extracted_concepts, kg, match, inferred_subject)

        return kg

    def _map_visual_type_to_node_type(self, visual_type: str, subject: str) -> str:
        vtype = visual_type.lower()
        if vtype in ("formula", "equation"):
            return "Formula" if subject in ("mathematics", "physics_electronics") else "Concept"
        elif vtype in ("code_snippet", "pseudo_code"):
            return "CodeBlock" if subject in ("programming", "general_cs") else "Concept"
        elif vtype in ("diagram", "architecture_diagram", "circuit_diagram"):
            if subject == "physics_electronics":
                return "Diagram"
            elif subject in ("general_cs", "programming"):
                return "ArchitectureComponent"
            else:
                return "VisualEvent"
        elif vtype == "table":
            return "Concept"
        return "VisualEvent"

    def _canonical_concept_id(self, label: str) -> str:
        clean_lbl = re.sub(r"^(?:the|a|an)\s+", "", label.strip().lower())
        clean = re.sub(r"[^a-zA-Z0-9]+", "_", clean_lbl).strip("_")
        return f"concept_{clean}"

    def _extract_concepts_from_segment(self, seg: TranscriptSegment, subject: str) -> List[str]:
        """Extract domain concepts using syntactic pattern matching."""
        text = seg.text
        concepts = []

        # Patterns like: "the concept of X", "known as X", "X is defined as", "called X"
        patterns = [
            r"\b(?:concept of|notion of|topic of)\s+([A-Z][a-zA-Z0-9_ ]{2,30})",
            r"\b([A-Z][a-zA-Z0-9_]{2,25}(?:\s+[A-Z][a-zA-Z0-9_]{2,25})*)\s+(?:is defined as|is a|means)\b",
            r"\bcalled\s+([A-Z][a-zA-Z0-9_ ]{2,30})\b",
            r"\b(?:theorem|lemma|algorithm|rule)\s+([A-Z][a-zA-Z0-9_ ]{2,30})",
        ]
        for pat in patterns:
            for match in re.finditer(pat, text, re.IGNORECASE):
                candidate = match.group(1).strip()
                cleaned = re.sub(r"^(?:the|a|an)\s+", "", candidate, flags=re.IGNORECASE).strip()
                if len(cleaned) > 2 and cleaned.lower() not in ("this", "that", "it", "here", "an example"):
                    concepts.append(cleaned.title())

        # Fallback to key subject capitalized multi-words if no patterns matched
        if not concepts:
            capitalized_phrases = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text)
            stopwords = {
                "in this", "we have", "as shown", "now let", "let us", "thank you",
                "today", "today we", "from", "here", "there", "then", "when", "where",
                "notice", "observe", "consider", "look", "from this", "with this", "for example",
                "looking", "examining", "internally", "most", "moving", "types", "anatomy",
                "most importantly", "understanding", "the", "this", "that", "these", "those"
            }
            for cap in capitalized_phrases:
                cleaned = re.sub(r"^(?:the|a|an)\s+", "", cap, flags=re.IGNORECASE).strip()
                if len(cleaned) > 2 and cleaned.lower() not in stopwords:
                    concepts.append(cleaned)

        return list(dict.fromkeys(concepts))[:3]  # top 3 unique

    def _extract_semantic_relations(
        self,
        seg: TranscriptSegment,
        vis: VisualEvent,
        concepts: List[str],
        kg: KnowledgeGraph,
        match: CandidateMatch,
        subject: str,
    ) -> None:
        """Extract explicit pedagogical relations from utterance text."""
        text = seg.text.lower()
        vis_node_id = f"node_{vis.visual_id}"

        # 1. Prerequisite relation:
        # Form A: "before learning X, you must understand Y"
        prereq_match = re.search(
            r"(?:before (?:we discuss|learning|studying)\s+([a-zA-Z0-9_ '\-]+?),\s*(?:you need|one must understand|we review)\s+([a-zA-Z0-9_ '\-]+))",
            text,
        )
        # Form B: "understanding X is a prerequisite for studying Y" / "X is a prerequisite for Y"
        prereq_match2 = re.search(
            r"(?:understanding\s+)?([a-zA-Z0-9_ '\-]+?)\s+(?:is a prerequisite (?:for|before)|is required (?:for|before))\s+(?:studying\s+|understanding\s+)?([a-zA-Z0-9_ '\-]+)",
            text,
        )
        if prereq_match:
            raw_target = prereq_match.group(1).strip()
            raw_source = prereq_match.group(2).strip()

            targets = [
                re.sub(r"^(?:the|a|an)\s+", "", p.strip().strip("'. "), flags=re.I).title()
                for p in re.split(r"\b(?:and|as well as|,)\b", raw_target)
                if p.strip().strip("'. ")
            ]
            sources = [
                re.sub(r"^(?:the|a|an)\s+", "", p.strip().strip("'. "), flags=re.I).title()
                for p in re.split(r"\b(?:and|as well as|,)\b", raw_source)
                if p.strip().strip("'. ")
            ]

            for source_concept in sources:
                for target_concept in targets:
                    s_id = self._canonical_concept_id(source_concept)
                    t_id = self._canonical_concept_id(target_concept)

                    kg.add_node(GraphNode(node_id=s_id, label=source_concept, node_type="Prerequisite", subject=subject))
                    kg.add_node(GraphNode(node_id=t_id, label=target_concept, node_type="Concept", subject=subject))

                    kg.add_edge(
                        GraphEdge(
                            source_id=s_id,
                            target_id=t_id,
                            relation_type="requires_prerequisite",
                            provenance_segment_ids=[seg.segment_id],
                            provenance_visual_ids=[vis.visual_id],
                            timestamps=[seg.start_time],
                            alignment_score=match.raw_composite_score,
                            calibrated_confidence=match.calibrated_confidence,
                            validation_status="accepted",
                            is_explicit=True,
                        )
                    )
        elif prereq_match2:
            raw_source = prereq_match2.group(1).strip()
            raw_target = prereq_match2.group(2).strip()

            source_concept = re.sub(r"^(?:the|a|an)\s+", "", raw_source, flags=re.I).strip("'. ").title()
            target_concept = re.sub(r"^(?:the|a|an)\s+", "", raw_target, flags=re.I).strip("'. ").title()

            s_id = self._canonical_concept_id(source_concept)
            t_id = self._canonical_concept_id(target_concept)

            kg.add_node(GraphNode(node_id=s_id, label=source_concept, node_type="Prerequisite", subject=subject))
            kg.add_node(GraphNode(node_id=t_id, label=target_concept, node_type="Concept", subject=subject))

            kg.add_edge(
                GraphEdge(
                    source_id=s_id,
                    target_id=t_id,
                    relation_type="requires_prerequisite",
                    provenance_segment_ids=[seg.segment_id],
                    provenance_visual_ids=[vis.visual_id],
                    timestamps=[seg.start_time],
                    alignment_score=match.raw_composite_score,
                    calibrated_confidence=match.calibrated_confidence,
                    validation_status="accepted",
                    is_explicit=True,
                )
            )

        # 2. Derivation relation: "we derive X from Y" or "from this equation we derive"
        if "derive" in text or "derivation" in text or "substituting" in text:
            deriv_match = re.search(r"(?:we derive|derive(?:s)?|derivation of)\s+([a-zA-Z0-9_ '\-]+?)(?:\s+(?:from|equals|=|\.)|\b)", text, re.I)
            derived_concept = None
            if deriv_match:
                cand = re.sub(r"^(?:the|a|an)\s+", "", deriv_match.group(1).strip(), flags=re.I).strip("'. ").title()
                if len(cand) > 2 and cand.lower() not in ("this", "that", "it", "here", "an equation"):
                    derived_concept = cand
            elif concepts:
                derived_concept = concepts[0]

            if derived_concept:
                c_id = self._canonical_concept_id(derived_concept)
                kg.add_node(GraphNode(node_id=c_id, label=derived_concept, node_type="Concept", subject=subject))
                kg.add_edge(
                    GraphEdge(
                        source_id=vis_node_id,
                        target_id=c_id,
                        relation_type="derives" if subject in ("mathematics", "physics_electronics") else "produces",
                        provenance_segment_ids=[seg.segment_id],
                        provenance_visual_ids=[vis.visual_id],
                        timestamps=[seg.start_time],
                        alignment_score=match.raw_composite_score,
                        calibrated_confidence=match.calibrated_confidence,
                        validation_status="accepted",
                        is_explicit=True,
                    )
                )

        # 3. Exemplification: "an example of this is", "for example"
        if "for example" in text or "for instance" in text or "exemplifies" in text:
            if concepts:
                c_id = self._canonical_concept_id(concepts[0])
                kg.add_edge(
                    GraphEdge(
                        source_id=vis_node_id,
                        target_id=c_id,
                        relation_type="exemplifies",
                        provenance_segment_ids=[seg.segment_id],
                        provenance_visual_ids=[vis.visual_id],
                        timestamps=[seg.start_time],
                        alignment_score=match.raw_composite_score,
                        calibrated_confidence=match.calibrated_confidence,
                        validation_status="accepted",
                        is_explicit=True,
                    )
                )

        # 4. Contradiction: "contradicts" or "conflicts with earlier"
        if "contradicts" in text or "violates" in text or "does not hold" in text:
            if concepts:
                c_id = self._canonical_concept_id(concepts[0])
                kg.add_edge(
                    GraphEdge(
                        source_id=vis_node_id,
                        target_id=c_id,
                        relation_type="contradicts",
                        provenance_segment_ids=[seg.segment_id],
                        provenance_visual_ids=[vis.visual_id],
                        timestamps=[seg.start_time],
                        alignment_score=match.raw_composite_score,
                        calibrated_confidence=match.calibrated_confidence,
                        validation_status="accepted",
                        is_explicit=True,
                    )
                )
