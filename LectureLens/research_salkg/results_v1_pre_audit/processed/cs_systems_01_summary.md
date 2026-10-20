# Lecture Knowledge Graph Summary: `cs_systems_01`
**Subject:** General Cs
**Total Nodes:** 19 | **Total Edges:** 17

## 1. Node Inventory by Type
| Node Type | Count | Sample Nodes |
| :--- | :--- | :--- |
| ArchitectureComponent | 2 | Virtual Address Translation Architecture: CPU -> MMU -> TLB , Page Table Lookup and Page Fault Handler Routine Flowchart |
| Concept | 9 | Virtual Memory, Before, Physical Memory |
| LectureSegment | 5 | In this operating systems lecture, we investigate ..., Before learning Virtual Memory, one must understan..., Examining this architecture diagram shows the Tran... |
| Prerequisite | 1 | Cpu Addressing Basics |
| VisualEvent | 2 | Operating Systems: Virtual Memory and Address Translation, Prerequisites: Physical Memory, RAM Hardware, CPU Registers, |

## 2. Accepted Grounded Relationships
| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| In this operating systems lect | `corresponds_to` | Operating Systems: Virtual Mem | 0.61 | os_seg_01 | os_vis_01 |
| Virtual Memory | `explains` | Operating Systems: Virtual Mem | 0.61 | os_seg_01 | os_vis_01 |
| Before learning Virtual Memory | `corresponds_to` | Prerequisites: Physical Memory | 0.36 | os_seg_02 | os_vis_02 |
| Before | `explains` | Prerequisites: Physical Memory | 0.36 | os_seg_02 | os_vis_02 |
| Virtual Memory | `explains` | Prerequisites: Physical Memory | 0.36 | os_seg_02 | os_vis_02 |
| Physical Memory | `explains` | Prerequisites: Physical Memory | 0.36 | os_seg_02 | os_vis_02 |
| Physical Memory | `requires_prerequisite` | Virtual Memory | 0.36 | os_seg_02 | os_vis_02 |
| Cpu Addressing Basics | `requires_prerequisite` | Virtual Memory | 0.36 | os_seg_02 | os_vis_02 |
| Examining this architecture di | `corresponds_to` | Virtual Address Translation Ar | 0.54 | os_seg_03 | os_vis_03 |
| Examining | `explains` | Virtual Address Translation Ar | 0.54 | os_seg_03 | os_vis_03 |
| Translation Lookaside Buffer | `explains` | Virtual Address Translation Ar | 0.54 | os_seg_03 | os_vis_03 |
| When | `explains` | Virtual Address Translation Ar | 0.54 | os_seg_03 | os_vis_03 |
| If a TLB miss occurs, the Memo | `corresponds_to` | Page Table Lookup and Page Fau | 0.46 | os_seg_04 | os_vis_04 |
| Memory Management Unit | `explains` | Page Table Lookup and Page Fau | 0.46 | os_seg_04 | os_vis_04 |
| Page Table | `explains` | Page Table Lookup and Page Fau | 0.46 | os_seg_04 | os_vis_04 |
| If the valid bit is zero, a Pa | `corresponds_to` | Page Table Lookup and Page Fau | 0.57 | os_seg_05 | os_vis_04 |
| Page Fault | `explains` | Page Table Lookup and Page Fau | 0.57 | os_seg_05 | os_vis_04 |

## 4. Ontological Validation Statistics
- **Schema Violations:** 0
- **Prerequisite DAG Cycles Detected:** 0
- **Duplicate Entities Merged:** 0
- **Broken Timestamps:** 0
- **Missing Provenance References:** 0