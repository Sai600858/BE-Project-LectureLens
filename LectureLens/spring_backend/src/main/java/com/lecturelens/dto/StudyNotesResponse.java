package com.lecturelens.dto;

public class StudyNotesResponse {
    private StudyNotesDto notes;

    public StudyNotesResponse() {}

    public StudyNotesResponse(StudyNotesDto notes) {
        this.notes = notes;
    }

    public StudyNotesDto getNotes() { return notes; }
    public void setNotes(StudyNotesDto notes) { this.notes = notes; }
}
