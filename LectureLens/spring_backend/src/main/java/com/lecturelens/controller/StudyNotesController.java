package com.lecturelens.controller;

import com.lecturelens.dto.GenerateStudyNotesRequest;
import com.lecturelens.dto.StudyNotesDto;
import com.lecturelens.dto.StudyNotesResponse;
import com.lecturelens.service.StudyNotesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "Study Notes", description = "4-mode structured study notes with inline educational diagrams and formulas")
public class StudyNotesController {

    @Autowired
    private StudyNotesService studyNotesService;

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

    @PostMapping({ "/{lectureId}/notes", "/{lectureId}/study-notes" })
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Generate structured study notes", description = "Generates academic study notes for a specific mode (short, detailed, exam, beginner) with inline diagrams")
    public ResponseEntity<StudyNotesResponse> generateStudyNotes(
            @PathVariable String lectureId,
            @RequestBody(required = false) GenerateStudyNotesRequest request,
            @RequestParam(required = false, defaultValue = "true") boolean forceRegenerate) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        String mode = (request != null && request.getMode() != null) ? request.getMode() : "detailed";
        StudyNotesDto dto = studyNotesService.generateStudyNotes(lectureId, mode, forceRegenerate, userId, role);
        return ResponseEntity.ok(new StudyNotesResponse(dto));
    }

    @GetMapping({ "/{lectureId}/notes", "/{lectureId}/study-notes" })
    @Operation(summary = "Get study notes", description = "Retrieves previously generated structured study notes for a specified mode without triggering regeneration")
    public ResponseEntity<StudyNotesResponse> getStudyNotes(
            @PathVariable String lectureId,
            @RequestParam(required = false, defaultValue = "detailed") String mode) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        StudyNotesDto dto = studyNotesService.getStudyNotes(lectureId, mode, userId, role);
        return ResponseEntity.ok(new StudyNotesResponse(dto));
    }

    @PutMapping({ "/{lectureId}/notes", "/{lectureId}/study-notes" })
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Update study notes markdown", description = "Edits and persists modified study notes markdown while enforcing sanitization")
    public ResponseEntity<StudyNotesResponse> updateStudyNotes(
            @PathVariable String lectureId,
            @RequestParam(required = false, defaultValue = "detailed") String mode,
            @RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        String markdown = body.getOrDefault("contentMarkdown", body.getOrDefault("markdown", ""));
        StudyNotesDto dto = studyNotesService.updateStudyNotes(lectureId, mode, markdown, userId, role);
        return ResponseEntity.ok(new StudyNotesResponse(dto));
    }
}
