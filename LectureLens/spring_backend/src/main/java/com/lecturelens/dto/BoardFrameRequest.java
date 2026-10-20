package com.lecturelens.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class BoardFrameRequest {

    @Schema(description = "Base64-encoded snapshot of the whiteboard frame", requiredMode = Schema.RequiredMode.REQUIRED)
    private String imageBase64;

    @Schema(description = "Video timestamp in seconds when the frame was captured", example = "12.5")
    private Double timestamp = 0.0;

    public BoardFrameRequest() {}

    public BoardFrameRequest(String imageBase64, Double timestamp) {
        this.imageBase64 = imageBase64;
        this.timestamp = timestamp != null ? timestamp : 0.0;
    }

    public String getImageBase64() {
        return imageBase64;
    }

    public void setImageBase64(String imageBase64) {
        this.imageBase64 = imageBase64;
    }

    public Double getTimestamp() {
        return timestamp != null ? timestamp : 0.0;
    }

    public void setTimestamp(Double timestamp) {
        this.timestamp = timestamp != null ? timestamp : 0.0;
    }
}
