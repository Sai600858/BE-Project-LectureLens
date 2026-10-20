package com.lecturelens.controller;

import com.lecturelens.dto.FlashcardListResponse;
import com.lecturelens.dto.FlashcardProgressRequest;
import com.lecturelens.dto.FlashcardProgressResponse;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.service.FlashcardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "Flashcards", description = "AI Flashcards and spaced repetition study progress")
public class FlashcardController {

    @Autowired
    private FlashcardService flashcardService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String userId = auth.getName();
            return userRepository.findById(userId).orElse(null);
        }
        return null;
    }

    @GetMapping("/{lectureId}/flashcards")
    @Operation(summary = "Get or generate lecture flashcards", description = "Returns study flashcards with user's Leitner spaced repetition status.")
    public ResponseEntity<FlashcardListResponse> getFlashcards(@PathVariable String lectureId) {
        User user = getCurrentUser();
        FlashcardListResponse response = flashcardService.getOrGenerateFlashcards(lectureId, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{lectureId}/flashcards/progress")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Update flashcard study progress", description = "Records whether a flashcard is unlearned, learned, or difficult for this student.")
    public ResponseEntity<FlashcardProgressResponse> updateProgress(
            @PathVariable String lectureId,
            @RequestBody FlashcardProgressRequest request) {
        User user = getCurrentUser();
        FlashcardProgressResponse response = flashcardService.updateFlashcardProgress(lectureId, request, user);
        return ResponseEntity.ok(response);
    }
}
