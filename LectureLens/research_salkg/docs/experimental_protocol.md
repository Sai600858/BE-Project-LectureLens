# Experimental Protocol and Evaluation Guidelines

This document details the reproducible experimental protocol, evaluation metrics, data split policies, and baseline configurations for SALKG.

---

## 1. Experimental Split Strategy

To prevent data leakage between utterances or visual events from the same speaker or lecture:
- **Split Unit:** Lecture-level partitioning.
- **Development Set (2 Lectures):**
  - `math_calculus_chain_rule.json`
  - `cs_programming_binary_search.json`
  - *Usage:* Parameter tuning, feature weight selection, confidence calibration ($\alpha, \beta, \gamma$), and threshold selection ($\theta_{\text{accept}}, \theta_{\text{review}}$).
- **Test Set (Held-Out, 6 Lectures):**
  - Full benchmark sweep including all domain categories and difficult stress tests.
  - Weights and thresholds are strictly fixed during test execution.

---

## 2. Evaluation Metrics and Exact Formulas

### 2.1 Alignment Metrics
- **True Positive ($TP$):** Segment $s_i$ correctly aligned to its ground-truth visual event $v_j^*$.
- **False Positive ($FP$):** Segment $s_i$ aligned to an incorrect visual event $v_{j'} \ne v_j^*$, or an alignment produced for an unaligned segment.
- **False Negative ($FN$):** A ground-truth alignment $(s_i, v_j^*)$ where the model abstained / rejected or predicted the wrong event.

$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall} = \frac{TP}{TP + FN}, \quad F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
$$\text{Coverage} = \frac{\text{Accepted Predictions}}{N_{\text{total}}}, \quad \text{False Match Rate} = \frac{FP}{TP + FP}$$

### 2.2 Subject Classification Metrics
$$\text{Accuracy} = \frac{1}{|\mathcal{D}_{\text{test}}|} \sum_{i=1}^{|\mathcal{D}_{\text{test}}|} \mathbb{I}(\hat{k}_i = k_i^*)$$
$$\text{Macro } F_1 = \frac{1}{|\mathcal{K}|} \sum_{k \in \mathcal{K}} F_1^{(k)}$$

### 2.3 Knowledge Graph Metrics
- **Node $F_1$:** Precision, Recall, and F1 over extracted domain concepts and algorithms against gold annotations.
- **Edge $F_1$:** Precision, Recall, and F1 over accepted pedagogical triples $(e_{\text{src}}, r, e_{\text{tgt}})$.
- **Evidence Attribution Accuracy:**
  $$\text{AttrAcc} = \frac{\sum_{e \in \mathcal{E}_{\text{corr}}} \mathbb{I}(e.\text{vis\_id} = v^*(e.\text{seg\_id}))}{|\mathcal{E}_{\text{corr}}|}$$
- **Unsupported Relation Rate:** Proportion of edges lacking verifiable multimodal pointers:
  $$\text{URR} = \frac{|\{e \in \mathcal{E} \mid \text{prov}(e) = \emptyset\}|}{|\mathcal{E}|}$$

---

## 3. Baselines for Comparison

1. **Baseline A (Temporal-Only):**
   $$A_{\text{temp}}(i, j) = \exp(-|m_i - u_j| / \tau), \quad \tau = 45.0\,\text{s}$$
2. **Baseline B (Semantic-Only TF-IDF):**
   $$A_{\text{sem}}(i, j) = \cos(\mathbf{v}_i, \mathbf{u}_j)$$
3. **Baseline C (Independent Combined Weighted):**
   $$A_{\text{comb}}(i, j) = 0.50 \cdot A_{\text{temp}}(i, j) + 0.50 \cdot A_{\text{sem}}(i, j)$$
4. **Proposed SALKG (No SeqOpt):** Subject-adaptive scoring with greedy local selection.
5. **Proposed SALKG (Full Pipeline):** Subject-adaptive scoring + Dynamic Programming sequence optimization + Calibrated confidence rejection + Graph validation.
