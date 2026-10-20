package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "quizzes")
public class Quiz {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String lectureId;

    @Column(nullable = false)
    private String title;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Quiz() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
