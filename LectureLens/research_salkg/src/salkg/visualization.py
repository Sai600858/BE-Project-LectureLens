"""Visualization and export generators for SALKG Knowledge Graphs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from salkg.input_schema import KnowledgeGraph


class KnowledgeGraphVisualizer:
    """Generates standalone HTML/SVG interactive visualizations, DOT files, and Markdown summaries."""

    NODE_COLORS = {
        "Concept": "#4CAF50",            # Green
        "Definition": "#2196F3",         # Blue
        "Formula": "#9C27B0",            # Purple
        "CodeBlock": "#FF9800",          # Orange
        "Algorithm": "#E91E63",          # Pink
        "Diagram": "#00BCD4",            # Cyan
        "Prerequisite": "#795548",       # Brown
        "LectureSegment": "#607D8B",     # Grey
        "VisualEvent": "#3F51B5",        # Indigo
        "UnknownEntity": "#9E9E9E",      # Light Grey
    }

    @classmethod
    def export_summary_markdown(cls, kg: KnowledgeGraph, output_path: Path) -> str:
        """Generate a structured, human-readable Markdown summary of the graph."""
        lines = [
            f"# Lecture Knowledge Graph Summary: `{kg.lecture_id}`",
            f"**Subject:** {kg.subject.replace('_', ' ').title()}",
            f"**Total Nodes:** {len(kg.nodes)} | **Total Edges:** {len(kg.edges)}",
            "",
            "## 1. Node Inventory by Type",
            "| Node Type | Count | Sample Nodes |",
            "| :--- | :--- | :--- |",
        ]

        nodes_by_type: Dict[str, List[str]] = {}
        for n in kg.nodes.values():
            nodes_by_type.setdefault(n.node_type, []).append(n.label)

        for ntype, labels in sorted(nodes_by_type.items()):
            sample = ", ".join(labels[:3])
            lines.append(f"| {ntype} | {len(labels)} | {sample} |")

        lines.extend([
            "",
            "## 2. Accepted Grounded Relationships",
            "| Source Node | Relation | Target Node | Confidence | Provenance Segments | Provenance Visuals |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |",
        ])

        accepted = [e for e in kg.edges if e.validation_status == "accepted"]
        for e in accepted[:50]:  # sample top 50
            src_lbl = kg.nodes[e.source_id].label if e.source_id in kg.nodes else e.source_id
            tgt_lbl = kg.nodes[e.target_id].label if e.target_id in kg.nodes else e.target_id
            segs = ", ".join(e.provenance_segment_ids) or "N/A"
            vis = ", ".join(e.provenance_visual_ids) or "N/A"
            lines.append(f"| {src_lbl[:30]} | `{e.relation_type}` | {tgt_lbl[:30]} | {e.calibrated_confidence:.2f} | {segs} | {vis} |")

        unresolved = [e for e in kg.edges if e.validation_status in ("unresolved", "rejected")]
        if unresolved:
            lines.extend([
                "",
                "## 3. Flagged / Unresolved Relationships",
                "| Source Node | Relation | Target Node | Status | Issues |",
                "| :--- | :--- | :--- | :--- | :--- |",
            ])
            for e in unresolved:
                src_lbl = kg.nodes[e.source_id].label if e.source_id in kg.nodes else e.source_id
                tgt_lbl = kg.nodes[e.target_id].label if e.target_id in kg.nodes else e.target_id
                issues_str = "; ".join(e.validation_issues) if e.validation_issues else "Low confidence"
                lines.append(f"| {src_lbl[:30]} | `{e.relation_type}` | {tgt_lbl[:30]} | {e.validation_status} | {issues_str} |")

        val_sum = kg.validation_summary or {}
        lines.extend([
            "",
            "## 4. Ontological Validation Statistics",
            f"- **Schema Violations:** {val_sum.get('schema_violations', 0)}",
            f"- **Prerequisite DAG Cycles Detected:** {val_sum.get('cycles_detected', 0)}",
            f"- **Duplicate Entities Merged:** {val_sum.get('duplicates_merged', 0)}",
            f"- **Broken Timestamps:** {val_sum.get('broken_timestamps', 0)}",
            f"- **Missing Provenance References:** {val_sum.get('missing_provenance', 0)}",
        ])

        content = "\n".join(lines)
        output_path.write_text(content, encoding="utf-8")
        return content

    @classmethod
    def export_dot(cls, kg: KnowledgeGraph, output_path: Path) -> str:
        """Export the graph in Graphviz DOT format."""
        dot_lines = [
            f'digraph "{kg.lecture_id}" {{',
            '  rankdir="LR";',
            '  node [shape=box, style="filled,rounded", fontname="Helvetica"];',
            '  edge [fontname="Helvetica", fontsize=10];',
            "",
        ]

        for node in kg.nodes.values():
            color = cls.NODE_COLORS.get(node.node_type, "#CCCCCC")
            clean_label = node.label.replace('"', '\\"').replace("\n", " ")[:35]
            dot_lines.append(f'  "{node.node_id}" [label="{clean_label}\\n({node.node_type})", fillcolor="{color}"];')

        dot_lines.append("")
        for e in kg.edges:
            style = "solid" if e.validation_status == "accepted" else "dashed"
            color = "#333333" if e.validation_status == "accepted" else "#D32F2F"
            dot_lines.append(
                f'  "{e.source_id}" -> "{e.target_id}" [label="{e.relation_type}", style="{style}", color="{color}"];'
            )

        dot_lines.append("}")
        dot_content = "\n".join(dot_lines)
        output_path.write_text(dot_content, encoding="utf-8")
        return dot_content

    @classmethod
    def export_interactive_html(cls, kg: KnowledgeGraph, output_path: Path) -> str:
        """Generate a zero-dependency interactive standalone SVG-based HTML viewer."""
        nodes_list = []
        for n in kg.nodes.values():
            nodes_list.append({
                "id": n.node_id,
                "label": n.label,
                "type": n.node_type,
                "color": cls.NODE_COLORS.get(n.node_type, "#999999"),
                "provenance_seg": n.provenance_segment_ids,
                "provenance_vis": n.provenance_visual_ids,
                "timestamps": n.timestamps,
            })

        edges_list = []
        for e in kg.edges:
            edges_list.append({
                "source": e.source_id,
                "target": e.target_id,
                "relation": e.relation_type,
                "confidence": e.calibrated_confidence,
                "status": e.validation_status,
                "provenance_seg": e.provenance_segment_ids,
                "provenance_vis": e.provenance_visual_ids,
            })

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SALKG Knowledge Graph - {kg.lecture_id}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; }}
    #header {{ padding: 16px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }}
    #container {{ display: flex; height: calc(100vh - 72px); }}
    #graph-pane {{ flex: 1; overflow: auto; position: relative; background: #0f172a; }}
    #info-pane {{ width: 380px; background: #1e293b; border-left: 1px solid #334155; padding: 20px; overflow-y: auto; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }}
    .status-accepted {{ background: #065f46; color: #34d399; }}
    .status-unresolved {{ background: #854d0e; color: #facc15; }}
    .status-rejected {{ background: #991b1b; color: #f87171; }}
    .card {{ background: #0f172a; border-radius: 8px; padding: 14px; margin-bottom: 16px; border: 1px solid #334155; }}
    svg {{ width: 100%; height: 100%; min-width: 800px; min-height: 600px; }}
    circle, rect {{ cursor: pointer; transition: all 0.2s; }}
    circle:hover, rect:hover {{ stroke: #38bdf8; stroke-width: 3px; }}
    line {{ stroke: #475569; stroke-width: 1.5; }}
    text {{ fill: #e2e8f0; font-size: 11px; user-select: none; pointer-events: none; }}
  </style>
</head>
<body>
  <div id="header">
    <div>
      <h2 style="margin:0 0 4px 0;">SALKG Knowledge Graph: {kg.lecture_id}</h2>
      <div style="font-size:13px; color:#94a3b8;">Subject: <strong>{kg.subject.replace('_', ' ').title()}</strong> | Nodes: {len(nodes_list)} | Edges: {len(edges_list)}</div>
    </div>
  </div>
  <div id="container">
    <div id="graph-pane">
      <svg id="svg-graph"></svg>
    </div>
    <div id="info-pane">
      <h3 style="margin-top:0;">Provenance Inspector</h3>
      <div id="details">Click on any node or edge to inspect its multimodal evidence provenance, timestamps, and validation status.</div>
    </div>
  </div>

  <script>
    const nodes = {json.dumps(nodes_list)};
    const edges = {json.dumps(edges_list)};
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

    const svg = document.getElementById('svg-graph');
    const width = 1200;
    const height = 900;
    svg.setAttribute('viewBox', `0 0 ${{width}} ${{height}}`);

    // Simple deterministic radial/force-inspired layout
    const N = nodes.length;
    const radius = Math.min(width, height) * 0.40;
    const cx = width / 2;
    const cy = height / 2;

    nodes.forEach((n, i) => {{
      const angle = (2 * Math.PI * i) / N;
      n.x = cx + radius * Math.cos(angle) + (i % 2 === 0 ? 30 : -30);
      n.y = cy + radius * Math.sin(angle) + (i % 3 === 0 ? 25 : -25);
    }});

    // Render Edges
    edges.forEach(e => {{
      const s = nodeMap[e.source];
      const t = nodeMap[e.target];
      if (!s || !t) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', s.x);
      line.setAttribute('y1', s.y);
      line.setAttribute('x2', t.x);
      line.setAttribute('y2', t.y);
      line.setAttribute('stroke', e.status === 'accepted' ? '#38bdf8' : '#f87171');
      if (e.status !== 'accepted') line.setAttribute('stroke-dasharray', '4,4');
      line.style.cursor = 'pointer';

      line.onclick = () => {{
        document.getElementById('details').innerHTML = `
          <div class="card">
            <h4>Relationship: ${{e.relation}}</h4>
            <p><strong>From:</strong> ${{s.label}}</p>
            <p><strong>To:</strong> ${{t.label}}</p>
            <p><strong>Status:</strong> <span class="badge status-${{e.status}}">${{e.status}}</span></p>
            <p><strong>Confidence:</strong> ${{e.confidence.toFixed(3)}}</p>
            <p><strong>Provenance Segments:</strong> ${{e.provenance_seg.join(', ') || 'None'}}</p>
            <p><strong>Provenance Visuals:</strong> ${{e.provenance_vis.join(', ') || 'None'}}</p>
          </div>
        `;
      }};
      svg.appendChild(line);
    }});

    // Render Nodes
    nodes.forEach(n => {{
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

      const label = n.label.length > 22 ? n.label.substring(0, 20) + '...' : n.label;
      text.textContent = label;
      text.setAttribute('x', n.x);
      text.setAttribute('y', n.y + 4);
      text.setAttribute('text-anchor', 'middle');

      const boxW = Math.max(100, label.length * 7 + 16);
      const boxH = 26;
      rect.setAttribute('x', n.x - boxW/2);
      rect.setAttribute('y', n.y - boxH/2);
      rect.setAttribute('width', boxW);
      rect.setAttribute('height', boxH);
      rect.setAttribute('rx', 6);
      rect.setAttribute('fill', n.color);

      g.appendChild(rect);
      g.appendChild(text);

      g.onclick = () => {{
        document.getElementById('details').innerHTML = `
          <div class="card">
            <h4>${{n.label}}</h4>
            <p><strong>Type:</strong> ${{n.type}}</p>
            <p><strong>Node ID:</strong> <code>${{n.id}}</code></p>
            <p><strong>Timestamps:</strong> ${{n.timestamps.map(t => t.toFixed(1) + 's').join(', ') || 'N/A'}}</p>
            <p><strong>Speech Evidence:</strong> ${{n.provenance_seg.join(', ') || 'None'}}</p>
            <p><strong>Visual Evidence:</strong> ${{n.provenance_vis.join(', ') || 'None'}}</p>
          </div>
        `;
      }};
      svg.appendChild(g);
    }});
  </script>
</body>
</html>
"""
        output_path.write_text(html, encoding="utf-8")
        return html
