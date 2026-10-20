# Research Limitations and Threats to Validity

## 1. Threats to Internal Validity
- **Rule-Based Relation Extraction:** Pedagogical relation extraction currently relies on syntactic dependency and discourse regex patterns (e.g., "before learning X, you must understand Y"). While highly precise and explainable, regex patterns exhibit lower recall when instructors employ idiomatic, colloquial, or indirect pedagogical phrasing.
- **Laplace-Smoothed Heuristic Classifier:** The transparent rule-based subject classifier can be influenced by heavy theoretical discussions in applied courses (e.g. algorithm runtime analysis triggering the mathematics prior instead of programming). While entropy metrics flag uncertainty, classical machine learning classifiers trained on TF-IDF or local embeddings would provide more continuous probability landscapes.

---

## 2. Threats to External Validity
- **Corpus Scale:** The prototype has been validated on 6 benchmark lecture streams covering multiple domains and noise conditions. While sufficient for proof-of-concept algorithmic verification, claims of global generalizability across all world languages and pedagogical cultures require hundreds of hours of raw classroom video.
- **Synthetic vs. In-the-Wild Video Artifacts:** Although the synthetic test suite specifically includes noisy ASR transcripts, repeated slides, and OCR artifacts, in-the-wild classroom recordings feature presenter occlusions, chalk-dust smudges on blackboards, ambient acoustic reverberation, and unprompted student interruptions.

---

## 3. Computational and Ontological Assumptions
- **Predefined Subject Ontologies:** The schemas defined in `configs/subjects.yaml` represent foundational structures for university-level STEM courses. Interdisciplinary lectures (e.g. Computational Quantum Chemistry or Bio-informatics) blur subject boundaries and may require dynamic ontological schema synthesis.
- **DAG Acyclicity Assumption:** Enforcing DAG properties on prerequisite relations assumes hierarchical curriculum progression. While true for foundational concepts, advanced reciprocal relationships (where concept A and concept B mutually inform each other) require multi-relational clustering rather than strict DAG cycle pruning.
