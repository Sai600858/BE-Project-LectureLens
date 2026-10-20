"""Text, symbolic, and code similarity functions for SALKG.

Improvements (v2):
- BM25 length-normalised TF-IDF instead of raw TF, preventing short visual
  captions from scoring unfairly low against long transcript segments.
- Weighted Jaccard symbol overlap: LaTeX macro tokens receive 3× weight.
- Trivial single-letter math-variable filter to eliminate noise from common
  English letters (a, i, s, e, o, u).
"""

from __future__ import annotations

import collections
import math
import re
from typing import Dict, List, Optional, Set, Tuple


def tokenize(text: str, lower: bool = True) -> List[str]:
    """Tokenize text into alphanumeric words and simple symbols."""
    if not text:
        return []
    if lower:
        text = text.lower()
    # Split on whitespace and punctuation, keeping basic identifiers
    tokens = re.findall(r"[a-zA-Z0-9_]+|[\+\-\*/=\(\)\{\}\[\]\\<>]", text)
    return tokens


def get_ngrams(tokens: List[str], n_min: int = 1, n_max: int = 2) -> List[str]:
    """Extract word n-grams from a list of tokens."""
    ngrams = []
    for n in range(n_min, n_max + 1):
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i : i + n]))
    return ngrams


class TFIDFScorer:
    """Deterministic, pure-Python TF-IDF vectorizer with BM25 TF normalization.

    Uses BM25 TF saturation instead of raw counts so that short visual captions
    (e.g. slide titles) are not systematically under-scored against long speech
    segments.  L2 normalization is applied after BM25 weighting.
    """

    # BM25 hyperparameters: k1 controls TF saturation, b controls length normalization.
    BM25_K1: float = 1.5
    BM25_B: float = 0.75

    def __init__(self, n_min: int = 1, n_max: int = 2):
        self.n_min = n_min
        self.n_max = n_max
        self.vocabulary: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.doc_count = 0
        self._avg_doc_len: float = 0.0  # needed for BM25 length normalization

    def fit(self, documents: List[str]) -> "TFIDFScorer":
        """Fit vocabulary, IDF weights, and average document length on a corpus."""
        self.doc_count = len(documents)
        df_counts: Dict[str, int] = collections.defaultdict(int)
        total_len = 0

        for doc in documents:
            tokens = tokenize(doc)
            total_len += len(tokens)
            terms = set(get_ngrams(tokens, self.n_min, self.n_max))
            for t in terms:
                df_counts[t] += 1

        self._avg_doc_len = total_len / max(1, self.doc_count)
        self.vocabulary = {term: idx for idx, term in enumerate(sorted(df_counts.keys()))}
        # Smoothed IDF: log((N + 1) / (df + 1)) + 1.0
        for term, df in df_counts.items():
            self.idf[term] = math.log((self.doc_count + 1.0) / (df + 1.0)) + 1.0

        return self

    def transform(self, text: str) -> Dict[str, float]:
        """Compute L2-normalised BM25-weighted sparse vector for *text*."""
        tokens = tokenize(text)
        doc_len = max(1, len(tokens))
        terms = get_ngrams(tokens, self.n_min, self.n_max)
        tf_counts: Dict[str, int] = collections.defaultdict(int)
        for t in terms:
            if t in self.vocabulary:
                tf_counts[t] += 1

        k1 = self.BM25_K1
        b = self.BM25_B
        avg_dl = self._avg_doc_len if self._avg_doc_len > 0 else 1.0
        len_norm = 1.0 - b + b * (doc_len / avg_dl)

        vector: Dict[str, float] = {}
        norm_sq = 0.0
        for term, count in tf_counts.items():
            # BM25 TF saturation: prevents high-frequency terms dominating
            tf_bm25 = count * (k1 + 1.0) / (count + k1 * len_norm)
            val = tf_bm25 * self.idf.get(term, 1.0)
            vector[term] = val
            norm_sq += val * val

        # L2 normalize for cosine computation
        norm = math.sqrt(norm_sq)
        if norm > 0.0:
            for term in vector:
                vector[term] /= norm

        return vector

    def cosine_similarity(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        """Compute cosine similarity between two sparse L2-normalised vectors."""
        if not vec_a or not vec_b:
            return 0.0
        # Iterate over the smaller vector for efficiency
        if len(vec_a) > len(vec_b):
            vec_a, vec_b = vec_b, vec_a

        dot = 0.0
        for term, val_a in vec_a.items():
            if term in vec_b:
                dot += val_a * vec_b[term]

        return min(max(dot, 0.0), 1.0)


# Common English single-letters that appear in math contexts but carry no
# discriminative signal for subject-specific alignment.
_TRIVIAL_MATH_VARS: Set[str] = {"a", "i", "s", "e", "o", "u", "t", "n", "m"}


def extract_math_symbols(text: str) -> Set[str]:
    """Extract mathematical variables, operators, differentials, and LaTeX tokens.

    Trivial single-letter English words (a, i, s, e, o, u, t, n, m) are excluded
    to avoid false-positive matches between general speech and domain-specific
    formulae that happen to contain common letters.
    """
    if not text:
        return set()
    text_lower = text.lower()
    # High-specificity LaTeX macros: \frac, \int, \partial, \nabla, etc.
    latex_cmds = set(re.findall(r"\\[a-zA-Z]+", text))
    # Differential operators: dx, dy, dt, dz
    differentials = set(re.findall(r"\b(?:d[xyzt]|dt|dx|dy|dz)\b", text_lower))
    # Single-letter math variables — filter trivial English letters
    raw_vars = set(re.findall(r"\b[a-zA-Z]\b", text_lower))
    math_vars = raw_vars - _TRIVIAL_MATH_VARS
    operators = set(re.findall(r"[=+\-*/^_{}\\]", text))
    return latex_cmds.union(differentials).union(math_vars).union(operators)


def _symbol_weight(sym: str) -> float:
    """Return specificity weight for a math symbol.

    LaTeX macros (backslash prefix) are highly domain-specific and receive
    3× weight; differential operators get 2×; plain vars/operators get 1×.
    """
    if sym.startswith("\\"):
        return 3.0
    if sym in {"dx", "dy", "dt", "dz"}:
        return 2.0
    return 1.0


def compute_symbol_overlap(text_a: str, text_b: str) -> float:
    """Compute *weighted* Jaccard symbol similarity between two math texts.

    LaTeX command tokens (e.g. \\frac, \\int) receive 3× weight over plain
    single-letter variables, reflecting their higher discriminative specificity.
    """
    syms_a = extract_math_symbols(text_a)
    syms_b = extract_math_symbols(text_b)
    if not syms_a or not syms_b:
        return 0.0
    intersection = syms_a.intersection(syms_b)
    union = syms_a.union(syms_b)
    w_intersection = sum(_symbol_weight(s) for s in intersection)
    w_union = sum(_symbol_weight(s) for s in union)
    return w_intersection / w_union if w_union > 0 else 0.0


def extract_code_identifiers(code_or_text: str) -> Set[str]:
    """Extract programming identifiers (snake_case, camelCase, function names)."""
    if not code_or_text:
        return set()
    # Matches identifiers of length >= 2
    raw_idents = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]{1,30}\b", code_or_text)
    identifiers = set()
    for ident in raw_idents:
        identifiers.add(ident.lower())
        # Also split camelCase (e.g. binarySearch -> binary, search)
        sub_words = re.sub(r"([A-Z])", r" \1", ident).split()
        for sw in sub_words:
            if len(sw) > 2:
                identifiers.add(sw.lower())
    return identifiers


def compute_identifier_overlap(text_a: str, text_b: str) -> float:
    """Compute Jaccard identifier overlap between code and spoken explanation."""
    idents_a = extract_code_identifiers(text_a)
    idents_b = extract_code_identifiers(text_b)
    if not idents_a or not idents_b:
        return 0.0
    intersection = len(idents_a.intersection(idents_b))
    union = len(idents_a.union(idents_b))
    return intersection / union if union > 0 else 0.0
