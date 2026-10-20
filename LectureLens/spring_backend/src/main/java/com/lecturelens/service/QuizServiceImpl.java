package com.lecturelens.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.stream.Collectors;

@Service
public class QuizServiceImpl implements QuizService {

    private static final Logger log = LoggerFactory.getLogger(QuizServiceImpl.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private QuizRepository quizRepository;

    @Autowired
    private QuizQuestionRepository quizQuestionRepository;

    @Autowired
    private QuizAttemptRepository quizAttemptRepository;

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
                throw new AccessDeniedException("Authentication required to access private lecture quiz.");
            }
            boolean isHost = currentUser.getId().equals(lecture.getHostId());
            boolean isAdmin = currentUser.getRole() == Role.ADMIN;
            boolean isEnrolled = participantRepository.existsByLectureIdAndUserId(lecture.getId(), currentUser.getId());
            if (!isHost && !isAdmin && !isEnrolled) {
                throw new AccessDeniedException("Access denied: You are not authorized to view this lecture's quiz.");
            }
        }
        return lecture;
    }

    private boolean isTeacherOrAdmin(Lecture lecture, User user) {
        if (user == null) return false;
        if (user.getRole() == Role.ADMIN || user.getRole() == Role.TEACHER) return true;
        return lecture != null && user.getId().equals(lecture.getHostId());
    }

    @Override
    @Transactional
    public QuizResponse getOrGenerateQuiz(String lectureIdentifier, User currentUser) {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        String resolvedId = lecture.getId();

        Optional<Quiz> existingOpt = quizRepository.findByLectureId(resolvedId);
        if (existingOpt.isPresent()) {
            Quiz quiz = existingOpt.get();
            List<QuizQuestion> questions = quizQuestionRepository.findByQuizId(quiz.getId());
            if (!questions.isEmpty()) {
                return buildQuizResponse(quiz, questions, lecture, currentUser);
            }
        }

        return generateNewQuiz(lecture, currentUser);
    }

    @Override
    @Transactional
    public QuizResponse regenerateQuiz(String lectureIdentifier, User currentUser) {
        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        if (currentUser == null || !isTeacherOrAdmin(lecture, currentUser)) {
            throw new AccessDeniedException("Only the lecture host, teachers, or administrators can regenerate quizzes.");
        }

        String resolvedId = lecture.getId();
        Optional<Quiz> existingOpt = quizRepository.findByLectureId(resolvedId);
        if (existingOpt.isPresent()) {
            quizQuestionRepository.deleteByQuizId(existingOpt.get().getId());
            quizRepository.delete(existingOpt.get());
        }

        return generateNewQuiz(lecture, currentUser);
    }

    private QuizResponse generateNewQuiz(Lecture lecture, User currentUser) {
        AiLectureContext context = aiContextAssemblyService.assembleContext(lecture.getId());
        List<QuizQuestionDto> generatedDtos = aiProviderOrchestrator.executeQuizGeneration(context);

        if (generatedDtos == null || generatedDtos.isEmpty()) {
            throw new IllegalStateException("AI quiz generation produced no questions.");
        }

        String quizId = "quiz_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        Quiz quiz = new Quiz();
        quiz.setId(quizId);
        quiz.setLectureId(lecture.getId());
        quiz.setTitle((lecture.getTitle() != null ? lecture.getTitle() : "Lecture") + " Assessment Quiz");
        quiz.setCreatedAt(LocalDateTime.now());
        quizRepository.save(quiz);

        List<QuizQuestion> savedQuestions = new ArrayList<>();
        for (QuizQuestionDto dto : generatedDtos) {
            if (dto.getQuestionText() == null || dto.getQuestionText().isBlank()) {
                continue;
            }

            QuizQuestion entity = new QuizQuestion();
            entity.setId("qq_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            entity.setQuizId(quizId);
            entity.setQuestionText(dto.getQuestionText().trim());

            String type = dto.getType();
            if (type == null || !List.of("MCQ", "TRUE_FALSE", "FILL_BLANK", "SHORT_ANSWER").contains(type.toUpperCase())) {
                type = "MCQ";
            }
            entity.setType(type.toUpperCase());

            try {
                entity.setOptionsJson(MAPPER.writeValueAsString(dto.getOptions() != null ? dto.getOptions() : List.of()));
            } catch (Exception e) {
                entity.setOptionsJson("[]");
            }

            entity.setCorrectAnswer(dto.getCorrectAnswer() != null ? dto.getCorrectAnswer().trim() : "Answer");
            entity.setExplanation(dto.getExplanation() != null ? dto.getExplanation().trim() : "");

            String diff = dto.getDifficulty();
            if (diff == null || !List.of("Easy", "Medium", "Hard").contains(diff)) {
                diff = "Medium";
            }
            entity.setDifficulty(diff);
            entity.setTopic(dto.getTopic() != null ? dto.getTopic().trim() : "General");
            entity.setCreatedAt(LocalDateTime.now());

            quizQuestionRepository.save(entity);
            savedQuestions.add(entity);
        }

        return buildQuizResponse(quiz, savedQuestions, lecture, currentUser);
    }

    private QuizResponse buildQuizResponse(Quiz quiz, List<QuizQuestion> questions, Lecture lecture, User currentUser) {
        boolean canSeeAnswers = isTeacherOrAdmin(lecture, currentUser);

        QuizDto quizDto = new QuizDto(quiz.getId(), quiz.getLectureId(), quiz.getTitle(), quiz.getCreatedAt());
        List<QuizQuestionDto> questionDtos = questions.stream().map(q -> {
            List<String> options = new ArrayList<>();
            try {
                if (q.getOptionsJson() != null && !q.getOptionsJson().isBlank()) {
                    options = MAPPER.readValue(q.getOptionsJson(), new TypeReference<List<String>>() {});
                }
            } catch (Exception ignored) {}

            QuizQuestionDto dto = new QuizQuestionDto();
            dto.setId(q.getId());
            dto.setQuizId(q.getQuizId());
            dto.setQuestionText(q.getQuestionText());
            dto.setType(q.getType());
            dto.setOptions(options);
            dto.setDifficulty(q.getDifficulty());
            dto.setTopic(q.getTopic());

            if (canSeeAnswers) {
                dto.setCorrectAnswer(q.getCorrectAnswer());
                dto.setExplanation(q.getExplanation());
            } else {
                dto.setCorrectAnswer(null);
                dto.setExplanation(null);
            }
            return dto;
        }).collect(Collectors.toList());

        return new QuizResponse(quizDto, questionDtos);
    }

    @Override
    @Transactional
    public QuizAttemptResponse submitQuiz(String lectureIdentifier, QuizSubmissionRequest request, User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication required to submit quiz attempt.");
        }
        if (request == null || request.getQuizId() == null || request.getQuizId().isBlank()) {
            throw new IllegalArgumentException("Quiz ID is required for submission.");
        }

        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        Quiz quiz = quizRepository.findById(request.getQuizId())
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found: " + request.getQuizId()));

        if (!quiz.getLectureId().equals(lecture.getId())) {
            throw new IllegalArgumentException("Quiz does not belong to the requested lecture.");
        }

        List<QuizQuestion> questions = quizQuestionRepository.findByQuizId(quiz.getId());
        if (questions == null || questions.isEmpty()) {
            throw new IllegalStateException("No questions found for quiz: " + quiz.getId());
        }

        Map<String, String> answers = request.getAnswers() != null ? request.getAnswers() : Collections.emptyMap();
        int score = 0;
        Set<String> weakTopics = new LinkedHashSet<>();
        List<QuizQuestionResultDto> results = new ArrayList<>();

        for (QuizQuestion q : questions) {
            String studentAnswer = answers.getOrDefault(q.getId(), "").trim();
            String studentAnswerLower = studentAnswer.toLowerCase();
            String correctAnswer = q.getCorrectAnswer() != null ? q.getCorrectAnswer().trim() : "";
            String correctAnswerLower = correctAnswer.toLowerCase();

            boolean isCorrect = false;
            if ("SHORT_ANSWER".equalsIgnoreCase(q.getType())) {
                isCorrect = studentAnswer.length() >= 5;
            } else {
                isCorrect = studentAnswerLower.equals(correctAnswerLower);
            }

            if (isCorrect) {
                score++;
            } else {
                if (q.getTopic() != null && !q.getTopic().isBlank()) {
                    weakTopics.add(q.getTopic().trim());
                }
            }

            results.add(new QuizQuestionResultDto(
                    q.getId(),
                    q.getQuestionText(),
                    studentAnswer,
                    correctAnswer,
                    isCorrect,
                    q.getExplanation(),
                    q.getDifficulty(),
                    q.getTopic()
            ));
        }

        int totalQuestions = questions.size();
        int percentage = Math.round(((float) score / totalQuestions) * 100);
        String attemptId = "att_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        QuizAttempt attempt = new QuizAttempt();
        attempt.setId(attemptId);
        attempt.setQuiz(quiz);
        attempt.setUser(currentUser);
        attempt.setScore(score);
        attempt.setTotalQuestions(totalQuestions);
        attempt.setAttemptedAt(LocalDateTime.now());

        try {
            attempt.setAnswersJson(MAPPER.writeValueAsString(answers));
            attempt.setWeakTopicsJson(MAPPER.writeValueAsString(new ArrayList<>(weakTopics)));
        } catch (Exception ignored) {}

        quizAttemptRepository.save(attempt);

        return new QuizAttemptResponse(
                attemptId,
                quiz.getId(),
                currentUser.getId(),
                score,
                totalQuestions,
                percentage,
                new ArrayList<>(weakTopics),
                results,
                attempt.getAttemptedAt()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> getQuizAttempts(String lectureIdentifier, User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication required to view quiz attempts.");
        }

        Lecture lecture = resolveLectureAndCheckAccess(lectureIdentifier, currentUser);
        Quiz quiz = quizRepository.findByLectureId(lecture.getId()).orElse(null);
        if (quiz == null) {
            return Collections.emptyList();
        }

        List<QuizAttempt> attempts;
        if (isTeacherOrAdmin(lecture, currentUser)) {
            attempts = quizAttemptRepository.findByQuizIdOrderByAttemptedAtDesc(quiz.getId());
        } else {
            attempts = quizAttemptRepository.findByQuizIdAndUserId(quiz.getId(), currentUser.getId());
        }

        List<QuizQuestion> questions = quizQuestionRepository.findByQuizId(quiz.getId());
        Map<String, QuizQuestion> questionMap = questions.stream()
                .collect(Collectors.toMap(QuizQuestion::getId, q -> q));

        return attempts.stream().map(att -> {
            int score = att.getScore() != null ? att.getScore() : 0;
            int total = att.getTotalQuestions() != null && att.getTotalQuestions() > 0 ? att.getTotalQuestions() : 1;
            int pct = Math.round(((float) score / total) * 100);

            List<String> weakTopics = new ArrayList<>();
            try {
                if (att.getWeakTopicsJson() != null) {
                    weakTopics = MAPPER.readValue(att.getWeakTopicsJson(), new TypeReference<List<String>>() {});
                }
            } catch (Exception ignored) {}

            Map<String, String> savedAnswers = new HashMap<>();
            try {
                if (att.getAnswersJson() != null) {
                    savedAnswers = MAPPER.readValue(att.getAnswersJson(), new TypeReference<Map<String, String>>() {});
                }
            } catch (Exception ignored) {}

            List<QuizQuestionResultDto> results = new ArrayList<>();
            for (Map.Entry<String, String> entry : savedAnswers.entrySet()) {
                QuizQuestion q = questionMap.get(entry.getKey());
                if (q != null) {
                    String userAns = entry.getValue();
                    boolean isCorrect = userAns.equalsIgnoreCase(q.getCorrectAnswer());
                    results.add(new QuizQuestionResultDto(
                            q.getId(), q.getQuestionText(), userAns,
                            q.getCorrectAnswer(), isCorrect, q.getExplanation(),
                            q.getDifficulty(), q.getTopic()
                    ));
                }
            }

            return new QuizAttemptResponse(
                    att.getId(),
                    quiz.getId(),
                    att.getUser().getId(),
                    score,
                    total,
                    pct,
                    weakTopics,
                    results,
                    att.getAttemptedAt()
            );
        }).collect(Collectors.toList());
    }
}
