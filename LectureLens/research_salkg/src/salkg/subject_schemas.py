"""Subject-specific schema and ontology management for SALKG."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

import yaml
from salkg.input_schema import GraphEdge, GraphNode


class SubjectSchemaManager:
    """Manages configurable ontological schemas for target academic subjects."""

    def __init__(self, subjects_config_path: Optional[str] = None):
        if subjects_config_path is None:
            from pathlib import Path
            for cand in ["research_salkg/configs/subjects.yaml", "configs/subjects.yaml"]:
                if Path(cand).exists():
                    subjects_config_path = cand
                    break
        self.schemas = self._load_schemas(subjects_config_path)

    def _load_schemas(self, path: Optional[str]) -> Dict[str, Dict[str, Any]]:
        if path:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if "subjects" in data:
                        return data["subjects"]
            except Exception:
                pass
        # Built-in schemas fallback
        return {
            "mathematics": {
                "node_types": {
                    "Concept", "Definition", "Formula", "Theorem", "Lemma",
                    "DerivationStep", "WorkedExample", "Prerequisite", "Result",
                    "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "derives", "uses",
                    "requires_prerequisite", "corresponds_to", "appears_at",
                    "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite", "derives"},
            },
            "programming": {
                "node_types": {
                    "Concept", "Algorithm", "DataStructure", "CodeBlock", "Function",
                    "Input", "Output", "Complexity", "Prerequisite", "Example",
                    "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "implements", "produces",
                    "uses", "requires_prerequisite", "corresponds_to", "appears_at",
                    "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite"},
            },
            "physics_electronics": {
                "node_types": {
                    "Concept", "PhysicalQuantity", "Formula", "Component", "Diagram",
                    "Law", "Measurement", "Derivation", "Prerequisite",
                    "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "derives", "uses",
                    "requires_prerequisite", "corresponds_to", "appears_at",
                    "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite"},
            },
            "general_cs": {
                "node_types": {
                    "Concept", "Definition", "ArchitectureComponent", "Process",
                    "Algorithm", "Protocol", "Example", "Prerequisite",
                    "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "uses",
                    "requires_prerequisite", "corresponds_to", "appears_at",
                    "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite"},
            },
            "biology": {
                "node_types": {
                    "Concept", "Organ", "AnatomicalStructure", "BiologicalProcess",
                    "FunctionalUnit", "ChemicalSubstance", "Organism", "Classification",
                    "Prerequisite", "Definition", "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "regulates", "has_part",
                    "functional_unit_of", "requires_prerequisite", "corresponds_to",
                    "appears_at", "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite"},
            },
            "unknown": {
                "node_types": {
                    "Concept", "Definition", "Example", "Prerequisite",
                    "LectureSegment", "VisualEvent", "UnknownEntity"
                },
                "relation_types": {
                    "explains", "exemplifies", "defines", "uses",
                    "requires_prerequisite", "corresponds_to", "appears_at",
                    "contradicts", "unknown_relation"
                },
                "dag_relations": {"requires_prerequisite"},
            },
        }

    def get_allowed_node_types(self, subject: str) -> Set[str]:
        schema = self.schemas.get(subject, self.schemas["unknown"])
        return set(schema.get("node_types", []))

    def get_allowed_relation_types(self, subject: str) -> Set[str]:
        schema = self.schemas.get(subject, self.schemas["unknown"])
        return set(schema.get("relation_types", []))

    def get_dag_relations(self, subject: str) -> Set[str]:
        schema = self.schemas.get(subject, self.schemas["unknown"])
        return set(schema.get("dag_relations", []))

    def validate_node(self, subject: str, node: GraphNode) -> List[str]:
        """Check if node adheres to the subject schema."""
        issues = []
        allowed = self.get_allowed_node_types(subject)
        if node.node_type not in allowed:
            issues.append(f"Node '{node.node_id}' type '{node.node_type}' not in allowed schema for subject '{subject}'. Allowed: {sorted(allowed)}")
        return issues

    def validate_edge(self, subject: str, edge: GraphEdge, nodes: Dict[str, GraphNode]) -> List[str]:
        """Check if edge relation type is allowed and nodes exist."""
        issues = []
        allowed_relations = self.get_allowed_relation_types(subject)
        if edge.relation_type not in allowed_relations:
            issues.append(
                f"Edge {edge.source_id}->{edge.target_id} relation '{edge.relation_type}' not in allowed relations for subject '{subject}'."
            )
        if edge.source_id not in nodes:
            issues.append(f"Edge source '{edge.source_id}' does not exist in graph nodes.")
        if edge.target_id not in nodes:
            issues.append(f"Edge target '{edge.target_id}' does not exist in graph nodes.")
        return issues
