# SALKG Algorithm Pseudocode Specification

This document provides formal algorithmic pseudocode for the primary procedures in the SALKG pipeline.

---

## Algorithm 1: Main SALKG Pipeline Execution

```text
Algorithm: SALKG_Pipeline(LectureRecording L, Configuration Theta)
Input: 
    L = (Segments S, VisualEvents V, Metadata M)
    Theta: Configuration parameters (weights, thresholds, schemas)
Output:
    Validated Knowledge Graph KG, AlignmentResult R_align, Report R_eval

1:  // Module 1: Input Normalization & Sanity Validation
2:  (S_norm, V_norm, report_norm) <- NormalizeAndValidate(S, V)
3:  if report_norm.valid == False and Theta.strict == True then
4:      raise ValidationError(report_norm.errors)
5:  end if
6:
7:  // Module 2: Subject & Content-Type Identification
8:  (k_hat, prob_dist, entropy, margin) <- ClassifySubject(S_norm, V_norm)
9:
10: // Module 3 & 4: Multimodal Candidate Alignment & Scoring
11: tfidf_index <- FitTFIDF(S_norm, V_norm)
12: candidates <- GenerateCandidatePairs(S_norm, V_norm, max_distance=Theta.max_dist)
13: 
14: // Module 5 & 6: Dynamic Programming Sequence Optimization
15: R_seq <- OptimizeSequenceDP(S_norm, V_norm, candidates, k_hat, tfidf_index, Theta)
16:
17: // Module 7: Calibrated Confidence Filtering & Selective Rejection
18: (R_filtered, conf_stats) <- FilterSelectiveAlignment(R_seq, Theta.confidence)
19:
20: // Module 8: Evidence-Grounded Knowledge Graph Construction
21: KG_raw <- BuildGroundedGraph(S_norm, V_norm, R_filtered, k_hat)
22:
23: // Module 9: Ontological Validation & DAG Cycle Resolution
24: (KG_validated, val_report) <- ValidateAndCorrectGraph(KG_raw, k_hat, Theta.graph)
25:
26: return KG_validated, R_filtered, val_report
```

---

## Algorithm 2: Dynamic Programming Sequence Optimization

```text
Algorithm: OptimizeSequenceDP(Segments S, VisualEvents V, Candidates C, Subject k_hat, TFIDF tfidf, Config Theta)
Input:
    S = (s_1, ..., s_N)
    V = (v_1, ..., v_M)
    C[i] = list of candidate visual events for segment s_i
Output:
    Optimal alignment assignments Y* = (y_1*, ..., y_N*)

1:  N <- length(S)
2:  Initialize DP table V_score[N, K] and Backpointer BP[N, K]
3:
4:  // Base case: Stage 1
5:  for each candidate k in C[1] do
6:      A_score <- ScorePair(s_1, k, k_hat, tfidf)
7:      V_score[1, k] <- A_score
8:      BP[1, k] <- -1
9:  end for
10:
11: // Inductive step: Stages 2 to N
12: for i = 2 to N do
13:     for each candidate k_curr in C[i] do
14:         best_val <- -infinity
15:         best_prev <- -1
16:         A_curr <- ScorePair(s_i, k_curr, k_hat, tfidf)
17:         
18:         for each candidate k_prev in C[i-1] do
19:             cost <- TransitionCost(k_prev.index, k_curr.index, Theta)
20:             cum_val <- V_score[i-1, k_prev] + A_curr - cost
21:             if cum_val > best_val then
22:                 best_val <- cum_val
23:                 best_prev <- k_prev
24:             end if
25:         end for
26:         
27:         V_score[i, k_curr] <- best_val
28:         BP[i, k_curr] <- best_prev
29:     end for
30: end for
31:
32: // Traceback optimal path
33: k_opt <- argmax_k(V_score[N, k])
34: Y*[N] <- k_opt
35: for i = N down to 2 do
36:     k_opt <- BP[i, k_opt]
37:     Y*[i-1] <- k_opt
38: end for
39:
40: return Y*
```

---

## Algorithm 3: Topological Prerequisite DAG Cycle Resolution

```text
Algorithm: ResolvePrerequisiteCycles(Graph KG, RelationType "requires_prerequisite")
Input:
    Knowledge Graph KG
Output:
    Cycle-free Knowledge Graph KG'

1:  Build adjacency list Adj for edges with relation == "requires_prerequisite"
2:  cycles <- FindAllCyclesDFS(Adj)
3:  
4:  for each cycle in cycles do
5:      // Identify weakest link in the cycle
6:      cycle_edges <- [e in KG.edges | e connects consecutive nodes in cycle]
7:      weakest_edge <- argmin_{e in cycle_edges} (e.calibrated_confidence, e.alignment_score)
8:      
9:      // Demote to unresolved rather than fabricating or silently removing
10:     weakest_edge.validation_status <- "unresolved"
11:     weakest_edge.validation_issues.append("Unresolved to eliminate cyclic prerequisite dependency.")
12: end for
13:
14: return KG
```
