package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "metadata_consistency_reports")
public class MetadataConsistencyReport {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id", nullable = false)
    private Lecture lecture;

    @Column(nullable = false)
    private String declaredTitle;

    private String declaredSubject;
    private String inferredSubject;

    @Column(nullable = false)
    private String consistencyStatus;

    @Column(nullable = false)
    private String matchType;

    @Column(nullable = false)
    private String confidence;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(columnDefinition = "TEXT")
    private String evidenceRefsJson;

    private Integer isProvisional = 0;
    private Integer teacherConfirmed = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public MetadataConsistencyReport() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Lecture getLecture() { return lecture; }
    public void setLecture(Lecture lecture) { this.lecture = lecture; }

    public String getDeclaredTitle() { return declaredTitle; }
    public void setDeclaredTitle(String declaredTitle) { this.declaredTitle = declaredTitle; }

    public String getDeclaredSubject() { return declaredSubject; }
    public void setDeclaredSubject(String declaredSubject) { this.declaredSubject = declaredSubject; }

    public String getInferredSubject() { return inferredSubject; }
    public void setInferredSubject(String inferredSubject) { this.inferredSubject = inferredSubject; }

    public String getConsistencyStatus() { return consistencyStatus; }
    public void setConsistencyStatus(String consistencyStatus) { this.consistencyStatus = consistencyStatus; }

    public String getMatchType() { return matchType; }
    public void setMatchType(String matchType) { this.matchType = matchType; }

    public String getConfidence() { return confidence; }
    public void setConfidence(String confidence) { this.confidence = confidence; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public String getEvidenceRefsJson() { return evidenceRefsJson; }
    public void setEvidenceRefsJson(String evidenceRefsJson) { this.evidenceRefsJson = evidenceRefsJson; }

    public Integer getIsProvisional() { return isProvisional; }
    public void setIsProvisional(Integer isProvisional) { this.isProvisional = isProvisional; }

    public Integer getTeacherConfirmed() { return teacherConfirmed; }
    public void setTeacherConfirmed(Integer teacherConfirmed) { this.teacherConfirmed = teacherConfirmed; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
