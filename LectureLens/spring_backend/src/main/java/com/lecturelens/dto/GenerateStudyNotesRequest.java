package com.lecturelens.dto;

public class GenerateStudyNotesRequest {
    private String mode; // short, detailed, exam, beginner

    public GenerateStudyNotesRequest() {}

    public GenerateStudyNotesRequest(String mode) {
        this.mode = mode;
    }

    public String getMode() {
        return (mode != null && !mode.isBlank()) ? mode : "detailed";
    }

    public void setMode(String mode) {
        this.mode = mode;
    }
}
