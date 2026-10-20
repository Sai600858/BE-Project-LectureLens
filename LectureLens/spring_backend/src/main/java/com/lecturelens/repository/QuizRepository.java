package com.lecturelens.repository;

import com.lecturelens.model.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, String> {
    Optional<Quiz> findByLectureId(String lectureId);
    void deleteByLectureId(String lectureId);
}
