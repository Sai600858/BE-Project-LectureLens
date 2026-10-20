# SALKG: Subject-Adaptive Lecture Knowledge Graph Construction
## Experimental Research Prototype for Multimodal Lecture Understanding

SALKG (**S**ubject-**A**daptive **L**ecture **K**nowledge **G**raph Construction) is an independent, offline, reproducible scientific research prototype developed to evaluate whether subject-conditioned multimodal alignment and ontological validation improve the accuracy, traceability, and consistency of lecture-grounded knowledge graphs over standard baselines.

---

### Non-Negotiable Isolation Policy
This prototype is completely isolated from the main LectureLens production application:
- No existing LectureLens code, services, database schemas, or dependencies are modified.
- All code, datasets, configurations, experiment outputs, and reports reside exclusively within `research_salkg/`.
- No paid API calls (e.g. Gemini, OpenAI) or cloud services are required; all baseline and proposed algorithms run fully offline and deterministically.

---

### Key Modules
1. **Input Normalization & Schema Validation (`salkg.input_schema`, `salkg.normalization`)**:
   - Parses timestamped speech transcripts, visual events (slides, equations, code, diagrams), and metadata with rigorous interval and integrity checks.
2. **Subject Identification & Uncertainty Estimation (`salkg.subject_classifier`)**:
   - Pluggable rule-based and vocabulary-driven subject classifier estimating subject probabilities, content types, and prediction entropy.
3. **Subject-Specific Schemas (`salkg.subject_schemas`)**:
   - Configurable ontologies for Mathematics, Programming, Physics/Electronics, and General Computer Science.
4. **Multimodal Alignment (`salkg.alignment_baselines`, `salkg.proposed_alignment`)**:
   - Baselines: Temporal-only, Semantic-only (TF-IDF), Independent Weighted.
   - Proposed: Subject-adaptive formulation tailoring weights to mathematical symbols, code identifiers, and content types.
5. **Sequence Optimization (`salkg.sequence_optimizer`)**:
   - Non-monotonic dynamic programming alignment accounting for repeated slides, lookbacks, and jump penalties.
6. **Selective Prediction & Confidence Calibration (`salkg.confidence`)**:
   - Risk-coverage rejection mechanism to eliminate low-confidence or ambiguous candidate alignments.
7. **Knowledge Graph Construction & Provenance Grounding (`salkg.graph_builder`, `salkg.provenance`)**:
   - Explicit node and edge generation where every triple retains strict references to source transcripts, visual events, and timestamps.
8. **Ontological Graph Validation (`salkg.graph_validator`)**:
   - Rule-based verification enforcing prerequisite DAG acyclicity, schema constraints, unsupported relationship flags, and entity deduplication.
9. **Evaluation & Metrics (`salkg.metrics`)**:
   - Exact mathematical evaluation of alignment, graph fidelity, subject classification, and computational efficiency.
10. **Query Demonstration & Visualization (`salkg.cli`, `salkg.visualization`)**:
    - Provenance-aware query interface and interactive graph visualization export.

---

### CLI Usage Guide

All commands can be run using the standard Python module runner from the repository root:

```bash
# Set PYTHONPATH to include research_salkg/src
export PYTHONPATH=research_salkg/src  # On Linux/macOS
# On Windows PowerShell:
$env:PYTHONPATH="research_salkg/src"

# 1. Validate an input lecture file
python -m salkg.cli validate-input --input research_salkg/data/synthetic/math_calculus.json

# 2. Run all baseline alignments
python -m salkg.cli run-baselines --config research_salkg/configs/default.yaml

# 3. Run the proposed SALKG algorithm
python -m salkg.cli run-proposed --config research_salkg/configs/default.yaml

# 4. Run systematic ablation studies
python -m salkg.cli run-ablation --config research_salkg/configs/experiment.yaml

# 5. Evaluate all results against ground truth
python -m salkg.cli evaluate --results research_salkg/results/raw/

# 6. Query the constructed knowledge graph
python -m salkg.cli query --graph research_salkg/results/processed/proposed_graph.json --concept "Chain Rule"

# 7. Generate research reports (Markdown and PDF)
python -m salkg.cli generate-report
```

---

### Running Tests
Execute unit tests covering all components, edge cases, mathematical formulas, and project isolation:

```powershell
python -m pytest research_salkg/tests/ -v
```
