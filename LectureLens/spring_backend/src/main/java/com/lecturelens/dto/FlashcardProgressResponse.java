package com.lecturelens.dto;

public class FlashcardProgressResponse {

    private boolean success;
    private String status;

    public FlashcardProgressResponse() {}

    public FlashcardProgressResponse(boolean success, String status) {
        this.success = success;
        this.status = status;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
