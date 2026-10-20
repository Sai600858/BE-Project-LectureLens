"""Machine-readable validation report schemas for SALKG-Guard."""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class FaithfulnessVerdict(str, Enum):
    """Axis 1: Lecture Faithfulness Verdicts."""
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    MISSING_FROM_LECTURE = "MISSING_FROM_LECTURE"
    INADEQUATE_EVIDENCE = "INADEQUATE_EVIDENCE"


class DomainVerdict(str, Enum):
    """Axis 2: Domain Correctness Verdicts."""
    DOMAIN_VALID = "DOMAIN_VALID"
    DOMAIN_INVALID = "DOMAIN_INVALID"
    SEMANTICALLY_PLAUSIBLE = "SEMANTICALLY_PLAUSIBLE"
    CONFLICTS_WITH_RULE = "CONFLICTS_WITH_RULE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    UNVERIFIABLE = "UNVERIFIABLE"


class GuardDecision(str, Enum):
    """Decision Engine Outcomes."""
    ACCEPT = "ACCEPT"
    REGENERATE = "REGENERATE"
    ABSTAIN = "ABSTAIN"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    REQUEST_REVIEW = "REQUEST_REVIEW"
    OMIT = "OMIT"


@dataclass
class EvidencePath:
    """Explicit provenance trail linking a generated claim to raw lecture signals."""
    claim_id: str
    evidence_id: str
    source_modality: str  # TRANSCRIPT, WHITEBOARD, SCREEN_SLIDE, SALKG_EDGE
    timestamp: float
    content_snippet: str
    alignment_confidence: float = 1.0
    directness: str = "DIRECT"  # DIRECT, CROSS_MODAL, DERIVED, CONFLICTING
    is_conflicting: bool = False
    validation_status: str = "verified"

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class DecomposedClaim:
    """Atomic verifiable proposition extracted from generated output."""
    claim_id: str
    text: str
    claim_type: str = "factual"  # factual, definition, formula, numerical, complexity, quiz_key, diagram_edge, diagram_node
    entities: List[str] = field(default_factory=list)
    formula_latex: Optional[str] = None
    numerical_values: List[float] = field(default_factory=list)
    cited_timestamp: Optional[str] = None
    cited_seconds: Optional[float] = None
    dependencies: List[str] = field(default_factory=list)  # IDs of claims this claim depends on
    requires_domain_check: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class ClaimValidationResult:
    """Dual-axis validation outcome for a single decomposed claim."""
    claim: DecomposedClaim
    axis1_faithfulness: FaithfulnessVerdict
    axis1_reason: str
    axis2_domain: DomainVerdict
    axis2_reason: str
    evidence_paths: List[EvidencePath] = field(default_factory=list)
    conflicting_evidence: List[EvidencePath] = field(default_factory=list)
    citation_valid: bool = True
    discrepancy_detected: bool = False
    discrepancy_note: Optional[str] = None
    decision: GuardDecision = GuardDecision.ACCEPT
    decision_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim": self.claim.to_dict(),
            "axis1_faithfulness": self.axis1_faithfulness.value,
            "axis1_reason": self.axis1_reason,
            "axis2_domain": self.axis2_domain.value,
            "axis2_reason": self.axis2_reason,
            "evidence_paths": [ep.to_dict() for ep in self.evidence_paths],
            "conflicting_evidence": [ep.to_dict() for ep in self.conflicting_evidence],
            "citation_valid": self.citation_valid,
            "discrepancy_detected": self.discrepancy_detected,
            "discrepancy_note": self.discrepancy_note,
            "decision": self.decision.value,
            "decision_reason": self.decision_reason,
        }


@dataclass
class ValidationReport:
    """Stable, comprehensive machine-readable validation report for educational generation."""
    request_id: str
    lecture_id: str
    content_type: str  # rag_answer, study_notes, quiz, flashcard, diagram
    domain: str
    overall_decision: GuardDecision
    decision_reason: str
    claim_results: List[ClaimValidationResult] = field(default_factory=list)
    total_claims: int = 0
    supported_claims: int = 0
    contradicted_claims: int = 0
    unsupported_claims: int = 0
    domain_valid_claims: int = 0
    domain_invalid_claims: int = 0
    citation_validity_rate: float = 1.0
    retry_count: int = 0
    executed_checks: List[str] = field(default_factory=list)
    unavailable_checks: List[str] = field(default_factory=list)
    salkg_alignment_coverage: float = 0.0
    suggested_correction_feedback: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "lecture_id": self.lecture_id,
            "content_type": self.content_type,
            "domain": self.domain,
            "overall_decision": self.overall_decision.value,
            "decision_reason": self.decision_reason,
            "summary_metrics": {
                "total_claims": self.total_claims,
                "supported_claims": self.supported_claims,
                "contradicted_claims": self.contradicted_claims,
                "unsupported_claims": self.unsupported_claims,
                "domain_valid_claims": self.domain_valid_claims,
                "domain_invalid_claims": self.domain_invalid_claims,
                "citation_validity_rate": round(self.citation_validity_rate, 4),
                "salkg_alignment_coverage": round(self.salkg_alignment_coverage, 4),
            },
            "claims": [cr.to_dict() for cr in self.claim_results],
            "retry_count": self.retry_count,
            "executed_checks": self.executed_checks,
            "unavailable_checks": self.unavailable_checks,
            "suggested_correction_feedback": self.suggested_correction_feedback,
        }
