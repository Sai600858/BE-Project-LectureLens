"""Subject and content-type identification module for SALKG."""

from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
from salkg.input_schema import LectureData


class SubjectClassifier:
    """Transparent, rule-based and vocabulary-driven subject and content-type classifier."""

    def __init__(self, subjects_config_path: Optional[str] = None):
        if subjects_config_path is None:
            for cand in ["research_salkg/configs/subjects.yaml", "configs/subjects.yaml"]:
                if Path(cand).exists():
                    subjects_config_path = cand
                    break
        self.subjects = self._load_subjects_config(subjects_config_path)

    def _load_subjects_config(self, path: Optional[str]) -> Dict[str, Any]:
        if path:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    return data.get("subjects", {})
            except Exception:
                pass
        # Built-in robust defaults if config path not passed
        return {
            "mathematics": {
                "keywords": [
                    "theorem", "proof", "lemma", "integral", "derivative", "differential",
                    "matrix", "vector", "eigenvector", "eigenvalue", "limit", "series",
                    "convergence", "calculus", "polynomial", "continuous", "gradient",
                    "determinant", "vector space", "linear algebra", "cauchy", "riemann"
                ],
                "symbols": ["\\int", "\\sum", "\\frac", "\\partial", "\\nabla", "\\infty", "\\lambda", "dx", "dy", "\\cdot", "\\approx"],
            },
            "programming": {
                "keywords": [
                    "function", "class", "method", "array", "linked list", "tree", "graph",
                    "recursion", "pointer", "memory", "complexity", "big o", "sorting",
                    "stack", "queue", "hash table", "binary search", "loop", "iteration",
                    "compile", "runtime", "object oriented", "inheritance", "polymorphism"
                ],
                "code_patterns": [r"\bdef\s+\w+", r"\bclass\s+\w+", r"\bpublic\s+static\s+void", r"[{}\[\];]", r"\bint\s+\w+"],
            },
            "physics_electronics": {
                "keywords": [
                    "voltage", "current", "resistance", "capacitance", "inductance", "ohm",
                    "kirchhoff", "magnetic", "electric field", "frequency", "impedance",
                    "semiconductor", "transistor", "diode", "photon", "wave", "velocity",
                    "acceleration", "force", "energy", "power", "flux", "maxwell"
                ],
                "symbols": ["v = ir", "omega", "mu_0", "epsilon_0", "hz", "khz", "mhz", "pf", "uf", "ma"],
            },
            "general_cs": {
                "keywords": [
                    "process", "thread", "cpu", "cache", "operating system", "deadlock",
                    "virtual memory", "tcp", "ip", "packet", "socket", "database",
                    "transaction", "acid properties", "sql", "normalization", "schema", "protocol",
                    "client server", "distributed", "concurrency", "scheduler"
                ],
                "symbols": [],
            },
            "biology": {
                "keywords": [
                    "biology", "excretion", "homeostasis", "kidney", "nephron",
                    "ammonia", "urea", "uric acid", "osmoregulation", "nitrogenous waste",
                    "ammonotelism", "ureotelism", "uricotelism", "renal pelvis", "hilum",
                    "cortex", "medulla", "bertini", "organism", "cell", "tissue", "organ",
                    "physiology", "anatomy", "filtration"
                ],
                "symbols": [],
            },
        }

    def classify(self, lecture: LectureData) -> Dict[str, Any]:
        """Classify lecture subject, content type breakdown, and uncertainty metrics."""
        # Aggregate all text evidence
        speech_texts = [s.text.lower() for s in lecture.segments if s.text]
        visual_texts = [v.extracted_text.lower() for v in lecture.visual_events if v.extracted_text]
        formulas = [v.formula_latex.lower() for v in lecture.visual_events if v.formula_latex]
        code_snippets = [v.code_content.lower() for v in lecture.visual_events if v.code_content]

        combined_text = " ".join(speech_texts + visual_texts)
        combined_formulas = " ".join(formulas)
        combined_code = " ".join(code_snippets)
        total_corpus = f"{combined_text} {combined_formulas} {combined_code}"

        # Score subjects based on evidence counts
        raw_scores: Dict[str, float] = {}
        feature_evidence: Dict[str, List[str]] = {}

        for subj_key, subj_spec in self.subjects.items():
            if subj_key == "unknown":
                continue

            score = 0.0
            evidence = []

            # 1. Keyword matching
            keywords = subj_spec.get("keywords", [])
            doc_len = max(1, len(combined_text.split()))
            for kw in keywords:
                # regex word boundary
                pattern = r"\b" + re.escape(kw) + r"\b"
                matches = len(re.findall(pattern, combined_text))
                if matches > 0:
                    # Normalize keyword weight by document length for long lectures (>100 words)
                    scale = min(1.0, 60.0 / doc_len) if doc_len > 100 else 1.0
                    score += matches * scale * 1.5
                    evidence.append(f"kw:{kw}({matches})")

            # 2. Mathematical symbol matching
            symbols = subj_spec.get("symbol_indicators", subj_spec.get("symbols", []))
            for sym in symbols:
                if not sym or sym == "=":
                    continue
                # Alphanumeric indicators (e.g. 'dx', 'dy', 'ma', 'hz', 'uf') require word boundaries
                # to prevent matching substrings within common English words (e.g. 'ma' in 'famous')
                if re.match(r"^[a-zA-Z0-9_]+$", sym):
                    count = len(re.findall(r"\b" + re.escape(sym) + r"\b", total_corpus, re.IGNORECASE))
                else:
                    count = total_corpus.count(sym.lower())
                if count > 0:
                    score += count * 2.0
                    evidence.append(f"sym:{sym}({count})")

            # 3. Code pattern matching
            code_patterns = subj_spec.get("code_indicators", subj_spec.get("code_patterns", []))
            for cp in code_patterns:
                try:
                    is_raw_regex = any(c in cp for c in [r"\b", r"\w", r"\s", "(?", "[", ".+", "*"])
                    pattern_to_use = cp if is_raw_regex else re.escape(cp)
                    matches = len(re.findall(pattern_to_use, total_corpus))
                except re.error:
                    matches = len(re.findall(re.escape(cp), total_corpus))
                if matches > 0:
                    score += matches * 2.5
                    evidence.append(f"code:{cp}({matches})")

            raw_scores[subj_key] = score
            feature_evidence[subj_key] = evidence

        # Convert raw scores to probabilities with Laplace smoothing
        smoothing_prior = 1.0
        total_score = sum(raw_scores.values()) + smoothing_prior * len(raw_scores)
        probabilities: Dict[str, float] = {}
        for k, v in raw_scores.items():
            probabilities[k] = (v + smoothing_prior) / total_score

        # Sort by probability descending
        sorted_candidates = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
        top_subject, top_prob = sorted_candidates[0]
        second_prob = sorted_candidates[1][1] if len(sorted_candidates) > 1 else 0.0

        # Calculate Shannon entropy and margin
        entropy = 0.0
        for p in probabilities.values():
            if p > 0:
                entropy -= p * math.log2(p)
        max_possible_entropy = math.log2(len(probabilities)) if len(probabilities) > 1 else 1.0
        normalized_entropy = entropy / max_possible_entropy if max_possible_entropy > 0 else 0.0
        margin = top_prob - second_prob

        # Soft subject mixture: blend top-2 subjects if close race (< 0.15 margin)
        mixture_weights: Dict[str, float] = {top_subject: round(top_prob, 4)}
        if len(sorted_candidates) > 1 and (top_prob - second_prob < 0.15) and sum(raw_scores.values()) >= 3.0:
            mixture_weights = {
                sorted_candidates[0][0]: round(sorted_candidates[0][1], 4),
                sorted_candidates[1][0]: round(sorted_candidates[1][1], 4)
            }

        # Unknown assignment if low confidence or high entropy or no strong features
        assigned_subject = top_subject
        is_unknown = False
        if sum(raw_scores.values()) < 3.0 or top_prob < 0.35 or normalized_entropy > 0.90:
            assigned_subject = "unknown"
            is_unknown = True

        # Content-type distribution estimation
        content_type_counts: Dict[str, int] = {}
        for ev in lecture.visual_events:
            vtype = ev.visual_type
            content_type_counts[vtype] = content_type_counts.get(vtype, 0) + 1
        total_visuals = len(lecture.visual_events) or 1
        content_type_distribution = {k: v / total_visuals for k, v in content_type_counts.items()}

        return {
            "assigned_subject": assigned_subject,
            "is_unknown": is_unknown,
            "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
            "mixture_weights": mixture_weights,
            "confidence": round(top_prob, 4),
            "margin": round(margin, 4),
            "entropy": round(entropy, 4),
            "normalized_entropy": round(normalized_entropy, 4),
            "top_features": feature_evidence.get(top_subject, [])[:10],
            "all_evidence": {k: v[:5] for k, v in feature_evidence.items() if v},
            "content_type_distribution": content_type_distribution,
        }
