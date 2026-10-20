package com.lecturelens.service;

import com.lecturelens.security.SvgSanitizer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class DiagramSvgService {

    @Autowired
    private SvgSanitizer svgSanitizer;

    public String generateSvg(String type, String title, String caption, Map<String, Object> spec) {
        if (type == null) type = "flowchart";
        String normalized = type.toLowerCase().trim();

        String rawSvg;
        switch (normalized) {
            case "null_coalesce_flow":
            case "coalesce_flow":
            case "null_handling":
                rawSvg = renderNullCoalesceFlowSvg(title, caption, spec);
                break;
            case "string_transformation":
            case "sql_string":
            case "string_functions":
                rawSvg = renderStringTransformationSvg(title, caption, spec);
                break;
            case "date_timeline":
            case "date_arithmetic":
            case "sql_date":
            case "date_functions":
                rawSvg = renderDateTimelineSvg(title, caption, spec);
                break;
            case "coordinate_graph":
                rawSvg = renderCoordinateGraphSvg(title, caption, spec);
                break;
            case "geometry_diagram":
            case "circle":
                rawSvg = renderGeometryDiagramSvg(title, caption, spec);
                break;
            case "biological_system":
            case "anatomy_diagram":
                rawSvg = renderBiologicalSystemSvg(title, caption, spec);
                break;
            case "algorithm_steps":
                rawSvg = renderAlgorithmStepsSvg(title, caption, spec);
                break;
            case "preserved_source_diagram":
                rawSvg = renderPreservedSourceDiagramSvg(title, caption, spec);
                break;
            case "flowchart":
            default:
                rawSvg = renderFlowchartSvg(title, caption, spec);
                break;
        }

        return svgSanitizer.sanitizeSvg(rawSvg);
    }

    private String escapeXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String renderNullCoalesceFlowSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "SQL COALESCE() Null-Handling Flow");
        String safeExpr = escapeXml(spec != null && spec.get("expression") != null ? spec.get("expression").toString() : "SELECT name, COALESCE(dept, 'Unknown') FROM employee;");
        String safeFallback = escapeXml(spec != null && spec.get("fallback") != null ? spec.get("fallback").toString() : "'Unknown'");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 260\" width=\"100%\" height=\"260\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"32\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                "<rect x=\"20\" y=\"50\" width=\"600\" height=\"35\" fill=\"#27272a\" rx=\"6\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"35\" y=\"73\" fill=\"#e4e4e7\" font-family=\"monospace\" font-size=\"13\">" + safeExpr + "</text>" +
                // Row 1
                "<rect x=\"40\" y=\"105\" width=\"140\" height=\"36\" fill=\"#22c55e22\" rx=\"4\" stroke=\"#22c55e\" stroke-width=\"1\"/>" +
                "<text x=\"55\" y=\"128\" fill=\"#22c55e\" font-family=\"sans-serif\" font-size=\"12\">Alice: 'IT' (NOT NULL)</text>" +
                "<path d=\"M190 123 L240 123\" stroke=\"#22c55e\" stroke-width=\"2\" marker-end=\"url(#arrow-green)\"/>" +
                "<rect x=\"250\" y=\"105\" width=\"130\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"265\" y=\"128\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">Returns: 'IT'</text>" +
                // Row 2
                "<rect x=\"40\" y=\"155\" width=\"140\" height=\"36\" fill=\"#ef444422\" rx=\"4\" stroke=\"#ef4444\" stroke-width=\"1\"/>" +
                "<text x=\"55\" y=\"178\" fill=\"#ef4444\" font-family=\"sans-serif\" font-size=\"12\">Bob: NULL</text>" +
                "<path d=\"M190 173 L240 173\" stroke=\"#f59e0b\" stroke-width=\"2\"/>" +
                "<rect x=\"250\" y=\"155\" width=\"160\" height=\"36\" fill=\"#f59e0b22\" rx=\"4\" stroke=\"#f59e0b\" stroke-width=\"1\"/>" +
                "<text x=\"265\" y=\"178\" fill=\"#f59e0b\" font-family=\"monospace\" font-size=\"12\">Fallback: " + safeFallback + "</text>" +
                // Row 3
                "<rect x=\"40\" y=\"205\" width=\"140\" height=\"36\" fill=\"#22c55e22\" rx=\"4\" stroke=\"#22c55e\" stroke-width=\"1\"/>" +
                "<text x=\"55\" y=\"228\" fill=\"#22c55e\" font-family=\"sans-serif\" font-size=\"12\">Charlie: 'HR' (NOT NULL)</text>" +
                "<path d=\"M190 223 L240 223\" stroke=\"#22c55e\" stroke-width=\"2\"/>" +
                "<rect x=\"250\" y=\"205\" width=\"130\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"265\" y=\"228\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">Returns: 'HR'</text>" +
                "</svg>";
    }

    private String renderStringTransformationSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "SQL String Functions Pipeline");
        String safeInput = escapeXml(spec != null && spec.get("input") != null ? spec.get("input").toString() : "  LectureLens  ");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 240\" width=\"100%\" height=\"240\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                "<rect x=\"20\" y=\"46\" width=\"180\" height=\"36\" fill=\"#27272a\" rx=\"6\" stroke=\"#38bdf8\" stroke-width=\"1\"/>" +
                "<text x=\"30\" y=\"68\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"12\">Raw: \"" + safeInput + "\"</text>" +
                // Transformations
                "<rect x=\"220\" y=\"46\" width=\"190\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"230\" y=\"68\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">UPPER(str) → '  LECTURELENS  '</text>" +
                "<rect x=\"220\" y=\"92\" width=\"190\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"230\" y=\"114\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">TRIM(str) → 'LectureLens'</text>" +
                "<rect x=\"220\" y=\"138\" width=\"190\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"230\" y=\"160\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">LENGTH(str) → 15</text>" +
                "<rect x=\"220\" y=\"184\" width=\"190\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"230\" y=\"206\" fill=\"#a1a1aa\" font-family=\"monospace\" font-size=\"12\">SUBSTRING(str, 3, 7) → 'Lecture'</text>" +
                "</svg>";
    }

    private String renderDateTimelineSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "SQL Date & Time Timeline");
        String safeBaseDate = escapeXml(spec != null && spec.get("baseDate") != null ? spec.get("baseDate").toString() : "2020-09-05");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 200\" width=\"100%\" height=\"200\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                "<line x1=\"40\" y1=\"100\" x2=\"600\" y2=\"100\" stroke=\"#71717a\" stroke-width=\"2\"/>" +
                // Base node
                "<circle cx=\"280\" cy=\"100\" r=\"8\" fill=\"#38bdf8\" stroke=\"#0284c7\" stroke-width=\"2\"/>" +
                "<text x=\"280\" y=\"80\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"12\" text-anchor=\"middle\">" + safeBaseDate + "</text>" +
                "<text x=\"280\" y=\"125\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">Base Date</text>" +
                // Add 10 day
                "<circle cx=\"480\" cy=\"100\" r=\"6\" fill=\"#22c55e\"/>" +
                "<text x=\"480\" y=\"80\" fill=\"#22c55e\" font-family=\"monospace\" font-size=\"12\" text-anchor=\"middle\">2020-09-15</text>" +
                "<text x=\"480\" y=\"125\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">DATE_ADD +10 DAY</text>" +
                // Sub 10 day
                "<circle cx=\"100\" cy=\"100\" r=\"6\" fill=\"#f59e0b\"/>" +
                "<text x=\"100\" y=\"80\" fill=\"#f59e0b\" font-family=\"monospace\" font-size=\"12\" text-anchor=\"middle\">2020-08-26</text>" +
                "<text x=\"100\" y=\"125\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">DATE_SUB -10 DAY</text>" +
                "</svg>";
    }

    private String renderCoordinateGraphSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Velocity-Time Function Graph");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 560 260\" width=\"100%\" height=\"260\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                // Axes
                "<line x1=\"60\" y1=\"210\" x2=\"500\" y2=\"210\" stroke=\"#71717a\" stroke-width=\"1.5\"/>" +
                "<line x1=\"60\" y1=\"210\" x2=\"60\" y2=\"50\" stroke=\"#71717a\" stroke-width=\"1.5\"/>" +
                "<text x=\"510\" y=\"214\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">Time (t)</text>" +
                "<text x=\"50\" y=\"42\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">Velocity (v)</text>" +
                // Linear curve v = u + at
                "<line x1=\"60\" y1=\"170\" x2=\"440\" y2=\"70\" stroke=\"#38bdf8\" stroke-width=\"2.5\"/>" +
                "<circle cx=\"60\" cy=\"170\" r=\"4\" fill=\"#38bdf8\"/>" +
                "<text x=\"70\" y=\"166\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"11\">u (initial)</text>" +
                "<text x=\"260\" y=\"110\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"12\" font-weight=\"bold\">v = u + at</text>" +
                "<text x=\"260\" y=\"130\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"10\">Slope = a (acceleration)</text>" +
                "</svg>";
    }

    private String renderGeometryDiagramSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Circle Geometry: Radius and Quadratic Area");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500 240\" width=\"100%\" height=\"240\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                // Circle
                "<circle cx=\"150\" cy=\"130\" r=\"70\" fill=\"#38bdf815\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-dasharray=\"4,2\"/>" +
                "<circle cx=\"150\" cy=\"130\" r=\"4\" fill=\"#38bdf8\"/>" +
                "<line x1=\"150\" y1=\"130\" x2=\"220\" y2=\"130\" stroke=\"#f59e0b\" stroke-width=\"2\"/>" +
                "<text x=\"180\" y=\"122\" fill=\"#f59e0b\" font-family=\"monospace\" font-size=\"12\" font-weight=\"bold\">r</text>" +
                "<text x=\"140\" y=\"150\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"10\">Center O</text>" +
                // Formulas on right
                "<rect x=\"260\" y=\"70\" width=\"210\" height=\"110\" fill=\"#27272a\" rx=\"6\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"280\" y=\"100\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">Area A = π r²</text>" +
                "<text x=\"280\" y=\"125\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">Circumference C = 2πr</text>" +
                "<text x=\"280\" y=\"155\" fill=\"#22c55e\" font-family=\"sans-serif\" font-size=\"11\">Quadratic scaling: A ∝ r²</text>" +
                "</svg>";
    }

    private String renderBiologicalSystemSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Human Excretory System Schematic");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 540 250\" width=\"100%\" height=\"250\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                // Kidneys
                "<ellipse cx=\"120\" cy=\"80\" rx=\"25\" ry=\"35\" fill=\"#ef444433\" stroke=\"#ef4444\" stroke-width=\"2\"/>" +
                "<ellipse cx=\"240\" cy=\"80\" rx=\"25\" ry=\"35\" fill=\"#ef444433\" stroke=\"#ef4444\" stroke-width=\"2\"/>" +
                "<text x=\"120\" y=\"85\" fill=\"#e4e4e7\" font-family=\"sans-serif\" font-size=\"10\" text-anchor=\"middle\">Kidney L</text>" +
                "<text x=\"240\" y=\"85\" fill=\"#e4e4e7\" font-family=\"sans-serif\" font-size=\"10\" text-anchor=\"middle\">Kidney R</text>" +
                // Ureters
                "<path d=\"M120 115 Q150 160 170 180\" stroke=\"#f59e0b\" stroke-width=\"2\" fill=\"none\"/>" +
                "<path d=\"M240 115 Q210 160 190 180\" stroke=\"#f59e0b\" stroke-width=\"2\" fill=\"none\"/>" +
                "<text x=\"140\" y=\"145\" fill=\"#f59e0b\" font-family=\"sans-serif\" font-size=\"10\">Ureters</text>" +
                // Bladder
                "<ellipse cx=\"180\" cy=\"195\" rx=\"30\" ry=\"20\" fill=\"#38bdf833\" stroke=\"#38bdf8\" stroke-width=\"2\"/>" +
                "<text x=\"180\" y=\"198\" fill=\"#e4e4e7\" font-family=\"sans-serif\" font-size=\"10\" text-anchor=\"middle\">Bladder</text>" +
                // Urethra
                "<line x1=\"180\" y1=\"215\" x2=\"180\" y2=\"235\" stroke=\"#38bdf8\" stroke-width=\"2\"/>" +
                "<text x=\"195\" y=\"230\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"9\">Urethra</text>" +
                // Notes on right
                "<rect x=\"310\" y=\"60\" width=\"210\" height=\"150\" fill=\"#27272a\" rx=\"6\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"325\" y=\"85\" fill=\"#38bdf8\" font-family=\"sans-serif\" font-size=\"12\" font-weight=\"bold\">Filtration Pathway</text>" +
                "<text x=\"325\" y=\"110\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">1. Kidneys: Glomerular GFR</text>" +
                "<text x=\"325\" y=\"130\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">2. Ureters: Peristalsis</text>" +
                "<text x=\"325\" y=\"150\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">3. Bladder: Storage</text>" +
                "<text x=\"325\" y=\"170\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">4. Urethra: Elimination</text>" +
                "</svg>";
    }

    private String renderAlgorithmStepsSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Algorithm Execution Steps");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 540 180\" width=\"100%\" height=\"180\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                // Array cells
                "<rect x=\"40\" y=\"70\" width=\"60\" height=\"40\" fill=\"#27272a\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"70\" y=\"95\" fill=\"#e4e4e7\" font-family=\"monospace\" font-size=\"13\" text-anchor=\"middle\">12</text>" +
                "<rect x=\"100\" y=\"70\" width=\"60\" height=\"40\" fill=\"#27272a\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"130\" y=\"95\" fill=\"#e4e4e7\" font-family=\"monospace\" font-size=\"13\" text-anchor=\"middle\">24</text>" +
                "<rect x=\"160\" y=\"70\" width=\"60\" height=\"40\" fill=\"#38bdf822\" stroke=\"#38bdf8\" stroke-width=\"2\"/>" +
                "<text x=\"190\" y=\"95\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"13\" font-weight=\"bold\" text-anchor=\"middle\">36 [M]</text>" +
                "<rect x=\"220\" y=\"70\" width=\"60\" height=\"40\" fill=\"#27272a\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"250\" y=\"95\" fill=\"#e4e4e7\" font-family=\"monospace\" font-size=\"13\" text-anchor=\"middle\">48</text>" +
                "<rect x=\"280\" y=\"70\" width=\"60\" height=\"40\" fill=\"#27272a\" stroke=\"#3f3f46\" stroke-width=\"1\"/>" +
                "<text x=\"310\" y=\"95\" fill=\"#e4e4e7\" font-family=\"monospace\" font-size=\"13\" text-anchor=\"middle\">60</text>" +
                "<text x=\"40\" y=\"140\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">Interval shrinking: Target compared against Midpoint element.</text>" +
                "</svg>";
    }

    private String renderPreservedSourceDiagramSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Preserved Lecture Diagram");
        String safeCaption = escapeXml(caption != null ? caption : "Captured directly from lecture whiteboard / slides");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 540 180\" width=\"100%\" height=\"180\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                "<rect x=\"20\" y=\"50\" width=\"500\" height=\"100\" fill=\"#27272a\" rx=\"6\" stroke=\"#38bdf8\" stroke-dasharray=\"4,4\" stroke-width=\"1\"/>" +
                "<text x=\"270\" y=\"95\" fill=\"#38bdf8\" font-family=\"sans-serif\" font-size=\"13\" font-weight=\"bold\" text-anchor=\"middle\">📷 High-Fidelity Preserved Source Snapshot</text>" +
                "<text x=\"270\" y=\"120\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">" + safeCaption + "</text>" +
                "</svg>";
    }

    private String renderFlowchartSvg(String title, String caption, Map<String, Object> spec) {
        String safeTitle = escapeXml(title != null ? title : "Operational Process Flowchart");

        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 560 180\" width=\"100%\" height=\"180\" style=\"background:#18181b; border-radius:8px;\">" +
                "<rect width=\"100%\" height=\"100%\" fill=\"#18181b\" rx=\"8\"/>" +
                "<text x=\"20\" y=\"30\" fill=\"#38bdf8\" font-family=\"monospace\" font-size=\"14\" font-weight=\"bold\">" + safeTitle + "</text>" +
                // Nodes
                "<rect x=\"30\" y=\"70\" width=\"100\" height=\"36\" fill=\"#27272a\" rx=\"18\" stroke=\"#38bdf8\" stroke-width=\"1\"/>" +
                "<text x=\"80\" y=\"93\" fill=\"#e4e4e7\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">1. Initialize</text>" +
                "<line x1=\"130\" y1=\"88\" x2=\"160\" y2=\"88\" stroke=\"#71717a\" stroke-width=\"2\"/>" +
                "<polygon points=\"210,70 250,88 210,106 170,88\" fill=\"#f59e0b22\" stroke=\"#f59e0b\" stroke-width=\"1\"/>" +
                "<text x=\"210\" y=\"92\" fill=\"#f59e0b\" font-family=\"sans-serif\" font-size=\"10\" text-anchor=\"middle\">Verify</text>" +
                "<line x1=\"250\" y1=\"88\" x2=\"280\" y2=\"88\" stroke=\"#71717a\" stroke-width=\"2\"/>" +
                "<rect x=\"280\" y=\"70\" width=\"110\" height=\"36\" fill=\"#27272a\" rx=\"4\" stroke=\"#22c55e\" stroke-width=\"1\"/>" +
                "<text x=\"335\" y=\"93\" fill=\"#22c55e\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">3. Process</text>" +
                "<line x1=\"390\" y1=\"88\" x2=\"420\" y2=\"88\" stroke=\"#71717a\" stroke-width=\"2\"/>" +
                "<rect x=\"420\" y=\"70\" width=\"100\" height=\"36\" fill=\"#27272a\" rx=\"18\" stroke=\"#38bdf8\" stroke-width=\"1\"/>" +
                "<text x=\"470\" y=\"93\" fill=\"#e4e4e7\" font-family=\"sans-serif\" font-size=\"11\" text-anchor=\"middle\">4. Commit</text>" +
                "<text x=\"30\" y=\"145\" fill=\"#a1a1aa\" font-family=\"sans-serif\" font-size=\"11\">Deterministic progression through initialization, state verification, execution, and commit.</text>" +
                "</svg>";
    }
}
