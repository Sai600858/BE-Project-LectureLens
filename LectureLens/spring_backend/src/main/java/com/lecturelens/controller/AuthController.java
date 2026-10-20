package com.lecturelens.controller;

import com.lecturelens.dto.AuthResponse;
import com.lecturelens.dto.LoginRequest;
import com.lecturelens.dto.RegisterRequest;
import com.lecturelens.dto.UserDto;
import com.lecturelens.service.AuthService;
import com.lecturelens.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "User authentication and profile management")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user account", description = "Public registration creates STUDENT accounts. ADMIN token required to create TEACHER or ADMIN.")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentUserId = null;
        String currentUserRole = null;

        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            currentUserId = authentication.getName();
            currentUserRole = authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(a -> a.startsWith("ROLE_"))
                    .map(a -> a.substring(5))
                    .findFirst()
                    .orElse(null);
        }

        AuthResponse response = authService.register(request, currentUserId, currentUserRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password", description = "Authenticates credentials and returns user profile with JWT bearer token")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile", description = "Returns profile of authenticated caller. Requires Bearer JWT token.")
    @SecurityRequirement(name = "Bearer Authentication")
    public ResponseEntity<?> getMe() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Access token required"));
        }

        String userId = authentication.getName();
        UserDto user = userService.getUserProfile(userId);
        return ResponseEntity.ok(Map.of("user", user));
    }
}
