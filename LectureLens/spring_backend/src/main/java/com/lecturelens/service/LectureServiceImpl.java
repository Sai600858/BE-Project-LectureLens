package com.lecturelens.service;

import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.CreateLectureRequest;
import com.lecturelens.dto.LectureDto;
import com.lecturelens.dto.LectureListResponse;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import com.lecturelens.model.User;
import com.lecturelens.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LectureServiceImpl implements LectureService {

    private static final Logger log = LoggerFactory.getLogger(LectureServiceImpl.class);

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

    @Autowired
    private RecordingRepository recordingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MediaServiceCoordinator mediaServiceCoordinator;

    @Override
    @Transactional
    public LectureDto createLecture(CreateLectureRequest request, String hostUserId, String hostUserRole) {
        if (request == null) {
            throw new IllegalArgumentException("Lecture request body is required");
        }

        if (hostUserRole == null || (!hostUserRole.equalsIgnoreCase("TEACHER") && !hostUserRole.equalsIgnoreCase("ADMIN"))) {
            throw new AccessDeniedException("Forbidden: requires one of [TEACHER, ADMIN] role");
        }

        String title = request.getTitle();
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Lecture title is required");
        }

        User host = userRepository.findById(hostUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Host user not found"));

        String lectureId = "lec_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        // Generate unique 8-character uppercase room ID
        String roomId;
        do {
            roomId = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (lectureRepository.existsByRoomId(roomId));

        String passwordHash = null;
        if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
            passwordHash = passwordEncoder.encode(request.getPassword().trim());
        }

        String visibility = "PUBLIC";
        if (request.getVisibility() != null && request.getVisibility().equalsIgnoreCase("PRIVATE")) {
            visibility = "PRIVATE";
        }

        Lecture lecture = new Lecture();
        lecture.setId(lectureId);
        lecture.setRoomId(roomId);
        lecture.setTitle(title.trim());
        lecture.setDescription(request.getDescription() != null ? request.getDescription().trim() : "");
        lecture.setHost(host);
        lecture.setScheduledAt(request.getScheduledAt());
        lecture.setStatus(LectureStatus.SCHEDULED);
        lecture.setVisibility(visibility);
        lecture.setPasswordHash(passwordHash);
        lecture.setSubject(request.getSubject() != null ? request.getSubject().trim() : "");
        lecture.setCreatedAt(LocalDateTime.now());

        lectureRepository.save(lecture);
        log.info("[Lecture] Created lecture '{}' (room '{}') by host '{}'", lectureId, roomId, host.getEmail());

        // Coordinate with Node.js mediasoup service
        mediaServiceCoordinator.preInitializeRoom(roomId, lectureId);

        return LectureDto.fromEntity(lecture, 0L, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public LectureListResponse listLectures(String statusFilter, String hostIdFilter, String currentUserId, String currentUserRole) {
        List<Lecture> rawList;

        LectureStatus parsedStatus = null;
        if (statusFilter != null && !statusFilter.isBlank()) {
            try {
                parsedStatus = LectureStatus.valueOf(statusFilter.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("[Lecture] Unknown status filter '{}', returning empty list", statusFilter);
                return new LectureListResponse(Collections.emptyList());
            }
        }

        String cleanHostId = (hostIdFilter != null && !hostIdFilter.isBlank()) ? hostIdFilter.trim() : null;

        if (parsedStatus != null && cleanHostId != null) {
            rawList = lectureRepository.findByStatusAndHostIdOrderByCreatedAtDesc(parsedStatus, cleanHostId);
        } else if (parsedStatus != null) {
            rawList = lectureRepository.findByStatusOrderByCreatedAtDesc(parsedStatus);
        } else if (cleanHostId != null) {
            rawList = lectureRepository.findByHostIdOrderByCreatedAtDesc(cleanHostId);
        } else {
            rawList = lectureRepository.findAllByOrderByCreatedAtDesc();
        }

        List<LectureDto> filteredDtos = new ArrayList<>();
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);

        for (Lecture l : rawList) {
            // Data Isolation: Private lectures are visible only to host, admins, or enrolled participants
            if ("PRIVATE".equalsIgnoreCase(l.getVisibility())) {
                boolean isHost = currentUserId != null && l.getHost() != null && l.getHost().getId().equals(currentUserId);
                boolean isEnrolled = currentUserId != null && participantRepository.existsByLectureIdAndUserId(l.getId(), currentUserId);

                if (!isAdmin && !isHost && !isEnrolled) {
                    continue; // Skip disclosing private lecture to unauthorized callers
                }
            }

            long segmentCount = transcriptSegmentRepository.countByLectureId(l.getId());
            int hasRecording = recordingRepository.existsByLectureId(l.getId()) ? 1 : 0;
            filteredDtos.add(LectureDto.fromEntity(l, segmentCount, hasRecording));
        }

        return new LectureListResponse(filteredDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public LectureDto getLectureByIdOrRoomId(String identifier, String currentUserId, String currentUserRole) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found"));

        // Data Isolation check for private lectures
        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUserId == null || currentUserId.isBlank()) {
                throw new BadCredentialsException("Authentication required to access private lecture content");
            }

            boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
            boolean isHost = lecture.getHost() != null && lecture.getHost().getId().equals(currentUserId);
            boolean isEnrolled = participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUserId);

            if (!isAdmin && !isHost && !isEnrolled) {
                throw new AccessDeniedException("Access denied to private lecture content");
            }
        }

        long segmentCount = transcriptSegmentRepository.countByLectureId(lecture.getId());
        int hasRecording = recordingRepository.existsByLectureId(lecture.getId()) ? 1 : 0;
        return LectureDto.fromEntity(lecture, segmentCount, hasRecording);
    }

    @Override
    @Transactional
    public LectureDto updateStatus(String identifier, String newStatusStr, String currentUserId, String currentUserRole) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }
        if (newStatusStr == null || newStatusStr.isBlank()) {
            throw new IllegalArgumentException("Invalid status");
        }

        LectureStatus targetStatus;
        try {
            targetStatus = LectureStatus.valueOf(newStatusStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found"));

        // Authorization: only host or admin can update status
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isHost = lecture.getHost() != null && lecture.getHost().getId().equals(currentUserId);
        if (!isAdmin && !isHost) {
            throw new AccessDeniedException("Forbidden: only the lecture host or an admin can update lecture status");
        }

        // Validate lifecycle transition rules
        LectureStatus currentStatus = lecture.getStatus();
        validateStatusTransition(currentStatus, targetStatus);

        lecture.setStatus(targetStatus);
        if (targetStatus == LectureStatus.LIVE && lecture.getStartTime() == null) {
            lecture.setStartTime(LocalDateTime.now());
        } else if (targetStatus == LectureStatus.ENDED && lecture.getEndTime() == null) {
            lecture.setEndTime(LocalDateTime.now());
        }

        lectureRepository.save(lecture);
        log.info("[Lecture] Updated status of lecture '{}' from '{}' to '{}'", lecture.getId(), currentStatus, targetStatus);

        return LectureDto.fromEntity(lecture);
    }

    @Override
    @Transactional
    public Map<String, Object> endLecture(String identifier, String currentUserId, String currentUserRole) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found"));

        // Authorization: only host or admin can end this lecture
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isHost = lecture.getHost() != null && lecture.getHost().getId().equals(currentUserId);
        if (!isAdmin && !isHost) {
            throw new AccessDeniedException("Forbidden: only the lecture host or an admin can end this lecture");
        }

        // Idempotent end handling: if already ended or completed, do not fail
        if (lecture.getStatus() != LectureStatus.ENDED && lecture.getStatus() != LectureStatus.COMPLETED) {
            lecture.setStatus(LectureStatus.ENDED);
            if (lecture.getEndTime() == null) {
                lecture.setEndTime(LocalDateTime.now());
            }
            lectureRepository.save(lecture);
            log.info("[Lecture] Ended lecture '{}' (room '{}')", lecture.getId(), lecture.getRoomId());
        }

        // Notify Node.js media service to close mediasoup room and emit socket event
        mediaServiceCoordinator.closeRoom(lecture.getRoomId(), lecture.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("status", "ENDED");
        response.put("lectureId", lecture.getId());
        response.put("roomId", lecture.getRoomId());
        return response;
    }

    @Override
    @Transactional
    public void deleteLecture(String identifier, String currentUserId, String currentUserRole) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found"));

        // Authorization: only host or admin can delete this lecture
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isHost = lecture.getHost() != null && lecture.getHost().getId().equals(currentUserId);
        if (!isAdmin && !isHost) {
            throw new AccessDeniedException("Forbidden: only the lecture host or an admin can delete this lecture");
        }

        // Coordinate with Node.js media service to close room
        mediaServiceCoordinator.closeRoom(lecture.getRoomId(), lecture.getId());

        lectureRepository.delete(lecture);
        log.info("[Lecture] Deleted lecture '{}' (room '{}')", lecture.getId(), lecture.getRoomId());
    }

    @Override
    @Transactional
    public void clearAllLectures(String currentUserId, String currentUserRole) {
        if (!"ADMIN".equalsIgnoreCase(currentUserRole)) {
            throw new AccessDeniedException("Forbidden: requires one of [ADMIN] role");
        }

        lectureRepository.deleteAll();
        log.warn("[Lecture] All lectures wiped by admin '{}'", currentUserId);
    }

    private void validateStatusTransition(LectureStatus current, LectureStatus target) {
        if (current == target) {
            return; // Idempotent self-transition
        }

        boolean valid = switch (current) {
            case SCHEDULED -> target == LectureStatus.LIVE || target == LectureStatus.ENDED;
            case LIVE -> target == LectureStatus.ENDED;
            case ENDED -> target == LectureStatus.PROCESSING || target == LectureStatus.COMPLETED;
            case PROCESSING -> target == LectureStatus.COMPLETED;
            case COMPLETED -> false;
        };

        if (!valid) {
            throw new IllegalArgumentException("Invalid lifecycle transition from " + current + " to " + target);
        }
    }
}
