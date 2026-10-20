package com.lecturelens.dto;

public class ChapterUpdateRequest {
    private String title;
    private Double startTime;
    private Double endTime;
    private String summary;

    public ChapterUpdateRequest() {}

    public ChapterUpdateRequest(String title, Double startTime, Double endTime, String summary) {
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.summary = summary;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Double getStartTime() { return startTime; }
    public void setStartTime(Double startTime) { this.startTime = startTime; }

    public Double getEndTime() { return endTime; }
    public void setEndTime(Double endTime) { this.endTime = endTime; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
}
