package com.lecturelens.service;

import com.lecturelens.dto.*;

import java.util.List;

public interface TranscriptService {
    TranscriptSegmentDto ingestSegment(String lectureIdentifier, TranscriptSegmentRequest request, String currentUserId, String currentUserRole);
    TranscriptResponse getTranscript(String lectureIdentifier, String currentUserId, String currentUserRole, Integer page, Integer size);
    TranscriptSearchResponse searchTranscript(String lectureIdentifier, String query, String currentUserId, String currentUserRole);
    LegacyTranscriptResponse getLegacyTranscript(String roomId, String currentUserId, String currentUserRole);
    TranscriptResponse syncTranscript(String lectureIdentifier, List<TranscriptSegmentRequest> segments, String fullText, String currentUserId, String currentUserRole);
}
