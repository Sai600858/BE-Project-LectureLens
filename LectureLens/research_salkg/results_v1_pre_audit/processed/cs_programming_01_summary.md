# Lecture Knowledge Graph Summary: `cs_programming_01`
**Subject:** Mathematics
**Total Nodes:** 17 | **Total Edges:** 14

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| Concept | 8 | def binary_search(arr, target):
    low, high = 0, len(arr) , For Finding Target Keys In Loga, Before |
| LectureSegment | 5 | Today we will analyze Binary Search, an efficient ..., Before learning Binary Search, one must understand..., Look at the code implementation on the slide. The ... |
| Prerequisite | 1 | Array Indexing Fundamentals |
| VisualEvent | 3 | Algorithm Analysis: Binary Search Overview, Prerequisites: Sorted Arrays, Random Access, Array Indices, Complexity Analysis: Best Case O(1), Worst Case O(log n), Sp |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Look at the code implementatio | `corresponds_to` | def binary_search(arr, target) | 0.65 | prog_seg_03 | prog_vis_03 |
| Look | `explains` | def binary_search(arr, target) | 0.65 | prog_seg_03 | prog_vis_03 |
| While | `explains` | def binary_search(arr, target) | 0.65 | prog_seg_03 | prog_vis_03 |
| If arr of mid equals target, r | `corresponds_to` | def binary_search(arr, target) | 0.66 | prog_seg_04 | prog_vis_03 |
| Now let us analyze the time co | `corresponds_to` | Complexity Analysis: Best Case | 0.65 | prog_seg_05 | prog_vis_04 |
| Because | `explains` | Complexity Analysis: Best Case | 0.65 | prog_seg_05 | prog_vis_04 |

## 3. Flagged / Unresolved Relationships
| Source Node | Relation | Target Node | Status | Issues |
| :--- | :--- | :--- | :--- | :--- |
| Today we will analyze Binary S | `corresponds_to` | Algorithm Analysis: Binary Sea | unresolved | Low alignment score (0.371 < 0.40). |
| For Finding Target Keys In Log | `explains` | Algorithm Analysis: Binary Sea | unresolved | Low alignment score (0.371 < 0.40). |
| Before learning Binary Search, | `corresponds_to` | Prerequisites: Sorted Arrays,  | unresolved | Low alignment score (0.371 < 0.40). |
| Before | `explains` | Prerequisites: Sorted Arrays,  | unresolved | Low alignment score (0.371 < 0.40). |
| Binary Search | `explains` | Prerequisites: Sorted Arrays,  | unresolved | Low alignment score (0.371 < 0.40). |
| Sorted Arrays | `explains` | Prerequisites: Sorted Arrays,  | unresolved | Low alignment score (0.371 < 0.40). |
| Sorted Arrays | `requires_prerequisite` | Binary Search | unresolved | Low alignment score (0.371 < 0.40). |
| Array Indexing Fundamentals | `requires_prerequisite` | Binary Search | unresolved | Low alignment score (0.371 < 0.40). |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0