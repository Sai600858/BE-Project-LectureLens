package com.lecturelens.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class TranscriptSegmentRequest {

    @Schema(description = "Sequence chunk identifier", example = "1")
    private Long chunkId;

    @Schema(description = "User or speaker identifier", example = "usr_teacher_demo")
    private String speakerId;

    @Schema(description = "Display name of the speaker", example = "Teacher")
    private String speakerName;

    @Schema(description = "Start offset in seconds", example = "0.0", requiredMode = Schema.RequiredMode.REQUIRED)
    private Double startTime = 0.0;

    @Schema(description = "End offset in seconds", example = "3.0")
    private Double endTime;

    @Schema(description = "Transcribed speech text content", example = "Welcome everyone to today's lecture.", requiredMode = Schema.RequiredMode.REQUIRED)
    private String text;

    @Schema(description = "Confidence score (0.0 to 1.0)", example = "0.95")
    private Double confidence = 1.0;

    @Schema(description = "Language code", example = "en")
    private String language = "en";

    public TranscriptSegmentRequest() {}

    public Long getChunkId() { return chunkId; }
    public void setChunkId(Long chunkId) { this.chunkId = chunkId; }

    public String getSpeakerId() { return speakerId; }
    public void setSpeakerId(String speakerId) { this.speakerId = speakerId; }

    public String getSpeakerName() { return speakerName; }
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; }

    public Double getStartTime() { return startTime != null ? startTime : 0.0; }
    public void setStartTime(Double startTime) { this.startTime = startTime != null ? startTime : 0.0; }

    public Double getEndTime() { return endTime; }
    public void setEndTime(Double endTime) { this.endTime = endTime; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public Double getConfidence() { return confidence != null ? confidence : 1.0; }
    public void setConfidence(Double confidence) { this.confidence = confidence != null ? confidence : 1.0; }

    public String getLanguage() { return language != null ? language : "en"; }
    public void setLanguage(String language) { this.language = language != null ? language : "en"; }
}
