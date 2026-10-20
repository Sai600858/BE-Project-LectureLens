package com.lecturelens.service;

import com.lecturelens.ai.AiLectureContext;
import com.lecturelens.ai.AiProviderOrchestrator;
import org.springframework.security.access.AccessDeniedException;
import com.lecturelens.common.ResourceNotFoundException;
import com.lecturelens.dto.FlashcardDto;
import com.lecturelens.dto.FlashcardListResponse;
import com.lecturelens.dto.FlashcardProgressRequest;
import com.lecturelens.dto.FlashcardProgressResponse;
import com.lecturelens.model.Flashcard;
import com.lecturelens.model.FlashcardProgress;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.FlashcardProgressRepository;
import com.lecturelens.repository.FlashcardRepository;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FlashcardServiceImpl implements FlashcardService {

    private static final Logger log = LoggerFactory.getLogger(FlashcardServiceImpl.class);

    @Autowired
    private FlashcardRepository flashcardRepository;

    @Autowired
    private FlashcardProgressRepository flashcardProgressRepository;

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private AiContextAssemblyService aiContextAssemblyService;

    @Autowired
    private AiProviderOrchestrator aiProviderOrchestrator;

    @Autowired
    private ParticipantRepository participantRepository;

    private Lecture resolveLectureAndCheckAccess(String lectureIdentifier, User currentUser) {
        if (lectureIdentifier == null || lectureIdentifier.isBlank()) {
            throw new IllegalArgumentException("Lecture identifier is required");
        }
        String cleanId = lectureIdentifier.trim();
        Lecture lecture = lectureRepository.findByIdOrRoomId(cleanId, cleanId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecture not found: " + cleanId));

        if ("PRIVATE".equalsIgnoreCase(lecture.getVisibility())) {
            if (currentUser == null) {
                throw new AccessDeniedException("Authentication required to access private lecture flashcards.");
            }
            boolean isHost = currentUser.getId().equals(lecture.getHostId());
            boolean isAdmin = currentUser.getRole() == Role.ADMIN;
            boolean isEnrolled = participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUser.getId());
            if (!isHost && !isAdmin && !isEnrolled) {
                throw new AccessDeniedException("Access denied: You are not authorized to view this lecture's flashcards.");
            }
        }
        return lecture;
    }

    @Override
    @Transactional
    public FlashcardListResponse getOrGenerateFlashcards(String lectureIdentifier, User currentUser) {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        String resolvedId = lecture.getId();

        List<Flashcard> existingCards = flashcardRepository.findByLectureId(resolvedId);
        List<FlashcardDto> cardDtos;

        if (existingCards != null && !existingCards.isEmpty()) {
            cardDtos = existingCards.stream().map(c -> new FlashcardDto(
                    c.getId(),
                    c.getLectureId(),
                    c.getQuestion(),
                    c.getAnswer(),
                    c.getTopic(),
                    c.getDifficulty(),
                    c.getCreatedAt()
            )).collect(Collectors.toList());
        } else {
            AiLectureContext context = aiContextAssemblyService.assembleContext(resolvedId);
            List<FlashcardDto> generated = aiProviderOrchestrator.executeFlashcardGeneration(context);

            if (generated == null || generated.isEmpty()) {
                throw new IllegalStateException("AI flashcard generation produced no cards.");
            }

            List<Flashcard> toSave = new ArrayList<>();
            for (FlashcardDto dto : generated) {
                if (dto.getQuestion() == null || dto.getQuestion().isBlank() ||
                        dto.getAnswer() == null || dto.getAnswer().isBlank()) {
                    continue;
                }
                Flashcard entity = new Flashcard();
                entity.setId("fc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                entity.setLectureId(resolvedId);
                entity.setQuestion(dto.getQuestion().trim());
                entity.setAnswer(dto.getAnswer().trim());
                entity.setTopic(dto.getTopic() != null ? dto.getTopic().trim() : "General");
                String diff = dto.getDifficulty();
                if (diff == null || !List.of("Easy", "Medium", "Hard").contains(diff)) {
                    diff = "Medium";
                }
                entity.setDifficulty(diff);
                entity.setCreatedAt(LocalDateTime.now());
                toSave.add(entity);
            }

            List<Flashcard> saved = flashcardRepository.saveAll(toSave);
            cardDtos = saved.stream().map(c -> new FlashcardDto(
                    c.getId(),
                    c.getLectureId(),
                    c.getQuestion(),
                    c.getAnswer(),
                    c.getTopic(),
                    c.getDifficulty(),
                    c.getCreatedAt()
            )).collect(Collectors.toList());
        }

        // Annotate with user Leitner status if authenticated
        if (currentUser != null) {
            List<FlashcardProgress> progressList = flashcardProgressRepository.findByUserId(currentUser.getId());
            Map<String, String> statusMap = progressList.stream()
                    .collect(Collectors.toMap(p -> p.getFlashcard().getId(), FlashcardProgress::getStatus, (s1, s2) -> s1));

            for (FlashcardDto dto : cardDtos) {
                dto.setStatus(statusMap.getOrDefault(dto.getId(), "unlearned"));
            }
        }

        return new FlashcardListResponse(cardDtos);
    }

    @Override
    @Transactional
    public FlashcardProgressResponse updateFlashcardProgress(String lectureIdentifier, FlashcardProgressRequest request, User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication required to update flashcard progress.");
        }
        if (request == null || request.getFlashcardId() == null || request.getFlashcardId().isBlank()) {
            throw new IllegalArgumentException("Flashcard ID is required.");
        }

        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        Flashcard flashcard = flashcardRepository.findById(request.getFlashcardId().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Flashcard not found: " + request.getFlashcardId()));

        if (!flashcard.getLectureId().equals(lecture.getId())) {
            throw new IllegalArgumentException("Flashcard does not belong to the specified lecture.");
        }

        String rawStatus = request.getStatus() != null ? request.getStatus().trim().toLowerCase() : "learned";
        String status = List.of("unlearned", "learned", "difficult").contains(rawStatus) ? rawStatus : "learned";

        Optional<FlashcardProgress> existingOpt = flashcardProgressRepository.findByFlashcardIdAndUserId(flashcard.getId(), currentUser.getId());
        if (existingOpt.isPresent()) {
            FlashcardProgress progress = existingOpt.get();
            progress.setStatus(status);
            progress.setUpdatedAt(LocalDateTime.now());
            flashcardProgressRepository.save(progress);
        } else {
            String progressId = "fcp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            FlashcardProgress progress = new FlashcardProgress(progressId, flashcard, currentUser, status);
            flashcardProgressRepository.save(progress);
        }

        return new FlashcardProgressResponse(true, status);
    }
}
