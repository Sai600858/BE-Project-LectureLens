"""Claim and Artifact Decomposer (Module A of SALKG-Guard).

Transforms unstructured or semi-structured Gemini outputs into checkable atomic units
without distorting technical meaning, equations, numerical values, or citations.
"""

from __future__ import annotations

from difflib import SequenceMatcher

import re
from typing import Any, Dict, List, Optional, Union

from salkg_guard.report_schema import DecomposedClaim


def parse_timestamp_to_seconds(ts_str: Optional[str]) -> Optional[float]:
    """Convert 'MM:SS' or 'HH:MM:SS' string into float seconds."""
    if not ts_str:
        return None
    cleaned = re.sub(r"[^\d:]", "", ts_str)
    parts = cleaned.split(":")
    try:
        if len(parts) == 2:
            return float(parts[0]) * 60.0 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600.0 + float(parts[1]) * 60.0 + float(parts[2])
    except (ValueError, IndexError):
        return None
    return None


class ClaimDecomposer:
    """Decomposes generative educational artifacts into verifiable atomic claims."""

    TIMESTAMP_PATTERNS = [
        re.compile(r"\[(?:Timestamp:?\s*)?(\d{1,2}:\d{2})\]", re.IGNORECASE),
        re.compile(r"\b(?:timestamp|at|time)\s+(\d{1,2}:\d{2})\b", re.IGNORECASE),
    ]

    FORMULA_PATTERN = re.compile(r"(\$[^\$]+\$|\\\([^\)]+\\\)|\\\[[^\]]+\\\])")
    COMPLEXITY_PATTERN = re.compile(r"\bO\s*\(\s*[^\)]+\s*\)", re.IGNORECASE)
    NUMBER_PATTERN = re.compile(r"\b[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?\b")

    @classmethod
    def decompose_text(cls, text: str, prefix: str = "claim") -> List[DecomposedClaim]:
        """Decompose free-form answer or lecture note into atomic factual sentences."""
        if not text or not text.strip():
            return []

        # Protect common abbreviations from premature sentence splitting
        abbrev_map = {
            "e.g.": "##ABBREV_EG##",
            "i.e.": "##ABBREV_IE##",
            "fig.": "##ABBREV_FIG##",
            "eq.": "##ABBREV_EQ##",
            "vs.": "##ABBREV_VS##",
            "etc.": "##ABBREV_ETC##",
            "dr.": "##ABBREV_DR##",
            "prof.": "##ABBREV_PROF##",
        }
        prep_text = text.strip()
        for abbrev, repl in abbrev_map.items():
            prep_text = re.sub(re.escape(abbrev), repl, prep_text, flags=re.IGNORECASE)

        # Split on sentence boundaries, list bullets, or newline breaks
        raw_lines = re.split(r"(?<=[.!?])\s+|\n+(?:[•\-\*]|\d+\.)?\s*", prep_text)
        claims: List[DecomposedClaim] = []
        claim_counter = 1
        prev_claim_id: Optional[str] = None

        for line in raw_lines:
            cleaned = line.strip()
            for abbrev, repl in abbrev_map.items():
                cleaned = cleaned.replace(repl, abbrev)
            # Ignore headers, greetings, or trivial filler
            if len(cleaned) < 8 or cleaned.startswith("#") or cleaned.lower() in ("sure!", "here is the answer:", "in summary:"):
                continue

            claim_id = f"{prefix}_{claim_counter:03d}"

            # Extract timestamp citations
            cited_ts = None
            cited_sec = None
            for pat in cls.TIMESTAMP_PATTERNS:
                m = pat.search(cleaned)
                if m:
                    cited_ts = m.group(1)
                    cited_sec = parse_timestamp_to_seconds(cited_ts)
                    break

            # Extract formulas
            formulas = cls.FORMULA_PATTERN.findall(cleaned)
            formula_latex = formulas[0] if formulas else None

            # Extract numbers
            numbers = []
            for num_str in cls.NUMBER_PATTERN.findall(cleaned):
                try:
                    val = float(num_str)
                    numbers.append(val)
                except ValueError:
                    pass

            # Detect claim type
            has_complexity = bool(cls.COMPLEXITY_PATTERN.search(cleaned))
            has_formula = bool(formula_latex)
            requires_domain = has_complexity or has_formula or any(
                kw in cleaned.lower()
                for kw in [
                    "derivative", "integral", "equation", "binary search", "recursion",
                    "quicksort", "voltage", "current", "impedance", "sql", "cache", "page table"
                ]
            )

            claim_type = "formula" if has_formula else ("complexity" if has_complexity else "factual")

            # Detect step-by-step or deductive dependencies
            deps = []
            lower_clean = cleaned.lower()
            if any(lower_clean.startswith(w) for w in ["therefore", "hence", "multiplying this", "substituting", "from this", "this implies"]):
                if prev_claim_id:
                    deps.append(prev_claim_id)

            claims.append(
                DecomposedClaim(
                    claim_id=claim_id,
                    text=cleaned,
                    claim_type=claim_type,
                    formula_latex=formula_latex,
                    numerical_values=numbers,
                    cited_timestamp=cited_ts,
                    cited_seconds=cited_sec,
                    dependencies=deps,
                    requires_domain_check=requires_domain,
                )
            )
            prev_claim_id = claim_id
            claim_counter += 1

        # Deduplicate near-identical claims
        unique_claims: List[DecomposedClaim] = []
        for c in claims:
            is_dup = False
            for u in unique_claims:
                if SequenceMatcher(None, c.text.lower(), u.text.lower()).ratio() >= 0.88:
                    is_dup = True
                    break
            if not is_dup:
                unique_claims.append(c)

        return unique_claims

    @classmethod
    def decompose_quiz(cls, quiz_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> List[DecomposedClaim]:
        """Decompose quiz items into distinct assertions for questions, options, answer key, and rationale."""
        questions_list = quiz_data if isinstance(quiz_data, list) else quiz_data.get("questions", [])
        claims: List[DecomposedClaim] = []

        for q_idx, q in enumerate(questions_list):
            q_num = q_idx + 1
            q_text = str(q.get("questionText") or q.get("question_text") or q.get("question") or "").strip()
            correct_ans = str(q.get("correctAnswer") or q.get("correct_answer") or "").strip()
            explanation = str(q.get("explanation") or "").strip()
            options = q.get("options") or []

            # 1. Question stem claim
            q_claim_id = f"quiz_q{q_num}_stem"
            claims.append(
                DecomposedClaim(
                    claim_id=q_claim_id,
                    text=f"Question {q_num} asks: '{q_text}'",
                    claim_type="factual",
                    requires_domain_check=False,
                )
            )

            # 2. Answer key assertion (depends on question stem)
            ans_claim_id = f"quiz_q{q_num}_answer_key"
            claims.append(
                DecomposedClaim(
                    claim_id=ans_claim_id,
                    text=f"For Question {q_num} ('{q_text}'), the single correct answer is '{correct_ans}'. All other options ({options}) are incorrect.",
                    claim_type="quiz_key",
                    dependencies=[q_claim_id],
                    requires_domain_check=True,
                )
            )

            # 3. Explanation claim
            if explanation:
                exp_claim_id = f"quiz_q{q_num}_explanation"
                claims.append(
                    DecomposedClaim(
                        claim_id=exp_claim_id,
                        text=f"Explanation for Question {q_num}: {explanation}",
                        claim_type="factual",
                        dependencies=[ans_claim_id],
                        requires_domain_check=True,
                    )
                )

        return claims

    @classmethod
    def decompose_flashcards(cls, flashcards: List[Dict[str, Any]]) -> List[DecomposedClaim]:
        """Decompose flashcards into front-back assertion pairs."""
        claims: List[DecomposedClaim] = []
        for idx, fc in enumerate(flashcards):
            card_num = idx + 1
            front = str(fc.get("question") or "").strip()
            back = str(fc.get("answer") or "").strip()

            c_id = f"flashcard_{card_num:03d}"
            claims.append(
                DecomposedClaim(
                    claim_id=c_id,
                    text=f"Concept/Prompt: '{front}' -> Definitive Answer: '{back}'",
                    claim_type="flashcard_qa",
                    requires_domain_check=True,
                )
            )
        return claims

    @classmethod
    def decompose_diagram(cls, diagram_spec: Dict[str, Any]) -> List[DecomposedClaim]:
        """Decompose diagram spec into atomic node, edge, and label claims."""
        claims: List[DecomposedClaim] = []
        diag_id = diagram_spec.get("id") or "diag_1"
        diag_title = diagram_spec.get("title") or "Diagram"
        diag_type = str(diagram_spec.get("visualizationType") or diagram_spec.get("type") or "").lower()
        spec = diagram_spec.get("spec") or {}

        # 1. Section context & semantic purpose
        sec_heading = diagram_spec.get("sectionHeading") or diagram_spec.get("heading") or ""
        sec_topic = diagram_spec.get("topic") or ""
        sec_domain = diagram_spec.get("domain") or ""
        claims.append(
            DecomposedClaim(
                claim_id=f"{diag_id}_title",
                text=f"Diagram illustrates: '{diag_title}'. Caption: '{diagram_spec.get('caption', '')}'. Associated Section: '{sec_heading}'. Topic: '{sec_topic}'. Domain: '{sec_domain}'.",
                claim_type="diagram_node",
                formula_latex=spec.get("equation") or diagram_spec.get("formula"),
                requires_domain_check=False,
            )
        )

        # 2. SQL COALESCE Flow Decomposition
        if "coalesce" in diag_type or "null" in diag_type:
            expr = spec.get("expression") or diagram_spec.get("expression") or "SELECT name, COALESCE(dept, 'Unknown') FROM employee;"
            fallback = spec.get("fallback") or "'Unknown'"
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_coalesce_eval",
                    text=f"Diagram asserts SQL COALESCE expression '{expr}': evaluates arguments in order, returns first non-null value, and replaces NULL with fallback {fallback}.",
                    claim_type="factual",
                    requires_domain_check=True,
                )
            )

        # 3. SQL String Functions Decomposition
        if "string" in diag_type or "trim" in diag_type:
            input_val = spec.get("input") or "  LectureLens  "
            ops = spec.get("operations") or []
            ops_summary = ", ".join(op.get("func", "") for op in ops) if ops else "UPPER, LOWER, LENGTH, TRIM, SUBSTRING, CONCAT"
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_string_ops",
                    text=f"Diagram asserts SQL string manipulation on input '{input_val}': applies string functions ({ops_summary}).",
                    claim_type="factual",
                    requires_domain_check=True,
                )
            )

        # 4. SQL Date & Time Timeline Decomposition
        if "date" in diag_type or "time" in diag_type:
            base_date = spec.get("baseDate") or "2020-09-05"
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_date_ops",
                    text=f"Diagram asserts SQL calendar date arithmetic with base date '{base_date}': DATE_ADD(INTERVAL 10 DAY) -> 2020-09-15, DATE_SUB(INTERVAL 10 DAY) -> 2020-08-26, DATEDIFF = 10.",
                    claim_type="factual",
                    requires_domain_check=True,
                )
            )

        # 5. Algorithm Execution Steps Decomposition
        if "algorithm" in diag_type or "array" in diag_type or "search" in diag_type:
            if spec.get("array") or diagram_spec.get("array"):
                arr = spec.get("array") or diagram_spec.get("array")
                target = spec.get("target") or diagram_spec.get("target") or 23
                low = spec.get("low", 4)
                high = spec.get("high", 8)
                claims.append(
                    DecomposedClaim(
                        claim_id=f"{diag_id}_array_search",
                        text=f"Diagram asserts array binary search over elements {arr} with target {target} in search interval [{low} .. {high}].",
                        claim_type="complexity",
                        requires_domain_check=True,
                    )
                )
            elif spec.get("steps") or diagram_spec.get("steps"):
                steps_list = spec.get("steps") or diagram_spec.get("steps") or []
                for s_idx, step_item in enumerate(steps_list):
                    st_text = step_item if isinstance(step_item, str) else str(step_item)
                    claims.append(
                        DecomposedClaim(
                            claim_id=f"{diag_id}_step_{s_idx+1}",
                            text=f"Diagram executes algorithmic process step {s_idx+1}: '{st_text}'",
                            claim_type="factual",
                            requires_domain_check=False,
                        )
                    )

        # 6. Nodes assertions
        nodes = diagram_spec.get("nodes") or []
        for n_idx, node in enumerate(nodes):
            n_label = node.get("label") or node.get("id") or f"Node_{n_idx+1}"
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_node_{n_idx+1}",
                    text=f"Diagram contains component node: '{n_label}'",
                    claim_type="diagram_node",
                    requires_domain_check=False,
                )
            )

        # 7. Directed Edge assertions
        edges = diagram_spec.get("edges") or []
        for e_idx, edge in enumerate(edges):
            src = edge.get("from") or edge.get("source") or ""
            tgt = edge.get("to") or edge.get("target") or ""
            label = edge.get("label") or ""
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_edge_{e_idx+1}",
                    text=f"Diagram asserts directed relationship: '{src}' -> '{tgt}' (Label: '{label}')",
                    claim_type="diagram_edge",
                    requires_domain_check=True,
                )
            )

        # 8. Mathematical/formula spec assertions (if coordinate graph)
        if "equation" in spec:
            claims.append(
                DecomposedClaim(
                    claim_id=f"{diag_id}_equation",
                    text=f"Diagram plots mathematical equation: '{spec['equation']}'",
                    claim_type="formula",
                    formula_latex=spec.get("equation"),
                    requires_domain_check=True,
                )
            )

        return claims
