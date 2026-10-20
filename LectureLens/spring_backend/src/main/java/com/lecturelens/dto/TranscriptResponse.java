package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class TranscriptResponse {
    private TranscriptDto transcript;
    private List<TranscriptSegmentDto> segments = new ArrayList<>();

    public TranscriptResponse() {}

    public TranscriptResponse(TranscriptDto transcript, List<TranscriptSegmentDto> segments) {
        this.transcript = transcript;
        this.segments = segments != null ? segments : new ArrayList<>();
    }

    public TranscriptDto getTranscript() { return transcript; }
    public void setTranscript(TranscriptDto transcript) { this.transcript = transcript; }

    public List<TranscriptSegmentDto> getSegments() { return segments; }
    public void setSegments(List<TranscriptSegmentDto> segments) { this.segments = segments != null ? segments : new ArrayList<>(); }
}
