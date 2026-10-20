# Lecture Knowledge Graph Summary: `math_calculus_01`
**Subject:** Mathematics
**Total Nodes:** 20 | **Total Edges:** 16

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| Concept | 8 | For Finding The Derivative Of C, And Basic Differentiation, Chain Rule |
| Formula | 2 | Theorem: Chain Rule \frac{dy}{dx} = \frac{dy}{du} \cdot \fra, Worked Example: y = \sin(x^2), \frac{dy}{dx} = 2x \cos(x^2) |
| LectureSegment | 6 | Welcome everyone. Today we discuss the Chain Rule ..., Before we discuss the Chain Rule, one must underst..., Let us state the formal theorem. If y equals f of ... |
| Prerequisite | 2 | Power Rule, Basic Differentiation |
| VisualEvent | 2 | Calculus Lecture: The Chain Rule for Composite Functions, Prerequisites: Power Rule, Product Rule, Derivative of Eleme |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Welcome everyone. Today we dis | `corresponds_to` | Calculus Lecture: The Chain Ru | 0.42 | math_seg_01 | math_vis_01 |
| For Finding The Derivative Of  | `explains` | Calculus Lecture: The Chain Ru | 0.42 | math_seg_01 | math_vis_01 |
| Before we discuss the Chain Ru | `corresponds_to` | Prerequisites: Power Rule, Pro | 0.26 | math_seg_02 | math_vis_02 |
| And Basic Differentiation | `explains` | Prerequisites: Power Rule, Pro | 0.26 | math_seg_02 | math_vis_02 |
| Power Rule | `requires_prerequisite` | Chain Rule | 0.26 | math_seg_02 | math_vis_02 |
| Basic Differentiation | `requires_prerequisite` | Chain Rule | 0.26 | math_seg_02 | math_vis_02 |
| Let us state the formal theore | `corresponds_to` | Theorem: Chain Rule \frac{dy}{ | 0.32 | math_seg_03 | math_vis_03 |
| Let | `explains` | Theorem: Chain Rule \frac{dy}{ | 0.32 | math_seg_03 | math_vis_03 |
| From this theorem we derive th | `corresponds_to` | Theorem: Chain Rule \frac{dy}{ | 0.44 | math_seg_04 | math_vis_03 |
| We Derive The Derivative Of Co | `explains` | Theorem: Chain Rule \frac{dy}{ | 0.44 | math_seg_04 | math_vis_03 |
| Theorem: Chain Rule \frac{dy}{ | `derives` | The | 0.44 | math_seg_04 | math_vis_03 |
| For example, consider the func | `corresponds_to` | Worked Example: y = \sin(x^2), | 0.37 | math_seg_05 | math_vis_04 |
| For | `explains` | Worked Example: y = \sin(x^2), | 0.37 | math_seg_05 | math_vis_04 |
| Worked Example: y = \sin(x^2), | `exemplifies` | For | 0.37 | math_seg_05 | math_vis_04 |
| Multiplying the outer derivati | `corresponds_to` | Worked Example: y = \sin(x^2), | 0.54 | math_seg_06 | math_vis_04 |
| Multiplying | `explains` | Worked Example: y = \sin(x^2), | 0.54 | math_seg_06 | math_vis_04 |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0