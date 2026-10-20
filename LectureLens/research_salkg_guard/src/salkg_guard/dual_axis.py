"""Dual-Axis Validation Engine (Module C of SALKG-Guard).

Assesses two orthogonal dimensions independently:
- Axis 1: Lecture Faithfulness (is it grounded in this specific lecture's signals?)
- Axis 2: Domain Correctness (is it technically, scientifically, or mathematically accurate?)

NEVER merges the two axes into a single ambiguous score.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from salkg_guard.domain_registry import DomainValidatorRegistry
from salkg_guard.report_schema import (
    ClaimValidationResult,
    DecomposedClaim,
    DomainVerdict,
    EvidencePath,
    FaithfulnessVerdict,
    GuardDecision,
)


class DualAxisValidator:
    """Evaluates claims on independent Lecture Faithfulness and Domain Correctness axes."""

    def __init__(self, domain_registry: Optional[DomainValidatorRegistry] = None):
        self.registry = domain_registry or DomainValidatorRegistry()

    def evaluate_claim(
        self,
        claim: DecomposedClaim,
        supporting_paths: List[EvidencePath],
        conflicting_paths: List[EvidencePath],
        citation_valid: bool,
        domain_name: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> ClaimValidationResult:
        """Run independent evaluations for Axis 1 and Axis 2 on a single decomposed claim."""

        # ── Axis 1: Lecture Faithfulness ─────────────────────────────────────
        has_direct_conflict = any(p.directness in ("DIRECT", "CROSS_MODAL") for p in conflicting_paths)
        if has_direct_conflict:
            axis1 = FaithfulnessVerdict.CONTRADICTED
            axis1_reason = f"Directly contradicted by {len(conflicting_paths)} lecture evidence segment(s)."
        elif conflicting_paths:
            axis1 = FaithfulnessVerdict.PARTIALLY_SUPPORTED
            axis1_reason = f"Soft or indirect conflict found across {len(conflicting_paths)} evidence path(s)."
        elif not citation_valid:
            axis1 = FaithfulnessVerdict.MISSING_FROM_LECTURE
            axis1_reason = f"Invalid citation '{claim.cited_timestamp}' (time out of range or ungrounded)."
        elif not supporting_paths:
            axis1 = FaithfulnessVerdict.MISSING_FROM_LECTURE
            axis1_reason = "No matching transcript or visual evidence found in this lecture."
        else:
            # Check strength of evidence paths
            max_conf = max(p.alignment_confidence for p in supporting_paths)
            has_direct = any(p.directness in ("DIRECT", "CROSS_MODAL") for p in supporting_paths)

            if has_direct and max_conf >= 0.55:
                axis1 = FaithfulnessVerdict.SUPPORTED
                axis1_reason = f"Directly grounded across {len(supporting_paths)} multimodal evidence item(s)."
            else:
                axis1 = FaithfulnessVerdict.PARTIALLY_SUPPORTED
                axis1_reason = "Partially supported with moderate or indirect evidence."

        # ── Axis 2: Domain Correctness ────────────────────────────────────────
        validator = self.registry.get_validator(domain_name)
        axis2, axis2_reason = validator.validate(claim, context)

        # ── Discrepancy Detection & Independent Preservations ─────────────────
        discrepancy = False
        disc_note = None

        if axis1 == FaithfulnessVerdict.SUPPORTED and axis2 == DomainVerdict.DOMAIN_INVALID:
            discrepancy = True
            disc_note = "DISCREPANCY: Stated by the lecturer, but confirmed technically/mathematically incorrect by domain rules."
        elif axis1 == FaithfulnessVerdict.MISSING_FROM_LECTURE and axis2 == DomainVerdict.DOMAIN_VALID:
            discrepancy = True
            disc_note = "DISCREPANCY: Technically valid general domain concept, but completely absent from this lecture's content."

        # ── Preliminary Claim Decision ────────────────────────────────────────
        if not citation_valid or axis2 == DomainVerdict.DOMAIN_INVALID:
            claim_dec = GuardDecision.REGENERATE
            dec_reason = "Deterministic domain error or invalid citation."
        elif axis1 == FaithfulnessVerdict.CONTRADICTED:
            claim_dec = GuardDecision.ABSTAIN
            dec_reason = "Direct evidence contradiction in lecture content."
        elif axis1 == FaithfulnessVerdict.MISSING_FROM_LECTURE:
            claim_dec = GuardDecision.ABSTAIN
            dec_reason = "Material lecture evidence missing."
        elif axis1 == FaithfulnessVerdict.PARTIALLY_SUPPORTED and axis2 in (DomainVerdict.CONFLICTS_WITH_RULE, DomainVerdict.UNVERIFIABLE):
            claim_dec = GuardDecision.NEEDS_REVIEW
            dec_reason = "Ambiguous evidence support requiring educator review."
        else:
            claim_dec = GuardDecision.ACCEPT
            dec_reason = "Faithful to lecture evidence and domain constraints."

        return ClaimValidationResult(
            claim=claim,
            axis1_faithfulness=axis1,
            axis1_reason=axis1_reason,
            axis2_domain=axis2,
            axis2_reason=axis2_reason,
            evidence_paths=supporting_paths,
            conflicting_evidence=conflicting_paths,
            citation_valid=citation_valid,
            discrepancy_detected=discrepancy,
            discrepancy_note=disc_note,
            decision=claim_dec,
            decision_reason=dec_reason,
        )
