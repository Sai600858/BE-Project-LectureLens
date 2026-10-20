package com.lecturelens.service;

import com.lecturelens.dto.QuizAttemptResponse;
import com.lecturelens.dto.QuizResponse;
import com.lecturelens.dto.QuizSubmissionRequest;
import com.lecturelens.model.User;

import java.util.List;

public interface QuizService {

    QuizResponse getOrGenerateQuiz(String lectureIdentifier, User currentUser);

    QuizResponse regenerateQuiz(String lectureIdentifier, User currentUser);

    QuizAttemptResponse submitQuiz(String lectureIdentifier, QuizSubmissionRequest request, User currentUser);

    List<QuizAttemptResponse> getQuizAttempts(String lectureIdentifier, User currentUser);
}
