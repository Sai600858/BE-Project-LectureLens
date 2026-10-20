package com.lecturelens.dto;

import java.util.List;

public class LectureListResponse {

    private List<LectureDto> lectures;

    public LectureListResponse() {}

    public LectureListResponse(List<LectureDto> lectures) {
        this.lectures = lectures;
    }

    public List<LectureDto> getLectures() {
        return lectures;
    }

    public void setLectures(List<LectureDto> lectures) {
        this.lectures = lectures;
    }
}
