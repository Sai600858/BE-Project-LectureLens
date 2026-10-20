package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.lecturelens.model.Transcript;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class TranscriptDto {

    private String id;

    @JsonProperty("lectureId")
    @JsonAlias({"lecture_id"})
    private String lectureId;

    @JsonProperty("fullText")
    @JsonAlias({"full_text"})
    private String fullText;

    private String status;

    @JsonProperty("createdAt")
    @JsonAlias({"created_at"})
    private LocalDateTime createdAt;

    @JsonProperty("updatedAt")
    @JsonAlias({"updated_at"})
    private LocalDateTime updatedAt;

    public TranscriptDto() {}

    public static TranscriptDto fromEntity(Transcript entity) {
        if (entity == null) return null;
        TranscriptDto dto = new TranscriptDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLectureId());
        dto.setFullText(entity.getFullText());
        dto.setStatus(entity.getStatus());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getFullText() { return fullText; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
