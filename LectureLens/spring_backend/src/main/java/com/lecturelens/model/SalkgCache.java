package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "salkg_cache")
public class SalkgCache {

    @Id
    @Column(name = "lecture_id")
    private String lectureId;

    private String inferredSubject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String alignmentJson;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String knowledgeGraphJson;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String validationReportJson;

    private LocalDateTime updatedAt = LocalDateTime.now();

    public SalkgCache() {}

    public SalkgCache(String lectureId, String inferredSubject, String alignmentJson, String knowledgeGraphJson, String validationReportJson) {
        this.lectureId = lectureId;
        this.inferredSubject = inferredSubject;
        this.alignmentJson = alignmentJson;
        this.knowledgeGraphJson = knowledgeGraphJson;
        this.validationReportJson = validationReportJson;
        this.updatedAt = LocalDateTime.now();
    }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getInferredSubject() { return inferredSubject; }
    public void setInferredSubject(String inferredSubject) { this.inferredSubject = inferredSubject; }

    public String getAlignmentJson() { return alignmentJson; }
    public void setAlignmentJson(String alignmentJson) { this.alignmentJson = alignmentJson; }

    public String getKnowledgeGraphJson() { return knowledgeGraphJson; }
    public void setKnowledgeGraphJson(String knowledgeGraphJson) { this.knowledgeGraphJson = knowledgeGraphJson; }

    public String getValidationReportJson() { return validationReportJson; }
    public void setValidationReportJson(String validationReportJson) { this.validationReportJson = validationReportJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
