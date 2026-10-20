"""Relationship and Contradiction Analyzer (Module D of SALKG-Guard).

Analyzes mutual consistency between decomposed claims, checks relationship
validity versus mere entity co-occurrence, and propagates failures across
explicit deductive dependency chains without invalidating independent claims.
"""

from __future__ import annotations

import re

from typing import Any, Dict, List, Optional, Set, Tuple

from salkg_guard.report_schema import (
    ClaimValidationResult,
    DecomposedClaim,
    DomainVerdict,
    FaithfulnessVerdict,
)


class ContradictionAndDependencyAnalyzer:
    """Analyzes relationships, contradictions, and dependency chains across claims."""

    @classmethod
    def check_internal_contradictions(
        cls,
        claim_results: List[ClaimValidationResult],
    ) -> List[Tuple[str, str, str]]:
        """Identify direct mutual contradictions between generated claims.
        Returns list of tuples: (claim_id_1, claim_id_2, description).
        """
        contradictions = []
        n = len(claim_results)

        for i in range(n):
            c1 = claim_results[i].claim
            t1 = c1.text.lower()

            for j in range(i + 1, n):
                c2 = claim_results[j].claim
                t2 = c2.text.lower()

                # Check complexity conflict
                if c1.claim_type == "complexity" and c2.claim_type == "complexity":
                    # Expanded list of algorithmic concepts
                    known_algos = [
                        "binary search", "merge sort", "quick sort", "linear search",
                        "insertion sort", "bubble sort", "heap sort", "bfs", "dfs", "dijkstra"
                    ]
                    for algo in known_algos:
                        if algo in t1 and algo in t2:
                            bounds1 = re.findall(r"o\s*\([^\)]+\)", t1)
                            bounds2 = re.findall(r"o\s*\([^\)]+\)", t2)
                            if bounds1 and bounds2 and set(bounds1) != set(bounds2):
                                contradictions.append(
                                    (c1.claim_id, c2.claim_id, f"Conflicting asymptotic complexity for {algo} between claims: {bounds1} vs {bounds2}.")
                                )
                            elif ("o(log n)" in t1 and "o(n)" in t2) or ("o(log n)" in t1 and "o(n^2)" in t2) or ("o(n log n)" in t1 and "o(n^2)" in t2):
                                contradictions.append(
                                    (c1.claim_id, c2.claim_id, f"Conflicting asymptotic complexity for {algo} between claims.")
                                )

                # Check numerical value conflict for same subject/entity (relaxed threshold >= 2 shared terms)
                if c1.numerical_values and c2.numerical_values:
                    t1_words = set(t1.split())
                    t2_words = set(t2.split())
                    common = t1_words.intersection(t2_words)
                    if len(common) >= 2 and c1.numerical_values != c2.numerical_values:
                        if any(k in common for k in ["area", "radius", "voltage", "current", "cost", "answer", "result", "time", "speed", "height"]):
                            contradictions.append(
                                (c1.claim_id, c2.claim_id, f"Inconsistent numerical values for shared concept '{common}'.")
                            )

                # Check cross-domain contamination conflict (e.g. SQL section paired with binary search or kinematics)
                is_sql_sec = any(k in t1 for k in ["coalesce", "sql", "database", "string function", "date arithmetic"]) or any(k in t2 for k in ["coalesce", "sql", "database", "string function", "date arithmetic"])
                is_unrelated_algo = any(k in t1 for k in ["binary search", "arr[mid]", "search interval", "v = u + at"]) or any(k in t2 for k in ["binary search", "arr[mid]", "search interval", "v = u + at"])
                if is_sql_sec and is_unrelated_algo:
                    contradictions.append(
                        (c1.claim_id, c2.claim_id, "Cross-domain contradiction: array search / binary search or kinematics concept asserted in a SQL/database section context.")
                    )

        return contradictions

    @classmethod
    def propagate_dependencies(
        cls,
        claim_results: List[ClaimValidationResult],
    ) -> None:
        """Propagate failure status across explicit deductive dependency links.
        If premise claim C_i failed, dependent claim C_j is marked with dependency issue.
        Does NOT invalidate independent claims.
        """
        result_by_id = {cr.claim.claim_id: cr for cr in claim_results}

        for cr in claim_results:
            claim = cr.claim
            if not claim.dependencies:
                continue

            for dep_id in claim.dependencies:
                dep_res = result_by_id.get(dep_id)
                if not dep_res:
                    continue

                # If parent dependency was contradicted, missing, or domain invalid
                parent_failed = (
                    dep_res.axis1_faithfulness in (FaithfulnessVerdict.CONTRADICTED, FaithfulnessVerdict.MISSING_FROM_LECTURE)
                    or dep_res.axis2_domain == DomainVerdict.DOMAIN_INVALID
                )

                if parent_failed:
                    cr.discrepancy_detected = True
                    reason = f"Deductive dependency failure: relies on premise '{dep_id}' which was assessed as {dep_res.axis1_faithfulness.value} / {dep_res.axis2_domain.value}."
                    if cr.discrepancy_note:
                        cr.discrepancy_note += f" | {reason}"
                    else:
                        cr.discrepancy_note = reason

    @classmethod
    def validate_diagram_edges(
        cls,
        claim_results: List[ClaimValidationResult],
        salkg_edges: List[Dict[str, Any]],
    ) -> None:
        """Verify that directed diagram edges have relational evidence,
        not merely co-occurrence of the two endpoint entities.
        """
        for cr in claim_results:
            if cr.claim.claim_type != "diagram_edge":
                continue

            # Check if this edge has an explicit supporting evidence path
            has_edge_support = any(
                ep.source_modality in ("SALKG_EDGE", "SCREEN_SLIDE", "WHITEBOARD")
                for ep in cr.evidence_paths
            )

            if not has_edge_support:
                cr.axis1_faithfulness = FaithfulnessVerdict.PARTIALLY_SUPPORTED
                cr.axis1_reason = "Diagram edge endpoints exist, but the directed relationship is unsupported by lecture evidence."
                cr.discrepancy_detected = True
