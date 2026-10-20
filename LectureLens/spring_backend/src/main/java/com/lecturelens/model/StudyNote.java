package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "study_notes")
public class StudyNote {

    @Id
    private String id;

    @Column(nullable = false)
    private String lectureId;

    @Column(nullable = false)
    private String mode; // short, detailed, exam, beginner

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String contentMarkdown;

    @Column(columnDefinition = "TEXT")
    private String formulasJson;

    @Column(columnDefinition = "TEXT")
    private String diagramsJson;

    @Column(columnDefinition = "TEXT")
    private String questionsJson;

    @Column(columnDefinition = "TEXT")
    private String sectionsJson = "[]";

    @Column(columnDefinition = "TEXT")
    private String visualizationsJson = "[]";

    private LocalDateTime createdAt = LocalDateTime.now();

    public StudyNote() {}

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

    public String getFormulasJson() { return formulasJson; }
    public void setFormulasJson(String formulasJson) { this.formulasJson = formulasJson; }

    public String getDiagramsJson() { return diagramsJson; }
    public void setDiagramsJson(String diagramsJson) { this.diagramsJson = diagramsJson; }

    public String getQuestionsJson() { return questionsJson; }
    public void setQuestionsJson(String questionsJson) { this.questionsJson = questionsJson; }

    public String getSectionsJson() { return sectionsJson; }
    public void setSectionsJson(String sectionsJson) { this.sectionsJson = sectionsJson; }

    public String getVisualizationsJson() { return visualizationsJson; }
    public void setVisualizationsJson(String visualizationsJson) { this.visualizationsJson = visualizationsJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
