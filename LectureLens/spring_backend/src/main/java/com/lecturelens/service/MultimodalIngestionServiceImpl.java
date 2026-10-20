package com.lecturelens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.*;
import com.lecturelens.model.*;
import com.lecturelens.repository.*;
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
public class MultimodalIngestionServiceImpl implements MultimodalIngestionService {

    private static final Logger log = LoggerFactory.getLogger(MultimodalIngestionServiceImpl.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private BoardContentRepository boardContentRepository;

    @Autowired
    private ScreenContentRepository screenContentRepository;

    @Autowired
    private MultimodalEventRepository multimodalEventRepository;

    @Autowired
    private ImageStorageService imageStorageService;

    @Autowired
    private VisionWorkerClient visionWorkerClient;

    @Autowired
    private MediaServiceCoordinator mediaServiceCoordinator;

    private Lecture checkLectureAccess(String identifier, String currentUserId, String currentUserRole, boolean isWriteOperation) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = identifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUserRole);
        boolean isHost = currentUserId != null && lecture.getHost() != null && currentUserId.equals(lecture.getHost().getId());
        boolean isEnrolled = currentUserId != null && participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUserId);

        // Visibility & access check
        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUserId == null || currentUserId.isBlank()) {
                throw new BadCredentialsException("Authentication required to access private lecture content");
            }
            if (!isAdmin && !isHost && !isEnrolled) {
                throw new AccessDeniedException("Access denied to private lecture content");
            }
        }

        // Ingestion write role check
        if (isWriteOperation) {
            if (currentUserId != null && !isAdmin && !isHost && !isEnrolled) {
                throw new AccessDeniedException("Forbidden: Only host, administrator, or enrolled participants can ingest lecture content");
            }
            // Confirm lecture is in a state permitting ingestion
            if (lecture.getStatus() == LectureStatus.ENDED && !isAdmin && !isHost) {
                throw new IllegalStateException("Cannot ingest new frames into an ended lecture");
            }
        }

        return lecture;
    }

    @Override
    @Transactional
    public BoardContentDto processBoardFrame(String lectureIdentifier, BoardFrameRequest request, String currentUserId, String currentUserRole) {
        if (request == null) {
            throw new IllegalArgumentException("Board frame request body is required");
        }

        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, true);
        double timestamp = request.getTimestamp() != null ? Math.max(0.0, request.getTimestamp()) : 0.0;

        // 1. Validate and safely store image to disk
        ImageStorageService.StoredImage stored = imageStorageService.validateAndStore("board", request.getImageBase64());

        // 2. OCR / Vision Analysis via worker with fallback
        VisionAnalysisDto analysis = visionWorkerClient.analyzeFrame("board", lecture.getId(), stored.getCleanBase64(), timestamp, stored.getImagePath());

        // 3. Deduplication Check against existing snapshots for this lecture
        Optional<BoardContent> duplicateOpt = boardContentRepository.findByLectureIdAndImageHash(lecture.getId(), stored.getImageHash());

        String equationsJson = writeJson(analysis.getEquations() != null ? analysis.getEquations() : List.of());
        String diagramJson = writeJson(analysis.getDiagram() != null ? analysis.getDiagram() : Map.of());
        String keyPointsJson = writeJson(analysis.getKeyPoints() != null ? analysis.getKeyPoints() : List.of());
        String conceptDiagramJson = writeJson(analysis.getConceptDiagram() != null ? analysis.getConceptDiagram() : Map.of());
        String structuredContentJson = writeJson(analysis.getStructuredContent() != null ? analysis.getStructuredContent() : List.of());

        if (duplicateOpt.isPresent()) {
            BoardContent existing = duplicateOpt.get();
            int existingScore = existing.getQualityScore() != null ? existing.getQualityScore() : 0;
            int newScore = analysis.getQualityScore() != null ? analysis.getQualityScore() : 0;

            if (newScore >= existingScore) {
                // Upgrade existing record with higher quality analysis
                existing.setTimestamp(timestamp);
                existing.setImagePath(stored.getImagePath());
                existing.setExtractedText(analysis.getExtractedText());
                existing.setEquation(analysis.getEquation());
                existing.setDiagramDescription(analysis.getDiagramDescription());
                existing.setEquationsJson(equationsJson);
                existing.setDiagramJson(diagramJson);
                existing.setKeyPointsJson(keyPointsJson);
                existing.setConceptDiagramJson(conceptDiagramJson);
                existing.setMainConcept(analysis.getMainConcept());
                existing.setStructuredContentJson(structuredContentJson);
                existing.setQualityScore(newScore);

                BoardContent saved = boardContentRepository.save(existing);
                BoardContentDto dto = BoardContentDto.fromEntity(saved);
                dto.setIsDuplicate(true);
                dto.setIsUpdate(true);
                dto.setReplacedId(existing.getId());
                dto.setMessage("Upgraded existing snapshot with higher clarity & formulas");

                mediaServiceCoordinator.notifyBoardFrameAdded(lecture.getRoomId(), lecture.getId(), dto);
                return dto;
            } else {
                // Preserve existing higher-quality snapshot
                BoardContentDto dto = BoardContentDto.fromEntity(existing);
                dto.setIsDuplicate(true);
                dto.setIsUpdate(false);
                dto.setKeptExistingId(existing.getId());
                dto.setMessage("Preserved existing snapshot with higher educational clarity");
                return dto;
            }
        }

        // 4. Distinct Snapshot: Persist BoardContent
        BoardContent boardContent = new BoardContent();
        boardContent.setId(stored.getContentId());
        boardContent.setLecture(lecture);
        boardContent.setTimestamp(timestamp);
        boardContent.setImagePath(stored.getImagePath());
        boardContent.setExtractedText(analysis.getExtractedText());
        boardContent.setEquation(analysis.getEquation());
        boardContent.setDiagramDescription(analysis.getDiagramDescription());
        boardContent.setEquationsJson(equationsJson);
        boardContent.setDiagramJson(diagramJson);
        boardContent.setKeyPointsJson(keyPointsJson);
        boardContent.setConceptDiagramJson(conceptDiagramJson);
        boardContent.setMainConcept(analysis.getMainConcept());
        boardContent.setStructuredContentJson(structuredContentJson);
        boardContent.setImageHash(stored.getImageHash());
        boardContent.setQualityScore(analysis.getQualityScore());
        boardContent.setCreatedAt(LocalDateTime.now());

        BoardContent saved = boardContentRepository.save(boardContent);

        // 5. Persist MultimodalEvent for SALKG and downstream consistency
        MultimodalEvent event = new MultimodalEvent();
        event.setId("evt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        event.setLecture(lecture);
        event.setTimestamp(timestamp);
        event.setTitle(analysis.getMainConcept() != null && !analysis.getMainConcept().isBlank() ? analysis.getMainConcept() : "Whiteboard Notes");
        event.setEventType("BOARD");
        event.setAudioText("");
        event.setVisualContent((analysis.getExtractedText() != null ? analysis.getExtractedText() : "") +
                (analysis.getEquation() != null && !analysis.getEquation().isBlank() ? " [Eq: " + analysis.getEquation() + "]" : ""));
        event.setCombinedInsight(analysis.getDiagramDescription() != null && !analysis.getDiagramDescription().isBlank() ?
                analysis.getDiagramDescription() : "Whiteboard visual content analyzed.");
        event.setCreatedAt(LocalDateTime.now());
        multimodalEventRepository.save(event);

        BoardContentDto dto = BoardContentDto.fromEntity(saved);
        dto.setIsDuplicate(false);
        dto.setMessage("Whiteboard snapshot ingested successfully");

        // 6. Notify Node.js mediasoup service for real-time WebSocket broadcast
        mediaServiceCoordinator.notifyBoardFrameAdded(lecture.getRoomId(), lecture.getId(), dto);

        log.info("[MultimodalIngestion] Ingested board frame '{}' for lecture '{}' at {}s",
                dto.getId(), lecture.getId(), timestamp);
        return dto;
    }

    @Override
    @Transactional
    public ScreenContentDto processScreenFrame(String lectureIdentifier, ScreenFrameRequest request, String currentUserId, String currentUserRole) {
        if (request == null) {
            throw new IllegalArgumentException("Screen frame request body is required");
        }

        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, true);
        double timestamp = request.getTimestamp() != null ? Math.max(0.0, request.getTimestamp()) : 0.0;

        // 1. Validate and safely store image to disk
        ImageStorageService.StoredImage stored = imageStorageService.validateAndStore("screen", request.getImageBase64());

        // 2. OCR / Vision Analysis via worker with fallback
        VisionAnalysisDto analysis = visionWorkerClient.analyzeFrame("screen", lecture.getId(), stored.getCleanBase64(), timestamp, stored.getImagePath());

        // 3. Deduplication Check against existing snapshots for this lecture
        Optional<ScreenContent> duplicateOpt = screenContentRepository.findByLectureIdAndImageHash(lecture.getId(), stored.getImageHash());

        String equationsJson = writeJson(analysis.getEquations() != null ? analysis.getEquations() : List.of());
        String diagramJson = writeJson(analysis.getDiagram() != null ? analysis.getDiagram() : Map.of());
        String keyPointsJson = writeJson(analysis.getKeyPoints() != null ? analysis.getKeyPoints() : List.of());
        String conceptDiagramJson = writeJson(analysis.getConceptDiagram() != null ? analysis.getConceptDiagram() : Map.of());
        String structuredContentJson = writeJson(analysis.getStructuredContent() != null ? analysis.getStructuredContent() : List.of());

        if (duplicateOpt.isPresent()) {
            ScreenContent existing = duplicateOpt.get();
            int existingScore = existing.getQualityScore() != null ? existing.getQualityScore() : 0;
            int newScore = analysis.getQualityScore() != null ? analysis.getQualityScore() : 0;

            if (newScore >= existingScore) {
                existing.setTimestamp(timestamp);
                existing.setImagePath(stored.getImagePath());
                existing.setSlideTitle(analysis.getSlideTitle() != null ? analysis.getSlideTitle() : analysis.getMainConcept());
                existing.setExtractedText(analysis.getExtractedText());
                existing.setCodeSnippet(analysis.getCodeSnippet());
                existing.setDiagramDescription(analysis.getDiagramDescription());
                existing.setEquationsJson(equationsJson);
                existing.setDiagramJson(diagramJson);
                existing.setCodeLanguage(analysis.getCodeLanguage());
                existing.setKeyPointsJson(keyPointsJson);
                existing.setConceptDiagramJson(conceptDiagramJson);
                existing.setMainConcept(analysis.getMainConcept());
                existing.setStructuredContentJson(structuredContentJson);
                existing.setQualityScore(newScore);

                ScreenContent saved = screenContentRepository.save(existing);
                ScreenContentDto dto = ScreenContentDto.fromEntity(saved);
                dto.setIsDuplicate(true);
                dto.setIsUpdate(true);
                dto.setReplacedId(existing.getId());
                dto.setMessage("Upgraded existing snapshot with higher clarity & formulas");

                mediaServiceCoordinator.notifyScreenFrameAdded(lecture.getRoomId(), lecture.getId(), dto);
                return dto;
            } else {
                ScreenContentDto dto = ScreenContentDto.fromEntity(existing);
                dto.setIsDuplicate(true);
                dto.setIsUpdate(false);
                dto.setKeptExistingId(existing.getId());
                dto.setMessage("Preserved existing snapshot with higher educational clarity");
                return dto;
            }
        }

        // 4. Distinct Snapshot: Persist ScreenContent
        ScreenContent screenContent = new ScreenContent();
        screenContent.setId(stored.getContentId());
        screenContent.setLecture(lecture);
        screenContent.setTimestamp(timestamp);
        screenContent.setImagePath(stored.getImagePath());
        screenContent.setSlideTitle(analysis.getSlideTitle() != null ? analysis.getSlideTitle() : analysis.getMainConcept());
        screenContent.setExtractedText(analysis.getExtractedText());
        screenContent.setCodeSnippet(analysis.getCodeSnippet());
        screenContent.setDiagramDescription(analysis.getDiagramDescription());
        screenContent.setEquationsJson(equationsJson);
        screenContent.setDiagramJson(diagramJson);
        screenContent.setCodeLanguage(analysis.getCodeLanguage() != null ? analysis.getCodeLanguage() : "");
        screenContent.setKeyPointsJson(keyPointsJson);
        screenContent.setConceptDiagramJson(conceptDiagramJson);
        screenContent.setMainConcept(analysis.getMainConcept());
        screenContent.setStructuredContentJson(structuredContentJson);
        screenContent.setImageHash(stored.getImageHash());
        screenContent.setQualityScore(analysis.getQualityScore());
        screenContent.setCreatedAt(LocalDateTime.now());

        ScreenContent saved = screenContentRepository.save(screenContent);

        // 5. Persist MultimodalEvent
        MultimodalEvent event = new MultimodalEvent();
        event.setId("evt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        event.setLecture(lecture);
        event.setTimestamp(timestamp);
        event.setTitle(analysis.getSlideTitle() != null && !analysis.getSlideTitle().isBlank() ? analysis.getSlideTitle() : "Presentation Slide");
        event.setEventType("SCREEN");
        event.setAudioText("");
        event.setVisualContent((analysis.getExtractedText() != null ? analysis.getExtractedText() : "") +
                (analysis.getEquation() != null && !analysis.getEquation().isBlank() ? " [Eq: " + analysis.getEquation() + "]" : ""));
        event.setCombinedInsight(analysis.getDiagramDescription() != null && !analysis.getDiagramDescription().isBlank() ?
                analysis.getDiagramDescription() : "Screen slide visual content analyzed.");
        event.setCreatedAt(LocalDateTime.now());
        multimodalEventRepository.save(event);

        ScreenContentDto dto = ScreenContentDto.fromEntity(saved);
        dto.setIsDuplicate(false);
        dto.setMessage("Screen slide snapshot ingested successfully");

        // 6. Notify Node.js media service for real-time WebSocket broadcast
        mediaServiceCoordinator.notifyScreenFrameAdded(lecture.getRoomId(), lecture.getId(), dto);

        log.info("[MultimodalIngestion] Ingested screen frame '{}' for lecture '{}' at {}s",
                dto.getId(), lecture.getId(), timestamp);
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BoardContentDto> getBoardContents(String lectureIdentifier, String currentUserId, String currentUserRole) {
        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, false);
        List<BoardContent> items = boardContentRepository.findByLectureIdOrderByTimestampAsc(lecture.getId());
        return items.stream().map(BoardContentDto::fromEntity).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScreenContentDto> getScreenContents(String lectureIdentifier, String currentUserId, String currentUserRole) {
        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, false);
        List<ScreenContent> items = screenContentRepository.findByLectureIdOrderByTimestampAsc(lecture.getId());
        return items.stream().map(ScreenContentDto::fromEntity).collect(Collectors.toList());
    }

    private static String writeJson(Object obj) {
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }
}
