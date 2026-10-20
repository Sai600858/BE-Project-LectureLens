# Lecture Knowledge Graph Summary: `math_calculus_01`
**Subject:** Mathematics
**Total Nodes:** 18 | **Total Edges:** 15

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| Concept | 6 | For Finding The Derivative Of C, And Basic Differentiation, Chain Rule |
| Formula | 2 | Theorem: Chain Rule \frac{dy}{dx} = \frac{dy}{du} \cdot \fra, Worked Example: y = \sin(x^2), \frac{dy}{dx} = 2x \cos(x^2) |
| LectureSegment | 6 | Welcome everyone. Today we discuss the Chain Rule ..., Before we discuss the Chain Rule, one must underst..., Let us state the formal theorem. If y equals f of ... |
| Prerequisite | 2 | Power Rule, Basic Differentiation |
| VisualEvent | 2 | Calculus Lecture: The Chain Rule for Composite Functions, Prerequisites: Power Rule, Product Rule, Derivative of Eleme |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Welcome everyone. Today we dis | `corresponds_to` | Calculus Lecture: The Chain Ru | 0.42 | math_seg_01 | math_vis_01 |
| For Finding The Derivative Of  | `explains` | Calculus Lecture: The Chain Ru | 0.42 | math_seg_01 | math_vis_01 |
| From this theorem we derive th | `corresponds_to` | Theorem: Chain Rule \frac{dy}{ | 0.44 | math_seg_04 | math_vis_03 |
| We Derive The Derivative Of Co | `explains` | Theorem: Chain Rule \frac{dy}{ | 0.44 | math_seg_04 | math_vis_03 |
| Theorem: Chain Rule \frac{dy}{ | `derives` | We Derive The Derivative Of Co | 0.44 | math_seg_04 | math_vis_03 |
| Multiplying the outer derivati | `corresponds_to` | Worked Example: y = \sin(x^2), | 0.54 | math_seg_06 | math_vis_04 |
| Multiplying | `explains` | Worked Example: y = \sin(x^2), | 0.54 | math_seg_06 | math_vis_04 |

## 3. Flagged / Unresolved Relationships
| Source Node | Relation | Target Node | Status | Issues |
| :--- | :--- | :--- | :--- | :--- |
| Before we discuss the Chain Ru | `corresponds_to` | Prerequisites: Power Rule, Pro | unresolved | Low alignment score (0.367 < 0.40). |
| And Basic Differentiation | `explains` | Prerequisites: Power Rule, Pro | unresolved | Low alignment score (0.367 < 0.40). |
| Power Rule | `requires_prerequisite` | Chain Rule | unresolved | Low alignment score (0.367 < 0.40). |
| Basic Differentiation | `requires_prerequisite` | Chain Rule | unresolved | Low alignment score (0.367 < 0.40). |
| Let us state the formal theore | `corresponds_to` | Theorem: Chain Rule \frac{dy}{ | unresolved | Low alignment score (0.374 < 0.40). |
| For example, consider the func | `corresponds_to` | Worked Example: y = \sin(x^2), | unresolved | Low alignment score (0.396 < 0.40). |
| Here | `explains` | Worked Example: y = \sin(x^2), | unresolved | Low alignment score (0.396 < 0.40). |
| Worked Example: y = \sin(x^2), | `exemplifies` | Here | unresolved | Low alignment score (0.396 < 0.40). |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0