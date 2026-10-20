package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class TranscriptSearchResponse {
    private List<TranscriptSegmentDto> matches = new ArrayList<>();

    public TranscriptSearchResponse() {}

    public TranscriptSearchResponse(List<TranscriptSegmentDto> matches) {
        this.matches = matches != null ? matches : new ArrayList<>();
    }

    public List<TranscriptSegmentDto> getMatches() {
        return matches;
    }

    public void setMatches(List<TranscriptSegmentDto> matches) {
        this.matches = matches != null ? matches : new ArrayList<>();
    }
}
