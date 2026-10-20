package com.lecturelens.dto;

import com.lecturelens.model.LectureChapter;

import java.time.LocalDateTime;

public class ChapterDto {
    private String id;
    private String lectureId;
    private String title;
    private Double startTime;
    private Double endTime;
    private String summary;
    private LocalDateTime createdAt;

    public ChapterDto() {}

    public ChapterDto(String id, String lectureId, String title, Double startTime, Double endTime, String summary) {
        this.id = id;
        this.lectureId = lectureId;
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.summary = summary;
        this.createdAt = LocalDateTime.now();
    }

    public static ChapterDto fromEntity(LectureChapter entity) {
        if (entity == null) return null;
        ChapterDto dto = new ChapterDto();
        dto.setId(entity.getId());
        dto.setLectureId(entity.getLecture() != null ? entity.getLecture().getId() : null);
        dto.setTitle(entity.getTitle());
        dto.setStartTime(entity.getStartTime());
        dto.setEndTime(entity.getEndTime());
        dto.setSummary(entity.getSummary());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Double getStartTime() { return startTime; }
    public void setStartTime(Double startTime) { this.startTime = startTime; }

    public Double getEndTime() { return endTime; }
    public void setEndTime(Double endTime) { this.endTime = endTime; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
