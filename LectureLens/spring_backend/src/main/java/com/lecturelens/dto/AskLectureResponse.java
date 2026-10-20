package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class AskLectureResponse {

    private String question;
    private String answer;
    private String relevantTimestamp;
    private Double timestampSeconds;
    private List<RagSourceCitationDto> sources = new ArrayList<>();
    private Object salkgGrounding;
    private Object validationReport;
    private String guardDecision;

    public AskLectureResponse() {}

    public AskLectureResponse(String question, String answer, String relevantTimestamp,
                              Double timestampSeconds, List<RagSourceCitationDto> sources) {
        this.question = question;
        this.answer = answer;
        this.relevantTimestamp = relevantTimestamp;
        this.timestampSeconds = timestampSeconds;
        this.sources = sources != null ? sources : new ArrayList<>();
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getRelevantTimestamp() { return relevantTimestamp; }
    public void setRelevantTimestamp(String relevantTimestamp) { this.relevantTimestamp = relevantTimestamp; }

    public Double getTimestampSeconds() { return timestampSeconds; }
    public void setTimestampSeconds(Double timestampSeconds) { this.timestampSeconds = timestampSeconds; }

    public List<RagSourceCitationDto> getSources() { return sources; }
    public void setSources(List<RagSourceCitationDto> sources) { this.sources = sources != null ? sources : new ArrayList<>(); }

    public Object getSalkgGrounding() { return salkgGrounding; }
    public void setSalkgGrounding(Object salkgGrounding) { this.salkgGrounding = salkgGrounding; }

    public Object getValidationReport() { return validationReport; }
    public void setValidationReport(Object validationReport) { this.validationReport = validationReport; }

    public String getGuardDecision() { return guardDecision; }
    public void setGuardDecision(String guardDecision) { this.guardDecision = guardDecision; }
}
