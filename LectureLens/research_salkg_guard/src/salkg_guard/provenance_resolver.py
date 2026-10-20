"""SALKG Provenance Path Resolver (Module B of SALKG-Guard).

Traces generated claims to verifiable raw lecture signals, alignment matches,
and knowledge graph relationships. Enforces citation validity and uncovers
cross-modal and contradictory evidence paths.
"""

from __future__ import annotations

import difflib
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from salkg.input_schema import LectureData, TranscriptSegment, VisualEvent
from salkg_guard.report_schema import DecomposedClaim, EvidencePath

# Meaningful stop words to ignore in token overlap
STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
    "it", "its", "this", "that", "these", "those", "and", "or", "but"
}


def tokenize(text: str) -> Set[str]:
    """Tokenize and filter stop words."""
    words = re.findall(r"\b[a-zA-Z0-9_\-\$]+\b", text.lower())
    return {w for w in words if len(w) > 1 and w not in STOP_WORDS}


class SALKGProvenanceResolver:
    """Resolves provenance paths between decomposed claims and authentic lecture evidence."""

    def __init__(self, lecture: LectureData, salkg_result: Optional[Dict[str, Any]] = None):
        self.lecture = lecture
        self.salkg_result = salkg_result or {}
        self.segments = lecture.segments
        self.visual_events = lecture.visual_events

        # Compute lecture time bounds
        seg_times = [s.end_time for s in self.segments] + [s.start_time for s in self.segments]
        vis_times = [v.timestamp for v in self.visual_events]
        all_times = seg_times + vis_times
        self.max_time = max(all_times) if all_times else 0.0

        # Build index of SALKG alignment matches
        self.alignment_by_seg: Dict[str, Dict[str, Any]] = {}
        self.alignment_by_vis: Dict[str, List[Dict[str, Any]]] = {}

        alignment = self.salkg_result.get("alignment", {})
        matches = alignment.get("matches", [])
        for m in matches:
            s_id = str(m.get("transcript_id"))
            v_id = str(m.get("visual_id"))
            self.alignment_by_seg[s_id] = m
            self.alignment_by_vis.setdefault(v_id, []).append(m)

        # Build KG edge index
        self.kg_edges = self.salkg_result.get("knowledge_graph", {}).get("edges", [])

        # Pre-build token index for transcript segments and visual events
        self.seg_token_index = {str(s.segment_id): tokenize(s.text) for s in self.segments}
        self.vis_token_index = {
            str(v.visual_id): tokenize(f"{v.extracted_text} {v.formula_latex or ''} {v.code_content or ''}")
            for v in self.visual_events
        }

    def resolve_claim(
        self,
        claim: DecomposedClaim,
    ) -> Tuple[List[EvidencePath], List[EvidencePath], bool]:
        """Find supporting evidence paths, conflicting evidence paths, and citation validity for claim."""
        supporting_paths: List[EvidencePath] = []
        conflicting_paths: List[EvidencePath] = []
        citation_valid = True

        claim_tokens = tokenize(claim.text)
        if not claim_tokens:
            return [], [], True

        # 1. Verify Citation (if an explicit timestamp is cited)
        if claim.cited_seconds is not None:
            cited_sec = claim.cited_seconds
            # If cited seconds is beyond lecture duration + 5s buffer, citation is invalid (hallucination)
            if self.max_time > 0 and cited_sec > (self.max_time + 5.0):
                citation_valid = False
            elif cited_sec < 0:
                citation_valid = False
            else:
                # Find evidence specifically around cited timestamp
                local_segs = [s for s in self.segments if abs(s.midpoint - cited_sec) <= 25.0]
                local_vis = [v for v in self.visual_events if abs(v.timestamp - cited_sec) <= 35.0]

                # Check if local evidence actually mentions relevant concepts
                local_tokens = set()
                for s in local_segs:
                    local_tokens.update(tokenize(s.text))
                for v in local_vis:
                    local_tokens.update(tokenize(v.extracted_text))

                overlap = len(claim_tokens.intersection(local_tokens))
                if not local_segs and not local_vis:
                    # Fabricated citation to a timestamp where nothing happened
                    citation_valid = False
                elif overlap == 0 and len(claim_tokens) >= 3:
                    # Citation exists, but content at that timestamp is totally unrelated
                    citation_valid = False

        # 2. Search Transcript Segments for Direct or Contradictory Evidence
        negation_words = {"not", "never", "cannot", "isn't", "aren't", "false", "incorrect", "unlike", "no"}
        stop_words = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "with", "by", "this", "that"}

        for s in self.segments:
            seg_toks = self.seg_token_index.get(str(s.segment_id), tokenize(s.text))
            inter = claim_tokens.intersection(seg_toks)
            precision = len(inter) / max(1, len(claim_tokens))
            recall = len(inter) / max(1, len(seg_toks))
            f1_overlap = 2 * precision * recall / max(1e-9, precision + recall)

            if f1_overlap >= 0.20 or len(inter) >= 2:
                # Entity-anchored negation detection
                shared_entities = inter - stop_words
                lower_seg = s.text.lower()
                lower_claim = claim.text.lower()

                def has_neg_entity(txt: str, entities: set) -> bool:
                    words = txt.split()
                    for idx, w in enumerate(words):
                        clean_w = re.sub(r"[^\w]", "", w)
                        if clean_w in negation_words:
                            window = {re.sub(r"[^\w]", "", nw) for nw in words[max(0, idx - 3): idx + 4]}
                            if window & entities:
                                return True
                    return False

                if shared_entities:
                    is_contradiction = has_neg_entity(lower_seg, shared_entities) != has_neg_entity(lower_claim, shared_entities)
                else:
                    has_seg_neg = any(w in lower_seg for w in negation_words)
                    has_claim_neg = any(w in lower_claim for w in negation_words)
                    is_contradiction = (has_seg_neg != has_claim_neg)

                # Check SALKG alignment match for this segment
                align_match = self.alignment_by_seg.get(str(s.segment_id))
                conf = float(align_match.get("calibrated_confidence", 1.0)) if align_match else 0.8
                status = align_match.get("status", "accepted") if align_match else "accepted"

                path = EvidencePath(
                    claim_id=claim.claim_id,
                    evidence_id=str(s.segment_id),
                    source_modality="TRANSCRIPT",
                    timestamp=s.start_time,
                    content_snippet=s.text[:140],
                    alignment_confidence=conf,
                    directness="DIRECT",
                    is_conflicting=is_contradiction,
                    validation_status=status,
                )

                if is_contradiction:
                    conflicting_paths.append(path)
                else:
                    supporting_paths.append(path)

                # Cross-modal evidence expansion via SALKG:
                # If segment is aligned to a visual event, pull the visual event into the evidence path!
                if align_match and align_match.get("status") == "accepted":
                    v_id = str(align_match.get("visual_id"))
                    vis_ev = next((v for v in self.visual_events if str(v.visual_id) == v_id), None)
                    if vis_ev:
                        vis_path = EvidencePath(
                            claim_id=claim.claim_id,
                            evidence_id=str(vis_ev.visual_id),
                            source_modality="SCREEN_SLIDE" if "code" in vis_ev.visual_type or "slide" in vis_ev.visual_type else "WHITEBOARD",
                            timestamp=vis_ev.timestamp,
                            content_snippet=vis_ev.extracted_text[:140],
                            alignment_confidence=float(align_match.get("calibrated_confidence", 1.0)),
                            directness="CROSS_MODAL",
                            is_conflicting=False,
                            validation_status="accepted",
                        )
                        supporting_paths.append(vis_path)

        # 3. Search Visual Events directly (for equations, code, diagrams)
        for v in self.visual_events:
            combined_vis_text = f"{v.extracted_text} {v.formula_latex or ''} {v.code_content or ''}"
            vis_toks = tokenize(combined_vis_text)
            inter = claim_tokens.intersection(vis_toks)
            overlap_ratio = len(inter) / max(1, len(claim_tokens))
            formula_matched = False
            if claim.formula_latex:
                clean_claim_f = claim.formula_latex.replace("$", "").replace(" ", "").lower()
                clean_vis_f = (v.formula_latex or "").replace("$", "").replace(" ", "").lower()
                clean_vis_t = combined_vis_text.replace("$", "").replace(" ", "").lower()
                if clean_claim_f and (clean_claim_f in clean_vis_f or clean_claim_f in clean_vis_t):
                    formula_matched = True

            if overlap_ratio >= 0.30 or formula_matched:
                # Avoid duplicate if already added via cross-modal expansion
                if not any(p.evidence_id == str(v.visual_id) for p in supporting_paths):
                    supporting_paths.append(
                        EvidencePath(
                            claim_id=claim.claim_id,
                            evidence_id=str(v.visual_id),
                            source_modality="SCREEN_SLIDE" if "code" in v.visual_type or "slide" in v.visual_type else "WHITEBOARD",
                            timestamp=v.timestamp,
                            content_snippet=combined_vis_text[:140],
                            alignment_confidence=1.0,
                            directness="DIRECT",
                            is_conflicting=False,
                            validation_status="verified",
                        )
                    )

        # 4. Search SALKG Knowledge Graph Pedagogical Relationships
        for edge in self.kg_edges:
            rel_type = edge.get("relation_type", "")
            src_id = edge.get("source_id", "")
            tgt_id = edge.get("target_id", "")
            edge_repr = f"{src_id} {rel_type} {tgt_id}".lower()

            if any(tok in edge_repr for tok in claim_tokens):
                supporting_paths.append(
                    EvidencePath(
                        claim_id=claim.claim_id,
                        evidence_id=f"edge_{src_id}_{tgt_id}",
                        source_modality="SALKG_EDGE",
                        timestamp=float(edge.get("timestamps", [0.0])[0]) if edge.get("timestamps") else 0.0,
                        content_snippet=f"SALKG Edge: ({src_id}) -[{rel_type}]-> ({tgt_id})",
                        alignment_confidence=float(edge.get("calibrated_confidence", 1.0)),
                        directness="DERIVED",
                        is_conflicting=False,
                        validation_status=edge.get("validation_status", "accepted"),
                    )
                )

        # Deduplicate paths by evidence_id
        seen = set()
        dedup_supporting = []
        for p in supporting_paths:
            if p.evidence_id not in seen:
                seen.add(p.evidence_id)
                dedup_supporting.append(p)

        return dedup_supporting, conflicting_paths, citation_valid
