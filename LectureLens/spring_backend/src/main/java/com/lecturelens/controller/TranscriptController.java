package com.lecturelens.controller;

import com.lecturelens.dto.*;
import com.lecturelens.service.TranscriptService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "Transcripts", description = "Speech-to-text transcript segments, searching, and synchronized lecture rehydration")
public class TranscriptController {

    @Autowired
    private TranscriptService transcriptService;

    private String getCurrentUserId(Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }

    private String getCurrentUserRole(Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(a -> a.startsWith("ROLE_"))
                    .map(a -> a.substring(5))
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    @PostMapping("/api/lectures/{lectureId}/transcript-segment")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Ingest transcript segment", description = "Stores an incremental speech segment with speaker identification and chronological timestamps")
    public ResponseEntity<TranscriptSegmentResponse> ingestSegment(
            @PathVariable String lectureId,
            @RequestBody TranscriptSegmentRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        TranscriptSegmentDto dto = transcriptService.ingestSegment(lectureId, request, userId, role);
        return ResponseEntity.ok(new TranscriptSegmentResponse(dto));
    }

    @GetMapping("/api/lectures/{lectureId}/transcript")
    @Operation(summary = "Get lecture transcript", description = "Retrieves master lecture transcript text and chronological segments with pagination bounds")
    public ResponseEntity<TranscriptResponse> getTranscript(
            @PathVariable String lectureId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        TranscriptResponse response = transcriptService.getTranscript(lectureId, userId, role, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/lectures/{lectureId}/transcript/search")
    @Operation(summary = "Search transcript segments", description = "Searches for matching keywords and phrases in the lecture transcript")
    public ResponseEntity<TranscriptSearchResponse> searchTranscript(
            @PathVariable String lectureId,
            @RequestParam(name = "q", required = false) String query) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        TranscriptSearchResponse response = transcriptService.searchTranscript(lectureId, query, userId, role);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/transcript/{roomId}")
    @Operation(summary = "Legacy transcript endpoint", description = "Backward-compatible transcript endpoint querying by room code")
    public ResponseEntity<LegacyTranscriptResponse> getLegacyTranscript(@PathVariable String roomId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        LegacyTranscriptResponse response = transcriptService.getLegacyTranscript(roomId, userId, role);
        return ResponseEntity.ok(response);
    }
}
