package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lecture_chapters", uniqueConstraints = {
    @UniqueConstraint(name = "uq_chapters_lecture_title_time", columnNames = {"lecture_id", "title", "startTime"})
})
public class LectureChapter {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id", nullable = false)
    private Lecture lecture;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private Double startTime;

    private Double endTime;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private LocalDateTime createdAt = LocalDateTime.now();

    public LectureChapter() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Lecture getLecture() { return lecture; }
    public void setLecture(Lecture lecture) { this.lecture = lecture; }

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
