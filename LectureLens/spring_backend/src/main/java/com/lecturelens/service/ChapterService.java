package com.lecturelens.service;

import com.lecturelens.dto.ChapterDto;
import com.lecturelens.dto.ChapterUpdateRequest;

import java.util.List;

public interface ChapterService {

    List<ChapterDto> getChapters(String lectureIdentifier, String currentUserId, String currentUserRole);

    List<ChapterDto> generateChapters(String lectureIdentifier, boolean forceRegenerate, String currentUserId, String currentUserRole);

    ChapterDto updateChapter(String lectureIdentifier, String chapterId, ChapterUpdateRequest request, String currentUserId, String currentUserRole);

    List<ChapterDto> validateAndOrderChapters(List<ChapterDto> rawChapters, Double lectureDuration);
}
