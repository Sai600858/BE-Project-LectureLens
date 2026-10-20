package com.lecturelens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.ai.AiProviderOrchestrator;
import com.lecturelens.ai.AiStudyNotesResult;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.StudyNotesDto;
import com.lecturelens.dto.StudySectionDto;
import com.lecturelens.dto.VisualizationDto;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.StudyNote;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import com.lecturelens.repository.StudyNoteRepository;
import com.lecturelens.security.SvgSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class StudyNotesServiceImpl implements StudyNotesService {

    private static final Logger log = LoggerFactory.getLogger(StudyNotesServiceImpl.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private StudyNoteRepository studyNoteRepository;

    @Autowired
    private AiContextAssemblyService contextAssemblyService;

    @Autowired
    private AiProviderOrchestrator aiProviderOrchestrator;

    @Autowired
    private DiagramSvgService diagramSvgService;

    @Autowired
    private SvgSanitizer svgSanitizer;

    @Autowired
    private SalkgGuardService salkgGuardService;

    @Autowired
    private MediaServiceCoordinator mediaServiceCoordinator;

    private static final Set<String> VALID_MODES = Set.of("short", "detailed", "exam", "beginner");

    private String normalizeMode(String mode) {
        if (mode == null || mode.isBlank()) return "detailed";
        String clean = mode.trim().toLowerCase();
        if (!VALID_MODES.contains(clean)) {
            throw new IllegalArgumentException("Invalid study note mode: " + mode + ". Must be one of [short, detailed, exam, beginner]");
        }
        return clean;
    }

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

        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUserId == null || currentUserId.isBlank()) {
                throw new BadCredentialsException("Authentication required to access private lecture content");
            }
            if (!isAdmin && !isHost && !isEnrolled) {
                throw new AccessDeniedException("Access denied to private lecture content");
            }
        }

        if (isWrite) {
            boolean isTeacher = "TEACHER".equalsIgnoreCase(currentUserRole);
            if (!isAdmin && !isHost && !isTeacher && !isEnrolled) {
                throw new AccessDeniedException("Access denied: only teachers, admins, hosts, or enrolled members can generate or edit notes");
            }
        }

        return lecture;
    }

    @Override
    @Transactional
    public StudyNotesDto getStudyNotes(String lectureIdentifier, String mode, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, false);
        String resolvedId = lecture.getId();
        String safeMode = normalizeMode(mode);

        Optional<StudyNote> noteOpt = studyNoteRepository.findByLectureIdAndMode(resolvedId, safeMode);
        if (noteOpt.isPresent()) {
            return StudyNotesDto.fromEntity(noteOpt.get(), null);
        }

        return generateStudyNotes(lectureIdentifier, safeMode, false, currentUserId, currentUserRole);
    }

    @Override
    @Transactional
    public StudyNotesDto generateStudyNotes(String lectureIdentifier, String mode, boolean forceRegenerate, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, forceRegenerate);
        String resolvedId = lecture.getId();
        String safeMode = normalizeMode(mode);

        if (!forceRegenerate) {
            Optional<StudyNote> existing = studyNoteRepository.findByLectureIdAndMode(resolvedId, safeMode);
            if (existing.isPresent()) {
                log.info("[StudyNotes] Returning existing notes for lecture '{}' mode '{}' without re-generating", resolvedId, safeMode);
                return StudyNotesDto.fromEntity(existing.get(), null);
            }
        }

        // 1. Assemble context
        AiLectureContext context = contextAssemblyService.assembleContext(resolvedId);

        // 2. Generate through orchestrator
        AiStudyNotesResult result = aiProviderOrchestrator.executeStudyNotesGeneration(context, safeMode);

        // 3. Render and sanitize SVGs for each visualization
        List<VisualizationDto> visualizations = new ArrayList<>();
        if (result.getSections() != null) {
            for (int i = 0; i < result.getSections().size(); i++) {
                StudySectionDto sec = result.getSections().get(i);
                if (sec.getVisualization() != null && Boolean.TRUE.equals(sec.getVisualization().getRequired())) {
                    VisualizationDto viz = sec.getVisualization();
                    if (viz.getId() == null) viz.setId("viz_" + (i + 1));
                    if (viz.getSectionHeading() == null) viz.setSectionHeading(sec.getHeading());

                    // Generate SVG if not already rendered
                    if (viz.getSvg() == null || viz.getSvg().isBlank()) {
                        String svg = diagramSvgService.generateSvg(
                                viz.getType(),
                                viz.getTitle() != null ? viz.getTitle() : sec.getHeading(),
                                viz.getCaption(),
                                viz.getSpec()
                        );
                        viz.setSvg(svg);
                    } else {
                        viz.setSvg(svgSanitizer.sanitizeSvg(viz.getSvg()));
                    }

                    visualizations.add(viz);
                }
            }
        }

        // Sanitize markdown content
        String sanitizedMarkdown = svgSanitizer.sanitizeMarkdown(result.getMarkdown());

        // 4. Safely upsert note entity for this mode to prevent unique constraint collision
        StudyNote note = studyNoteRepository.findByLectureIdAndMode(resolvedId, safeMode).orElseGet(() -> {
            StudyNote n = new StudyNote();
            n.setId("notes_" + safeMode + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            n.setLectureId(resolvedId);
            n.setMode(safeMode);
            return n;
        });
        note.setTitle(result.getTitle() != null ? result.getTitle() : (context.getLectureTitle() + " — " + safeMode.toUpperCase() + " Notes"));
        note.setContentMarkdown(sanitizedMarkdown);

        try {
            note.setFormulasJson(MAPPER.writeValueAsString(result.getFormulas() != null ? result.getFormulas() : Collections.emptyList()));
            note.setDiagramsJson(MAPPER.writeValueAsString(result.getDiagrams() != null ? result.getDiagrams() : Collections.emptyList()));
            note.setQuestionsJson(MAPPER.writeValueAsString(result.getQuestions() != null ? result.getQuestions() : Collections.emptyList()));
            note.setSectionsJson(MAPPER.writeValueAsString(result.getSections() != null ? result.getSections() : Collections.emptyList()));
            note.setVisualizationsJson(MAPPER.writeValueAsString(visualizations));
        } catch (Exception ex) {
            log.warn("[StudyNotes] Error serializing JSON note columns: {}", ex.getMessage());
        }

        note.setCreatedAt(LocalDateTime.now());
        StudyNote saved = studyNoteRepository.save(note);
        String noteId = saved.getId();
        log.info("[StudyNotes] Persisted study note '{}' for lecture '{}' mode '{}'", noteId, resolvedId, safeMode);

        // Notify connected room participants via Node.js Socket.IO
        mediaServiceCoordinator.notifyNotesGenerated(lecture.getRoomId(), resolvedId, Map.of("id", noteId, "lectureId", resolvedId, "mode", safeMode));

        // 6. Validation hook
        Map<String, Object> validationReport = salkgGuardService.validateContent(
                resolvedId,
                "study_notes",
                sanitizedMarkdown,
                context.getDomain()
        );

        return StudyNotesDto.fromEntity(saved, validationReport);
    }

    @Override
    @Transactional
    public StudyNotesDto updateStudyNotes(String lectureIdentifier, String mode, String updatedMarkdown, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, true);
        String resolvedId = lecture.getId();
        String safeMode = normalizeMode(mode);

        StudyNote note = studyNoteRepository.findByLectureIdAndMode(resolvedId, safeMode)
                .orElseThrow(() -> new ResourceNotFoundException("Study note not found to update for lecture: " + resolvedId + " mode: " + safeMode));

        if (updatedMarkdown == null || updatedMarkdown.isBlank()) {
            throw new IllegalArgumentException("Markdown content is required for updating study notes");
        }

        String sanitized = svgSanitizer.sanitizeMarkdown(updatedMarkdown);
        note.setContentMarkdown(sanitized);
        StudyNote saved = studyNoteRepository.save(note);
        log.info("[StudyNotes] Updated markdown content for note '{}' (lecture '{}')", note.getId(), resolvedId);

        return StudyNotesDto.fromEntity(saved, null);
    }
}
