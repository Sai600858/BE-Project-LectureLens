package com.lecturelens.dto;

public class RagChunkDto {

    private String sourceType; // TRANSCRIPT, BOARD, SLIDE
    private String speaker;
    private String text;
    private Double timestamp;
    private double score;

    public RagChunkDto() {}

    public RagChunkDto(String sourceType, String speaker, String text, Double timestamp, double score) {
        this.sourceType = sourceType;
        this.speaker = speaker;
        this.text = text;
        this.timestamp = timestamp;
        this.score = score;
    }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getSpeaker() { return speaker; }
    public void setSpeaker(String speaker) { this.speaker = speaker; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public Double getTimestamp() { return timestamp; }
    public void setTimestamp(Double timestamp) { this.timestamp = timestamp; }

    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }
}
