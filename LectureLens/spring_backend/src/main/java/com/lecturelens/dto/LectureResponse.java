package com.lecturelens.dto;

public class LectureResponse {

    private LectureDto lecture;

    public LectureResponse() {}

    public LectureResponse(LectureDto lecture) {
        this.lecture = lecture;
    }

    public LectureDto getLecture() {
        return lecture;
    }

    public void setLecture(LectureDto lecture) {
        this.lecture = lecture;
    }
}
