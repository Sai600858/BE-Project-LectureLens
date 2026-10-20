package com.lecturelens.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.common.InsufficientSourceMaterialException;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.model.*;
import com.lecturelens.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class AiContextAssemblyService {

    private static final Logger log = LoggerFactory.getLogger(AiContextAssemblyService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

    @Autowired
    private BoardContentRepository boardContentRepository;

    @Autowired
    private ScreenContentRepository screenContentRepository;

    private String formatTime(Double seconds) {
        if (seconds == null || seconds < 0) return "0:00";
        int totalSec = seconds.intValue();
        int m = totalSec / 60;
        int s = totalSec % 60;
        return String.format("%d:%02d", m, s);
    }

    /**
     * Gathers bounded, relevant context from transcripts, whiteboard frames, and presentation slides.
     */
    @Transactional(readOnly = true)
    public AiLectureContext assembleContext(String lectureIdentifier) {
        if (lectureIdentifier == null || lectureIdentifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }

        String cleanId = lectureIdentifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        String resolvedId = lecture.getId();
        Optional<Transcript> transcriptOpt = transcriptRepository.findByLectureId(resolvedId);
        List<TranscriptSegment> segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(resolvedId);
        List<BoardContent> boardContents = boardContentRepository.findByLectureIdOrderByTimestampAsc(resolvedId);
        List<ScreenContent> screenContents = screenContentRepository.findByLectureIdOrderByTimestampAsc(resolvedId);

        // Source Material Sufficiency Validation
        String fullText = transcriptOpt.map(Transcript::getFullText).orElse("");
        boolean hasSegments = segments != null && !segments.isEmpty();
        boolean hasBoard = boardContents != null && !boardContents.isEmpty();
        boolean hasScreen = screenContents != null && !screenContents.isEmpty();
        boolean hasTranscriptText = fullText != null && fullText.trim().length() >= 10;

        if (!hasSegments && !hasBoard && !hasScreen && !hasTranscriptText) {
            log.warn("[AiContextAssembly] Lecture '{}' lacks sufficient source material for AI generation", resolvedId);
            throw new InsufficientSourceMaterialException(
                    "Insufficient lecture source material to generate content. Please record lecture speech or presentation content before initiating generation."
            );
        }

        // Build formatted transcript
        StringBuilder transcriptBuilder = new StringBuilder();
        if (hasSegments) {
            for (TranscriptSegment seg : segments) {
                String speaker = (seg.getSpeakerName() != null && !seg.getSpeakerName().isBlank()) ? seg.getSpeakerName() : "Speaker";
                transcriptBuilder.append("[")
                        .append(formatTime(seg.getStartTime()))
                        .append("] ")
                        .append(speaker)
                        .append(": ")
                        .append(seg.getText())
                        .append("\n");
            }
        } else if (hasTranscriptText) {
            transcriptBuilder.append(fullText.trim());
        }

        String transcriptText = transcriptBuilder.toString().trim();

        // Build Board Notes
        StringBuilder boardNotes = new StringBuilder();
        List<Map<String, Object>> preservedDiagrams = new ArrayList<>();

        if (hasBoard) {
            for (BoardContent b : boardContents) {
                boardNotes.append("[").append(formatTime(b.getTimestamp())).append("] ")
                        .append("Board Text: ").append(b.getExtractedText() != null ? b.getExtractedText() : "None")
                        .append(" | Eq: ").append(b.getEquation() != null ? b.getEquation() : "None")
                        .append(" | Diagram: ").append(b.getDiagramDescription() != null ? b.getDiagramDescription() : "None")
                        .append("\n");

                if (b.getStructuredContentJson() != null && !b.getStructuredContentJson().isBlank()) {
                    try {
                        List<Map<String, Object>> items = MAPPER.readValue(b.getStructuredContentJson(), new TypeReference<List<Map<String, Object>>>() {});
                        for (Map<String, Object> item : items) {
                            item.put("source", "board");
                            item.put("timestamp", b.getTimestamp());
                            item.put("imagePath", b.getImagePath());
                            preservedDiagrams.add(item);
                        }
                    } catch (Exception ignored) {}
                } else if (b.getImagePath() != null) {
                    Map<String, Object> diag = new HashMap<>();
                    diag.put("id", "diag_board_" + (preservedDiagrams.size() + 1));
                    diag.put("label", (b.getMainConcept() != null && !b.getMainConcept().isBlank()) ? b.getMainConcept() : "Whiteboard Diagram");
                    diag.put("description", b.getDiagramDescription() != null ? b.getDiagramDescription() : "");
                    diag.put("source", "board");
                    diag.put("timestamp", b.getTimestamp());
                    diag.put("imagePath", b.getImagePath());
                    preservedDiagrams.add(diag);
                }
            }
        }

        // Build Screen Notes
        StringBuilder screenNotes = new StringBuilder();
        if (hasScreen) {
            for (ScreenContent s : screenContents) {
                screenNotes.append("[").append(formatTime(s.getTimestamp())).append("] ")
                        .append("Slide: ").append(s.getSlideTitle() != null ? s.getSlideTitle() : "Slide")
                        .append(" | Body: ").append(s.getExtractedText() != null ? s.getExtractedText() : "")
                        .append(" | Code: ").append(s.getCodeSnippet() != null ? s.getCodeSnippet() : "None")
                        .append("\n");

                if (s.getStructuredContentJson() != null && !s.getStructuredContentJson().isBlank()) {
                    try {
                        List<Map<String, Object>> items = MAPPER.readValue(s.getStructuredContentJson(), new TypeReference<List<Map<String, Object>>>() {});
                        for (Map<String, Object> item : items) {
                            item.put("source", "screen");
                            item.put("timestamp", s.getTimestamp());
                            item.put("imagePath", s.getImagePath());
                            preservedDiagrams.add(item);
                        }
                    } catch (Exception ignored) {}
                } else if (s.getImagePath() != null) {
                    Map<String, Object> diag = new HashMap<>();
                    diag.put("id", "diag_screen_" + (preservedDiagrams.size() + 1));
                    diag.put("label", s.getSlideTitle() != null ? s.getSlideTitle() : "Slide Diagram");
                    diag.put("description", s.getDiagramDescription() != null ? s.getDiagramDescription() : "");
                    diag.put("source", "screen");
                    diag.put("timestamp", s.getTimestamp());
                    diag.put("imagePath", s.getImagePath());
                    preservedDiagrams.add(diag);
                }
            }
        }

        // Domain inference
        String inferredDomain = "general_cs";
        String combinedLower = (lecture.getTitle() + " " + transcriptText + " " + boardNotes + " " + screenNotes).toLowerCase();
        if (combinedLower.contains("sql") || combinedLower.contains("database") || combinedLower.contains("table") || combinedLower.contains("coalesce")) {
            inferredDomain = "databases";
        } else if (combinedLower.contains("circle") || combinedLower.contains("radius") || combinedLower.contains("geometry")) {
            inferredDomain = "mathematics";
        } else if (combinedLower.contains("kidney") || combinedLower.contains("nephron") || combinedLower.contains("excretory") || combinedLower.contains("anatomy")) {
            inferredDomain = "biology";
        } else if (combinedLower.contains("velocity") || combinedLower.contains("acceleration") || combinedLower.contains("kinematics")) {
            inferredDomain = "physics_electronics";
        }

        AiLectureContext context = new AiLectureContext();
        context.setLectureId(resolvedId);
        context.setLectureTitle(lecture.getTitle() != null ? lecture.getTitle() : "Lecture Session");
        context.setTranscriptText(transcriptText);
        context.setBoardNotes(boardNotes.toString().trim());
        context.setScreenNotes(screenNotes.toString().trim());
        context.setPreservedDiagrams(preservedDiagrams);
        context.setDomain(inferredDomain);

        return context;
    }
}
