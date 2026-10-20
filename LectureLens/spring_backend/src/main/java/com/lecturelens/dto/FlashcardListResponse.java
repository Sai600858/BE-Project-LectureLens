package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class FlashcardListResponse {

    private List<FlashcardDto> flashcards = new ArrayList<>();

    public FlashcardListResponse() {}

    public FlashcardListResponse(List<FlashcardDto> flashcards) {
        this.flashcards = flashcards != null ? flashcards : new ArrayList<>();
    }

    public List<FlashcardDto> getFlashcards() { return flashcards; }
    public void setFlashcards(List<FlashcardDto> flashcards) { this.flashcards = flashcards != null ? flashcards : new ArrayList<>(); }
}
