package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.model.BoardContent;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class BoardContentDto {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private String id;

    @JsonProperty("lectureId")
    @JsonAlias({"lecture_id"})
    private String lectureId;

    private Double timestamp;

    @JsonProperty("imagePath")
    @JsonAlias({"image_path"})
    private String imagePath;

    @JsonProperty("extractedText")
    @JsonAlias({"extracted_text"})
    private String extractedText;

    private String equation;

    @JsonProperty("diagramDescription")
    @JsonAlias({"diagram_description"})
    private String diagramDescription;

    private List<Object> equations = new ArrayList<>();
    private Map<String, Object> diagram = new HashMap<>();

    @JsonProperty("keyPoints")
    @JsonAlias({"key_points"})
    private List<String> keyPoints = new ArrayList<>();

    @JsonProperty("conceptDiagram")
    @JsonAlias({"concept_diagram"})
    private Map<String, Object> conceptDiagram = new HashMap<>();

    @JsonProperty("mainConcept")
    @JsonAlias({"main_concept"})
    private String mainConcept = "";

    @JsonProperty("structuredContent")
    @JsonAlias({"structured_content"})
    private List<Object> structuredContent = new ArrayList<>();

    @JsonProperty("imageHash")
    @JsonAlias({"image_hash"})
    private String imageHash = "";

    @JsonProperty("qualityScore")
    @JsonAlias({"quality_score"})
    private Integer qualityScore = 0;

    private Boolean isDuplicate;
    private Boolean isUpdate;
    private String replacedId;
    private String keptExistingId;
    private String message;

    @JsonProperty("createdAt")
    @JsonAlias({"created_at"})
    private LocalDateTime createdAt;

    public BoardContentDto() {}

    public static BoardContentDto fromEntity(BoardContent entity) {
        if (entity == null) return null;
        BoardContentDto dto = new BoardContentDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLecture() != null ? entity.getLecture().getId() : null);
        dto.setTimestamp(entity.getTimestamp());
        dto.setImagePath(entity.getImagePath());
        dto.setExtractedText(entity.getExtractedText());
        dto.setEquation(entity.getEquation());
        dto.setDiagramDescription(entity.getDiagramDescription());
        dto.setMainConcept(entity.getMainConcept() != null ? entity.getMainConcept() : "");
        dto.setImageHash(entity.getImageHash() != null ? entity.getImageHash() : "");
        dto.setQualityScore(entity.getQualityScore() != null ? entity.getQualityScore() : 0);
        dto.setCreatedAt(entity.getCreatedAt());

        try {
            if (entity.getEquationsJson() != null && !entity.getEquationsJson().isBlank()) {
                dto.setEquations(MAPPER.readValue(entity.getEquationsJson(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            dto.setEquations(new ArrayList<>());
        }

        try {
            if (entity.getDiagramJson() != null && !entity.getDiagramJson().isBlank()) {
                dto.setDiagram(MAPPER.readValue(entity.getDiagramJson(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            dto.setDiagram(new HashMap<>());
        }

        try {
            if (entity.getKeyPointsJson() != null && !entity.getKeyPointsJson().isBlank()) {
                dto.setKeyPoints(MAPPER.readValue(entity.getKeyPointsJson(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            dto.setKeyPoints(new ArrayList<>());
        }

        try {
            if (entity.getConceptDiagramJson() != null && !entity.getConceptDiagramJson().isBlank()) {
                dto.setConceptDiagram(MAPPER.readValue(entity.getConceptDiagramJson(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            dto.setConceptDiagram(new HashMap<>());
        }

        try {
            if (entity.getStructuredContentJson() != null && !entity.getStructuredContentJson().isBlank()) {
                dto.setStructuredContent(MAPPER.readValue(entity.getStructuredContentJson(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            dto.setStructuredContent(new ArrayList<>());
        }

        return dto;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }

    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }

    public String getExtractedText() { return extractedText; }
    public void setExtractedText(String extractedText) { this.extractedText = extractedText; }

    public String getEquation() { return equation; }
    public void setEquation(String equation) { this.equation = equation; }

    public String getDiagramDescription() { return diagramDescription; }
    public void setDiagramDescription(String diagramDescription) { this.diagramDescription = diagramDescription; }

    public List<Object> getEquations() { return equations; }
    public void setEquations(List<Object> equations) { this.equations = equations; }

    public Map<String, Object> getDiagram() { return diagram; }
    public void setDiagram(Map<String, Object> diagram) { this.diagram = diagram; }

    public List<String> getKeyPoints() { return keyPoints; }
    public void setKeyPoints(List<String> keyPoints) { this.keyPoints = keyPoints; }

    public Map<String, Object> getConceptDiagram() { return conceptDiagram; }
    public void setConceptDiagram(Map<String, Object> conceptDiagram) { this.conceptDiagram = conceptDiagram; }

    public String getMainConcept() { return mainConcept; }
    public void setMainConcept(String mainConcept) { this.mainConcept = mainConcept; }

    public List<Object> getStructuredContent() { return structuredContent; }
    public void setStructuredContent(List<Object> structuredContent) { this.structuredContent = structuredContent; }

    public String getImageHash() { return imageHash; }
    public void setImageHash(String imageHash) { this.imageHash = imageHash; }

    public Integer getQualityScore() { return qualityScore; }
    public void setQualityScore(Integer qualityScore) { this.qualityScore = qualityScore; }

    public Boolean getIsDuplicate() { return isDuplicate; }
    public void setIsDuplicate(Boolean duplicate) { isDuplicate = duplicate; }

    public Boolean getIsUpdate() { return isUpdate; }
    public void setIsUpdate(Boolean update) { isUpdate = update; }

    public String getReplacedId() { return replacedId; }
    public void setReplacedId(String replacedId) { this.replacedId = replacedId; }

    public String getKeptExistingId() { return keptExistingId; }
    public void setKeptExistingId(String keptExistingId) { this.keptExistingId = keptExistingId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
