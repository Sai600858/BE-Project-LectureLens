package com.lecturelens.dto;

public class QuizQuestionResultDto {

    private String questionId;
    private String questionText;
    private String userAnswer;
    private String correctAnswer;
    private Boolean isCorrect;
    private String explanation;
    private String difficulty;
    private String topic;

    public QuizQuestionResultDto() {}

    public QuizQuestionResultDto(String questionId, String questionText, String userAnswer,
                                 String correctAnswer, Boolean isCorrect, String explanation,
                                 String difficulty, String topic) {
        this.questionId = questionId;
        this.questionText = questionText;
        this.userAnswer = userAnswer;
        this.correctAnswer = correctAnswer;
        this.isCorrect = isCorrect;
        this.explanation = explanation;
        this.difficulty = difficulty;
        this.topic = topic;
    }

    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public String getUserAnswer() { return userAnswer; }
    public void setUserAnswer(String userAnswer) { this.userAnswer = userAnswer; }

    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }

    public Boolean getIsCorrect() { return isCorrect; }
    public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
}
