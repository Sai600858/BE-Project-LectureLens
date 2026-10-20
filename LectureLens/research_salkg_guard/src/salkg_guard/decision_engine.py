"""Risk-Calibrated Decision Method (Phase 5 of SALKG-Guard).

Determines whether to ACCEPT, REGENERATE, ABSTAIN, or flag for NEEDS_REVIEW.
Uses explicit hard-failure criteria and risk-calibrated claim aggregation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from salkg_guard.report_schema import (
    ClaimValidationResult,
    DomainVerdict,
    FaithfulnessVerdict,
    GuardDecision,
    ValidationReport,
)


class DecisionEngine:
    """Aggregates claim-level validations into risk-calibrated decisions with targeted correction hints."""

    def __init__(
        self,
        min_support_ratio: float = 0.65,
        max_unsupported_claims: int = 1,
    ):
        self.min_support_ratio = min_support_ratio
        self.max_unsupported_claims = max_unsupported_claims

    def decide(
        self,
        request_id: str,
        lecture_id: str,
        content_type: str,
        domain: str,
        claim_results: List[ClaimValidationResult],
        internal_contradictions: List[Tuple[str, str, str]],
        retry_count: int = 0,
        salkg_coverage: float = 0.0,
    ) -> ValidationReport:
        """Derive overall decision and assemble complete machine-readable validation report."""
        total = len(claim_results)

        if total == 0:
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=GuardDecision.ABSTAIN,
                decision_reason="No verifiable claims extracted from generated content.",
                claim_results=[],
                total_claims=0,
                retry_count=retry_count,
            )

        supported = sum(1 for cr in claim_results if cr.axis1_faithfulness == FaithfulnessVerdict.SUPPORTED)
        contradicted = sum(1 for cr in claim_results if cr.axis1_faithfulness == FaithfulnessVerdict.CONTRADICTED)
        missing = sum(1 for cr in claim_results if cr.axis1_faithfulness == FaithfulnessVerdict.MISSING_FROM_LECTURE)
        unsupported = contradicted + missing

        domain_valid = sum(1 for cr in claim_results if cr.axis2_domain == DomainVerdict.DOMAIN_VALID)
        domain_invalid = sum(1 for cr in claim_results if cr.axis2_domain == DomainVerdict.DOMAIN_INVALID)

        citations_valid = sum(1 for cr in claim_results if cr.citation_valid)
        citation_rate = citations_valid / total

        # ── 1. Severity-Graded Domain Errors -> REGENERATE or NEEDS_REVIEW ───
        if domain_invalid > 0:
            failed_claims = [cr for cr in claim_results if cr.axis2_domain == DomainVerdict.DOMAIN_INVALID]
            critical_errors = [
                cr for cr in failed_claims
                if cr.claim.claim_type in ("formula", "complexity", "syntax", "code")
                or any(k in (cr.axis2_reason or "").lower() for k in ["syntax", "equation", "formula", "complexity", "big o", "law"])
            ]
            minor_errors = [cr for cr in failed_claims if cr not in critical_errors]
            hint = "; ".join(f"Claim '{fc.claim.claim_id}': {fc.axis2_reason}" for fc in failed_claims)

            if critical_errors or not minor_errors:
                dec = GuardDecision.REGENERATE
                reason = f"Detected {domain_invalid} deterministic domain error(s): {hint}"
            else:
                dec = GuardDecision.NEEDS_REVIEW
                reason = f"Detected {domain_invalid} minor domain discrepancy requiring review: {hint}"

            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=dec,
                decision_reason=reason,
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
                suggested_correction_feedback=f"Fix the following technical errors without guessing: {hint}",
            )

        # ── 2. Hard Failure: Fabricated Citations -> REGENERATE ─────────────
        if citation_rate < 1.0 and any(cr.claim.cited_timestamp for cr in claim_results):
            bad_cites = [cr for cr in claim_results if not cr.citation_valid]
            hint = f"Invalid timestamps cited: {[bc.claim.cited_timestamp for bc in bad_cites]}. Only cite timestamps present in this lecture."
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=GuardDecision.REGENERATE,
                decision_reason="Detected invalid or hallucinated timestamp citations.",
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
                suggested_correction_feedback=hint,
            )

        # ── 3. Internal Contradictions -> REGENERATE ────────────────────────
        if internal_contradictions:
            hint = "; ".join(desc for _, _, desc in internal_contradictions)
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=GuardDecision.REGENERATE,
                decision_reason=f"Internal contradictions between claims: {hint}",
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
                suggested_correction_feedback=f"Resolve mutual contradictions: {hint}",
            )

        # ── 4. Majority Missing Evidence -> ABSTAIN or OMIT ─────────────────
        # When material lecture evidence is missing (e.g. topic not in lecture)
        support_ratio = supported / total
        if missing > total / 2 or support_ratio < 0.35:
            is_diagram = content_type == "diagram"
            dec = GuardDecision.OMIT if is_diagram else GuardDecision.ABSTAIN
            reason = (
                "Diagram cannot be reliably grounded in lecture evidence; omitting visualization per policy."
                if is_diagram
                else "Material topic evidence was not found in this lecture. System must abstain to avoid hallucination."
            )
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=dec,
                decision_reason=reason,
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
            )

        # ── 5. Unresolved Ambiguity / Contradiction -> NEEDS_REVIEW ─────────
        if contradicted > 0 or any(cr.discrepancy_detected for cr in claim_results):
            disc_notes = [cr.discrepancy_note for cr in claim_results if cr.discrepancy_note]
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=GuardDecision.NEEDS_REVIEW,
                decision_reason=f"Evidence contradiction or lecturer discrepancy detected: {'; '.join(disc_notes)}",
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
            )

        # ── 5.5 Support Ratio Check (min_support_ratio threshold gate) ──────
        if support_ratio < self.min_support_ratio or unsupported > self.max_unsupported_claims:
            if support_ratio < 0.35:
                dec = GuardDecision.ABSTAIN
                reason = f"Support ratio {support_ratio:.2f} is below critical threshold 0.35 ({supported}/{total} claims supported); abstaining."
            else:
                dec = GuardDecision.NEEDS_REVIEW
                reason = f"Support ratio {support_ratio:.2f} is below min_support_ratio {self.min_support_ratio:.2f} ({supported}/{total} claims supported); flagged for review."
            return ValidationReport(
                request_id=request_id,
                lecture_id=lecture_id,
                content_type=content_type,
                domain=domain,
                overall_decision=dec,
                decision_reason=reason,
                claim_results=claim_results,
                total_claims=total,
                supported_claims=supported,
                contradicted_claims=contradicted,
                unsupported_claims=unsupported,
                domain_valid_claims=domain_valid,
                domain_invalid_claims=domain_invalid,
                citation_validity_rate=citation_rate,
                retry_count=retry_count,
                salkg_alignment_coverage=salkg_coverage,
            )

        # ── 6. Satisfactory Verification -> ACCEPT ──────────────────────────
        return ValidationReport(
            request_id=request_id,
            lecture_id=lecture_id,
            content_type=content_type,
            domain=domain,
            overall_decision=GuardDecision.ACCEPT,
            decision_reason=f"Validated with high lecture faithfulness ({supported}/{total} supported claims) and valid domain constraints.",
            claim_results=claim_results,
            total_claims=total,
            supported_claims=supported,
            contradicted_claims=contradicted,
            unsupported_claims=unsupported,
            domain_valid_claims=domain_valid,
            domain_invalid_claims=domain_invalid,
            citation_validity_rate=citation_rate,
            retry_count=retry_count,
            salkg_alignment_coverage=salkg_coverage,
        )
