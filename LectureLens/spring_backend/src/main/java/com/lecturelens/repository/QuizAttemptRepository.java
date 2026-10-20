package com.lecturelens.repository;

import com.lecturelens.model.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, String> {

    @Query("SELECT a FROM QuizAttempt a WHERE a.quiz.id = :quizId AND a.user.id = :userId")
    List<QuizAttempt> findByQuizIdAndUserId(@Param("quizId") String quizId, @Param("userId") String userId);

    @Query("SELECT a FROM QuizAttempt a WHERE a.user.id = :userId ORDER BY a.attemptedAt DESC")
    List<QuizAttempt> findByUserIdOrderByAttemptedAtDesc(@Param("userId") String userId);

    @Query("SELECT a FROM QuizAttempt a WHERE a.quiz.id = :quizId ORDER BY a.attemptedAt DESC")
    List<QuizAttempt> findByQuizIdOrderByAttemptedAtDesc(@Param("quizId") String quizId);
}
