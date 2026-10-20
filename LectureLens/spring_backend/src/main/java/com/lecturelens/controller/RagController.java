package com.lecturelens.controller;

import com.lecturelens.dto.AskLectureRequest;
import com.lecturelens.dto.AskLectureResponse;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.service.RagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "Ask This Lecture (RAG)", description = "Retrieval-Augmented conversational question answering grounded in multimodal lecture records")
public class RagController {

    @Autowired
    private RagService ragService;

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

    @PostMapping("/{lectureId}/ask")
    @Operation(summary = "Ask question about lecture", description = "Performs grounded multimodal retrieval and answers with timestamp citations and source evidence.")
    public ResponseEntity<AskLectureResponse> askLecture(
            @PathVariable String lectureId,
            @Valid @RequestBody AskLectureRequest request) {
        User user = getCurrentUser();
        AskLectureResponse response = ragService.askLecture(lectureId, request, user);
        return ResponseEntity.ok(response);
    }
}
