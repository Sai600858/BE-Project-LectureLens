package com.lecturelens.controller;

import com.lecturelens.dto.ChapterDto;
import com.lecturelens.dto.ChapterListResponse;
import com.lecturelens.dto.ChapterResponse;
import com.lecturelens.dto.ChapterUpdateRequest;
import com.lecturelens.service.ChapterService;
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
@Tag(name = "Lecture Chapters", description = "AI-powered chronological chapter segmentation and timeline boundaries")
public class ChapterController {

    @Autowired
    private ChapterService chapterService;

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

    @GetMapping("/{lectureId}/chapters")
    @Operation(summary = "Get lecture chapters", description = "Retrieves chronological chapters and timeline boundaries without triggering regeneration")
    public ResponseEntity<ChapterListResponse> getChapters(@PathVariable String lectureId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        List<ChapterDto> list = chapterService.getChapters(lectureId, userId, role);
        return ResponseEntity.ok(new ChapterListResponse(list));
    }

    @PostMapping("/{lectureId}/chapters")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Generate lecture chapters", description = "Generates chronological chapter boundaries from lecture transcript and multimodal evidence")
    public ResponseEntity<ChapterListResponse> generateChapters(
            @PathVariable String lectureId,
            @RequestParam(required = false, defaultValue = "true") boolean forceRegenerate) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        List<ChapterDto> list = chapterService.generateChapters(lectureId, forceRegenerate, userId, role);
        return ResponseEntity.ok(new ChapterListResponse(list));
    }

    @PutMapping("/{lectureId}/chapters/{chapterId}")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Update lecture chapter", description = "Modifies title, timestamps, or summary of an existing chapter")
    public ResponseEntity<ChapterResponse> updateChapter(
            @PathVariable String lectureId,
            @PathVariable String chapterId,
            @RequestBody ChapterUpdateRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        ChapterDto updated = chapterService.updateChapter(lectureId, chapterId, request, userId, role);
        return ResponseEntity.ok(new ChapterResponse(updated));
    }
}
