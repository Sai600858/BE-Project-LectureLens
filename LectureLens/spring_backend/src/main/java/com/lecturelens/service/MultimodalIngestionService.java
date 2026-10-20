package com.lecturelens.service;

import com.lecturelens.dto.BoardContentDto;
import com.lecturelens.dto.BoardFrameRequest;
import com.lecturelens.dto.ScreenContentDto;
import com.lecturelens.dto.ScreenFrameRequest;

import java.util.List;

public interface MultimodalIngestionService {
    BoardContentDto processBoardFrame(String lectureIdentifier, BoardFrameRequest request, String currentUserId, String currentUserRole);
    ScreenContentDto processScreenFrame(String lectureIdentifier, ScreenFrameRequest request, String currentUserId, String currentUserRole);
    List<BoardContentDto> getBoardContents(String lectureIdentifier, String currentUserId, String currentUserRole);
    List<ScreenContentDto> getScreenContents(String lectureIdentifier, String currentUserId, String currentUserRole);
}
