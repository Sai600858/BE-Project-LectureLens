package com.lecturelens.dto;

public class SummaryResponse {
    private SummaryDto summary;

    public SummaryResponse() {}

    public SummaryResponse(SummaryDto summary) {
        this.summary = summary;
    }

    public SummaryDto getSummary() { return summary; }
    public void setSummary(SummaryDto summary) { this.summary = summary; }
}
