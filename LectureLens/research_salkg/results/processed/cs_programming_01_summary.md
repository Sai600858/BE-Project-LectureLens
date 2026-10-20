# Lecture Knowledge Graph Summary: `cs_programming_01`
**Subject:** Programming
**Total Nodes:** 19 | **Total Edges:** 16

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| CodeBlock | 1 | def binary_search(arr, target):
    low, high = 0, len(arr)  |
| Concept | 9 | For Finding Target Keys In Loga, Before, Binary Search |
| LectureSegment | 5 | Today we will analyze Binary Search, an efficient ..., Before learning Binary Search, one must understand..., Look at the code implementation on the slide. The ... |
| Prerequisite | 1 | Array Indexing Fundamentals |
| VisualEvent | 3 | Algorithm Analysis: Binary Search Overview, Prerequisites: Sorted Arrays, Random Access, Array Indices, Complexity Analysis: Best Case O(1), Worst Case O(log n), Sp |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Today we will analyze Binary S | `corresponds_to` | Algorithm Analysis: Binary Sea | 0.43 | prog_seg_01 | prog_vis_01 |
| For Finding Target Keys In Log | `explains` | Algorithm Analysis: Binary Sea | 0.43 | prog_seg_01 | prog_vis_01 |
| Before learning Binary Search, | `corresponds_to` | Prerequisites: Sorted Arrays,  | 0.34 | prog_seg_02 | prog_vis_02 |
| Before | `explains` | Prerequisites: Sorted Arrays,  | 0.34 | prog_seg_02 | prog_vis_02 |
| Binary Search | `explains` | Prerequisites: Sorted Arrays,  | 0.34 | prog_seg_02 | prog_vis_02 |
| Sorted Arrays | `explains` | Prerequisites: Sorted Arrays,  | 0.34 | prog_seg_02 | prog_vis_02 |
| Sorted Arrays | `requires_prerequisite` | Binary Search | 0.34 | prog_seg_02 | prog_vis_02 |
| Array Indexing Fundamentals | `requires_prerequisite` | Binary Search | 0.34 | prog_seg_02 | prog_vis_02 |
| Look at the code implementatio | `corresponds_to` | def binary_search(arr, target) | 0.72 | prog_seg_03 | prog_vis_03 |
| The | `explains` | def binary_search(arr, target) | 0.72 | prog_seg_03 | prog_vis_03 |
| While | `explains` | def binary_search(arr, target) | 0.72 | prog_seg_03 | prog_vis_03 |
| If arr of mid equals target, r | `corresponds_to` | def binary_search(arr, target) | 0.78 | prog_seg_04 | prog_vis_03 |
| Now let us analyze the time co | `corresponds_to` | Complexity Analysis: Best Case | 0.50 | prog_seg_05 | prog_vis_04 |
| Now | `explains` | Complexity Analysis: Best Case | 0.50 | prog_seg_05 | prog_vis_04 |
| Because | `explains` | Complexity Analysis: Best Case | 0.50 | prog_seg_05 | prog_vis_04 |
| Big | `explains` | Complexity Analysis: Best Case | 0.50 | prog_seg_05 | prog_vis_04 |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0