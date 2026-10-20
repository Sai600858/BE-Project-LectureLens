package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class LegacyTranscriptResponse {
    private String roomId;
    private String status;
    private String fullText;
    private List<TranscriptSegmentDto> segments = new ArrayList<>();

    public LegacyTranscriptResponse() {}

    public LegacyTranscriptResponse(String roomId, String status, String fullText, List<TranscriptSegmentDto> segments) {
        this.roomId = roomId;
        this.status = status;
        this.fullText = fullText;
        this.segments = segments != null ? segments : new ArrayList<>();
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getFullText() { return fullText; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public List<TranscriptSegmentDto> getSegments() { return segments; }
    public void setSegments(List<TranscriptSegmentDto> segments) { this.segments = segments != null ? segments : new ArrayList<>(); }
}
