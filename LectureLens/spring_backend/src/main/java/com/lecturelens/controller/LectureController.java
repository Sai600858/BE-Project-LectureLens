package com.lecturelens.controller;

import com.lecturelens.dto.*;
import com.lecturelens.service.LectureService;
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
@RequestMapping("/api/lectures")
@Tag(name = "Lectures", description = "Lecture session management, room allocation, and lifecycle control")
public class LectureController {

    @Autowired
    private LectureService lectureService;

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

    @PostMapping
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Create a lecture session", description = "Allocates a unique room code and initializes mediasoup. Teachers & Admins only.")
    public ResponseEntity<LectureResponse> createLecture(@RequestBody CreateLectureRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        LectureDto dto = lectureService.createLecture(request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(new LectureResponse(dto));
    }

    @GetMapping
    @Operation(summary = "List lectures", description = "Returns active, scheduled, or past lectures with optional filters by status and host")
    public ResponseEntity<LectureListResponse> listLectures(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String hostId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        LectureListResponse response = lectureService.listLectures(status, hostId, userId, role);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get lecture details", description = "Retrieves lecture by database ID or 8-character Room Code")
    public ResponseEntity<LectureResponse> getLectureById(@PathVariable String id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        LectureDto dto = lectureService.getLectureByIdOrRoomId(id, userId, role);
        return ResponseEntity.ok(new LectureResponse(dto));
    }

    @PutMapping("/{id}/status")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Update lecture lifecycle status (PUT)", description = "Transitions lecture through SCHEDULED -> LIVE -> ENDED -> PROCESSING -> COMPLETED. Host/Admin only.")
    public ResponseEntity<?> updateStatusPut(
            @PathVariable String id,
            @RequestBody UpdateLectureStatusRequest request) {
        return handleStatusUpdate(id, request);
    }

    @PatchMapping("/{id}/status")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Update lecture lifecycle status (PATCH)", description = "Transitions lecture through lifecycle states. Host/Admin only.")
    public ResponseEntity<?> updateStatusPatch(
            @PathVariable String id,
            @RequestBody UpdateLectureStatusRequest request) {
        return handleStatusUpdate(id, request);
    }

    private ResponseEntity<?> handleStatusUpdate(String id, UpdateLectureStatusRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        String statusVal = request != null ? request.getStatus() : null;
        LectureDto updated = lectureService.updateStatus(id, statusVal, userId, role);
        return ResponseEntity.ok(Map.of("success", true, "status", updated.getStatus()));
    }

    @PostMapping("/{id}/end")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "End lecture session", description = "Transitions lecture to ENDED and coordinates room cleanup with Node.js mediasoup. Host/Admin only.")
    public ResponseEntity<?> endLecture(@PathVariable String id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        Map<String, Object> result = lectureService.endLecture(id, userId, role);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Delete lecture session", description = "Cascades deletion across lecture artifacts and cleans up room in media service. Host/Admin only.")
    public ResponseEntity<?> deleteLecture(@PathVariable String id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        lectureService.deleteLecture(id, userId, role);
        return ResponseEntity.ok(Map.of("success", true, "message", "Lecture deleted successfully."));
    }

    @DeleteMapping
    @SecurityRequirement(name = "Bearer Authentication")
    @Operation(summary = "Clear all lecture history", description = "Wipes all lecture sessions and artifacts. Administrator only.")
    public ResponseEntity<?> clearAllLectures() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = getCurrentUserId(auth);
        String role = getCurrentUserRole(auth);

        lectureService.clearAllLectures(userId, role);
        return ResponseEntity.ok(Map.of("success", true, "message", "All lecture history cleared successfully."));
    }
}
