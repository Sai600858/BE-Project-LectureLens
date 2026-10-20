package com.lecturelens.dto;

import java.util.List;

public class ChapterListResponse {
    private List<ChapterDto> chapters;

    public ChapterListResponse() {}

    public ChapterListResponse(List<ChapterDto> chapters) {
        this.chapters = chapters;
    }

    public List<ChapterDto> getChapters() { return chapters; }
    public void setChapters(List<ChapterDto> chapters) { this.chapters = chapters; }
}
