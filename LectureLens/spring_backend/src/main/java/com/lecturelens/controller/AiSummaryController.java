package com.lecturelens.controller;

import com.lecturelens.dto.SummaryDto;
import com.lecturelens.dto.SummaryResponse;
import com.lecturelens.service.AiSummaryService;
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
@RequestMapping("/api/lectures")
@Tag(name = "AI Summaries", description = "AI-powered multimodal lecture summaries and key concepts")
public class AiSummaryController {

    @Autowired
    private AiSummaryService aiSummaryService;

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

    @PostMapping("/{lectureId}/summary")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Generate AI summary", description = "Generates a structured executive summary from lecture transcripts and multimodal artifacts")
    public ResponseEntity<SummaryResponse> generateSummary(
            @PathVariable String lectureId,
            @RequestParam(required = false, defaultValue = "true") boolean forceRegenerate) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        SummaryDto dto = aiSummaryService.generateSummary(lectureId, forceRegenerate, userId, role);
        return ResponseEntity.ok(new SummaryResponse(dto));
    }

    @GetMapping("/{lectureId}/summary")
    @Operation(summary = "Get AI summary", description = "Retrieves previously generated AI summary without triggering regeneration")
    public ResponseEntity<SummaryResponse> getSummary(@PathVariable String lectureId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        SummaryDto dto = aiSummaryService.getSummary(lectureId, userId, role);
        return ResponseEntity.ok(new SummaryResponse(dto));
    }
}
