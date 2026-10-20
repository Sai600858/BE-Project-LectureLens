package com.lecturelens.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AskLectureRequest {

    @NotBlank(message = "Question cannot be empty")
    @Size(max = 1000, message = "Question must be at most 1000 characters")
    private String question;

    public AskLectureRequest() {}

    public AskLectureRequest(String question) {
        this.question = question;
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
}
