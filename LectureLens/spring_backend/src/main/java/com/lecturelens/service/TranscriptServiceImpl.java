package com.lecturelens.service;

import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.*;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import com.lecturelens.model.Transcript;
import com.lecturelens.model.TranscriptSegment;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import com.lecturelens.repository.TranscriptRepository;
import com.lecturelens.repository.TranscriptSegmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TranscriptServiceImpl implements TranscriptService {

    private static final Logger log = LoggerFactory.getLogger(TranscriptServiceImpl.class);

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

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
                throw new AccessDeniedException("Forbidden: Only host, administrator, or enrolled participants can ingest transcripts");
            }
        }

        return lecture;
    }

    @Override
    @Transactional
    public TranscriptSegmentDto ingestSegment(String lectureIdentifier, TranscriptSegmentRequest request, String currentUserId, String currentUserRole) {
        if (request == null) {
            throw new IllegalArgumentException("Transcript segment request is required");
        }

        String text = request.getText();
        if (text == null || text.trim().isEmpty()) {
            throw new IllegalArgumentException("Transcript segment text cannot be empty");
        }
        text = text.trim();

        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, true);

        double startTime = request.getStartTime() != null ? Math.max(0.0, request.getStartTime()) : 0.0;
        double endTime = request.getEndTime() != null ? Math.max(startTime, request.getEndTime()) : startTime + 3.0;
        double confidence = request.getConfidence() != null ? Math.min(1.0, Math.max(0.0, request.getConfidence())) : 1.0;

        String speakerName = request.getSpeakerName() != null && !request.getSpeakerName().isBlank()
                ? request.getSpeakerName().trim() : "Teacher";
        String speakerId = request.getSpeakerId() != null && !request.getSpeakerId().isBlank()
                ? request.getSpeakerId().trim() : (currentUserId != null ? currentUserId : "host");

        // Deduplication by chunkId: if chunkId is present and already exists for this lecture, update it
        TranscriptSegment segment;
        if (request.getChunkId() != null) {
            Optional<TranscriptSegment> existingOpt = transcriptSegmentRepository.findByLectureIdAndChunkId(lecture.getId(), request.getChunkId());
            if (existingOpt.isPresent()) {
                segment = existingOpt.get();
                segment.setText(text);
                segment.setEndTime(Math.max(segment.getEndTime() != null ? segment.getEndTime() : endTime, endTime));
                segment.setConfidence(confidence);
                segment = transcriptSegmentRepository.save(segment);
            } else {
                segment = new TranscriptSegment();
                segment.setLectureId(lecture.getId());
                segment.setChunkId(request.getChunkId());
                segment.setSpeakerId(speakerId);
                segment.setSpeakerName(speakerName);
                segment.setStartTime(startTime);
                segment.setEndTime(endTime);
                segment.setText(text);
                segment.setConfidence(confidence);
                segment.setCreatedAt(LocalDateTime.now());
                segment = transcriptSegmentRepository.save(segment);
            }
        } else {
            segment = new TranscriptSegment();
            segment.setLectureId(lecture.getId());
            segment.setSpeakerId(speakerId);
            segment.setSpeakerName(speakerName);
            segment.setStartTime(startTime);
            segment.setEndTime(endTime);
            segment.setText(text);
            segment.setConfidence(confidence);
            segment.setCreatedAt(LocalDateTime.now());
            segment = transcriptSegmentRepository.save(segment);
        }

        // Upsert master Transcript record
        Transcript transcript = transcriptRepository.findByLectureId(lecture.getId())
                .orElseGet(() -> {
                    Transcript t = new Transcript();
                    t.setId("trans_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                    t.setLectureId(lecture.getId());
                    t.setFullText("");
                    t.setStatus(lecture.getStatus() == LectureStatus.ENDED ? "complete" : "live");
                    t.setCreatedAt(LocalDateTime.now());
                    return t;
                });

        if (transcript.getFullText() == null || transcript.getFullText().isBlank()) {
            transcript.setFullText(text);
        } else if (!transcript.getFullText().contains(text)) {
            transcript.setFullText(transcript.getFullText() + " " + text);
        }
        transcript.setUpdatedAt(LocalDateTime.now());
        transcriptRepository.save(transcript);

        TranscriptSegmentDto dto = TranscriptSegmentDto.fromEntity(segment);

        // Notify Node.js media service for real-time WebSocket broadcast
        mediaServiceCoordinator.notifyTranscriptUpdated(lecture.getRoomId(), List.of(dto), transcript.getFullText(), transcript.getStatus());

        log.debug("[TranscriptService] Ingested segment {} for lecture '{}' [{}s - {}s]: {}",
                segment.getId(), lecture.getId(), startTime, endTime, text);

        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public TranscriptResponse getTranscript(String lectureIdentifier, String currentUserId, String currentUserRole, Integer page, Integer size) {
        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, false);

        Transcript transcript = transcriptRepository.findByLectureId(lecture.getId()).orElse(null);
        TranscriptDto transcriptDto = transcript != null ? TranscriptDto.fromEntity(transcript) : null;

        List<TranscriptSegmentDto> segmentDtos;
        if (page != null && size != null && size > 0) {
            int safeSize = Math.min(size, 200);
            Page<TranscriptSegment> segmentPage = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(
                    lecture.getId(), PageRequest.of(page, safeSize, Sort.by("startTime").ascending()));
            segmentDtos = segmentPage.getContent().stream().map(TranscriptSegmentDto::fromEntity).collect(Collectors.toList());
        } else {
            List<TranscriptSegment> segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(lecture.getId());
            segmentDtos = segments.stream().map(TranscriptSegmentDto::fromEntity).collect(Collectors.toList());
        }

        return new TranscriptResponse(transcriptDto, segmentDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public TranscriptSearchResponse searchTranscript(String lectureIdentifier, String query, String currentUserId, String currentUserRole) {
        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, false);

        if (query == null || query.trim().isEmpty()) {
            return new TranscriptSearchResponse(Collections.emptyList());
        }

        List<TranscriptSegment> matches = transcriptSegmentRepository.findByLectureIdAndTextContainingIgnoreCase(
                lecture.getId(), query.trim());
        List<TranscriptSegmentDto> dtos = matches.stream().map(TranscriptSegmentDto::fromEntity).collect(Collectors.toList());
        return new TranscriptSearchResponse(dtos);
    }

    @Override
    @Transactional(readOnly = true)
    public LegacyTranscriptResponse getLegacyTranscript(String roomId, String currentUserId, String currentUserRole) {
        Lecture lecture = checkLectureAccess(roomId, currentUserId, currentUserRole, false);

        Transcript transcript = transcriptRepository.findByLectureId(lecture.getId()).orElse(null);
        List<TranscriptSegment> segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(lecture.getId());
        List<TranscriptSegmentDto> dtos = segments.stream().map(TranscriptSegmentDto::fromEntity).collect(Collectors.toList());

        String status = transcript != null && transcript.getStatus() != null ? transcript.getStatus() : "complete";
        String fullText = transcript != null && transcript.getFullText() != null && !transcript.getFullText().isBlank()
                ? transcript.getFullText()
                : dtos.stream().map(TranscriptSegmentDto::getText).filter(Objects::nonNull).collect(Collectors.joining(" "));

        return new LegacyTranscriptResponse(lecture.getRoomId() != null ? lecture.getRoomId() : roomId, status, fullText, dtos);
    }

    @Override
    @Transactional
    public TranscriptResponse syncTranscript(String lectureIdentifier, List<TranscriptSegmentRequest> segments, String fullText, String currentUserId, String currentUserRole) {
        Lecture lecture = checkLectureAccess(lectureIdentifier, currentUserId, currentUserRole, true);

        if (segments != null) {
            for (TranscriptSegmentRequest segReq : segments) {
                if (segReq.getText() != null && !segReq.getText().isBlank()) {
                    ingestSegment(lecture.getId(), segReq, currentUserId, currentUserRole);
                }
            }
        }

        if (fullText != null && !fullText.isBlank()) {
            Transcript transcript = transcriptRepository.findByLectureId(lecture.getId())
                    .orElseGet(() -> {
                        Transcript t = new Transcript();
                        t.setId("trans_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                        t.setLectureId(lecture.getId());
                        t.setStatus("live");
                        t.setCreatedAt(LocalDateTime.now());
                        return t;
                    });
            transcript.setFullText(fullText.trim());
            transcript.setUpdatedAt(LocalDateTime.now());
            transcriptRepository.save(transcript);
        }

        return getTranscript(lecture.getId(), currentUserId, currentUserRole, null, null);
    }
}
