package com.lecturelens.repository;

import com.lecturelens.model.Flashcard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FlashcardRepository extends JpaRepository<Flashcard, String> {
    List<Flashcard> findByLectureId(String lectureId);
    void deleteByLectureId(String lectureId);
}
