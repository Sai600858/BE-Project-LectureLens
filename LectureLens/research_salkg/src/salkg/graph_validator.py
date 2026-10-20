"""Graph validation, constraint verification, and deduplication for SALKG."""

from __future__ import annotations

import collections
import difflib
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from salkg.input_schema import GraphEdge, GraphNode, KnowledgeGraph
from salkg.subject_schemas import SubjectSchemaManager


class KnowledgeGraphValidator:
    """Validates ontological constraints, detects DAG cycles, and canonicalizes concepts."""

    def __init__(
        self,
        schema_manager: Optional[SubjectSchemaManager] = None,
        min_evidence_score: float = 0.30,
        concept_similarity_threshold: float = 0.88,
    ):
        self.schema_manager = schema_manager or SubjectSchemaManager()
        self.min_evidence_score = min_evidence_score
        self.concept_sim_threshold = concept_similarity_threshold

    def validate_and_correct(self, kg: KnowledgeGraph) -> Tuple[KnowledgeGraph, Dict[str, Any]]:
        """Execute full validation suite and flag or correct defects."""
        subject = kg.subject
        dag_relations = self.schema_manager.get_dag_relations(subject)

        report = {
            "initial_node_count": len(kg.nodes),
            "initial_edge_count": len(kg.edges),
            "schema_violations": 0,
            "broken_timestamps": 0,
            "missing_provenance": 0,
            "cycles_detected": 0,
            "duplicates_merged": 0,
            "accepted_edges": 0,
            "unresolved_edges": 0,
            "rejected_edges": 0,
            "issues": [],
        }

        # Step 1: Detect and Merge Duplicate Concepts
        duplicates_merged = self._merge_duplicate_concepts(kg)
        report["duplicates_merged"] = duplicates_merged

        # Step 2: Validate Nodes
        for node_id, node in list(kg.nodes.items()):
            schema_issues = self.schema_manager.validate_node(subject, node)
            if schema_issues:
                report["schema_violations"] += len(schema_issues)
                report["issues"].extend(schema_issues)

        # Step 3: Validate Edges (Hard constraints & soft plausibility)
        validated_edges: List[GraphEdge] = []
        for edge in kg.edges:
            edge_issues = []

            # Check existence of source and target
            if edge.source_id not in kg.nodes:
                edge_issues.append(f"Missing source node '{edge.source_id}'.")
            if edge.target_id not in kg.nodes:
                edge_issues.append(f"Missing target node '{edge.target_id}'.")

            # Check schema relation type
            allowed_rels = self.schema_manager.get_allowed_relation_types(subject)
            if edge.relation_type not in allowed_rels:
                edge_issues.append(f"Invalid relation type '{edge.relation_type}' for subject '{subject}'.")
                report["schema_violations"] += 1

            # Check provenance references
            if not edge.provenance_segment_ids and not edge.provenance_visual_ids:
                edge_issues.append("Unsupported relation: missing provenance segment or visual IDs.")
                report["missing_provenance"] += 1

            # Check timestamps
            if any(ts < 0 for ts in edge.timestamps):
                edge_issues.append("Broken timestamp: negative time value detected.")
                report["broken_timestamps"] += 1

            # Soft plausibility check on alignment score
            if edge.alignment_score < self.min_evidence_score:
                edge_issues.append(
                    f"Low alignment score ({edge.alignment_score:.3f} < {self.min_evidence_score:.2f})."
                )

            # Determine final status
            if edge_issues:
                if any("Missing source" in iss or "Missing target" in iss for iss in edge_issues):
                    edge.validation_status = "rejected"
                    report["rejected_edges"] += 1
                else:
                    edge.validation_status = "unresolved"
                    report["unresolved_edges"] += 1
                edge.validation_issues = edge_issues
                report["issues"].extend(edge_issues)
            else:
                edge.validation_status = "accepted"
                report["accepted_edges"] += 1

            validated_edges.append(edge)

        kg.edges = validated_edges

        # Step 4: DAG Cycle Detection on Prerequisite / Derivation relations
        for rel_type in dag_relations:
            cycles = self._detect_cycles_for_relation(kg, rel_type)
            if cycles:
                report["cycles_detected"] += len(cycles)
                for cycle in cycles:
                    cycle_str = " -> ".join(cycle)
                    issue = f"DAG Cycle detected in relation '{rel_type}': {cycle_str}"
                    report["issues"].append(issue)
                    # Break cycle by marking the lowest confidence edge in cycle as unresolved
                    self._resolve_cycle_edge(kg, cycle, rel_type)

        report["final_node_count"] = len(kg.nodes)
        report["final_edge_count"] = len(kg.edges)
        post_audit = self.audit_graph(kg)
        report["remaining_violations"] = post_audit["total_violations"]
        kg.validation_summary = report

        return kg, report

    def audit_graph(self, kg: KnowledgeGraph) -> Dict[str, Any]:
        """Audit graph for structural and semantic consistency defects without modifying the graph."""
        subject = kg.subject
        dag_relations = self.schema_manager.get_dag_relations(subject)

        # 1. Duplicate concepts count
        concept_nodes = [n for n in kg.nodes.values() if n.node_type == "Concept"]
        dup_count = 0
        seen_matched = set()
        for i in range(len(concept_nodes)):
            if i in seen_matched:
                continue
            n_a = concept_nodes[i]
            lbl_a = re.sub(r"^(?:the|a|an)\s+", "", n_a.label.lower().strip())
            for j in range(i + 1, len(concept_nodes)):
                if j in seen_matched:
                    continue
                n_b = concept_nodes[j]
                lbl_b = re.sub(r"^(?:the|a|an)\s+", "", n_b.label.lower().strip())
                if lbl_a == lbl_b or difflib.SequenceMatcher(None, lbl_a, lbl_b).ratio() >= self.concept_sim_threshold:
                    dup_count += 1
                    seen_matched.add(j)
                    break

        # 2. Node schema violations
        schema_violations = 0
        for node in kg.nodes.values():
            issues = self.schema_manager.validate_node(subject, node)
            schema_violations += len(issues)

        # 3. Edge schema & timestamp violations
        broken_timestamps = 0
        missing_provenance = 0
        allowed_rels = self.schema_manager.get_allowed_relation_types(subject)
        for edge in kg.edges:
            if edge.source_id not in kg.nodes or edge.target_id not in kg.nodes:
                schema_violations += 1
            if edge.relation_type not in allowed_rels:
                schema_violations += 1
            if not edge.provenance_segment_ids and not edge.provenance_visual_ids:
                missing_provenance += 1
            if any(ts < 0 for ts in edge.timestamps):
                broken_timestamps += 1

        # 4. DAG cycles
        cycles_count = 0
        for rel_type in dag_relations:
            cycles = self._detect_cycles_for_relation(kg, rel_type)
            cycles_count += len(cycles)

        total_violations = schema_violations + broken_timestamps + missing_provenance + cycles_count + dup_count
        return {
            "schema_violations": schema_violations,
            "broken_timestamps": broken_timestamps,
            "missing_provenance": missing_provenance,
            "dag_cycles": cycles_count,
            "duplicate_concepts": dup_count,
            "total_violations": total_violations,
        }

    def _merge_duplicate_concepts(self, kg: KnowledgeGraph) -> int:
        """Find concept nodes with near-identical labels and merge into canonical node."""
        concept_nodes = [n for n in kg.nodes.values() if n.node_type == "Concept"]
        merged_count = 0
        canonical_map: Dict[str, str] = {}  # old_id -> new_id

        for i in range(len(concept_nodes)):
            n_a = concept_nodes[i]
            if n_a.node_id in canonical_map:
                continue
            lbl_a = re.sub(r"^(?:the|a|an)\s+", "", n_a.label.lower().strip())
            for j in range(i + 1, len(concept_nodes)):
                n_b = concept_nodes[j]
                if n_b.node_id in canonical_map:
                    continue

                lbl_b = re.sub(r"^(?:the|a|an)\s+", "", n_b.label.lower().strip())
                is_duplicate = False

                if lbl_a == lbl_b:
                    is_duplicate = True
                else:
                    # Do not merge if they end with different suffixes like ' a' vs ' b' or ' 1' vs ' 2'
                    words_a = lbl_a.split()
                    words_b = lbl_b.split()
                    if len(words_a) > 1 and len(words_b) > 1 and words_a[-1] != words_b[-1] and (len(words_a[-1]) == 1 or len(words_b[-1]) == 1):
                        is_duplicate = False
                    else:
                        sim = difflib.SequenceMatcher(None, lbl_a, lbl_b).ratio()
                        if sim >= self.concept_sim_threshold:
                            is_duplicate = True

                if is_duplicate:
                    # Keep n_a as canonical, mark n_b to be merged
                    canonical_map[n_b.node_id] = n_a.node_id
                    for seg in n_b.provenance_segment_ids:
                        if seg not in n_a.provenance_segment_ids:
                            n_a.provenance_segment_ids.append(seg)
                    for vis in n_b.provenance_visual_ids:
                        if vis not in n_a.provenance_visual_ids:
                            n_a.provenance_visual_ids.append(vis)
                    for ts in n_b.timestamps:
                        if ts not in n_a.timestamps:
                            n_a.timestamps.append(ts)
                    merged_count += 1

        # Rewire edges and delete merged nodes
        if canonical_map:
            for edge in kg.edges:
                if edge.source_id in canonical_map:
                    edge.source_id = canonical_map[edge.source_id]
                if edge.target_id in canonical_map:
                    edge.target_id = canonical_map[edge.target_id]

            for old_id in canonical_map:
                if old_id in kg.nodes:
                    del kg.nodes[old_id]

        return merged_count

    def _detect_cycles_for_relation(self, kg: KnowledgeGraph, relation_type: str) -> List[List[str]]:
        """Detect directed cycles for a specific relation using Tarjan's / DFS approach."""
        adj: Dict[str, List[str]] = collections.defaultdict(list)
        for edge in kg.edges:
            if edge.relation_type == relation_type and edge.validation_status != "rejected":
                adj[edge.source_id].append(edge.target_id)

        visited: Dict[str, int] = {}  # 0: unvisited, 1: visiting, 2: visited
        cycles: List[List[str]] = []
        path: List[str] = []

        def dfs(u: str):
            visited[u] = 1
            path.append(u)
            for v in adj.get(u, []):
                if visited.get(v, 0) == 1:
                    # Cycle found
                    idx = path.index(v)
                    cycles.append(path[idx:] + [v])
                elif visited.get(v, 0) == 0:
                    dfs(v)
            path.pop()
            visited[u] = 2

        all_nodes = list(adj.keys())
        for node in all_nodes:
            if visited.get(node, 0) == 0:
                dfs(node)

        return cycles

    def _resolve_cycle_edge(self, kg: KnowledgeGraph, cycle: List[str], relation_type: str) -> None:
        """Mark the lowest confidence edge in a cycle as unresolved to preserve DAG structure."""
        cycle_edges = []
        for i in range(len(cycle) - 1):
            u, v = cycle[i], cycle[i + 1]
            for edge in kg.edges:
                if edge.source_id == u and edge.target_id == v and edge.relation_type == relation_type:
                    cycle_edges.append(edge)

        if cycle_edges:
            # Pick lowest confidence edge
            weakest = min(cycle_edges, key=lambda e: (e.calibrated_confidence, e.alignment_score))
            weakest.validation_status = "unresolved"
            weakest.validation_issues.append("Unresolved to break DAG prerequisite cycle.")
