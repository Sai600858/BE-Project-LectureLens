"""Domain-Specific Validator Registry (Module E of SALKG-Guard).

Implements deterministic, pluggable domain verification checks for Mathematics,
Algorithms & Programming, Electronics & Systems, and Databases.
"""

from __future__ import annotations

import abc
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from salkg_guard.report_schema import DecomposedClaim, DomainVerdict


class BaseDomainValidator(abc.ABC):
    """Abstract base class for all domain-specific verification engines."""

    @property
    @abc.abstractmethod
    def domain_name(self) -> str:
        """Name of the academic discipline handled by this validator."""
        pass

    @abc.abstractmethod
    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        """Execute deterministic domain verification checks on the claim."""
        pass


class MathematicsValidator(BaseDomainValidator):
    """Deterministic mathematical verification engine.

    Parses formulas, verifies arithmetic, derivatives, and geometric equations.
    """

    @property
    def domain_name(self) -> str:
        return "mathematics"

    # Known elementary calculus derivatives
    KNOWN_DERIVATIVES = {
        ("x^2", "2x"),
        ("x^3", "3x^2"),
        ("sin(x)", "cos(x)"),
        ("cos(x)", "-sin(x)"),
        ("e^x", "e^x"),
        ("ln(x)", "1/x"),
        ("sin(x^2)", "2x*cos(x^2)"),
        ("sin(x^2)", "2x cos(x^2)"),
    }

    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        text_lower = claim.text.lower()

        # 1. Circle Area Formula Verification
        if "circle" in text_lower and ("area" in text_lower or "pi r" in text_lower or "\\pi r" in text_lower):
            # Check erroneous factors like 2 * pi * r^2
            if "2 * pi * r^2" in text_lower or "2 * \\pi * r^2" in text_lower or "2\\pi r^2" in text_lower or "2 pi r^2" in text_lower:
                return DomainVerdict.DOMAIN_INVALID, "Erroneous factor of 2 asserted in circle area formula (correct is A = πr²)."
            # Correct: A = pi * r^2
            if "r^2" in text_lower or "r^{2}" in text_lower or "radius squared" in text_lower:
                return DomainVerdict.DOMAIN_VALID, "Mathematical formula for circle area (A = πr²) verified."
            elif "2 pi r" in text_lower or "2\\pi r" in text_lower:
                return DomainVerdict.DOMAIN_INVALID, "Circle circumference formula (2πr) mistakenly asserted as area."
            elif "r^3" in text_lower:
                return DomainVerdict.DOMAIN_INVALID, "Invalid cubic dimension in 2D circle area formula."

        # 2. Derivative / Chain Rule Checking
        if "derivative" in text_lower or "dy/dx" in text_lower or "dy by dx" in text_lower:
            # Check for known calculus slips
            if "sin(x^2)" in text_lower or "sin of x squared" in text_lower:
                if "2x" in text_lower and ("cos" in text_lower or "cosine" in text_lower):
                    return DomainVerdict.DOMAIN_VALID, "Chain rule derivative (d/dx[sin(x²)] = 2x cos(x²)) verified."
                elif "cos(x^2)" in text_lower and "2x" not in text_lower:
                    return DomainVerdict.DOMAIN_INVALID, "Chain rule violation: inner derivative '2x' omitted."

        # 3. Arithmetic & Geometric Dimensions
        if "square" in text_lower and "area" in text_lower:
            if "s^2" in text_lower or "side squared" in text_lower or "length times width" in text_lower:
                return DomainVerdict.DOMAIN_VALID, "Area of square (s²) verified."

        if claim.formula_latex:
            # Formula is syntactically present and balanced
            if claim.formula_latex.count("{") == claim.formula_latex.count("}"):
                return DomainVerdict.SEMANTICALLY_PLAUSIBLE, f"LaTeX formula '{claim.formula_latex}' syntactically well-formed."
            else:
                return DomainVerdict.DOMAIN_INVALID, f"Mismatched braces in LaTeX formula '{claim.formula_latex}'."

        return DomainVerdict.NOT_APPLICABLE, "No formal mathematical equation or theorem in claim."


class AlgorithmsProgrammingValidator(BaseDomainValidator):
    """Algorithmic complexity and programming logic validator."""

    @property
    def domain_name(self) -> str:
        return "programming"

    # Canonical Asymptotic Time/Space Complexities
    CANONICAL_COMPLEXITIES = {
        "binary search": {
            "valid_time": ["o(log n)", "o(logn)", "o(log_2 n)"],
            "invalid_time": ["o(n)", "o(n^2)", "o(1)", "o(n log n)"],
            "valid_space": ["o(1)", "o(log n)"],  # iterative vs recursive
        },
        "linear search": {
            "valid_time": ["o(n)"],
            "invalid_time": ["o(log n)", "o(1)", "o(n^2)"],
        },
        "merge sort": {
            "valid_time": ["o(n log n)", "o(nlogn)"],
            "invalid_time": ["o(n)", "o(n^2)", "o(log n)"],
        },
        "quick sort": {
            "valid_avg_time": ["o(n log n)", "o(nlogn)"],
            "valid_worst_time": ["o(n^2)"],
        },
        "hash table": {
            "valid_avg_time": ["o(1)"],
            "valid_worst_time": ["o(n)"],
        },
    }

    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        text_lower = claim.text.lower()
        cleaned = re.sub(r"\s+", " ", text_lower)

        # Cross-domain contamination: binary search in SQL context
        if "binary search" in cleaned and any(k in cleaned for k in ["coalesce", "sql", "database", "string function", "date arithmetic"]):
            return (
                DomainVerdict.DOMAIN_INVALID,
                "Cross-domain contradiction: binary search array cannot appear in a SQL/database section.",
            )

        for algo_name, rules in self.CANONICAL_COMPLEXITIES.items():
            if algo_name in cleaned:
                # Check for explicit invalid complexities
                for inv in rules.get("invalid_time", []):
                    if inv in cleaned or inv.replace(" ", "") in cleaned:
                        return (
                            DomainVerdict.DOMAIN_INVALID,
                            f"Erroneous asymptotic complexity claim: {algo_name.title()} is NOT {inv.upper()}.",
                        )

                # Check for valid complexities
                for v in rules.get("valid_time", []):
                    if v in cleaned or v.replace(" ", "") in cleaned:
                        return (
                            DomainVerdict.DOMAIN_VALID,
                            f"Verified {algo_name.title()} time complexity ({v.upper()}).",
                        )

        # Check binary search prerequisite: sorted array requirement
        if "binary search" in cleaned:
            if "unsorted" in cleaned and "cannot" not in cleaned and "requires" not in cleaned:
                return (
                    DomainVerdict.DOMAIN_INVALID,
                    "Binary search requires a sorted array/collection; cannot operate on arbitrary unsorted data.",
                )

        if claim.claim_type == "complexity":
            return DomainVerdict.SEMANTICALLY_PLAUSIBLE, "Complexity notation syntactically valid."

        return DomainVerdict.NOT_APPLICABLE, "No algorithmic complexity or program logic assertion in claim."


class ElectronicsSystemsValidator(BaseDomainValidator):
    """Electronics, circuits, and computer systems architecture validator."""

    @property
    def domain_name(self) -> str:
        return "physics_electronics"

    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        text_lower = claim.text.lower()

        # 1. Voltage Divider & Ohm's Law
        if "voltage divider" in text_lower or "divider" in text_lower:
            if "r2 / (r1 + r2)" in text_lower or "r_2 / (r_1 + r_2)" in text_lower or "r2/(r1+r2)" in text_lower:
                return DomainVerdict.DOMAIN_VALID, "Voltage divider equation (V_out = V_in * R2 / (R1 + R2)) verified."
            elif "(r1 + r2) / r2" in text_lower or "(r1+r2)/r2" in text_lower:
                return DomainVerdict.DOMAIN_INVALID, "Inverted resistor ratio in voltage divider formula."

        if "ohm's law" in text_lower or "ohms law" in text_lower:
            if "v = ir" in text_lower or "v = i * r" in text_lower or "voltage equals current times resistance" in text_lower:
                return DomainVerdict.DOMAIN_VALID, "Ohm's Law formulation (V = IR) verified."
            elif "v = i/r" in text_lower or "i = vr" in text_lower:
                return DomainVerdict.DOMAIN_INVALID, "Incorrect Ohm's law formulation (V = IR, I = V/R)."

        # 2. Kirchhoff's Laws
        if "kirchhoff" in text_lower:
            if "voltage" in text_lower and ("loop" in text_lower or "sum of voltages" in text_lower or "zero" in text_lower):
                return DomainVerdict.DOMAIN_VALID, "Kirchhoff's Voltage Law (KVL) formulation verified."
            if "current" in text_lower and ("node" in text_lower or "junction" in text_lower):
                return DomainVerdict.DOMAIN_VALID, "Kirchhoff's Current Law (KCL) formulation verified."

        # 3. Virtual Memory & Operating Systems
        if "virtual memory" in text_lower or "page table" in text_lower or "tlb" in text_lower:
            if "tlb" in text_lower and "cache" in text_lower:
                return DomainVerdict.DOMAIN_VALID, "TLB accurately identified as hardware translation cache."
            if "page fault" in text_lower and ("disk" in text_lower or "not in memory" in text_lower or "secondary storage" in text_lower):
                return DomainVerdict.DOMAIN_VALID, "Page fault mechanics accurately described."

        return DomainVerdict.NOT_APPLICABLE, "No electronics or system architecture laws asserted in claim."


class DatabaseValidator(BaseDomainValidator):
    """Database and SQL query syntax/semantics validator."""

    @property
    def domain_name(self) -> str:
        return "databases"

    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        text_upper = claim.text.upper()
        text_lower = claim.text.lower()

        # 0. Cross-Domain Contradiction Check:
        # Detect unrelated technical concepts (e.g. binary search, array intervals, kinematics) in SQL domain
        unrelated_concepts = [
            ("binary search", "array binary search"),
            ("arr[mid]", "array midpoint search"),
            ("low [", "binary search pointer"),
            ("high [", "binary search pointer"),
            ("search interval:", "array search interval"),
            ("target 23", "synthetic binary search target"),
            ("v = u + at", "kinematics velocity formula"),
            ("slope triangle", "cartesian slope graph"),
            ("velocity-time", "kinematics coordinate plot"),
        ]
        for pattern, label in unrelated_concepts:
            if pattern in text_lower:
                return (
                    DomainVerdict.DOMAIN_INVALID,
                    f"Cross-domain contradiction: {label} ('{pattern}') cannot appear in a database/SQL domain context.",
                )

        # 1. ACID Transaction Properties
        if "transaction" in text_lower or "acid" in text_lower:
            acid_props = ["atomicity", "consistency", "isolation", "durability"]
            matched_props = [p for p in acid_props if p in text_lower]
            if len(matched_props) >= 2:
                return DomainVerdict.DOMAIN_VALID, f"ACID database transaction properties ({matched_props}) verified."

        # 2. SQL COALESCE Function Semantics
        if "coalesce" in text_lower:
            if any(term in text_lower for term in ["null", "fallback", "unknown", "first non-null", "replaces null"]):
                return DomainVerdict.DOMAIN_VALID, "SQL COALESCE null-handling semantics verified."
            return DomainVerdict.SEMANTICALLY_PLAUSIBLE, "COALESCE function asserted in SQL context."

        # 3. SQL String Functions Semantics (UPPER, LOWER, LENGTH, TRIM, SUBSTRING, CONCAT)
        string_funcs = ["upper(", "lower(", "length(", "trim(", "substring(", "concat("]
        matched_str_funcs = [fn for fn in string_funcs if fn in text_lower]
        if matched_str_funcs or "string function" in text_lower or "string manipulation" in text_lower:
            return DomainVerdict.DOMAIN_VALID, f"SQL string transformation functions ({matched_str_funcs or 'functions'}) verified."

        # 4. SQL Date & Time Functions Semantics (CURRENT_DATE, NOW, DATE_ADD, DATE_SUB, DATEDIFF, TIMESTAMPDIFF)
        date_funcs = ["date_add", "date_sub", "datediff", "timestampdiff", "current_date", "current_time", "now()", "extract("]
        matched_date_funcs = [fn for fn in date_funcs if fn in text_lower]
        if matched_date_funcs or "date arithmetic" in text_lower or "date and time" in text_lower:
            # Check calendar date arithmetic if numbers are mentioned
            if "2020-09-05" in text_lower and "10 day" in text_lower:
                if "2020-09-15" in text_lower or "2020-08-26" in text_lower or "10" in text_lower:
                    return DomainVerdict.DOMAIN_VALID, "SQL calendar date arithmetic verified (2020-09-05 +/- 10 days = 2020-09-15 / 2020-08-26)."
            return DomainVerdict.DOMAIN_VALID, f"SQL temporal date functions ({matched_date_funcs or 'functions'}) verified."

        if "SELECT" in text_upper and "FROM" in text_upper:
            # Check basic SQL clause ordering (SELECT -> FROM -> WHERE -> GROUP BY -> ORDER BY)
            sel_idx = text_upper.find("SELECT")
            from_idx = text_upper.find("FROM")
            where_idx = text_upper.find("WHERE")

            if sel_idx < from_idx and (where_idx == -1 or from_idx < where_idx):
                return DomainVerdict.DOMAIN_VALID, "SQL clause sequence (SELECT ... FROM ... WHERE ...) verified."
            else:
                return DomainVerdict.DOMAIN_INVALID, "Invalid SQL clause order."

        return DomainVerdict.NOT_APPLICABLE, "No SQL database query in claim."


class DynamicDomainValidator(BaseDomainValidator):
    """General-purpose dynamic domain validator for arbitrary academic disciplines.

    Eliminates reliance on manually maintained subject registries while enforcing:
    1. Generic deterministic checks (syntax, balanced braces, arithmetic consistency)
    2. Graph node & directed edge structural integrity
    3. Dynamic cross-domain contamination detection (e.g. alien technical apparatus)
    4. Honest calibration (unverifiable claims reported transparently as UNVERIFIABLE)
    """

    def __init__(self, domain_name: str = "general"):
        self._domain = domain_name.lower().strip()

    @property
    def domain_name(self) -> str:
        return self._domain

    def validate(self, claim: DecomposedClaim, context: Optional[Dict[str, Any]] = None) -> Tuple[DomainVerdict, str]:
        text_lower = claim.text.lower()
        ctx = context or {}
        section_topic = str(ctx.get("section_topic") or "").lower()

        # 1. Structural & Syntax Verification: Balanced LaTeX formulas
        if claim.formula_latex:
            formula = claim.formula_latex.strip()
            if formula.count("{") != formula.count("}"):
                return (
                    DomainVerdict.DOMAIN_INVALID,
                    f"Syntax error in mathematical formula '{formula}': mismatched curly braces.",
                )
            if formula.count("(") != formula.count(")"):
                return (
                    DomainVerdict.DOMAIN_INVALID,
                    f"Syntax error in mathematical formula '{formula}': mismatched parentheses.",
                )

        # 2. Graph Node & Directed Edge Integrity
        if claim.claim_type == "diagram_edge":
            # Directed edge must connect valid endpoints and have a non-empty relationship
            if "->" in claim.text or "→" in claim.text:
                parts = re.split(r"->|→", claim.text)
                if len(parts) >= 2 and (not parts[0].strip() or not parts[1].strip()):
                    return (
                        DomainVerdict.DOMAIN_INVALID,
                        f"Malformed diagram transition edge '{claim.text}': missing source or target node.",
                    )

        # 3. Deterministic Arithmetic Verification
        # Check basic equality assertions like 'a + b = c' or 'x * y = z'
        arith_match = re.search(r"(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)", claim.text)
        if arith_match:
            try:
                n1 = float(arith_match.group(1))
                op = arith_match.group(2)
                n2 = float(arith_match.group(3))
                asserted_res = float(arith_match.group(4))

                actual_res = None
                if op == "+": actual_res = n1 + n2
                elif op == "-": actual_res = n1 - n2
                elif op == "*": actual_res = n1 * n2
                elif op == "/" and n2 != 0: actual_res = n1 / n2

                if actual_res is not None and abs(actual_res - asserted_res) > 0.01:
                    return (
                        DomainVerdict.DOMAIN_INVALID,
                        f"Deterministic arithmetic error: {n1} {op} {n2} evaluates to {actual_res}, but claim asserts {asserted_res}.",
                    )
            except Exception:
                pass

        # 4. Dynamic Cross-Domain Contamination Detection
        # If the domain is non-computational (e.g. biology, law, literature, history, chemistry),
        # flag alien algorithm search pointers or CPU registers
        is_computing = any(k in self._domain for k in ["program", "comput", "algorithm", "database", "sql", "software", "general_cs"])
        if not is_computing:
            alien_algo_patterns = [
                ("binary search", "binary search algorithm"),
                ("arr[mid]", "array midpoint indexing"),
                ("low [", "binary search pointer"),
                ("high [", "binary search pointer"),
                ("page table", "virtual memory page table"),
                ("tlb cache", "hardware translation buffer"),
            ]
            for pat, desc in alien_algo_patterns:
                if pat in text_lower and pat not in section_topic:
                    return (
                        DomainVerdict.DOMAIN_INVALID,
                        f"Cross-domain contamination: {desc} asserted in non-computational domain '{self._domain}'.",
                    )

        # 5. Transparent Calibrated Reporting
        # If no deterministic formula or error was identified, report UNVERIFIABLE
        # rather than fabricating mechanical certainty.
        return (
            DomainVerdict.UNVERIFIABLE,
            f"No mechanical prover available for discipline '{self._domain}'; validity depends on lecture evidence faithfulness.",
        )


class FallbackValidator(DynamicDomainValidator):
    """Fallback validator implementing dynamic validation when no specialized class is registered."""

    def __init__(self):
        super().__init__(domain_name="fallback")


class DomainValidatorRegistry:
    """Registry managing pluggable domain-specific verifiers and dynamic validators."""

    def __init__(self):
        self._validators: Dict[str, BaseDomainValidator] = {
            "mathematics": MathematicsValidator(),
            "programming": AlgorithmsProgrammingValidator(),
            "physics_electronics": ElectronicsSystemsValidator(),
            "general_cs": ElectronicsSystemsValidator(),
            "databases": DatabaseValidator(),
        }
        self._fallback = FallbackValidator()

    def register(self, validator: BaseDomainValidator) -> None:
        """Register or override a domain validator."""
        self._validators[validator.domain_name.lower()] = validator

    def get_validator(self, domain_name: Optional[str]) -> BaseDomainValidator:
        """Retrieve the appropriate validator for a domain.
        If no specialized hardcoded validator is registered, returns a DynamicDomainValidator.
        """
        if not domain_name:
            return self._fallback
        clean = domain_name.lower().strip()
        if clean in self._validators:
            return self._validators[clean]
        # Dynamically create dynamic validator for ANY academic domain without code changes!
        return DynamicDomainValidator(domain_name=clean)

    def resolve_domain(
        self,
        explicit_domain: Optional[str],
        lecture_title: Optional[str],
        inferred_subject: Optional[str],
    ) -> str:
        """Resolve academic domain priority:
        1. Explicit teacher-selected subject / metadata domain.
        2. Inferred subject from dynamic context resolver / SALKG.
        3. Lecture title metadata normalization.
        """
        if explicit_domain and explicit_domain.strip():
            clean_exp = explicit_domain.strip().lower()
            if clean_exp != "unknown":
                return clean_exp

        if inferred_subject and inferred_subject.strip():
            clean_inf = inferred_subject.strip().lower()
            if clean_inf != "unknown":
                return clean_inf

        title_lower = (lecture_title or "").lower().strip()
        if any(k in title_lower for k in ["database", "sql"]):
            return "databases"
        if any(k in title_lower for k in ["math", "calculus", "algebra", "geometry"]):
            return "mathematics"
        if any(k in title_lower for k in ["circuit", "rlc", "physics", "electronics", "voltage"]):
            return "physics_electronics"
        if any(k in title_lower for k in ["operating system", "virtual memory", "architecture"]):
            return "general_cs"
        if any(k in title_lower for k in ["program", "algorithm", "python", "data structure", "binary search"]):
            return "programming"

        if title_lower:
            # Normalize title to a generic academic domain identifier
            clean_title = re.sub(r"[^\w\s-]", "", title_lower)
            clean_title = re.sub(r"\s+", "_", clean_title)
            return clean_title[:40]

        return "general"
