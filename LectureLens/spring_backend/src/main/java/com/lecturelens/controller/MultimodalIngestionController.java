package com.lecturelens.controller;

import com.lecturelens.dto.*;
import com.lecturelens.service.MultimodalIngestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "Multimodal Ingestion", description = "Whiteboard, screen frame snapshots, vision OCR, and deduplication")
public class MultimodalIngestionController {

    @Autowired
    private MultimodalIngestionService multimodalIngestionService;

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

    @PostMapping("/{lectureId}/board-frame")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Ingest whiteboard snapshot", description = "Validates, deduplicates via image hash, performs OCR analysis, and stores whiteboard content")
    public ResponseEntity<BoardContentResponse> uploadBoardFrame(
            @PathVariable String lectureId,
            @RequestBody BoardFrameRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        BoardContentDto dto = multimodalIngestionService.processBoardFrame(lectureId, request, userId, role);
        return ResponseEntity.ok(new BoardContentResponse(dto));
    }

    @PostMapping("/{lectureId}/screen-frame")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Ingest presentation slide snapshot", description = "Validates, deduplicates, analyzes slides, and stores screen presentation content")
    public ResponseEntity<ScreenContentResponse> uploadScreenFrame(
            @PathVariable String lectureId,
            @RequestBody ScreenFrameRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        ScreenContentDto dto = multimodalIngestionService.processScreenFrame(lectureId, request, userId, role);
        return ResponseEntity.ok(new ScreenContentResponse(dto));
    }

    @GetMapping("/{lectureId}/board-contents")
    @Operation(summary = "Get whiteboard contents", description = "Returns chronological whiteboard snapshots, diagrams, and formulas for a lecture")
    public ResponseEntity<BoardContentsListResponse> getBoardContents(@PathVariable String lectureId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        List<BoardContentDto> list = multimodalIngestionService.getBoardContents(lectureId, userId, role);
        return ResponseEntity.ok(new BoardContentsListResponse(list));
    }

    @GetMapping("/{lectureId}/screen-contents")
    @Operation(summary = "Get screen contents", description = "Returns chronological presentation slides, diagrams, and code snippets for a lecture")
    public ResponseEntity<ScreenContentsListResponse> getScreenContents(@PathVariable String lectureId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        List<ScreenContentDto> list = multimodalIngestionService.getScreenContents(lectureId, userId, role);
        return ResponseEntity.ok(new ScreenContentsListResponse(list));
    }
}
