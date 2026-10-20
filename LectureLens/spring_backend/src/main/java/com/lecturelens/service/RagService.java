package com.lecturelens.service;

import com.lecturelens.dto.AskLectureRequest;
import com.lecturelens.dto.AskLectureResponse;
import com.lecturelens.model.User;

public interface RagService {

    AskLectureResponse askLecture(String lectureIdentifier, AskLectureRequest request, User currentUser);
}
