# Lecture Knowledge Graph Summary: `math_noisy_edge_cases`
**Subject:** Mathematics
**Total Nodes:** 14 | **Total Edges:** 11

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| Concept | 4 | Now, States Nx To The N Minus 1, The |
| Formula | 4 | Polynomial Derivative: f(x) = x^2, f'(x) = 2x, Trigonometric Derivative: \frac{d}{dx}[\sin(x)] = \cos(x), Polynomial Derivative (Repeated): f(x) = x^n, f'(x) = n x^{n |
| LectureSegment | 5 | Today we revisit derivatives. Look at this equatio..., Now we move forward to trigonometric functions. He..., Let us go back to our earlier slide on polynomial ... |
| VisualEvent | 1 | Plot of Decreasing Function: Slope f'(x) < 0 (Downward Monot |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Today we revisit derivatives.  | `corresponds_to` | Polynomial Derivative: f(x) =  | 0.59 | edge_seg_01 | edge_vis_01 |
| Now we move forward to trigono | `corresponds_to` | Trigonometric Derivative: \fra | 0.34 | edge_seg_02 | edge_vis_02 |
| Now | `explains` | Trigonometric Derivative: \fra | 0.34 | edge_seg_02 | edge_vis_02 |
| Let us go back to our earlier  | `corresponds_to` | Polynomial Derivative (Repeate | 0.35 | edge_seg_03 | edge_vis_01_repeat |
| States Nx To The N Minus 1 | `explains` | Polynomial Derivative (Repeate | 0.35 | edge_seg_03 | edge_vis_01_repeat |
| Notice this noisy transcriptio | `corresponds_to` | Trig Derv: d/dx[cos x] = -sin  | 0.34 | edge_seg_04 | edge_vis_03_noisy_ocr |
| Now look closely at the curve  | `corresponds_to` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| Now | `explains` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| The | `explains` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| This | `explains` | Plot of Decreasing Function: S | 0.60 | edge_seg_05 | edge_vis_04_contradiction |
| Plot of Decreasing Function: S | `contradicts` | Now | 0.60 | edge_seg_05 | edge_vis_04_contradiction |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0