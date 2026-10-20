package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class FlashcardDto {

    private String id;
    private String lectureId;
    private String question;
    private String answer;
    private String topic;
    private String difficulty; // Easy, Medium, Hard
    private String status; // unlearned, learned, difficult (per-user Leitner state)
    private LocalDateTime createdAt;

    public FlashcardDto() {}

    public FlashcardDto(String id, String lectureId, String question, String answer,
                        String topic, String difficulty, LocalDateTime createdAt) {
        this.id = id;
        this.lectureId = lectureId;
        this.question = question;
        this.answer = answer;
        this.topic = topic;
        this.difficulty = difficulty != null ? difficulty : "Medium";
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
