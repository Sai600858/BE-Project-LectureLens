# Lecture Knowledge Graph Summary: `math_noisy_edge_cases`
**Subject:** Mathematics
**Total Nodes:** 15 | **Total Edges:** 11

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| ArchitectureComponent | 1 | Plot of Decreasing Function: Slope f'(x) < 0 (Downward Monot |
| Concept | 5 | Look, Here, States Nx To The N Minus 1 |
| Formula | 4 | Polynomial Derivative: f(x) = x^2, f'(x) = 2x, Trigonometric Derivative: \frac{d}{dx}[\sin(x)] = \cos(x), Polynomial Derivative (Repeated): f(x) = x^n, f'(x) = n x^{n |
| LectureSegment | 5 | Today we revisit derivatives. Look at this equatio..., Now we move forward to trigonometric functions. He..., Let us go back to our earlier slide on polynomial ... |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Today we revisit derivatives.  | `corresponds_to` | Polynomial Derivative: f(x) =  | 0.59 | edge_seg_01 | edge_vis_01 |
| Look | `explains` | Polynomial Derivative: f(x) =  | 0.59 | edge_seg_01 | edge_vis_01 |
| Now we move forward to trigono | `corresponds_to` | Trigonometric Derivative: \fra | 0.34 | edge_seg_02 | edge_vis_02 |
| Here | `explains` | Trigonometric Derivative: \fra | 0.34 | edge_seg_02 | edge_vis_02 |
| Now look closely at the curve  | `corresponds_to` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| This | `explains` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| Plot of Decreasing Function: S | `contradicts` | This | 0.60 | edge_seg_05 | edge_vis_04_contradiction |

## 3. Flagged / Unresolved Relationships
| Source Node | Relation | Target Node | Status | Issues |
| :--- | :--- | :--- | :--- | :--- |
| Let us go back to our earlier  | `corresponds_to` | Polynomial Derivative (Repeate | unresolved | Low alignment score (0.385 < 0.40). |
| States Nx To The N Minus 1 | `explains` | Polynomial Derivative (Repeate | unresolved | Low alignment score (0.385 < 0.40). |
| Notice this noisy transcriptio | `corresponds_to` | Trig Derv: d/dx[cos x] = -sin  | unresolved | Low alignment score (0.369 < 0.40). |
| Notice | `explains` | Trig Derv: d/dx[cos x] = -sin  | unresolved | Low alignment score (0.369 < 0.40). |

## 4. Ontological Validation Statistics
- **Schema Violations:** 1
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0