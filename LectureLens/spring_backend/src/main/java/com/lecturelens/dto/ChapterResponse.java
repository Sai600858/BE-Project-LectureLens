package com.lecturelens.dto;

public class ChapterResponse {
    private ChapterDto chapter;

    public ChapterResponse() {}

    public ChapterResponse(ChapterDto chapter) {
        this.chapter = chapter;
    }

    public ChapterDto getChapter() { return chapter; }
    public void setChapter(ChapterDto chapter) { this.chapter = chapter; }
}
