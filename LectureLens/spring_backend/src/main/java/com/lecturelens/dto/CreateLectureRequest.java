package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateLectureRequest {

    private String title;
    private String description;
    private LocalDateTime scheduledAt;
    private String visibility = "PUBLIC";
    private String password;
    private String subject = "";

    public CreateLectureRequest() {}

    public CreateLectureRequest(String title, String description, LocalDateTime scheduledAt, String visibility, String password, String subject) {
        this.title = title;
        this.description = description;
        this.scheduledAt = scheduledAt;
        this.visibility = visibility != null ? visibility : "PUBLIC";
        this.password = password;
        this.subject = subject != null ? subject : "";
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(LocalDateTime scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }
}
