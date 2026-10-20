package com.lecturelens.repository;

import com.lecturelens.model.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, String> {
    List<QuizAttempt> findByQuizIdAndUserId(String quizId, String userId);
    List<QuizAttempt> findByUserIdOrderByAttemptedAtDesc(String userId);
}
