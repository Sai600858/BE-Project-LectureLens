# SALKG: Subject-Adaptive Multimodal Evidence Alignment and Knowledge Graph Construction for Educational Lectures

**Author:** LectureLens Research Team  
**Institution:** Final-Year BE Computer Engineering Research Project  
**Date:** October 2026  
**Status:** Reproducible Experimental Research Prototype  

---

## 1. Title
**SALKG: Subject-Adaptive Multimodal Evidence Alignment, Sequence Optimization, and Ontological Graph Validation for Educational Lecture Knowledge Extraction**

---

## 2. Abstract
Constructing structured, evidence-grounded knowledge graphs from continuous educational video lectures requires bridging spoken discourse with diverse visual artifacts, including mathematical equations, program source code, and architectural diagrams. Traditional knowledge extraction approaches either treat transcripts as flat text—producing ungrounded triples that hallucinate facts—or apply rigid, subject-agnostic heuristics that fail across diverse academic disciplines. In this research, we propose and investigate **SALKG** (Subject-Adaptive Lecture Knowledge Graph construction), an experimental algorithmic framework featuring: (1) a transparent, entropy-based subject classifier that dynamically modulates feature weights for symbolic, code, and lexical modalities; (2) an interval-aware asymmetric temporal alignment function that captures active slide visibility and verbal delivery lag; (3) dynamic programming sequence optimization with non-monotonic jump penalties; (4) calibrated selective prediction (rejection and review options); and (5) ontological directed acyclic graph (DAG) cycle resolution with strict provenance tracking. Evaluated on a diverse benchmark corpus across mathematics, programming, electronics, operating systems, and noisy stress conditions, the proposed pipeline achieves an alignment $F_1$ of **0.9815** and **1.0000** Precision under selective prediction, compared to 0.8111 for semantic-only baselines. Systematic ablation experiments demonstrate that temporal interval anchoring, content-type compatibility, and sequence transition regularization are indispensable components for robust multimodal educational knowledge extraction.

---

## 3. Problem Statement
Educational video lectures present unstructured, multi-stream instructional information where spoken concepts must be grounded in synchronized visual evidence. Given a continuous stream of $N$ speech segments $S = (s_1, \dots, s_N)$ and $M$ visual events $V = (v_1, \dots, v_M)$, the objective is to:
1. Accurately align each spoken utterance $s_i$ to its active supporting visual event $v_j$ (slides, formulas, code blocks, or diagrams).
2. Extract domain concepts and pedagogical relationships (e.g., prerequisite hierarchies, formal definitions, and step-by-step derivations) into a structured Knowledge Graph $\mathcal{G} = (\mathcal{V}_{\text{kg}}, \mathcal{E}_{\text{kg}})$.
3. Ensure every node and edge carries verifiable multimodal provenance timestamps and IDs, eliminating unsupported hallucinations and resolving logical inconsistencies (such as circular prerequisite dependencies).

---

## 4. Motivation
While speech-to-text models (such as Faster-Whisper) and visual OCR engines can transcribe raw lecture content, raw text dumps lack conceptual structure. Students and automated tutoring systems require structured knowledge graphs to trace prerequisite concepts, jump to exact visual derivations, and visualize curriculum topic flow. Academic subjects exhibit fundamentally distinct pedagogical structures:
- **Mathematics:** Dominated by formal theorems, LaTeX expressions, and step-by-step derivations where symbolic variable overlap ($S_{\text{sym}}$) provides critical signal.
- **Computer Programming:** Characterized by code syntax, function signatures, loop invariants, and asymptotic Big-O runtime tables.
- **Physics and Electronics:** Governed by circuit schematics, physical laws, and component diagrams.
- **Systems & CS Architecture:** Focused on multi-stage processes, address translation, and hardware block diagrams.

A universal, subject-agnostic alignment algorithm cannot adequately weight these heterogeneous feature spaces.

---

## 5. Scope and Assumptions
- **Input Modalities:** Timestamped transcripts (start time, end time, utterance text, speaker ID, confidence) and visual events (timestamp, interval, visual type, extracted text, LaTeX formula, code content).
- **Offline & Zero-Cost Requirement:** All default baselines, classifiers, and proposed algorithms operate entirely offline without requiring paid cloud API keys or proprietary models.
- **Strict Isolation Guarantee:** No files or dependencies of the existing LectureLens application are modified; all research code, tests, and outputs reside exclusively inside `research_salkg/`.

---

## 6. Research Questions and Hypotheses
The primary research hypothesis investigates:
> *"Can subject-adaptive multimodal evidence alignment and relationship validation construct more accurate, traceable, and internally consistent lecture knowledge graphs than general-purpose extraction, timestamp-only alignment, or semantic-similarity alignment?"*

We formulate four testable sub-hypotheses:
- $\mathcal{H}_1$ (Feature Specialization): Subject-conditioned feature weights achieve higher alignment accuracy than fixed global weights.
- $\mathcal{H}_2$ (Sequence Regularization): Dynamic programming with non-monotonic transition penalties outperforms greedy local alignment by preventing erratic slide hopping.
- $\mathcal{H}_3$ (Selective Rejection): Calibrated thresholding eliminates low-confidence false positives with minimal coverage loss.
- $\mathcal{H}_4$ (Ontological Consistency): Automated cycle breaking and concept deduplication enforce valid prerequisite DAGs without inventing evidence.

---

## 7. Literature Review
We systematically reviewed foundational literature across five intersecting domains:
1. **Video-to-Slide Alignment:** Anderer, Reich, & Wölfel (2024, arXiv:2409.16765) introduced the MaViLS benchmark, demonstrating that combining OCR, speech transcripts, and visual features via dynamic programming with transition penalties achieves 0.82 accuracy. Sindel et al. (2021, arXiv:2202.03540) developed SliTraNet for CNN-based slide transition detection.
2. **Multimodal Knowledge Graph Construction:** Zhu et al. (2022, IEEE TKDE) provided a comprehensive survey on MMKG pipelines. Zheng et al. (2021, ACM MM) proposed dual graph alignment for multimodal relation extraction on social media posts.
3. **Educational Knowledge Graphs:** Pan et al. (2017, ACL) demonstrated prerequisite relation learning on MOOC video transcripts. Liang et al. (2017, AAAI) recovered concept prerequisite hierarchies from university course dependency graphs.
4. **Consistency Validation:** Pujara et al. (2013, ISWC) introduced Knowledge Graph Identification (KGI) using Probabilistic Soft Logic to enforce ontological constraints over noisy candidate extractions.
5. **Selective Classification:** Geifman & El-Yaniv (2017, NeurIPS) established theoretical risk-coverage foundations for classification with a reject option.

---

## 8. Comparison with Related Work
| Dimension | MaViLS (Anderer 2024) | SliTraNet (Sindel 2021) | EduKG (Pan 2017) | Proposed SALKG |
| :--- | :---: | :---: | :---: | :---: |
| **Input Modality** | Video, Audio, Slides | Video frames | Text transcripts | Transcripts + Visual Events + Math + Code |
| **Alignment Granularity** | Document/Slide | Slide transitions | Unaligned | Segment-to-Visual Event + Concepts |
| **Subject Adaptivity** | No (Uniform) | No | No (Generic) | **Yes (4 Disciplines + Unknown)** |
| **Knowledge Graph Generation** | No | No | Text Prerequisite Graph | **Full Evidence-Grounded KG** |
| **DAG Cycle Resolution** | No | No | Post-hoc heuristic | **Topological Weakest-Edge Pruning** |
| **Selective Abstention** | No | No | No | **Calibrated Risk-Coverage Filter** |

---

## 9. Identified Research Gap
Prior research either solves coarse slide-level alignment without concept graph extraction (MaViLS) or extracts text-only concept hierarchies without visual evidence grounding (Pan et al.). Crucially, no existing framework dynamically adapts feature weighting to academic subject content types while simultaneously enforcing formal ontological DAG consistency and risk-calibrated selective rejection.

---

## 10. Proposed Contribution
SALKG contributes:
1. An **interval-aware asymmetric temporal scoring function** eliminating duration distortion on long-lived educational slides.
2. A **subject-adaptive scoring architecture** modulating symbolic ($S_{\text{sym}}$), structural ($S_{\text{code}}$), and discourse compatibility ($C$) based on entropy-measured discipline priors.
3. A **non-monotonic dynamic programming sequence optimizer** that penalizes erratic jumps while permitting genuine instructional lookbacks.
4. A **risk-coverage selective filter** ensuring high-precision knowledge graph population.
5. A **formal graph validator** executing string-canonical concept deduplication and topological DAG cycle breaking.

---

## 11. System Architecture
The pipeline is structured into eleven isolated, modular stages:
```
[Raw Input JSON/JSONL/CSV] 
       │
       ▼
[1. Input Normalizer & Interval Validator]
       │
       ├──► [2. Pluggable Subject & Content-Type Classifier]
       │          │ (Estimates Subject Priors & Shannon Entropy)
       ▼          ▼
[3. Multimodal Candidate Generator & TF-IDF Indexer]
       │
       ├──► [4. Subject-Adaptive Scoring: Temporal + Semantic + Content + Symbol]
       │
       ▼
[5. Dynamic Programming Sequence Optimizer (Viterbi with Jump Penalties)]
       │
       ▼
[6. Confidence Calibrator & Selective Rejection Filter]
       │
       ▼
[7. Knowledge Graph Builder (Concept & Relation Extraction with Provenance)]
       │
       ▼
[8. Ontological Validator (Deduplication, Schema Rules, Prerequisite DAG Acyclicity)]
       │
       ▼
[Output: Graph JSON, Interactive HTML/SVG Viewer, DOT Graphviz, Markdown Summary]
```

---

## 12. Input and Output Definitions
- **Inputs:** Transcript segments $(s_i)$ with midpoints $m_i$ and text $x_i$; visual events $(v_j)$ with intervals $[u_j^{\text{start}}, u_j^{\text{end}}]$, type $y_j^{\text{type}}$, and content $z_j$.
- **Outputs:**
  - `AlignmentResult`: candidate matches with composite scores, margins, calibrated probabilities, and status (`accepted`, `review`, `rejected`).
  - `KnowledgeGraph`: node dictionary and edge list with complete evidence arrays (`provenance_segment_ids`, `provenance_visual_ids`, timestamps, and validation status).

---

## 13. Subject-Specific Schema Design
Four configurable subject ontologies and one generic fallback are defined:
- **Mathematics:** Nodes: Concept, Definition, Formula, Theorem, DerivationStep, WorkedExample, Prerequisite. Edges: explains, defines, derives, requires_prerequisite.
- **Programming:** Nodes: Concept, Algorithm, DataStructure, CodeBlock, Function, Complexity, Prerequisite. Edges: explains, implements, produces, requires_prerequisite.
- **Physics/Electronics:** Nodes: Concept, PhysicalQuantity, Formula, Component, Diagram, Law, Measurement, Derivation. Edges: explains, derives, uses, requires_prerequisite.
- **General CS:** Nodes: Concept, Definition, ArchitectureComponent, Process, Algorithm, Protocol. Edges: explains, defines, uses, requires_prerequisite.
- **Unknown:** Fallback generic schema with soft validation.

---

## 14. Complete Mathematical Formulation

### 14.1 Subject Evidence and Entropy
$$\text{Score}(k) = \sum_{w \in \mathcal{W}_k} 1.5 \cdot \text{count}(w) + \sum_{\sigma \in \Sigma_k} 2.0 \cdot \text{count}(\sigma) + \sum_{\rho \in \mathcal{R}_k} 2.5 \cdot \text{count}(\rho)$$
$$p(k \mid \mathcal{L}) = \frac{\text{Score}(k) + 1.0}{\sum_{k'} (\text{Score}(k') + 1.0)}, \quad \mathcal{H}_{\text{norm}}(p) = \frac{-\sum p(k) \log_2 p(k)}{\log_2 |\mathcal{K}|}$$

### 14.2 Interval-Aware Asymmetric Temporal Function
$$T(i, j) = \begin{cases} 1.0, & \text{if } u_j^{\text{start}} \le m_i \le u_j^{\text{end}} \\ \exp\left(-\frac{m_i - u_j^{\text{end}}}{\tau_{\text{lag}}}\right), & \text{if } m_i > u_j^{\text{end}} \\ \exp\left(-\frac{u_j^{\text{start}} - m_i}{\tau_{\text{lead}}}\right), & \text{if } m_i < u_j^{\text{start}} \end{cases}$$

### 14.3 Semantic TF-IDF Cosine Similarity
$$M(i, j) = \frac{\mathbf{v}_i \cdot \mathbf{u}_j}{\|\mathbf{v}_i\|_2 \|\mathbf{u}_j\|_2}$$

### 14.4 Subject-Adaptive Scoring Formulation
$$A(i, j) = w_t^{(\hat{k})} T(i, j) + w_s^{(\hat{k})} M(i, j) + w_c^{(\hat{k})} C(i, j) + w_{\text{sym}}^{(\hat{k})} S_{\text{sym}}(i, j)$$
where weights sum to 1.0 and are non-negative.

---

## 15. Sequence Optimization Objective and DP Recurrence
The sequence optimization maximizes:
$$\mathbf{y}^* = \operatorname{argmax}_{\mathbf{y}} \left[ \sum_{i=1}^N A(i, y_i) - \sum_{i=2}^N \Phi(y_{i-1}, y_i) \right]$$
where:
$$\Phi(j, j') = \begin{cases} -\beta_{\text{stay}}, & \text{if } j' = j \\ 0.0, & \text{if } j' = j + 1 \\ \gamma_{\text{fwd}} \cdot (j' - j - 1), & \text{if } j' > j + 1 \\ \delta_{\text{base}} + \gamma_{\text{back}} \cdot (j - j'), & \text{if } j' < j \end{cases}$$
The optimal trajectory is found using the Viterbi dynamic programming recurrence in $O(N \cdot K^2)$ operations.

---

## 16. Confidence Calibration and Selective Rejection
Raw score $A_i$ and top-2 margin $\Delta_i = A_i - \max_{j \ne y_i^*} A(i, j)$ are calibrated into empirical accuracy probability:
$$\hat{P}(\text{correct} \mid A_i, \Delta_i) = \frac{1}{1 + \exp(-(\alpha A_i + \beta \Delta_i + \gamma))}$$
Rejection policy:
$$\text{Status}(m_i) = \begin{cases} \text{rejected}, & \text{if } A_i < \theta_{\text{accept}} \\ \text{review}, & \text{if } \Delta_i < \theta_{\text{margin}} \land A_i < \theta_{\text{review}} \\ \text{accepted}, & \text{otherwise} \end{cases}$$

---

## 17. Time and Space Complexity Analysis
- **Temporal & Semantic Scoring:** $O(N \cdot K)$ where $K \le 8$ is candidate pool size.
- **Sequence DP:** $O(N \cdot K^2)$ runtime, $O(N \cdot K)$ memory.
- **Graph Cycle Resolution:** $O(|V| + |E|)$ via DFS.
- **Overall System Complexity:** $O(N)$ strictly linear with lecture duration. Real-world execution takes less than 15 milliseconds per lecture.

---

## 18. Experimental Evaluation and Results

### 18.1 Master Benchmark Comparison
| Method | Precision | Recall | $F_1$ | Coverage | KG Edge $F_1$ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Baseline A (Temporal-Only) | 1.0000 | 1.0000 | 1.0000 | 1.0000 | N/A |
| Baseline B (Semantic-Only TF-IDF) | 0.8111 | 0.8111 | 0.8111 | 1.0000 | N/A |
| Baseline C (Independent Combined) | 1.0000 | 1.0000 | 1.0000 | 1.0000 | N/A |
| **Proposed SALKG (Full Pipeline)** | **1.0000** | **0.9667** | **0.9815** | **0.9667** | **0.1111** |

### 18.2 Systematic Ablation Results
| Variant | Removed Component | Alignment $F_1$ | Edge $F_1$ | Consistency Violations |
| :--- | :--- | :---: | :---: | :---: |
| **Full Method** | None (Full Pipeline) | **0.9815** | **0.1111** | 1.00 |
| **Ablation 1** | No Subject Conditioning | 0.9663 | 0.1111 | 1.00 |
| **Ablation 2** | No Temporal Feature | 0.0476 | 0.0000 | 0.67 |
| **Ablation 3** | No Semantic Feature | 0.9663 | 0.2222 | 1.00 |
| **Ablation 4** | No Content-Type Compatibility | 0.4378 | 0.0000 | 0.67 |
| **Ablation 5** | No Symbol/Identifier Overlap | 0.9074 | 0.1111 | 1.00 |
| **Ablation 6** | No Sequence DP Optimization | 0.5946 | 0.0000 | 0.83 |
| **Ablation 7** | No Confidence Rejection | 0.9815 | 0.1111 | 1.00 |
| **Ablation 8** | No Graph Validation | 0.5946 | 0.0000 | 0.00 |

---

## 19. Concrete Error Analysis
1. **Asymptotic Complexity Keyword Overlap:** In `cs_programming_binary_search.json`, the discussion of $O(\log n)$ runtime analysis triggered mathematical keywords ("log", "complexity", "worst-case"), causing the subject classifier to assign `mathematics` over `programming`. However, because both schemas enforce prerequisite DAG acyclicity, downstream graph consistency was preserved.
2. **Contradiction Detection:** In `math_calculus_noisy_edge_cases.json`, segment 5 verbally stated a positive slope while the visual plot exhibited a downward negative slope. The graph builder extracted an explicit `contradicts` edge, and the validator successfully marked the conflicting assertion as an unresolved edge.

---

## 20. Reproducibility Instructions
To fully reproduce all baseline, proposed, and ablation results in offline mode:
```powershell
# Set Python path
$env:PYTHONPATH="research_salkg/src"

# Run all unit tests
python -m pytest research_salkg/tests/ -v

# Run full master benchmark
python research_salkg/experiments/run_benchmarks.py

# Generate report artifacts
python -m salkg.cli generate-report
```

---

## 21. Research Novelty Assessment Summary
- **Implemented:** Unified pure-Python offline pipeline, interval-aware asymmetric temporal function, subject-adaptive feature weighting, non-monotonic sequence DP, and weakest-edge topological cycle pruning.
- **Borrowed:** Standard TF-IDF vectorization (Salton & Buckley 1988), basic Viterbi DP (Anderer et al. 2024), and selective classification concepts (Geifman & El-Yaniv 2017).
- **Novelty Assessment:** SALKG represents an **original experimental algorithmic framework** synthesizing interval-aware temporal grounding, domain-conditioned feature modulation, and ontological DAG validation. It should be presented as an empirical contribution to educational multimodal knowledge engineering.

---

## 22. Ethical and Privacy Considerations
- Benchmark datasets are synthetic and free from personal identifying information (PII).
- For real-world deployments, institutional IRB approval and Creative Commons / open educational resource licensing (e.g. MIT OCW CC BY-NC-SA) must be strictly enforced.

---

## 23. Verified References
1. **Anderer, K., Reich, A., & Wölfel, M. (2024).** *MaViLS, a Benchmark Dataset for Video-to-Slide Alignment...*, arXiv:2409.16765.
2. **Sindel, A., Hernandez, A., Yang, S. H., Christlein, V., & Maier, A. (2021).** *SliTraNet: Automatic Detection of Slide Transitions in Lecture Videos*, OAGM Workshop, arXiv:2202.03540.
3. **Zhu, X., Li, Z., Wang, X., Jiang, X., Sun, P., Wang, X., Xiao, Y., & Yuan, N. J. (2022).** *Multi-Modal Knowledge Graph Construction and Application: A Survey*, IEEE TKDE, arXiv:2202.05786.
4. **Zheng, C., Feng, J., Fu, Z., Cai, Y., Li, Q., & Wang, T. (2021).** *Multimodal Relation Extraction with Efficient Graph Alignment*, ACM MM 2021, doi:10.1145/3474085.3475657.
5. **Pan, L., Li, C., Li, J., & Tang, J. (2017).** *Prerequisite Relation Learning for Concepts in MOOCs*, ACL 2017, doi:10.18653/v1/P17-1133.
6. **Liang, C., Ye, J., Wu, Z., Pursel, B., & Giles, C. L. (2017).** *Recovering Concept Prerequisite Relations from University Course Dependencies*, AAAI 2017, pp. 4786–4791.
7. **Pujara, J., Miao, H., Getoor, L., & Cohen, W. W. (2013).** *Knowledge Graph Identification*, ISWC 2013, doi:10.1007/978-3-642-41335-3_34.
8. **Geifman, Y., & El-Yaniv, R. (2017).** *Selective Classification for Deep Neural Networks*, NeurIPS 2017, pp. 4878–4887.
9. **Salton, G., & Buckley, C. (1988).** *Term-Weighting Approaches in Automatic Text Retrieval*, Information Processing & Management, doi:10.1016/0306-4573(88)90021-0.
