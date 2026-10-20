package com.lecturelens.service;

import com.lecturelens.dto.VisionAnalysisDto;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class LocalVisionHeuristicAnalyzer {

    /**
     * Calculates an objective quality score for a snapshot matching visionService.js algorithm.
     */
    public int calculateQualityScore(VisionAnalysisDto dto) {
        if (dto == null) return 0;
        int score = 0;

        // 1. Equations & Mathematical Content
        List<Map<String, Object>> eqs = dto.getEquations();
        if (eqs != null) {
            score += eqs.size() * 20;
        }
        String eqStr = dto.getEquation();
        if (eqStr != null && !eqStr.trim().isEmpty()) {
            score += 15;
            if (eqStr.matches(".*[=+\\-*/\\\\^_{}].*")) {
                score += 10;
            }
        }

        // 2. Structured items & Visualizations
        List<Map<String, Object>> items = dto.getStructuredContent();
        if (items != null) {
            score += items.size() * 15;
            for (Map<String, Object> item : items) {
                if (Boolean.TRUE.equals(item.get("visualizationRequired")) && item.get("svg") != null) {
                    score += 25;
                }
                Object vars = item.get("variables");
                if (vars instanceof Map<?, ?> varMap) {
                    score += varMap.size() * 5;
                }
                Object expl = item.get("explanation");
                if (expl instanceof String explStr && explStr.length() > 20) {
                    score += 10;
                }
            }
        }

        // 3. Extracted Text completeness
        String text = dto.getExtractedText() != null ? dto.getExtractedText().trim() : "";
        score += Math.min(text.length() / 5, 35);

        // 4. Slide Title & Topic specificity
        String topic = dto.getMainConcept();
        if (topic != null && !topic.trim().isEmpty() &&
            !topic.toLowerCase().contains("captured at") && !topic.toLowerCase().contains("content")) {
            score += 15;
        }

        // 5. Existing Diagrams & Key Points
        String diagDesc = dto.getDiagramDescription();
        if (diagDesc != null && diagDesc.trim().length() > 10) {
            score += 15;
        }
        if (dto.getDiagram() != null && !dto.getDiagram().isEmpty()) {
            score += 15;
        }
        if (dto.getKeyPoints() != null) {
            score += dto.getKeyPoints().size() * 6;
        }

        return score;
    }

    /**
     * Fallback heuristic concept analysis when LLM / worker is offline or unneeded.
     */
    public VisionAnalysisDto analyzeHeuristic(String frameType, Double timestamp, String imagePath, String hintText) {
        VisionAnalysisDto dto = new VisionAnalysisDto();
        double ts = timestamp != null ? timestamp : 0.0;
        String combined = (hintText != null ? hintText : "").toLowerCase();

        // 1. Circle Geometry
        if (combined.contains("circle") || combined.contains("area = \\pi r^2") || combined.contains("pi r^2") ||
            (combined.contains("area") && combined.contains("radius"))) {
            dto.setTopic("Circle Geometry: Radius and Area Formula");
            dto.setMainConcept("Circle Geometry: Radius and Area Formula");
            dto.setExtractedText("Circle Geometry: Radius r, Area = \\pi r^2");
            dto.setEquation("Area = \\pi r^2");

            Map<String, Object> eqMap = new HashMap<>();
            eqMap.put("name", "Circle Area");
            eqMap.put("latex", "Area = \\pi r^2");
            eqMap.put("description", "Area of a circle given radius r");
            dto.setEquations(List.of(eqMap));

            Map<String, Object> item = new HashMap<>();
            item.put("type", "formula");
            item.put("content", "Area = \\pi r^2");
            item.put("subject", "geometry");
            item.put("explanation", "The area of a circle is directly proportional to the square of its radius multiplied by pi.");
            item.put("takeaway", "Doubling the radius quadruples the area (A ∝ r²).");
            item.put("visualizationRequired", true);
            item.put("visualizationType", "geometry_diagram");

            Map<String, Object> spec = new HashMap<>();
            spec.put("shape", "circle");
            spec.put("radius", "r");
            spec.put("formula", "A = \\pi r^2");
            item.put("visualizationSpec", spec);

            dto.setStructuredContent(List.of(item));
            dto.setKeyPoints(List.of("Area scales quadratically with radius", "Circumference is 2*pi*r"));
            dto.setQualityScore(calculateQualityScore(dto));
            return dto;
        }

        // 2. Human Physiology & Excretory System
        if (combined.contains("excret") || combined.contains("kidney") || combined.contains("urinary") ||
            combined.contains("nephron") || combined.contains("homeostasis")) {
            dto.setTopic("Human Physiology: Excretory Products and Their Elimination");
            dto.setMainConcept("Human Physiology: Excretory Products and Their Elimination");
            dto.setExtractedText("Human Excretory System: Kidneys -> Ureters -> Urinary Bladder -> Urethra");

            Map<String, Object> item = new HashMap<>();
            item.put("type", "concept");
            item.put("content", "Human Excretory System");
            item.put("explanation", "Excretion expels nitrogenous wastes to maintain constant internal chemical homeostasis.");
            item.put("visualizationRequired", true);
            item.put("visualizationType", "biological_system");

            dto.setStructuredContent(List.of(item));
            dto.setKeyPoints(List.of("Nephron is the structural and functional unit (~1M per kidney)", "Maintains osmoregulation and homeostasis"));
            dto.setQualityScore(calculateQualityScore(dto));
            return dto;
        }

        // 3. Kinematics (v = u + at)
        if (combined.contains("v = u + at") || combined.contains("velocity") || combined.contains("acceleration")) {
            dto.setTopic("Kinematics: Uniform Acceleration");
            dto.setMainConcept("Kinematics: Uniform Acceleration");
            dto.setExtractedText("Kinematics: Final Velocity v = u + at");
            dto.setEquation("v = u + at");

            Map<String, Object> eqMap = new HashMap<>();
            eqMap.put("name", "First Equation of Motion");
            eqMap.put("latex", "v = u + at");
            dto.setEquations(List.of(eqMap));

            Map<String, Object> item = new HashMap<>();
            item.put("type", "formula");
            item.put("content", "v = u + at");
            item.put("explanation", "Final velocity increases linearly with time under uniform acceleration.");
            item.put("visualizationRequired", true);
            item.put("visualizationType", "coordinate_graph");

            dto.setStructuredContent(List.of(item));
            dto.setKeyPoints(List.of("Slope represents constant acceleration a", "Y-intercept is initial velocity u"));
            dto.setQualityScore(calculateQualityScore(dto));
            return dto;
        }

        // Default Pedagogical Frame
        boolean isBoard = "board".equalsIgnoreCase(frameType);
        String label = isBoard ? "Whiteboard Notes" : "Presentation Slide";
        dto.setTopic(label + " at " + Math.round(ts) + "s");
        dto.setSlideTitle(label);
        dto.setMainConcept(label);
        dto.setExtractedText(label + " captured at timestamp " + Math.round(ts) + "s");
        dto.setDiagramDescription(isBoard ? "Whiteboard diagram and visual notes." : "Presentation slide visual content.");
        dto.setKeyPoints(List.of("Lecture instructional content captured at " + Math.round(ts) + "s"));
        dto.setQualityScore(calculateQualityScore(dto));

        return dto;
    }
}
