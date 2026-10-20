package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "summaries")
public class Summary {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String lectureId;

    @Column(columnDefinition = "TEXT")
    private String shortSummary;

    @Column(columnDefinition = "TEXT")
    private String detailedSummary;

    @Column(columnDefinition = "TEXT")
    private String keyConceptsJson;

    @Column(columnDefinition = "TEXT")
    private String definitionsJson;

    @Column(columnDefinition = "TEXT")
    private String examplesJson;

    @Column(columnDefinition = "TEXT")
    private String keyTakeawaysJson;

    @Column(columnDefinition = "TEXT")
    private String topicsCoveredJson;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Summary() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getShortSummary() { return shortSummary; }
    public void setShortSummary(String shortSummary) { this.shortSummary = shortSummary; }

    public String getDetailedSummary() { return detailedSummary; }
    public void setDetailedSummary(String detailedSummary) { this.detailedSummary = detailedSummary; }

    public String getKeyConceptsJson() { return keyConceptsJson; }
    public void setKeyConceptsJson(String keyConceptsJson) { this.keyConceptsJson = keyConceptsJson; }

    public String getDefinitionsJson() { return definitionsJson; }
    public void setDefinitionsJson(String definitionsJson) { this.definitionsJson = definitionsJson; }

    public String getExamplesJson() { return examplesJson; }
    public void setExamplesJson(String examplesJson) { this.examplesJson = examplesJson; }

    public String getKeyTakeawaysJson() { return keyTakeawaysJson; }
    public void setKeyTakeawaysJson(String keyTakeawaysJson) { this.keyTakeawaysJson = keyTakeawaysJson; }

    public String getTopicsCoveredJson() { return topicsCoveredJson; }
    public void setTopicsCoveredJson(String topicsCoveredJson) { this.topicsCoveredJson = topicsCoveredJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
