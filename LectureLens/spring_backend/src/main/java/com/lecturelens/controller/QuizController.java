package com.lecturelens.controller;

import com.lecturelens.dto.QuizAttemptResponse;
import com.lecturelens.dto.QuizResponse;
import com.lecturelens.dto.QuizSubmissionRequest;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.service.QuizService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lectures")
@Tag(name = "Quizzes", description = "AI Quiz generation, answer evaluation, and scoring")
public class QuizController {

    @Autowired
    private QuizService quizService;

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

    @GetMapping("/{lectureId}/quiz")
    @Operation(summary = "Get or generate lecture quiz", description = "Retrieves existing quiz or generates a new one. Enforces answer confidentiality for students.")
    public ResponseEntity<QuizResponse> getQuiz(@PathVariable String lectureId) {
        User user = getCurrentUser();
        QuizResponse response = quizService.getOrGenerateQuiz(lectureId, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{lectureId}/quiz")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Regenerate lecture quiz", description = "Deletes existing quiz and creates fresh assessment. Teachers & Admins only.")
    public ResponseEntity<QuizResponse> regenerateQuiz(@PathVariable String lectureId) {
        User user = getCurrentUser();
        QuizResponse response = quizService.regenerateQuiz(lectureId, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{lectureId}/quiz/submit")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Submit quiz attempt", description = "Evaluates answers server-side, calculates score, and identifies weak topics.")
    public ResponseEntity<QuizAttemptResponse> submitQuiz(
            @PathVariable String lectureId,
            @RequestBody QuizSubmissionRequest request) {
        User user = getCurrentUser();
        QuizAttemptResponse response = quizService.submitQuiz(lectureId, request, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{lectureId}/quiz/attempts")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Get quiz attempts", description = "Returns student's attempts, or all lecture attempts for teacher/admin.")
    public ResponseEntity<List<QuizAttemptResponse>> getAttempts(@PathVariable String lectureId) {
        User user = getCurrentUser();
        List<QuizAttemptResponse> response = quizService.getQuizAttempts(lectureId, user);
        return ResponseEntity.ok(response);
    }
}
