package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuizResponse {

    private QuizDto quiz;
    private List<QuizQuestionDto> questions = new ArrayList<>();
    private Object validationReport;

    public QuizResponse() {}

    public QuizResponse(QuizDto quiz, List<QuizQuestionDto> questions) {
        this.quiz = quiz;
        this.questions = questions != null ? questions : new ArrayList<>();
    }

    public QuizResponse(QuizDto quiz, List<QuizQuestionDto> questions, Object validationReport) {
        this.quiz = quiz;
        this.questions = questions != null ? questions : new ArrayList<>();
        this.validationReport = validationReport;
    }

    public QuizDto getQuiz() { return quiz; }
    public void setQuiz(QuizDto quiz) { this.quiz = quiz; }

    public List<QuizQuestionDto> getQuestions() { return questions; }
    public void setQuestions(List<QuizQuestionDto> questions) { this.questions = questions != null ? questions : new ArrayList<>(); }

    public Object getValidationReport() { return validationReport; }
    public void setValidationReport(Object validationReport) { this.validationReport = validationReport; }
}
