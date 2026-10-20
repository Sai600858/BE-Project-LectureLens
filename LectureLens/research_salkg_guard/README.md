# SALKG-Guard: Dual-Axis Lecture Verification & Hallucination Guard

SALKG-Guard is an independent validation and guardrail system designed to ensure all AI-generated outputs (RAG answers, study notes, quiz questions, mindmaps) are strictly grounded in lecture evidence and subject-domain truth.

---

### Key Modules (`src/salkg_guard/`)
1. **Claim Decomposer (`decomposer.py`)**: Breaks down generated artifacts into atomic, testable claims.
2. **Multimodal Provenance Resolver (`provenance_resolver.py`)**: Maps claims to timestamped transcript utterances, whiteboard snapshots, and SALKG graph nodes/edges.
3. **Dual-Axis Validator (`dual_axis.py`)**: Evaluates claims on two independent axes:
   - **Lecture Faithfulness**: Was this taught in the lecture?
   - **Domain Correctness**: Is it factually sound according to the domain ontology?
4. **Contradiction & Dependency Analyzer (`contradiction_analyzer.py`)**: Identifies prerequisite violations and logical contradictions.
5. **Decision Engine (`decision_engine.py`)**: Generates risk-calibrated decisions (`ACCEPT`, `REGENERATE`, `ABSTAIN`, `NEEDS_REVIEW`).
6. **Pipeline Runner (`pipeline.py`)**: Subprocess entry point executed by LectureLens backend.
7. **Domain Registry (`domain_registry.py`)**: Domain validators and subject-specific rules.

---

### Running Tests

```bash
# From LectureLens root:
$env:PYTHONPATH="research_salkg_guard/src;research_salkg/src"
pytest research_salkg_guard/tests/
```
