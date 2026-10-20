package com.lecturelens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.ai.AiProviderOrchestrator;
import com.lecturelens.ai.AiSummaryResult;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.SummaryDto;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.Summary;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import com.lecturelens.repository.SummaryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AiSummaryServiceImpl implements AiSummaryService {

    private static final Logger log = LoggerFactory.getLogger(AiSummaryServiceImpl.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private AiContextAssemblyService contextAssemblyService;

    @Autowired
    private AiProviderOrchestrator aiProviderOrchestrator;

    @Autowired
    private SalkgGuardService salkgGuardService;

    @Autowired
    private MediaServiceCoordinator mediaServiceCoordinator;

    private Lecture checkAccess(String identifier, String currentUserId, String currentUserRole, boolean isWrite) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isHost = currentUserId != null && lecture.getHost() != null && currentUserId.equals(lecture.getHost().getId());
        boolean isEnrolled = currentUserId != null && participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUserId);

        // Data Isolation check for private lectures
        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUserId == null || currentUserId.isBlank()) {
                throw new BadCredentialsException("Authentication required to access private lecture content");
            }
            if (!isAdmin && !isHost && !isEnrolled) {
                throw new AccessDeniedException("Access denied to private lecture content");
            }
        }

        // Generation write operation check: must be Host, Teacher, or Admin
        if (isWrite) {
            boolean isTeacher = "TEACHER".equalsIgnoreCase(currentUserRole);
            if (!isAdmin && !isHost && !isTeacher && !isEnrolled) {
                throw new AccessDeniedException("Access denied: only teachers, admins, hosts, or enrolled members can generate summaries");
            }
        }

        return lecture;
    }

    @Override
    @Transactional
    public SummaryDto getSummary(String lectureIdentifier, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, false);
        String resolvedId = lecture.getId();

        Optional<Summary> summaryOpt = summaryRepository.findByLectureId(resolvedId);
        if (summaryOpt.isPresent()) {
            return SummaryDto.fromEntity(summaryOpt.get(), null);
        }

        return generateSummary(lectureIdentifier, false, currentUserId, currentUserRole);
    }

    @Override
    @Transactional
    public SummaryDto generateSummary(String lectureIdentifier, boolean forceRegenerate, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, forceRegenerate);
        String resolvedId = lecture.getId();

        // Check if summary already exists and forceRegenerate is false
        if (!forceRegenerate) {
            Optional<Summary> existing = summaryRepository.findByLectureId(resolvedId);
            if (existing.isPresent()) {
                log.info("[AiSummary] Returning existing summary for lecture '{}' without re-generating", resolvedId);
                return SummaryDto.fromEntity(existing.get(), null);
            }
        }

        // 1. Assemble bounded, verified context with source sufficiency validation
        AiLectureContext context = contextAssemblyService.assembleContext(resolvedId);

        // 2. Execute generation through orchestrator (Gemini -> fallback)
        AiSummaryResult result = aiProviderOrchestrator.executeSummaryGeneration(context);

        // 3. Find existing summary or initialize new entity (safe upsert for unique lecture_id constraint)
        Summary entity = summaryRepository.findByLectureId(resolvedId).orElseGet(() -> {
            Summary s = new Summary();
            s.setId("sum_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            s.setLectureId(resolvedId);
            return s;
        });
        entity.setShortSummary(result.getShortSummary());
        entity.setDetailedSummary(result.getDetailedSummary());

        try {
            entity.setKeyConceptsJson(MAPPER.writeValueAsString(result.getKeyConcepts()));
            entity.setDefinitionsJson(MAPPER.writeValueAsString(result.getDefinitions()));
            entity.setExamplesJson(MAPPER.writeValueAsString(result.getExamples()));
            entity.setKeyTakeawaysJson(MAPPER.writeValueAsString(result.getKeyTakeaways()));
            entity.setTopicsCoveredJson(MAPPER.writeValueAsString(result.getTopicsCovered()));
        } catch (Exception ex) {
            log.warn("[AiSummary] Error serializing summary JSON arrays: {}", ex.getMessage());
        }

        entity.setCreatedAt(LocalDateTime.now());
        Summary saved = summaryRepository.save(entity);
        String summaryId = saved.getId();
        log.info("[AiSummary] Persisted summary '{}' for lecture '{}' via provider '{}'", summaryId, resolvedId, result.getProviderName());

        // Notify connected room participants via Node.js Socket.IO
        mediaServiceCoordinator.notifySummaryGenerated(lecture.getRoomId(), resolvedId, Map.of("id", summaryId, "lectureId", resolvedId));

        // 5. Trigger non-blocking SALKG-Guard validation hook
        Map<String, Object> validationReport = salkgGuardService.validateContent(
                resolvedId,
                "summary",
                result.getShortSummary() + "\n\n" + result.getDetailedSummary(),
                context.getDomain()
        );

        return SummaryDto.fromEntity(saved, validationReport);
    }
}
