package com.lecturelens.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class QuizAttemptResponse {

    private String attemptId;
    private String quizId;
    private String userId;
    private Integer score;
    private Integer totalQuestions;
    private Integer percentage;
    private List<String> weakTopics = new ArrayList<>();
    private List<QuizQuestionResultDto> results = new ArrayList<>();
    private LocalDateTime attemptedAt;

    public QuizAttemptResponse() {}

    public QuizAttemptResponse(String attemptId, String quizId, String userId, Integer score,
                               Integer totalQuestions, Integer percentage,
                               List<String> weakTopics, List<QuizQuestionResultDto> results,
                               LocalDateTime attemptedAt) {
        this.attemptId = attemptId;
        this.quizId = quizId;
        this.userId = userId;
        this.score = score;
        this.totalQuestions = totalQuestions;
        this.percentage = percentage;
        this.weakTopics = weakTopics != null ? weakTopics : new ArrayList<>();
        this.results = results != null ? results : new ArrayList<>();
        this.attemptedAt = attemptedAt != null ? attemptedAt : LocalDateTime.now();
    }

    public String getAttemptId() { return attemptId; }
    public void setAttemptId(String attemptId) { this.attemptId = attemptId; }

    public String getQuizId() { return quizId; }
    public void setQuizId(String quizId) { this.quizId = quizId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(Integer totalQuestions) { this.totalQuestions = totalQuestions; }

    public Integer getTotal() { return totalQuestions; }

    public Integer getPercentage() { return percentage; }
    public void setPercentage(Integer percentage) { this.percentage = percentage; }

    public List<String> getWeakTopics() { return weakTopics; }
    public void setWeakTopics(List<String> weakTopics) { this.weakTopics = weakTopics != null ? weakTopics : new ArrayList<>(); }

    public List<QuizQuestionResultDto> getResults() { return results; }
    public void setResults(List<QuizQuestionResultDto> results) { this.results = results != null ? results : new ArrayList<>(); }

    public LocalDateTime getAttemptedAt() { return attemptedAt; }
    public void setAttemptedAt(LocalDateTime attemptedAt) { this.attemptedAt = attemptedAt; }
}
