package com.lecturelens.repository;

import com.lecturelens.model.FlashcardProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlashcardProgressRepository extends JpaRepository<FlashcardProgress, String> {

    @Query("SELECT p FROM FlashcardProgress p WHERE p.flashcard.id = :flashcardId AND p.user.id = :userId")
    Optional<FlashcardProgress> findByFlashcardIdAndUserId(@Param("flashcardId") String flashcardId, @Param("userId") String userId);

    @Query("SELECT p FROM FlashcardProgress p WHERE p.user.id = :userId")
    List<FlashcardProgress> findByUserId(@Param("userId") String userId);
}
