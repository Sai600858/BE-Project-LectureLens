# Research Contribution and Novelty Assessment

## 1. What Did We Implement Ourselves?
- **Unified Pipeline Architecture**: An end-to-end, reproducible prototype written in pure Python 3 without paid APIs, encompassing data loading, interval normalization, heuristic subject classification with Shannon entropy, domain-specific ontologies, candidate generation, alignment algorithms, dynamic programming sequence optimization, confidence calibration, knowledge graph building, topological cycle checking, and HTML/SVG visualization.
- **Interval-Aware Asymmetric Temporal Function**: A modified temporal formulation that assigns full compatibility ($T=1.0$) to speech segments occurring within a slide's active presentation window $[v_{\text{start}}, v_{\text{end}}]$, combined with asymmetric exponential decay for verbal lag vs. anticipation.
- **Subject-Conditioned Feature Modulation**: A mechanism that dynamically tunes the relative importance of symbolic ($S_{\text{sym}}$), structural ($S_{\text{code}}$), lexical (TF-IDF), and discourse content-type compatibility based on predicted lecture discipline.
- **Topological DAG Prerequisite Enforcement with Weakest-Edge Pruning**: A cycle-detection and resolution pass that identifies directed cycles in prerequisite relations and resolves them by demoting the lowest-confidence edge to `unresolved` rather than discarding the entire subgraph.

---

## 2. Which Algorithms Were Taken From Established Methods?
- **TF-IDF Vectorization and Cosine Similarity**: Standard classical text retrieval methods (Salton & Buckley, 1988).
- **Dynamic Programming Sequence Alignment**: Adaptations of the Viterbi algorithm / Dynamic Time Warping (DTW) with transition penalties, aligned with methods used in video-to-slide alignment (Anderer et al., 2024).
- **Selective Classification Formulation**: Risk-coverage thresholding and abstention concepts adapted from Geifman & El-Yaniv (NeurIPS 2017).
- **Tarjan's / DFS Topological Sort for Cycle Detection**: Standard graph algorithms for directed acyclic graph verification.

---

## 3. Which Parts Are Merely Standard Combinations?
- Combining temporal distance with TF-IDF cosine similarity via weighted linear combination ($w_t T + w_s M$) is a standard multimedia retrieval baseline (Baseline C).
- Scoring token overlap using Jaccard index on symbol or identifier sets is a standard information retrieval technique.

---

## 4. What Precise Change Distinguishes the Proposed Method?
The primary distinguishing modification is the **two-tier subject-adaptive and interval-conditioned formulation**:
1. Rather than treating visual artifacts as point timestamps ($t_j$), SALKG treats them as temporal intervals $[v_{\text{start}}, v_{\text{end}}]$ with subject-differentiated semantics (formulas vs. code blocks vs. diagrams).
2. It introduces discourse marker compatibility ($C(i, j)$) linking spoken presentation cues ("look at this equation", "this function implements") directly to visual entity types.
3. It couples alignment scoring directly into an evidence-grounded Knowledge Graph builder where every concept and relation retains verifiable pointers to speech timestamps and visual IDs, verified by ontological DAG constraints.

---

## 5. Which Related Paper Is Closest to Our Approach?
- **Katharina Anderer, Andreas Reich, and Matthias Wölfel (2024)**, *"MaViLS, a Benchmark Dataset for Video-to-Slide Alignment..."* (arXiv:2409.16765).
  - *Comparison:* MaViLS aligns speech, OCR, and visual features using dynamic programming and transition penalties. However, MaViLS operates strictly at the slide level and does not extract concepts, mathematical formulas, code blocks, or construct validated knowledge graphs.

---

## 6. What Experimental Evidence Supports the Claimed Contribution?
- On benchmark tests, the proposed SALKG pipeline achieved **Precision: 1.0, Recall: 0.9667, F1: 0.9815, Coverage: 0.9667**, outperforming semantic-only matching (F1: 0.8111).
- Ablation experiments demonstrate that removing sequence optimization drops F1 to **0.5946**, removing content-type compatibility drops F1 to **0.4378**, and removing temporal features drops F1 to **0.0476**.
- The ontological validator merged near-duplicate concepts and successfully broke circular prerequisite dependencies while maintaining complete evidence provenance.

---

## 7. What Evidence Is Missing?
- Evaluation has currently been conducted on controlled synthetic and semi-synthetic benchmark lectures spanning four target subjects plus difficult edge cases.
- Large-scale, in-the-wild video evaluations across hundreds of raw hours with natural speech disfluencies, classroom camera movements, and extreme handwriting noise have not yet been evaluated.

---

## 8. What Should NOT Yet Be Claimed in a Research Paper?
- Do **not** claim that SALKG is an entirely novel mathematical theory of alignment.
- Do **not** claim that SALKG replaces human curriculum designers or solves universal educational ontologies.
- Do **not** claim superiority over modern 70B+ multimodal vision-language models without empirical side-by-side benchmark testing on the exact same videos.

---

## 9. Additional Experiments Needed to Strengthen the Contribution
1. Benchmark testing on the complete 20-lecture MaViLS public dataset.
2. Direct comparison with an offline open-source Multimodal Large Language Model (e.g. LLaVA-NeXT or Qwen2-VL) running under identical zero-shot and few-shot prompts.
3. Human expert pedagogical evaluation of the constructed prerequisite graphs.

---

## 10. Novelty Status Conclusion
The evidence supports describing SALKG as an **experimental research prototype and specialized algorithmic framework** that novelly synthesizes interval-aware temporal alignment, subject-conditioned feature weighting, and ontological consistency validation. It should be presented as an **empirical, reproducible contribution to educational multimedia knowledge extraction**, rather than a standalone revolutionary algorithm.
