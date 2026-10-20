package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "multimodal_events")
public class MultimodalEvent {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id", nullable = false)
    private Lecture lecture;

    @Column(nullable = false)
    private Double timestamp;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String eventType;

    @Column(columnDefinition = "TEXT")
    private String audioText;

    @Column(columnDefinition = "TEXT")
    private String visualContent;

    @Column(columnDefinition = "TEXT")
    private String combinedInsight;

    private LocalDateTime createdAt = LocalDateTime.now();

    public MultimodalEvent() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Lecture getLecture() { return lecture; }
    public void setLecture(Lecture lecture) { this.lecture = lecture; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getAudioText() { return audioText; }
    public void setAudioText(String audioText) { this.audioText = audioText; }

    public String getVisualContent() { return visualContent; }
    public void setVisualContent(String visualContent) { this.visualContent = visualContent; }

    public String getCombinedInsight() { return combinedInsight; }
    public void setCombinedInsight(String combinedInsight) { this.combinedInsight = combinedInsight; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
