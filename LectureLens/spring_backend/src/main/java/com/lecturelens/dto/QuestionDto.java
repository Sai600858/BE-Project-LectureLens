package com.lecturelens.dto;

public class QuestionDto {
    private String question;
    private String hint;

    public QuestionDto() {}

    public QuestionDto(String question, String hint) {
        this.question = question;
        this.hint = hint;
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getHint() { return hint; }
    public void setHint(String hint) { this.hint = hint; }
}
