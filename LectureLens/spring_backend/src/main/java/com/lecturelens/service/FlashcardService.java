package com.lecturelens.service;

import com.lecturelens.dto.FlashcardListResponse;
import com.lecturelens.dto.FlashcardProgressRequest;
import com.lecturelens.dto.FlashcardProgressResponse;
import com.lecturelens.model.User;

public interface FlashcardService {

    FlashcardListResponse getOrGenerateFlashcards(String lectureIdentifier, User currentUser);

    FlashcardProgressResponse updateFlashcardProgress(String lectureIdentifier, FlashcardProgressRequest request, User currentUser);
}
