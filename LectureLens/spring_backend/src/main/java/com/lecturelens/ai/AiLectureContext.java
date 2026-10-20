package com.lecturelens.ai;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class AiLectureContext {
    private String lectureId;
    private String lectureTitle;
    private String transcriptText;
    private String boardNotes;
    private String screenNotes;
    private List<Map<String, Object>> preservedDiagrams = Collections.emptyList();
    private String domain;

    public AiLectureContext() {}

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getLectureTitle() { return lectureTitle; }
    public void setLectureTitle(String lectureTitle) { this.lectureTitle = lectureTitle; }

    public String getTranscriptText() { return transcriptText; }
    public void setTranscriptText(String transcriptText) { this.transcriptText = transcriptText; }

    public String getBoardNotes() { return boardNotes; }
    public void setBoardNotes(String boardNotes) { this.boardNotes = boardNotes; }

    public String getScreenNotes() { return screenNotes; }
    public void setScreenNotes(String screenNotes) { this.screenNotes = screenNotes; }

    public List<Map<String, Object>> getPreservedDiagrams() { return preservedDiagrams; }
    public void setPreservedDiagrams(List<Map<String, Object>> preservedDiagrams) { this.preservedDiagrams = preservedDiagrams; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    private String hostName;
    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }
}
