package com.lecturelens.ai;

import com.lecturelens.dto.*;

import java.util.List;

public interface AiProvider {

    String getName();

    boolean isAvailable();

    AiSummaryResult generateSummary(AiLectureContext context);

    AiStudyNotesResult generateStudyNotes(AiLectureContext context, String mode);

    List<ChapterDto> generateChapters(AiLectureContext context);

    List<QuizQuestionDto> generateQuizQuestions(AiLectureContext context);

    List<FlashcardDto> generateFlashcards(AiLectureContext context);

    AskLectureResponse answerLectureQuestion(AiLectureContext context, String question, List<RagChunkDto> relevantChunks);
}
