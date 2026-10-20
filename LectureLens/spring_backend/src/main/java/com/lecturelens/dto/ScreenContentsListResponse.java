package com.lecturelens.dto;

import java.util.ArrayList;
import java.util.List;

public class ScreenContentsListResponse {
    private List<ScreenContentDto> contents = new ArrayList<>();

    public ScreenContentsListResponse() {}

    public ScreenContentsListResponse(List<ScreenContentDto> contents) {
        this.contents = contents != null ? contents : new ArrayList<>();
    }

    public List<ScreenContentDto> getContents() {
        return contents;
    }

    public void setContents(List<ScreenContentDto> contents) {
        this.contents = contents != null ? contents : new ArrayList<>();
    }
}
