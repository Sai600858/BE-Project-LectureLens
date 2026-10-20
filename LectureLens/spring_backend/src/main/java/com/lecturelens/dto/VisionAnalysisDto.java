package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VisionAnalysisDto {

    private String topic = "";
    private String slideTitle = "";
    private String mainConcept = "";
    private String extractedText = "";
    private String equation = "";
    private String diagramDescription = "";
    private String codeSnippet = "";
    private String codeLanguage = "";
    private List<Map<String, Object>> equations = new ArrayList<>();
    private Map<String, Object> diagram = new HashMap<>();
    private List<String> keyPoints = new ArrayList<>();
    private Map<String, Object> conceptDiagram = new HashMap<>();
    private List<Map<String, Object>> structuredContent = new ArrayList<>();
    private Integer qualityScore = 0;
    private String imageHash = "";

    public VisionAnalysisDto() {}

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getSlideTitle() { return slideTitle; }
    public void setSlideTitle(String slideTitle) { this.slideTitle = slideTitle; }

    public String getMainConcept() {
        if (mainConcept != null && !mainConcept.isBlank()) return mainConcept;
        if (topic != null && !topic.isBlank()) return topic;
        return slideTitle != null ? slideTitle : "";
    }
    public void setMainConcept(String mainConcept) { this.mainConcept = mainConcept; }

    public String getExtractedText() { return extractedText; }
    public void setExtractedText(String extractedText) { this.extractedText = extractedText; }

    public String getEquation() { return equation; }
    public void setEquation(String equation) { this.equation = equation; }

    public String getDiagramDescription() { return diagramDescription; }
    public void setDiagramDescription(String diagramDescription) { this.diagramDescription = diagramDescription; }

    public String getCodeSnippet() { return codeSnippet; }
    public void setCodeSnippet(String codeSnippet) { this.codeSnippet = codeSnippet; }

    public String getCodeLanguage() { return codeLanguage; }
    public void setCodeLanguage(String codeLanguage) { this.codeLanguage = codeLanguage; }

    public List<Map<String, Object>> getEquations() { return equations; }
    public void setEquations(List<Map<String, Object>> equations) { this.equations = equations != null ? equations : new ArrayList<>(); }

    public Map<String, Object> getDiagram() { return diagram; }
    public void setDiagram(Map<String, Object> diagram) { this.diagram = diagram != null ? diagram : new HashMap<>(); }

    public List<String> getKeyPoints() { return keyPoints; }
    public void setKeyPoints(List<String> keyPoints) { this.keyPoints = keyPoints != null ? keyPoints : new ArrayList<>(); }

    public Map<String, Object> getConceptDiagram() { return conceptDiagram; }
    public void setConceptDiagram(Map<String, Object> conceptDiagram) { this.conceptDiagram = conceptDiagram != null ? conceptDiagram : new HashMap<>(); }

    public List<Map<String, Object>> getStructuredContent() { return structuredContent; }
    public void setStructuredContent(List<Map<String, Object>> structuredContent) { this.structuredContent = structuredContent != null ? structuredContent : new ArrayList<>(); }

    public Integer getQualityScore() { return qualityScore; }
    public void setQualityScore(Integer qualityScore) { this.qualityScore = qualityScore != null ? qualityScore : 0; }

    public String getImageHash() { return imageHash; }
    public void setImageHash(String imageHash) { this.imageHash = imageHash; }
}
