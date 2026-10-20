package com.lecturelens.repository;

import com.lecturelens.model.FlashcardProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlashcardProgressRepository extends JpaRepository<FlashcardProgress, String> {
    Optional<FlashcardProgress> findByFlashcardIdAndUserId(String flashcardId, String userId);
    List<FlashcardProgress> findByUserId(String userId);
}
