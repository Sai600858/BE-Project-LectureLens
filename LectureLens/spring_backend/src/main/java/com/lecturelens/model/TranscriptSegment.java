package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transcript_segments")
public class TranscriptSegment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String lectureId;

    private Long chunkId;
    private String speakerId;
    private String speakerName;

    @Column(nullable = false)
    private Double startTime;

    private Double endTime;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    private Double confidence = 1.0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public TranscriptSegment() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public Long getChunkId() { return chunkId; }
    public void setChunkId(Long chunkId) { this.chunkId = chunkId; }

    public String getSpeakerId() { return speakerId; }
    public void setSpeakerId(String speakerId) { this.speakerId = speakerId; }

    public String getSpeakerName() { return speakerName; }
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; }

    public Double getStartTime() { return startTime; }
    public void setStartTime(Double startTime) { this.startTime = startTime; }

    public Double getEndTime() { return endTime; }
    public void setEndTime(Double endTime) { this.endTime = endTime; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
