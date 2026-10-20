package com.lecturelens.ai;

import com.lecturelens.dto.ChapterDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiProviderOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(AiProviderOrchestrator.class);

    @Autowired
    private GeminiAiProvider geminiAiProvider;

    @Autowired
    private MockAiProvider mockAiProvider;

    @Autowired
    private HeuristicFallbackAiProvider heuristicFallbackAiProvider;

    // Concurrency deduplication lock map
    private final ConcurrentHashMap<String, Object> activeGenerationLocks = new ConcurrentHashMap<>();

    public AiSummaryResult executeSummaryGeneration(AiLectureContext context) {
        String lockKey = "summary:" + context.getLectureId();
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider (for unit/integration testing)
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for lecture '{}'", context.getLectureId());
                        return mockAiProvider.generateSummary(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock AI summary generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt primary Gemini provider if keys are available
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for lecture '{}'", context.getLectureId());
                        return geminiAiProvider.generateSummary(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini summary generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback provider for lecture '{}'", context.getLectureId());
                }

                // 3. Fallback to factual heuristic provider
                return heuristicFallbackAiProvider.generateSummary(context);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }

    public AiStudyNotesResult executeStudyNotesGeneration(AiLectureContext context, String mode) {
        String lockKey = "notes:" + context.getLectureId() + ":" + mode;
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for study notes (mode '{}') on lecture '{}'", mode, context.getLectureId());
                        return mockAiProvider.generateStudyNotes(context, mode);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock study notes generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt Gemini provider
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for study notes (mode '{}') on lecture '{}'", mode, context.getLectureId());
                        return geminiAiProvider.generateStudyNotes(context, mode);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini study notes generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback for study notes on lecture '{}'", context.getLectureId());
                }

                // 3. Fallback
                return heuristicFallbackAiProvider.generateStudyNotes(context, mode);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }

    public List<ChapterDto> executeChaptersGeneration(AiLectureContext context) {
        String lockKey = "chapters:" + context.getLectureId();
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for chapters on lecture '{}'", context.getLectureId());
                        return mockAiProvider.generateChapters(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock chapters generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt Gemini provider
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for chapters on lecture '{}'", context.getLectureId());
                        return geminiAiProvider.generateChapters(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini chapters generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback for chapters on lecture '{}'", context.getLectureId());
                }

                // 3. Fallback
                return heuristicFallbackAiProvider.generateChapters(context);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }

    public List<com.lecturelens.dto.QuizQuestionDto> executeQuizGeneration(AiLectureContext context) {
        String lockKey = "quiz:" + context.getLectureId();
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for quiz on lecture '{}'", context.getLectureId());
                        return mockAiProvider.generateQuizQuestions(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock quiz generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt Gemini provider
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for quiz on lecture '{}'", context.getLectureId());
                        return geminiAiProvider.generateQuizQuestions(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini quiz generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback for quiz on lecture '{}'", context.getLectureId());
                }

                // 3. Fallback
                return heuristicFallbackAiProvider.generateQuizQuestions(context);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }

    public List<com.lecturelens.dto.FlashcardDto> executeFlashcardGeneration(AiLectureContext context) {
        String lockKey = "flashcards:" + context.getLectureId();
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for flashcards on lecture '{}'", context.getLectureId());
                        return mockAiProvider.generateFlashcards(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock flashcards generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt Gemini provider
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for flashcards on lecture '{}'", context.getLectureId());
                        return geminiAiProvider.generateFlashcards(context);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini flashcards generation failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback for flashcards on lecture '{}'", context.getLectureId());
                }

                // 3. Fallback
                return heuristicFallbackAiProvider.generateFlashcards(context);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }

    public com.lecturelens.dto.AskLectureResponse executeRagAnswer(AiLectureContext context, String question, List<com.lecturelens.dto.RagChunkDto> relevantChunks) {
        String lockKey = "rag:" + context.getLectureId();
        Object lock = activeGenerationLocks.computeIfAbsent(lockKey, k -> new Object());

        synchronized (lock) {
            try {
                // 1. Check Mock provider
                if (mockAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Using mock AI provider for RAG on lecture '{}'", context.getLectureId());
                        return mockAiProvider.answerLectureQuestion(context, question, relevantChunks);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Mock RAG answer failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                }

                // 2. Attempt Gemini provider
                if (geminiAiProvider.isAvailable()) {
                    try {
                        log.info("[AiOrchestrator] Attempting Gemini provider for RAG on lecture '{}'", context.getLectureId());
                        return geminiAiProvider.answerLectureQuestion(context, question, relevantChunks);
                    } catch (Exception ex) {
                        log.warn("[AiOrchestrator] Gemini RAG answer failed ({}). Falling back to heuristic provider.", ex.getMessage());
                    }
                } else {
                    log.info("[AiOrchestrator] Gemini keys not configured/active. Using heuristic fallback for RAG on lecture '{}'", context.getLectureId());
                }

                // 3. Fallback
                return heuristicFallbackAiProvider.answerLectureQuestion(context, question, relevantChunks);
            } finally {
                activeGenerationLocks.remove(lockKey);
            }
        }
    }
}
