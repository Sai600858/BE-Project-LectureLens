package com.lecturelens.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "flashcard_progress", uniqueConstraints = {
    @UniqueConstraint(name = "uq_flashcard_progress_user", columnNames = {"flashcard_id", "user_id"})
})
public class FlashcardProgress {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flashcard_id", nullable = false)
    private Flashcard flashcard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String status = "unlearned";

    private LocalDateTime updatedAt = LocalDateTime.now();

    public FlashcardProgress() {}

    public FlashcardProgress(String id, Flashcard flashcard, User user, String status) {
        this.id = id;
        this.flashcard = flashcard;
        this.user = user;
        this.status = status != null ? status : "unlearned";
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Flashcard getFlashcard() { return flashcard; }
    public void setFlashcard(Flashcard flashcard) { this.flashcard = flashcard; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
