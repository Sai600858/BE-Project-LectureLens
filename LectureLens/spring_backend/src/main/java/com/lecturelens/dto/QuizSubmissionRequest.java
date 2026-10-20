package com.lecturelens.dto;

import java.util.HashMap;
import java.util.Map;

public class QuizSubmissionRequest {

    private String quizId;
    private Map<String, String> answers = new HashMap<>();

    public QuizSubmissionRequest() {}

    public QuizSubmissionRequest(String quizId, Map<String, String> answers) {
        this.quizId = quizId;
        this.answers = answers != null ? answers : new HashMap<>();
    }

    public String getQuizId() { return quizId; }
    public void setQuizId(String quizId) { this.quizId = quizId; }

    public Map<String, String> getAnswers() { return answers; }
    public void setAnswers(Map<String, String> answers) { this.answers = answers != null ? answers : new HashMap<>(); }
}
