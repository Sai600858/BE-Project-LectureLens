package com.lecturelens.dto;

public class FlashcardProgressRequest {

    private String flashcardId;
    private String status; // unlearned, learned, difficult

    public FlashcardProgressRequest() {}

    public FlashcardProgressRequest(String flashcardId, String status) {
        this.flashcardId = flashcardId;
        this.status = status;
    }

    public String getFlashcardId() { return flashcardId; }
    public void setFlashcardId(String flashcardId) { this.flashcardId = flashcardId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
