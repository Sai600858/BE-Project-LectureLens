package com.lecturelens.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.model.StudyNote;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class StudyNotesDto {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private String id;
    private String lectureId;
    private String mode;
    private String title;
    private String contentMarkdown;
    private List<FormulaDto> formulas;
    private List<DiagramDto> diagrams;
    private List<QuestionDto> questions;
    private List<StudySectionDto> sections;
    private List<VisualizationDto> visualizations;
    private LocalDateTime createdAt;
    private Map<String, Object> validationReport;

    public StudyNotesDto() {}

    public static StudyNotesDto fromEntity(StudyNote entity, Map<String, Object> validationReport) {
        if (entity == null) return null;
        StudyNotesDto dto = new StudyNotesDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLectureId());
        dto.setMode(entity.getMode());
        dto.setTitle(entity.getTitle());
        dto.setContentMarkdown(entity.getContentMarkdown());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setValidationReport(validationReport);

        try {
            if (entity.getFormulasJson() != null && !entity.getFormulasJson().isBlank()) {
                dto.setFormulas(MAPPER.readValue(entity.getFormulasJson(), new TypeReference<List<FormulaDto>>() {}));
            } else {
                dto.setFormulas(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setFormulas(Collections.emptyList());
        }

        try {
            if (entity.getDiagramsJson() != null && !entity.getDiagramsJson().isBlank()) {
                dto.setDiagrams(MAPPER.readValue(entity.getDiagramsJson(), new TypeReference<List<DiagramDto>>() {}));
            } else {
                dto.setDiagrams(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setDiagrams(Collections.emptyList());
        }

        try {
            if (entity.getQuestionsJson() != null && !entity.getQuestionsJson().isBlank()) {
                dto.setQuestions(MAPPER.readValue(entity.getQuestionsJson(), new TypeReference<List<QuestionDto>>() {}));
            } else {
                dto.setQuestions(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setQuestions(Collections.emptyList());
        }

        try {
            if (entity.getSectionsJson() != null && !entity.getSectionsJson().isBlank()) {
                dto.setSections(MAPPER.readValue(entity.getSectionsJson(), new TypeReference<List<StudySectionDto>>() {}));
            } else {
                dto.setSections(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setSections(Collections.emptyList());
        }

        try {
            if (entity.getVisualizationsJson() != null && !entity.getVisualizationsJson().isBlank()) {
                dto.setVisualizations(MAPPER.readValue(entity.getVisualizationsJson(), new TypeReference<List<VisualizationDto>>() {}));
            } else {
                dto.setVisualizations(Collections.emptyList());
            }
        } catch (Exception e) {
            dto.setVisualizations(Collections.emptyList());
        }

        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContentMarkdown() { return contentMarkdown; }
    public void setContentMarkdown(String contentMarkdown) { this.contentMarkdown = contentMarkdown; }

    public List<FormulaDto> getFormulas() { return formulas; }
    public void setFormulas(List<FormulaDto> formulas) { this.formulas = formulas; }

    public List<DiagramDto> getDiagrams() { return diagrams; }
    public void setDiagrams(List<DiagramDto> diagrams) { this.diagrams = diagrams; }

    public List<QuestionDto> getQuestions() { return questions; }
    public void setQuestions(List<QuestionDto> questions) { this.questions = questions; }

    public List<StudySectionDto> getSections() { return sections; }
    public void setSections(List<StudySectionDto> sections) { this.sections = sections; }

    public List<VisualizationDto> getVisualizations() { return visualizations; }
    public void setVisualizations(List<VisualizationDto> visualizations) { this.visualizations = visualizations; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Map<String, Object> getValidationReport() { return validationReport; }
    public void setValidationReport(Map<String, Object> validationReport) { this.validationReport = validationReport; }
}
