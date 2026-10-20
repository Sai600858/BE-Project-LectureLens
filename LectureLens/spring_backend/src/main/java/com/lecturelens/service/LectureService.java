package com.lecturelens.service;

import com.lecturelens.dto.CreateLectureRequest;
import com.lecturelens.dto.LectureDto;
import com.lecturelens.dto.LectureListResponse;

import java.util.Map;

public interface LectureService {
    LectureDto createLecture(CreateLectureRequest request, String hostUserId, String hostUserRole);
    LectureListResponse listLectures(String statusFilter, String hostIdFilter, String currentUserId, String currentUserRole);
    LectureDto getLectureByIdOrRoomId(String identifier, String currentUserId, String currentUserRole);
    LectureDto updateStatus(String identifier, String newStatusStr, String currentUserId, String currentUserRole);
    Map<String, Object> endLecture(String identifier, String currentUserId, String currentUserRole);
    void deleteLecture(String identifier, String currentUserId, String currentUserRole);
    void clearAllLectures(String currentUserId, String currentUserRole);
}
