package com.lecturelens.service;

import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.ai.AiProviderOrchestrator;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.ChapterDto;
import com.lecturelens.dto.ChapterUpdateRequest;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureChapter;
import com.lecturelens.repository.LectureChapterRepository;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChapterServiceImpl implements ChapterService {

    private static final Logger log = LoggerFactory.getLogger(ChapterServiceImpl.class);

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private LectureChapterRepository lectureChapterRepository;

    @Autowired
    private AiContextAssemblyService contextAssemblyService;

    @Autowired
    private AiProviderOrchestrator aiProviderOrchestrator;

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
                throw new AccessDeniedException("Access denied: only teachers, admins, hosts, or enrolled members can generate or edit chapters");
            }
        }

        return lecture;
    }

    @Override
    @Transactional
    public List<ChapterDto> getChapters(String lectureIdentifier, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, false);
        String resolvedId = lecture.getId();

        List<LectureChapter> entities = lectureChapterRepository.findByLectureIdOrderByStartTimeAsc(resolvedId);
        if (entities.isEmpty()) {
            return generateChapters(lectureIdentifier, false, currentUserId, currentUserRole);
        }
        return entities.stream().map(ChapterDto::fromEntity).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<ChapterDto> generateChapters(String lectureIdentifier, boolean forceRegenerate, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, forceRegenerate);
        String resolvedId = lecture.getId();

        if (!forceRegenerate) {
            List<LectureChapter> existing = lectureChapterRepository.findByLectureIdOrderByStartTimeAsc(resolvedId);
            if (!existing.isEmpty()) {
                log.info("[Chapters] Returning {} existing chapter(s) for lecture '{}' without re-generating", existing.size(), resolvedId);
                return existing.stream().map(ChapterDto::fromEntity).collect(Collectors.toList());
            }
        }

        // 1. Assemble context
        AiLectureContext context = contextAssemblyService.assembleContext(resolvedId);

        // 2. Generate raw chapters via orchestrator
        List<ChapterDto> rawChapters = aiProviderOrchestrator.executeChaptersGeneration(context);
        if (rawChapters == null || rawChapters.isEmpty()) {
            throw new IllegalStateException("AI model failed to generate chapters from lecture context");
        }

        // 3. Chronological sorting, validation, and boundary enforcement
        rawChapters.sort(Comparator.comparingDouble(c -> c.getStartTime() != null ? c.getStartTime() : 0.0));

        List<LectureChapter> toSave = new ArrayList<>();
        double previousEnd = 0.0;

        for (int i = 0; i < rawChapters.size(); i++) {
            ChapterDto raw = rawChapters.get(i);
            double start = raw.getStartTime() != null ? Math.max(0.0, raw.getStartTime()) : previousEnd;

            // Enforce non-decreasing chronological order
            if (start < previousEnd) {
                start = previousEnd;
            }

            Double end = raw.getEndTime();
            if (end == null || end <= start) {
                if (i < rawChapters.size() - 1 && rawChapters.get(i + 1).getStartTime() != null) {
                    end = Math.max(start + 1.0, rawChapters.get(i + 1).getStartTime());
                } else {
                    end = start + 120.0; // 2 minutes default window
                }
            }

            previousEnd = end;

            String chapterId = "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            LectureChapter entity = new LectureChapter();
            entity.setId(chapterId);
            entity.setLecture(lecture);
            entity.setTitle(raw.getTitle() != null && !raw.getTitle().isBlank() ? raw.getTitle().trim() : ("Chapter " + (i + 1)));
            entity.setStartTime(start);
            entity.setEndTime(end);
            entity.setSummary(raw.getSummary() != null ? raw.getSummary().trim() : "");
            entity.setCreatedAt(LocalDateTime.now());

            toSave.add(entity);
        }

        // 4. Safe idempotent replacement
        lectureChapterRepository.deleteByLectureId(resolvedId);
        lectureChapterRepository.flush();
        List<LectureChapter> saved = lectureChapterRepository.saveAll(toSave);
        log.info("[Chapters] Saved {} validated chapters for lecture '{}'", saved.size(), resolvedId);

        List<ChapterDto> dtoList = saved.stream().map(ChapterDto::fromEntity).collect(Collectors.toList());
        mediaServiceCoordinator.notifyChaptersGenerated(lecture.getRoomId(), resolvedId, dtoList);

        return dtoList;
    }

    @Override
    @Transactional
    public ChapterDto updateChapter(String lectureIdentifier, String chapterId, ChapterUpdateRequest request, String currentUserId, String currentUserRole) {
        Lecture lecture = checkAccess(lectureIdentifier, currentUserId, currentUserRole, true);
        String resolvedId = lecture.getId();

        LectureChapter chapter = lectureChapterRepository.findById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter not found: " + chapterId));

        if (!chapter.getLecture().getId().equals(resolvedId)) {
            throw new AccessDeniedException("Chapter does not belong to the specified lecture");
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            chapter.setTitle(request.getTitle().trim());
        }
        if (request.getStartTime() != null) {
            if (request.getStartTime() < 0) {
                throw new IllegalArgumentException("Start time must be non-negative");
            }
            chapter.setStartTime(request.getStartTime());
        }
        if (request.getEndTime() != null) {
            if (request.getEndTime() <= chapter.getStartTime()) {
                throw new IllegalArgumentException("End time must be strictly greater than start time");
            }
            chapter.setEndTime(request.getEndTime());
        }
        if (request.getSummary() != null) {
            chapter.setSummary(request.getSummary().trim());
        }

        LectureChapter updated = lectureChapterRepository.save(chapter);
        log.info("[Chapters] Updated chapter '{}' for lecture '{}'", chapterId, resolvedId);
        return ChapterDto.fromEntity(updated);
    }

    @Override
    public List<ChapterDto> validateAndOrderChapters(List<ChapterDto> rawChapters, Double lectureDuration) {
        if (rawChapters == null || rawChapters.isEmpty()) {
            return Collections.emptyList();
        }

        List<ChapterDto> sorted = new ArrayList<>(rawChapters);
        sorted.sort(Comparator.comparingDouble(c -> c.getStartTime() != null ? c.getStartTime() : 0.0));

        List<ChapterDto> result = new ArrayList<>();
        double previousEnd = 0.0;

        for (int i = 0; i < sorted.size(); i++) {
            ChapterDto c = sorted.get(i);
            double start = c.getStartTime() != null ? Math.max(0.0, c.getStartTime()) : previousEnd;
            if (start < previousEnd) {
                start = previousEnd;
            }

            Double end = c.getEndTime();
            if (end == null || end <= start) {
                if (i < sorted.size() - 1 && sorted.get(i + 1).getStartTime() != null) {
                    end = Math.max(start + 1.0, sorted.get(i + 1).getStartTime());
                } else if (lectureDuration != null && lectureDuration > start) {
                    end = lectureDuration;
                } else {
                    end = start + 60.0;
                }
            }

            if (lectureDuration != null && end > lectureDuration) {
                end = lectureDuration;
            }

            previousEnd = end;

            ChapterDto validated = new ChapterDto();
            validated.setId(c.getId());
            validated.setLectureId(c.getLectureId());
            validated.setTitle(c.getTitle());
            validated.setStartTime(start);
            validated.setEndTime(end);
            validated.setSummary(c.getSummary());
            result.add(validated);
        }

        return result;
    }
}
