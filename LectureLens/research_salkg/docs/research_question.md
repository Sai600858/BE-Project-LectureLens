# Research Question and Theoretical Hypotheses

## Primary Research Question

> **"Can subject-adaptive multimodal evidence alignment and relationship validation construct more accurate, traceable, and internally consistent lecture knowledge graphs than general-purpose extraction, timestamp-only alignment, or semantic-similarity alignment?"**

This question is treated formally as an empirical scientific hypothesis, not an established fact.

---

## 1. Problem Definition and Scope

Educational video lectures present a rich, synchronized multimodal stream comprising:
1. Spoken discourse transcribed into timestamped segments $S = \{s_1, s_2, \dots, s_N\}$.
2. Visual artifacts $V = \{v_1, v_2, \dots, v_M\}$, including presentation slide text, formal mathematical formulas, program source code snippets, circuit diagrams, and architecture flowcharts.

Existing educational extraction frameworks largely fall into two extreme paradigms:
- **Generic Information Extraction:** Large language models or relation classifiers process text transcripts in isolation, ignoring visual evidence and generating ungrounded facts that lack provenance.
- **Unimodal or Heuristic Alignment:** Systems align speech to slides using global Dynamic Time Warping (DTW) or TF-IDF text matching without modeling the semantic nature of different academic subjects (e.g. derivations in mathematics versus algorithmic complexity in computer science).

SALKG investigates whether:
1. Identifying the academic subject $\hat{y}_{\text{subj}} \in \{\text{Mathematics}, \text{Programming}, \text{Physics/Electronics}, \text{General CS}, \text{Unknown}\}$ dynamically modulates the importance of symbolic vs. structural vs. lexical similarity features.
2. Formally coupling local multimodal compatibility with sequence transition optimization prevents erratic jumping across slides.
3. Selective prediction (rejection and review options based on calibrated confidence) and ontological consistency rules (DAG cycle checking on prerequisite hierarchies and duplicate resolution) yield significantly higher fidelity knowledge graphs.

---

## 2. Formal Hypotheses

### Hypothesis 1: Feature Modality Specialization
$$\mathcal{H}_1: \text{Subject-conditioned feature weighting achieves higher alignment } F_1 \text{ than uniform feature weighting.}$$
- *Rationale:* In mathematical lectures, variable and LaTeX symbol overlap ($S_{\text{sym}}$) provides high signal even when spoken transcripts are brief. In programming lectures, identifier overlap ($S_{\text{code}}$) and code-block compatibility anchor explanations far more reliably than generic stopwords.

### Hypothesis 2: Sequence Transition Regularization
$$\mathcal{H}_2: \text{Dynamic programming sequence optimization with non-monotonic jump penalties outperforms greedy local alignment.}$$
- *Rationale:* Instructors rarely jump haphazardly across slides. Regularizing sequential flow with forward-jump and backward-jump penalties eliminates spurious matches while permitting genuine lookbacks when local evidence is overwhelmingly strong.

### Hypothesis 3: Selective Prediction and Calibration
$$\mathcal{H}_3: \text{Risk-coverage thresholding drastically lowers false acceptance rate (FAR) with minimal coverage sacrifice.}$$
- *Rationale:* Low-scoring or ambiguous matches where the margin between top candidates is narrow ($\Delta \le \theta_{\text{margin}}$) account for the vast majority of false positive triples in downstream knowledge graphs.

### Hypothesis 4: Ontological Validation and Acyclicity
$$\mathcal{H}_4: \text{Rule-based graph verification detects and resolves logical inconsistencies without discarding valid evidence.}$$
- *Rationale:* Educational prerequisite relations form strict directed acyclic graphs (DAGs). Automated graph validation can identify circular dependencies and unresolved evidence without fabricating relations.
