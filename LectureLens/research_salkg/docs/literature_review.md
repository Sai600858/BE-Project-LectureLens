# Comprehensive Literature Review and Research Matrix

## 1. Literature Overview

The challenge of constructing structured, evidence-grounded educational knowledge graphs from unstructured multimodal lectures spans five distinct research fields:
1. **Multimodal Lecture Understanding & Video-to-Slide Alignment**: Mapping continuous audio/speech transcripts to visual slide presentations.
2. **Multimodal Knowledge Graph (MMKG) Construction**: Extracting entities, symbols, and relations across vision and text.
3. **Educational Knowledge Graphs & Concept Prerequisite Learning**: Mining hierarchical dependencies among academic concepts.
4. **Knowledge Graph Identification & Consistency Validation**: Enforcing global structural and logical constraints over noisy candidate extractions.
5. **Selective Classification & Uncertainty Estimation**: Designing models that can abstain or reject ambiguous hypotheses.

---

## 2. Verified Literature Matrix

| Paper Title | Authors | Year | Venue / Publisher | DOI / Stable Identifier | Problem Addressed | Method Used | Dataset & Metrics | Limitations Relevant to This Research | Overlap with SALKG |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MaViLS, a Benchmark Dataset for Video-to-Slide Alignment** | Katharina Anderer, Andreas Reich, Matthias Wölfel | 2024 | arXiv / CS.CV | `arXiv:2409.16765` | Video-to-slide alignment across academic disciplines | Multimodal fusion (OCR, visual features, transcripts) + DP transition penalty | 20 diverse MIT OCW/Tübingen lectures; Alignment Accuracy | Operates at coarse slide level; does not extract fine-grained concept KGs or pedagogical relations | Validates DP sequence penalties and OCR/text dominance in lecture alignment |
| **SliTraNet: Slide Transitions in Lecture Videos** | Aline Sindel, Abner Hernandez, Seung Hee Yang, Vincent Christlein, Andreas Maier | 2021 | OAGM Workshop | `arXiv:2202.03540` | Visual slide transition boundary detection | 2D/3D Convolutional Neural Networks | Lecture video recordings; Precision, Recall, F1 of slide changes | Pure visual frame transition detector; lacks speech transcript integration and KG semantics | Informs visual event boundary assumptions |
| **Multi-Modal Knowledge Graph Construction and Application: A Survey** | Xiangru Zhu, Zhixu Li, Xiaodan Wang, Xueyao Jiang, Penglei Sun, Xuwu Wang, Yanghua Xiao, Nicholas Jing Yuan | 2022 | IEEE TKDE | `arXiv:2202.05786` | Comprehensive review of MMKG construction pipelines | Survey of MNER, MRE, Multimodal Entity Linking, Cross-modal Fusion | General MMKG benchmarks (MMpedia, ImageGraph) | Assumes static image-text pairs; does not address temporal lecture streams or academic schemas | Provides theoretical foundations for multimodal relation extraction |
| **Multimodal Relation Extraction with Efficient Graph Alignment** | Changmeng Zheng, Junhao Feng, Ze Fu, Yi Cai, Qing Li, Tao Wang | 2021 | ACM MM 2021 | `doi:10.1145/3474085.3475657` | Relation extraction from text enriched with visual context | Dual graph alignment (text scene graph + visual object graph) | MNRE dataset (15k+ social media posts); Precision, Recall, F1 | Evaluated on social media posts; lacks temporal progression and domain-specific schemas | Demonstrates that cross-modal alignment boosts relation extraction |
| **Prerequisite Relation Learning for Concepts in MOOCs** | Liangming Pan, Chengjiang Li, Juanzi Li, Jie Tang | 2017 | ACL 2017 | `doi:10.18653/v1/P17-1133` | Inferring concept prerequisite relations from MOOC data | Representation learning with structural and semantic feature engineering | Coursera courses (Algorithms, Machine Learning); F1-score | Text-only analysis of course syllabi and transcripts; lacks visual grounding to equations/code | Establishes prerequisite evaluation protocol and DAG properties |
| **Recovering Concept Prerequisite Relations from Course Dependencies** | Chen Liang, Jianbo Ye, Zhaohui Wu, Bart Pursel, C. Lee Giles | 2017 | AAAI 2017 | `AAAI-2017/11019` | Inferring concept prerequisites from university curriculum graphs | Optimization framework mapping course dependencies to concept links | Course listings across 11 US universities; Precision, Recall, MAP | Macro-level course catalog data; lacks multimodal classroom video grounding | Grounding for DAG prerequisite consistency |
| **Knowledge Graph Identification** | Jay Pujara, Hui Miao, Lise Getoor, William W. Cohen | 2013 | ISWC 2013 | `doi:10.1007/978-3-642-41335-3_34` | Cleaning noisy, uncertain extractions into coherent KGs | Probabilistic Soft Logic (PSL) with ontological constraint optimization | NELL and Freebase extractions; Graph Accuracy, F1 | High computational overhead for continuous streaming lecture data | Motivates formal graph validation, cycle breaking, and evidence gating |
| **Selective Classification for Deep Neural Networks** | Yonatan Geifman, Ran El-Yaniv | 2017 | NeurIPS 2017 | `NIPS.2017/7074` | Classification with a reject option under risk constraints | Softmax margin and uncertainty thresholding with risk-coverage analysis | ImageNet, CIFAR-10; Coverage vs. Empirical Risk | Applied to single-modal image classification rather than structured multimodal KGs | Theoretical basis for confidence rejection and abstention policy |

---

## 3. Critical Research Gap

Across the reviewed literature, three major gaps persist:
1. **Disconnection Between Alignment and Graph Extraction:** Existing video-to-slide alignment systems (e.g. MaViLS, SliTraNet) stop at predicting slide intervals and do not construct structured knowledge graphs. Conversely, educational KG systems (e.g. Pan et al., Liang et al.) operate purely on text transcripts or coarse course descriptions, completely omitting the visual equations, diagrams, and code snippets that constitute the core evidence in STEM disciplines.
2. **Subject Agnosticism:** Prior alignment and extraction algorithms treat all educational videos homogeneously. A mathematics lecture (dominated by symbolic expressions and theorem derivations) is processed with identical feature weights and schemas as a computer systems lecture (dominated by architectural flowcharts and protocols).
3. **Absence of Multimodal Provenance Verification:** When generative or neural models predict triples from lectures, they rarely verify whether the assertion is explicitly grounded in an active visual artifact or verbal utterance, resulting in unverified textbook hallucinations.

**The SALKG Objective:** To establish an integrated, subject-adaptive alignment and graph construction pipeline that combines domain-tailored feature weighting, non-monotonic sequence regularization, calibrated confidence rejection, and ontological DAG validation.
