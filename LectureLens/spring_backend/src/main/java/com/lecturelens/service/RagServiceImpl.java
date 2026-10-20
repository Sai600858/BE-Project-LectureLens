
package com.lecturelens.service;

import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.ai.AiProviderOrchestrator;
import org.springframework.security.access.AccessDeniedException;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.*;
import com.lecturelens.model.*;
import com.lecturelens.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class RagServiceImpl implements RagService {

    private static final Logger log = LoggerFactory.getLogger(RagServiceImpl.class);

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
            "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
            "into", "through", "during", "before", "after", "above", "below",
            "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
            "me", "him", "her", "us", "them", "my", "your", "his", "their", "our",
            "what", "how", "why", "when", "where", "can", "could", "would", "should", "tell",
            "and", "or", "but", "so", "as", "if", "then", "than", "also", "just",
            "regarding", "discussed", "discuss", "mention", "mentioned", "talk", "talked",
            "state", "stated", "explain", "explained", "describe", "described");

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

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private AiContextAssemblyService aiContextAssemblyService;

    @Autowired
    private AiProviderOrchestrator aiProviderOrchestrator;

    private Lecture resolveLectureAndCheckAccess(String lectureIdentifier, User currentUser) {
        if (lectureIdentifier == null || lectureIdentifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }
        String cleanId = lectureIdentifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUser == null) {
                throw new AccessDeniedException("Authentication required to access private lecture RAG.");
            }
            boolean isHost = currentUser.getId().equals(lecture.getHostId());
            boolean isAdmin = currentUser.getRole() == Role.ADMIN;
            boolean isEnrolled = participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUser.getId());
            if (!isHost && !isAdmin && !isEnrolled) {
                throw new AccessDeniedException("Access denied: You are not authorized to query this private lecture.");
            }
        }
        return lecture;
    }

    @Override
    @Transactional
    public AskLectureResponse askLecture(String lectureIdentifier, AskLectureRequest request, User currentUser) {
        if (request == null || request.getQuestion() == null || request.getQuestion().isBlank()) {
            throw new IllegalArgumentException("Valid question text is required");
        }

        String rawQuestion = request.getQuestion().trim();
        String question = rawQuestion.length() > 1000 ? rawQuestion.substring(0, 1000) : rawQuestion;

        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        String resolvedId = lecture.getId();

        // 1. Gather multimodal records
        List<TranscriptSegment> segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(resolvedId);
        Optional<Transcript> transcriptOpt = transcriptRepository.findByLectureId(resolvedId);
        List<BoardContent> boardContents = boardContentRepository.findByLectureIdOrderByTimestampAsc(resolvedId);
        List<ScreenContent> screenContents = screenContentRepository.findByLectureIdOrderByTimestampAsc(resolvedId);
        Optional<Summary> summaryOpt = summaryRepository.findByLectureId(resolvedId);

        // Synthesize segments if segments table empty but full_text exists
        if ((segments == null || segments.isEmpty()) && transcriptOpt.isPresent()) {
            String fullText = transcriptOpt.get().getFullText();
            if (fullText != null && !fullText.isBlank()) {
                String[] lines = fullText.split("\\n+");
                segments = new ArrayList<>();
                double offset = 0.0;
                for (String line : lines) {
                    if (!line.isBlank()) {
                        TranscriptSegment seg = new TranscriptSegment();
                        seg.setId(Math.abs(UUID.randomUUID().getMostSignificantBits()));
                        seg.setLectureId(resolvedId);
                        seg.setSpeakerName(lecture.getHostName() != null ? lecture.getHostName() : "Speaker");
                        seg.setText(line.trim());
                        seg.setStartTime(offset);
                        seg.setEndTime(offset + 5.0);
                        segments.add(seg);
                        offset += 5.0;
                    }
                }
            }
        }

        boolean hasTranscript = segments != null && !segments.isEmpty();
        boolean hasBoard = boardContents != null && !boardContents.isEmpty();
        boolean hasScreen = screenContents != null && !screenContents.isEmpty();
        boolean hasSummary = summaryOpt.isPresent()
                && (summaryOpt.get().getShortSummary() != null || summaryOpt.get().getDetailedSummary() != null);

        // If truly no lecture content exists
        if (!hasTranscript && !hasBoard && !hasScreen && !hasSummary) {
            String fallbackMsg = "No transcription or lecture materials have been recorded for \"" +
                    lecture.getTitle()
                    + "\" yet. To ask questions about a lecture, ensure that speech-to-text live transcription is started during the lecture session, or review a lecture with recorded transcription.";
            return new AskLectureResponse(question, fallbackMsg, null, null, Collections.emptyList());
        }

        // 2. Search relevant multimodal chunks
        List<RagChunkDto> relevantChunks = searchRelevantChunks(question, segments, boardContents, screenContents, 10);

        // 3. Assemble AI Context
        AiLectureContext context = new AiLectureContext();
        context.setLectureId(resolvedId);
        context.setLectureTitle(lecture.getTitle());
        context.setHostName(lecture.getHostName());

        StringBuilder fullTranscript = new StringBuilder();
        if (segments != null) {
            for (TranscriptSegment s : segments) {
                fullTranscript.append("[").append(formatOffset(s.getStartTime())).append("] ")
                        .append(s.getSpeakerName() != null ? s.getSpeakerName() : "Speaker")
                        .append(": ").append(s.getText()).append("\n");
            }
        }
        context.setTranscriptText(fullTranscript.toString());

        StringBuilder boardNotes = new StringBuilder();
        if (boardContents != null) {
            for (BoardContent b : boardContents) {
                boardNotes.append("[").append(formatOffset(b.getTimestamp())).append("] ")
                        .append("Whiteboard: ").append(b.getExtractedText() != null ? b.getExtractedText() : "")
                        .append(b.getEquation() != null ? " | Eq: " + b.getEquation() : "")
                        .append("\n");
            }
        }
        context.setBoardNotes(boardNotes.toString());

        // 4. Generate answer via AI Provider Orchestrator
        AskLectureResponse response = aiProviderOrchestrator.executeRagAnswer(context, question, relevantChunks);

        // 5. Persist to chat_messages if user is logged in
        if (currentUser != null) {
            try {
                ChatMessage userMsg = new ChatMessage();
                userMsg.setId("msg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                userMsg.setLecture(lecture);
                userMsg.setUserId(currentUser.getId());
                userMsg.setSenderName(currentUser.getName() != null ? currentUser.getName() : "Student");
                userMsg.setMessage("Q: " + question);
                userMsg.setTimestamp(System.currentTimeMillis());
                userMsg.setCreatedAt(LocalDateTime.now());
                chatMessageRepository.save(userMsg);

                ChatMessage aiMsg = new ChatMessage();
                aiMsg.setId("msg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                aiMsg.setLecture(lecture);
                aiMsg.setUserId("system_ai_tutor");
                aiMsg.setSenderName("AI Tutor");
                aiMsg.setMessage(response.getAnswer());
                aiMsg.setTimestamp(System.currentTimeMillis() + 1);
                aiMsg.setCreatedAt(LocalDateTime.now());
                chatMessageRepository.save(aiMsg);
            } catch (Exception e) {
                log.warn("[RagService] Failed to persist chat messages for query: {}", e.getMessage());
            }
        }

        return response;
    }

    private List<RagChunkDto> searchRelevantChunks(String query,
            List<TranscriptSegment> segments,
            List<BoardContent> boardContents,
            List<ScreenContent> screenContents,
            int limit) {
        String rawQuery = (query != null ? query : "").trim().toLowerCase();
        String queryClean = rawQuery.replaceAll("[^a-z0-9\\s]", " ");
        List<String> queryWords = Arrays.stream(queryClean.split("\\s+"))
                .filter(w -> w.length() > 1 && !STOP_WORDS.contains(w))
                .collect(Collectors.toList());

        List<RagChunkDto> scoredItems = new ArrayList<>();

        // 1. Transcript segments
        if (segments != null) {
            for (TranscriptSegment seg : segments) {
                if (seg.getText() == null || seg.getText().isBlank())
                    continue;
                String textLower = seg.getText().toLowerCase();
                String speakerLower = (seg.getSpeakerName() != null ? seg.getSpeakerName() : "").toLowerCase();
                double score = 0;

                if (queryClean.length() > 3 && textLower.contains(queryClean)) {
                    score += 15;
                }
                for (String word : queryWords) {
                    if (speakerLower.contains(word))
                        score += 6;
                    if (Pattern.compile("\\b" + Pattern.quote(word) + "\\b", Pattern.CASE_INSENSITIVE)
                            .matcher(textLower).find()) {
                        score += 4;
                    } else if (textLower.contains(word)) {
                        score += 2;
                    }
                }
                if (score > 0) {
                    scoredItems.add(new RagChunkDto(
                            "TRANSCRIPT",
                            seg.getSpeakerName() != null ? seg.getSpeakerName() : "Speaker",
                            seg.getText(),
                            seg.getStartTime() != null ? seg.getStartTime() : 0.0,
                            score));
                }
            }
        }

        // 2. Whiteboard contents
        if (boardContents != null) {
            for (BoardContent b : boardContents) {
                String textPart = b.getExtractedText() != null ? b.getExtractedText() : "";
                String eqPart = b.getEquation() != null ? b.getEquation() : "";
                String combined = (textPart + " " + eqPart).toLowerCase();
                double score = 0;

                if (queryClean.length() > 3 && combined.contains(queryClean)) {
                    score += 15;
                }
                for (String word : queryWords) {
                    if (combined.contains(word))
                        score += 4;
                }
                if (score > 0) {
                    scoredItems.add(new RagChunkDto(
                            "BOARD",
                            "Whiteboard Note",
                            "Board Text: " + textPart + (eqPart.isEmpty() ? "" : " | Equation: " + eqPart),
                            b.getTimestamp() != null ? b.getTimestamp() : 0.0,
                            score));
                }
            }
        }

        // 3. Screen contents
        if (screenContents != null) {
            for (ScreenContent s : screenContents) {
                String titlePart = s.getSlideTitle() != null ? s.getSlideTitle() : "";
                String textPart = s.getExtractedText() != null ? s.getExtractedText() : "";
                String codePart = s.getCodeSnippet() != null ? s.getCodeSnippet() : "";
                String combined = (titlePart + " " + textPart + " " + codePart).toLowerCase();
                double score = 0;

                if (queryClean.length() > 3 && combined.contains(queryClean)) {
                    score += 15;
                }
                for (String word : queryWords) {
                    if (combined.contains(word))
                        score += 4;
                }
                if (score > 0) {
                    scoredItems.add(new RagChunkDto(
                            "SLIDE",
                            "Slide Presentation",
                            "Slide: " + titlePart + (textPart.isEmpty() ? "" : " | Content: " + textPart),
                            s.getTimestamp() != null ? s.getTimestamp() : 0.0,
                            score));
                }
            }
        }

        scoredItems.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        return scoredItems.stream().limit(limit).collect(Collectors.toList());
    }

    private String formatOffset(Double seconds) {
        if (seconds == null || seconds < 0)
            return "0:00";
        int total = seconds.intValue();
        return String.format("%d:%02d", total / 60, total % 60);
    }
}
