package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class BoardContentsListResponse {
    private List<BoardContentDto> contents = new ArrayList<>();

    public BoardContentsListResponse() {}

    public BoardContentsListResponse(List<BoardContentDto> contents) {
        this.contents = contents != null ? contents : new ArrayList<>();
    }

    public List<BoardContentDto> getContents() {
        return contents;
    }

    public void setContents(List<BoardContentDto> contents) {
        this.contents = contents != null ? contents : new ArrayList<>();
    }
}
