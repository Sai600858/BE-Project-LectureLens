package com.lecturelens.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.model.Summary;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class SummaryDto {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private String id;
    private String lectureId;
    private String shortSummary;
    private String detailedSummary;
    private List<KeyConceptDto> keyConcepts;
    private List<DefinitionDto> definitions;
    private List<ExampleDto> examples;
    private List<String> keyTakeaways;
    private List<String> topicsCovered;
    private LocalDateTime createdAt;
    private Map<String, Object> validationReport;

    public SummaryDto() {}

    public static SummaryDto fromEntity(Summary entity, Map<String, Object> validationReport) {
        if (entity == null) return null;
        SummaryDto dto = new SummaryDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLectureId());
        dto.setShortSummary(entity.getShortSummary());
        dto.setDetailedSummary(entity.getDetailedSummary());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setValidationReport(validationReport);

        try {
            if (entity.getKeyConceptsJson() != null && !entity.getKeyConceptsJson().isBlank()) {
                dto.setKeyConcepts(MAPPER.readValue(entity.getKeyConceptsJson(), new TypeReference<List<KeyConceptDto>>() {}));
            } else {
                dto.setKeyConcepts(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setKeyConcepts(Collections.emptyList());
        }

        try {
            if (entity.getDefinitionsJson() != null && !entity.getDefinitionsJson().isBlank()) {
                dto.setDefinitions(MAPPER.readValue(entity.getDefinitionsJson(), new TypeReference<List<DefinitionDto>>() {}));
            } else {
                dto.setDefinitions(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setDefinitions(Collections.emptyList());
        }

        try {
            if (entity.getExamplesJson() != null && !entity.getExamplesJson().isBlank()) {
                dto.setExamples(MAPPER.readValue(entity.getExamplesJson(), new TypeReference<List<ExampleDto>>() {}));
            } else {
                dto.setExamples(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setExamples(Collections.emptyList());
        }

        try {
            if (entity.getKeyTakeawaysJson() != null && !entity.getKeyTakeawaysJson().isBlank()) {
                dto.setKeyTakeaways(MAPPER.readValue(entity.getKeyTakeawaysJson(), new TypeReference<List<String>>() {}));
            } else {
                dto.setKeyTakeaways(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setKeyTakeaways(Collections.emptyList());
        }

        try {
            if (entity.getTopicsCoveredJson() != null && !entity.getTopicsCoveredJson().isBlank()) {
                dto.setTopicsCovered(MAPPER.readValue(entity.getTopicsCoveredJson(), new TypeReference<List<String>>() {}));
            } else {
                dto.setTopicsCovered(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setTopicsCovered(Collections.emptyList());
        }

        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getShortSummary() { return shortSummary; }
    public void setShortSummary(String shortSummary) { this.shortSummary = shortSummary; }

    public String getDetailedSummary() { return detailedSummary; }
    public void setDetailedSummary(String detailedSummary) { this.detailedSummary = detailedSummary; }

    public List<KeyConceptDto> getKeyConcepts() { return keyConcepts; }
    public void setKeyConcepts(List<KeyConceptDto> keyConcepts) { this.keyConcepts = keyConcepts; }

    public List<DefinitionDto> getDefinitions() { return definitions; }
    public void setDefinitions(List<DefinitionDto> definitions) { this.definitions = definitions; }

    public List<ExampleDto> getExamples() { return examples; }
    public void setExamples(List<ExampleDto> examples) { this.examples = examples; }

    public List<String> getKeyTakeaways() { return keyTakeaways; }
    public void setKeyTakeaways(List<String> keyTakeaways) { this.keyTakeaways = keyTakeaways; }

    public List<String> getTopicsCovered() { return topicsCovered; }
    public void setTopicsCovered(List<String> topicsCovered) { this.topicsCovered = topicsCovered; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Map<String, Object> getValidationReport() { return validationReport; }
    public void setValidationReport(Map<String, Object> validationReport) { this.validationReport = validationReport; }
}
