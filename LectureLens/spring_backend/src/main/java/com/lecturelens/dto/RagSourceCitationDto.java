package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class RagSourceCitationDto {

    private String type; // TRANSCRIPT, BOARD, SLIDE
    private String timestamp;
    private Double timestampSeconds;
    private String snippet;
    private Object salkgMatch;

    public RagSourceCitationDto() {}

    public RagSourceCitationDto(String type, String timestamp, Double timestampSeconds, String snippet) {
        this.type = type;
        this.timestamp = timestamp;
        this.timestampSeconds = timestampSeconds;
        this.snippet = snippet;
    }

    public RagSourceCitationDto(String type, String timestamp, Double timestampSeconds, String snippet, Object salkgMatch) {
        this.type = type;
        this.timestamp = timestamp;
        this.timestampSeconds = timestampSeconds;
        this.snippet = snippet;
        this.salkgMatch = salkgMatch;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public Double getTimestampSeconds() { return timestampSeconds; }
    public void setTimestampSeconds(Double timestampSeconds) { this.timestampSeconds = timestampSeconds; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }

    public Object getSalkgMatch() { return salkgMatch; }
    public void setSalkgMatch(Object salkgMatch) { this.salkgMatch = salkgMatch; }
}
