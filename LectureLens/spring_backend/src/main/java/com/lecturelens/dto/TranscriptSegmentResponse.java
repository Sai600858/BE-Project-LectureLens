package com.lecturelens.dto;

public class TranscriptSegmentResponse {
    private boolean success = true;
    private TranscriptSegmentDto segment;

    public TranscriptSegmentResponse() {}

    public TranscriptSegmentResponse(TranscriptSegmentDto segment) {
        this.success = true;
        this.segment = segment;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public TranscriptSegmentDto getSegment() { return segment; }
    public void setSegment(TranscriptSegmentDto segment) { this.segment = segment; }
}
