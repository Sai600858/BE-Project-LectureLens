package com.lecturelens.dto;

public class BoardContentResponse {
    private boolean success = true;
    private BoardContentDto content;

    public BoardContentResponse() {}

    public BoardContentResponse(BoardContentDto content) {
        this.success = true;
        this.content = content;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public BoardContentDto getContent() { return content; }
    public void setContent(BoardContentDto content) { this.content = content; }
}
