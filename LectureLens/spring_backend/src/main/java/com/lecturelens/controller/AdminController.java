package com.lecturelens.controller;

import com.lecturelens.dto.AdminStatsResponse;
import com.lecturelens.dto.UserListResponse;
import com.lecturelens.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administration", description = "Administrative user management and platform statistics")
@SecurityRequirement(name = "Bearer Authentication")
public class AdminController {

    @Autowired
    private UserService userService;

    @GetMapping("/users")
    @Operation(summary = "List all platform users", description = "Returns users without password hashes, ordered by creation date descending. Admin only.")
    public ResponseEntity<UserListResponse> listUsers() {
        UserListResponse response = userService.listAllUsers();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/users/{userId}")
    @Operation(summary = "Delete user account", description = "Removes user account. Prevents self-deletion and deletion of last admin. Admin only.")
    public ResponseEntity<?> deleteUser(@PathVariable String userId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentAdminId = authentication != null ? authentication.getName() : null;

        userService.deleteUser(userId, currentAdminId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/stats")
    @Operation(summary = "Get platform metrics", description = "Returns system counts for users, lectures, recordings, and active rooms. Admin only.")
    public ResponseEntity<AdminStatsResponse> getStats() {
        AdminStatsResponse stats = userService.getAdminStats();
        return ResponseEntity.ok(stats);
    }
}
