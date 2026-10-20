# Complete Mathematical Formulation of the SALKG Algorithm

This document provides the formal mathematical definitions, variable specifications, score normalizations, and complexity bounds for every component of the SALKG algorithm framework.

---

## 1. Input Space Definitions and Variable Table

Let a lecture recording be formalized as a tuple $\mathcal{L} = (S, V, \mathcal{M})$, where:
- $S = (s_1, s_2, \dots, s_N)$ is an ordered sequence of $N$ transcript segments.
- $V = (v_1, v_2, \dots, v_M)$ is an ordered sequence of $M$ extracted visual events.
- $\mathcal{M}$ represents optional lecture-level metadata.

### Variable Specification Table
| Symbol | Type | Description |
| :--- | :--- | :--- |
| $s_i$ | Struct | $i$-th transcript segment: $(t_{i}^{\text{start}}, t_{i}^{\text{end}}, x_i, c_i)$ |
| $m_i$ | $\mathbb{R}^+$ | Midpoint of segment $s_i$: $m_i = \frac{t_{i}^{\text{start}} + t_{i}^{\text{end}}}{2}$ |
| $d_i$ | $\mathbb{R}^+$ | Duration of segment $s_i$: $d_i = t_{i}^{\text{end}} - t_{i}^{\text{start}}$ |
| $x_i$ | String | Spoken utterance text in segment $s_i$ |
| $v_j$ | Struct | $j$-th visual event: $(u_{j}^{\text{start}}, u_{j}^{\text{end}}, \tau_j, y_j^{\text{type}}, z_j)$ |
| $u_j$ | $\mathbb{R}^+$ | Timestamp or midpoint of visual event $v_j$ |
| $z_j$ | String | Extracted text / formula LaTeX / code content of event $v_j$ |
| $y_j^{\text{type}}$ | Enum | Visual event category $\in \{\text{slide\_text}, \text{formula}, \text{code\_snippet}, \text{diagram}, \text{table}\}$ |
| $\hat{k} \in \mathcal{K}$ | Enum | Inferred subject $\in \{\text{mathematics}, \text{programming}, \text{physics\_electronics}, \text{general\_cs}, \text{unknown}\}$ |
| $T(i, j)$ | $[0, 1]$ | Temporal compatibility score between $s_i$ and $v_j$ |
| $M(i, j)$ | $[0, 1]$ | Semantic text similarity score between $s_i$ and $v_j$ |
| $C(i, j)$ | $[0, 1]$ | Content-type compatibility score |
| $S_{\text{sym}}(i, j)$ | $[0, 1]$ | Symbolic or code identifier overlap score |
| $A(i, j)$ | $[0, 1]$ | Composite multimodal alignment score |
| $\Phi(j, j')$ | $\mathbb{R}$ | Sequence transition penalty between visual events $v_j$ and $v_{j'}$ |
| $\mathbf{y}^*$ | Vector | Optimal alignment path $\mathbf{y}^* = (y_1^*, \dots, y_N^*)$ where $y_i^* \in \{1, \dots, M\}$ |
| $\hat{P}(i, j)$ | $[0, 1]$ | Calibrated empirical correctness probability |

---

## 2. Subject Classification and Uncertainty Estimation

The lecture subject is estimated over the concatenated corpus of spoken and visual evidence $\mathcal{D}_{\mathcal{L}} = \{x_1, \dots, x_N\} \cup \{z_1, \dots, z_M\}$.

### Raw Subject Evidence Score
For each subject class $k \in \mathcal{K} \setminus \{\text{unknown}\}$:
$$\text{Score}(k) = \sum_{w \in \mathcal{W}_k} 1.5 \cdot \text{count}(w, \mathcal{D}_{\mathcal{L}}) + \sum_{\sigma \in \Sigma_k} 2.0 \cdot \text{count}(\sigma, \mathcal{D}_{\mathcal{L}}) + \sum_{\rho \in \mathcal{R}_k} 2.5 \cdot \text{count}(\rho, \mathcal{D}_{\mathcal{L}})$$
where $\mathcal{W}_k$ denotes domain keywords, $\Sigma_k$ denotes mathematical/physical symbols, and $\mathcal{R}_k$ denotes syntactic code patterns.

### Probability Distribution with Laplace Smoothing
$$p(k \mid \mathcal{L}) = \frac{\text{Score}(k) + \alpha}{\sum_{k' \in \mathcal{K}} (\text{Score}(k') + \alpha)}, \quad \alpha = 1.0$$

### Shannon Entropy and Prediction Margin
$$\mathcal{H}(p) = -\sum_{k \in \mathcal{K}} p(k \mid \mathcal{L}) \log_2 p(k \mid \mathcal{L})$$
$$\mathcal{H}_{\text{norm}}(p) = \frac{\mathcal{H}(p)}{\log_2 |\mathcal{K}|}$$
$$\text{Margin}(p) = p_{(1)} - p_{(2)}$$
where $p_{(1)}$ and $p_{(2)}$ represent the top-1 and top-2 probabilities.

### Decision Rule
$$\hat{k} = \begin{cases} \text{unknown}, & \text{if } \sum_k \text{Score}(k) < 3.0 \lor p_{(1)} < 0.35 \lor \mathcal{H}_{\text{norm}}(p) > 0.90 \\ \operatorname{argmax}_k p(k \mid \mathcal{L}), & \text{otherwise} \end{cases}$$

---

## 3. Multimodal Alignment Scoring

### 3.1 Interval-Aware Temporal Compatibility $T(i, j)$
Let visual event $v_j$ span active interval $[u_j^{\text{start}}, u_j^{\text{end}}]$, and transcript segment $s_i$ have midpoint $m_i$.
$$T(i, j) = \begin{cases} 1.0, & \text{if } u_j^{\text{start}} \le m_i \le u_j^{\text{end}} \\ \exp\left(-\frac{m_i - u_j^{\text{end}}}{\tau_{\text{lag}}}\right), & \text{if } m_i > u_j^{\text{end}} \quad (\text{verbal lag}) \\ \exp\left(-\frac{u_j^{\text{start}} - m_i}{\tau_{\text{lead}}}\right), & \text{if } m_i < u_j^{\text{start}} \quad (\text{anticipation}) \end{cases}$$
Default calibrated parameters: $\tau_{\text{lead}} = 25.0\,\text{s}$, $\tau_{\text{lag}} = 65.0\,\text{s}$.

### 3.2 Semantic Similarity $M(i, j)$
Texts $x_i$ and $z_j$ are transformed into L2-normalized sparse TF-IDF vectors $\mathbf{v}_i, \mathbf{u}_j \in \mathbb{R}^{|\mathcal{V}|}$:
$$\text{TF}(t, d) = \text{freq}(t, d), \quad \text{IDF}(t, \mathcal{D}) = \ln\left(\frac{|\mathcal{D}| + 1.0}{\text{DF}(t) + 1.0}\right) + 1.0$$
$$M(i, j) = \cos(\mathbf{v}_i, \mathbf{u}_j) = \frac{\mathbf{v}_i \cdot \mathbf{u}_j}{\|\mathbf{v}_i\|_2 \|\mathbf{u}_j\|_2} \in [0, 1]$$

### 3.3 Content-Type Compatibility $C(i, j)$
Let $\mathcal{C}(y_j^{\text{type}})$ denote the set of discourse cue patterns associated with visual type $y_j^{\text{type}}$:
$$C(i, j) = \begin{cases} 1.0, & \text{if } \sum_{\pi \in \mathcal{C}} \mathbb{I}(\pi \in x_i) \ge 2 \\ 0.8, & \text{if } \sum_{\pi \in \mathcal{C}} \mathbb{I}(\pi \in x_i) = 1 \\ 0.35, & \text{otherwise} \end{cases}$$

### 3.4 Subject-Specialized Overlap $S_{\text{sym}}(i, j)$
- For $\hat{k} \in \{\text{mathematics}, \text{physics\_electronics}\}$:
  $$S_{\text{sym}}(i, j) = \frac{|\Sigma(x_i) \cap \Sigma(z_j)|}{|\Sigma(x_i) \cup \Sigma(z_j)|}$$
- For $\hat{k} \in \{\text{programming}, \text{general\_cs}\}$:
  $$S_{\text{sym}}(i, j) = \frac{|\mathcal{I}(x_i) \cap \mathcal{I}(z_j)|}{|\mathcal{I}(x_i) \cup \mathcal{I}(z_j)|}$$
where $\Sigma(\cdot)$ extracts mathematical symbols and differentials, and $\mathcal{I}(\cdot)$ extracts program identifiers.

### 3.5 Composite Subject-Adaptive Scoring Function
$$A(i, j) = w_t^{(\hat{k})} T(i, j) + w_s^{(\hat{k})} M(i, j) + w_c^{(\hat{k})} C(i, j) + w_{\text{sym}}^{(\hat{k})} S_{\text{sym}}(i, j)$$
subject to:
$$w_t^{(\hat{k})} + w_s^{(\hat{k})} + w_c^{(\hat{k})} + w_{\text{sym}}^{(\hat{k})} = 1.0, \quad w_{\bullet}^{(\hat{k})} \ge 0$$

---

## 4. Sequence Optimization Objective

Let $\mathbf{y} = (y_1, y_2, \dots, y_N) \in \{1, \dots, M\}^N$ denote an assignment of visual events to segments. The sequence optimization problem is:
$$\mathbf{y}^* = \operatorname{argmax}_{\mathbf{y}} \left[ \sum_{i=1}^N A(i, y_i) - \sum_{i=2}^N \Phi(y_{i-1}, y_i) \right]$$

### Transition Penalty Function $\Phi(j, j')$
$$\Phi(j, j') = \begin{cases} -\beta_{\text{stay}}, & \text{if } j' = j \quad (\text{staying on active slide}) \\ 0.0, & \text{if } j' = j + 1 \quad (\text{linear next slide}) \\ \gamma_{\text{fwd}} \cdot (j' - j - 1), & \text{if } j' > j + 1 \quad (\text{forward jump skipping slides}) \\ \delta_{\text{base}} + \gamma_{\text{back}} \cdot (j - j'), & \text{if } j' < j \quad (\text{non-monotonic backward reference}) \end{cases}$$
Default calibrated parameters: $\beta_{\text{stay}} = 0.05$, $\gamma_{\text{fwd}} = 0.15$, $\gamma_{\text{back}} = 0.35$, $\delta_{\text{base}} = 0.10$.

### Dynamic Programming Recurrence (Viterbi)
Let $V(i, k)$ be the maximum path score up to segment $i$ choosing visual candidate $k \in \text{Cand}(s_i)$:
$$V(1, k) = A(1, k)$$
$$V(i, k) = A(i, k) + \max_{k' \in \text{Cand}(s_{i-1})} \left[ V(i-1, k') - \Phi(k', k) \right]$$
$$\text{Backpointer}(i, k) = \operatorname{argmax}_{k' \in \text{Cand}(s_{i-1})} \left[ V(i-1, k') - \Phi(k', k) \right]$$

---

## 5. Confidence Calibration and Selective Rejection

Let candidate match $m_i = (s_i, v_{y_i^*})$ have score $A_i = A(i, y_i^*)$ and margin $\Delta_i = A_i - \max_{j \ne y_i^*} A(i, j)$.

### Parametric Logistic Calibration
$$\hat{P}(\text{correct} \mid A_i, \Delta_i) = \sigma(\alpha A_i + \beta \Delta_i + \gamma) = \frac{1}{1 + \exp(-(\alpha A_i + \beta \Delta_i + \gamma))}$$
Parameters tuned on development split: $\alpha = 4.5$, $\beta = 3.2$, $\gamma = -2.8$.

### Selective Rejection Policy
$$\text{Decision}(m_i) = \begin{cases} \text{rejected}, & \text{if } A_i < \theta_{\text{accept}} \\ \text{review}, & \text{if } \Delta_i < \theta_{\text{margin}} \land A_i < \theta_{\text{review}} \\ \text{accepted}, & \text{otherwise} \end{cases}$$
Calibrated thresholds: $\theta_{\text{accept}} = 0.32$, $\theta_{\text{review}} = 0.45$, $\theta_{\text{margin}} = 0.03$.

---

## 6. Computational Complexity Analysis

- **Subject Classification:** $O((N + M) \cdot |\mathcal{W}|)$ where $|\mathcal{W}|$ is keyword lexicon size ($\approx 100$). Runs in $< 2\,\text{ms}$.
- **Candidate Generation:** $O(N \cdot M)$ bounded by window filtering to $O(N \cdot K)$ where $K \le 8$ is candidate pool size.
- **TF-IDF & Pairwise Scoring:** $O(N \cdot K \cdot L)$ where $L$ is average token length of utterance ($\approx 25$).
- **Sequence DP Optimization:** $O(N \cdot K^2)$ time and $O(N \cdot K)$ space. For $N = 100$, $K = 8$, $N \cdot K^2 = 6,400$ operations ($< 5\,\text{ms}$).
- **Graph Validation & Cycle Detection:** DFS cycle check runs in $O(|V_{\text{kg}}| + |E_{\text{kg}}|)$. Concept deduplication runs in $O(|C_{\text{kg}}|^2 \cdot \bar{l})$. Total validation runs in $< 3\,\text{ms}$.
- **Overall Pipeline Complexity:** **Linear in lecture duration** $O(N)$, fully deterministic, and requires $O(N)$ memory.
