package com.lecturelens.dto;

import java.time.LocalDateTime;

public class QuizDto {

    private String id;
    private String lectureId;
    private String title;
    private LocalDateTime createdAt;

    public QuizDto() {}

    public QuizDto(String id, String lectureId, String title, LocalDateTime createdAt) {
        this.id = id;
        this.lectureId = lectureId;
        this.title = title;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
