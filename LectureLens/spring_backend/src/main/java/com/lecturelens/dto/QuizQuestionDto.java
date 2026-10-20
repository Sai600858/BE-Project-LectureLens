package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuizQuestionDto {

    private String id;
    private String quizId;
    private String questionText;
    private String type; // MCQ, TRUE_FALSE, FILL_BLANK, SHORT_ANSWER
    private List<String> options = new ArrayList<>();
    private String correctAnswer;
    private String explanation;
    private String difficulty; // Easy, Medium, Hard
    private String topic;

    public QuizQuestionDto() {}

    public QuizQuestionDto(String id, String quizId, String questionText, String type,
                           List<String> options, String correctAnswer, String explanation,
                           String difficulty, String topic) {
        this.id = id;
        this.quizId = quizId;
        this.questionText = questionText;
        this.type = type;
        this.options = options != null ? options : new ArrayList<>();
        this.correctAnswer = correctAnswer;
        this.explanation = explanation;
        this.difficulty = difficulty != null ? difficulty : "Medium";
        this.topic = topic != null ? topic : "General";
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getQuizId() { return quizId; }
    public void setQuizId(String quizId) { this.quizId = quizId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    @JsonProperty("question_text")
    public String getQuestion_text() { return questionText; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options != null ? options : new ArrayList<>(); }

    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }

    @JsonProperty("correct_answer")
    public String getCorrect_answer() { return correctAnswer; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
}
