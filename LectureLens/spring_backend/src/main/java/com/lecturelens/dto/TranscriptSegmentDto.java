package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.lecturelens.model.TranscriptSegment;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class TranscriptSegmentDto {

    private Long id;

    @JsonProperty("lectureId")
    @JsonAlias({"lecture_id"})
    private String lectureId;

    @JsonProperty("chunkId")
    @JsonAlias({"chunk_id"})
    private Long chunkId;

    @JsonProperty("speakerId")
    @JsonAlias({"speaker_id"})
    private String speakerId;

    @JsonProperty("speakerName")
    @JsonAlias({"speaker_name"})
    private String speakerName;

    @JsonProperty("startTime")
    @JsonAlias({"start_time", "startOffset"})
    private Double startTime;

    @JsonProperty("endTime")
    @JsonAlias({"end_time", "endOffset"})
    private Double endTime;

    private String text;
    private Double confidence;

    @JsonProperty("createdAt")
    @JsonAlias({"created_at"})
    private LocalDateTime createdAt;

    public TranscriptSegmentDto() {}

    public static TranscriptSegmentDto fromEntity(TranscriptSegment entity) {
        if (entity == null) return null;
        TranscriptSegmentDto dto = new TranscriptSegmentDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLectureId());
        dto.setChunkId(entity.getChunkId());
        dto.setSpeakerId(entity.getSpeakerId());
        dto.setSpeakerName(entity.getSpeakerName());
        dto.setStartTime(entity.getStartTime());
        dto.setEndTime(entity.getEndTime());
        dto.setText(entity.getText());
        dto.setConfidence(entity.getConfidence());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

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
