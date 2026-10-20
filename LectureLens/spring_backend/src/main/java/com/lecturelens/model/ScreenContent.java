package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "screen_contents")
public class ScreenContent {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id", nullable = false)
    private Lecture lecture;

    @Column(nullable = false)
    private Double timestamp;

    private String imagePath;
    private String slideTitle;

    @Column(columnDefinition = "TEXT")
    private String extractedText;

    @Column(columnDefinition = "TEXT")
    private String codeSnippet;

    @Column(columnDefinition = "TEXT")
    private String diagramDescription;

    @Column(columnDefinition = "TEXT")
    private String equationsJson = "[]";

    @Column(columnDefinition = "TEXT")
    private String diagramJson = "{}";

    private String codeLanguage = "";

    @Column(columnDefinition = "TEXT")
    private String keyPointsJson = "[]";

    @Column(columnDefinition = "TEXT")
    private String conceptDiagramJson = "{}";

    private String mainConcept = "";

    @Column(columnDefinition = "TEXT")
    private String structuredContentJson = "[]";

    private String imageHash = "";
    private Integer qualityScore = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public ScreenContent() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Lecture getLecture() { return lecture; }
    public void setLecture(Lecture lecture) { this.lecture = lecture; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }

    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }

    public String getSlideTitle() { return slideTitle; }
    public void setSlideTitle(String slideTitle) { this.slideTitle = slideTitle; }

    public String getExtractedText() { return extractedText; }
    public void setExtractedText(String extractedText) { this.extractedText = extractedText; }

    public String getCodeSnippet() { return codeSnippet; }
    public void setCodeSnippet(String codeSnippet) { this.codeSnippet = codeSnippet; }

    public String getDiagramDescription() { return diagramDescription; }
    public void setDiagramDescription(String diagramDescription) { this.diagramDescription = diagramDescription; }

    public String getEquationsJson() { return equationsJson; }
    public void setEquationsJson(String equationsJson) { this.equationsJson = equationsJson; }

    public String getDiagramJson() { return diagramJson; }
    public void setDiagramJson(String diagramJson) { this.diagramJson = diagramJson; }

    public String getCodeLanguage() { return codeLanguage; }
    public void setCodeLanguage(String codeLanguage) { this.codeLanguage = codeLanguage; }

    public String getKeyPointsJson() { return keyPointsJson; }
    public void setKeyPointsJson(String keyPointsJson) { this.keyPointsJson = keyPointsJson; }

    public String getConceptDiagramJson() { return conceptDiagramJson; }
    public void setConceptDiagramJson(String conceptDiagramJson) { this.conceptDiagramJson = conceptDiagramJson; }

    public String getMainConcept() { return mainConcept; }
    public void setMainConcept(String mainConcept) { this.mainConcept = mainConcept; }

    public String getStructuredContentJson() { return structuredContentJson; }
    public void setStructuredContentJson(String structuredContentJson) { this.structuredContentJson = structuredContentJson; }

    public String getImageHash() { return imageHash; }
    public void setImageHash(String imageHash) { this.imageHash = imageHash; }

    public Integer getQualityScore() { return qualityScore; }
    public void setQualityScore(Integer qualityScore) { this.qualityScore = qualityScore; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
