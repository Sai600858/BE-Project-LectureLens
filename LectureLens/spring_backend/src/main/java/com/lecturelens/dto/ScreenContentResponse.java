package com.lecturelens.dto;

public class ScreenContentResponse {
    private boolean success = true;
    private ScreenContentDto content;

    public ScreenContentResponse() {}

    public ScreenContentResponse(ScreenContentDto content) {
        this.success = true;
        this.content = content;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public ScreenContentDto getContent() { return content; }
    public void setContent(ScreenContentDto content) { this.content = content; }
}
