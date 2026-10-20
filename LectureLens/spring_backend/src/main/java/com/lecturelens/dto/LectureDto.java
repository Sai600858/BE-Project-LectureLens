package com.lecturelens.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.lecturelens.model.Lecture;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class LectureDto {

    private String id;

    @JsonProperty("lectureId")
    private String lectureId;

    @JsonProperty("roomId")
    private String roomId;

    @JsonProperty("room_id")
    private String roomIdSnake;

    private String title;
    private String description;

    @JsonProperty("hostId")
    private String hostId;

    @JsonProperty("host_id")
    private String hostIdSnake;

    @JsonProperty("hostName")
    private String hostName;

    @JsonProperty("host_name")
    private String hostNameSnake;

    @JsonProperty("hostEmail")
    private String hostEmail;

    @JsonProperty("host_email")
    private String hostEmailSnake;

    @JsonProperty("scheduled_at")
    private LocalDateTime scheduledAt;

    @JsonProperty("start_time")
    private LocalDateTime startTime;

    @JsonProperty("end_time")
    private LocalDateTime endTime;

    private String status;
    private String visibility;
    private String subject;

    @JsonProperty("segmentCount")
    private Long segmentCount;

    @JsonProperty("segment_count")
    private Long segmentCountSnake;

    @JsonProperty("hasRecording")
    private Integer hasRecording;

    @JsonProperty("has_recording")
    private Integer hasRecordingSnake;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    public LectureDto() {}

    public static LectureDto fromEntity(Lecture lecture) {
        return fromEntity(lecture, 0L, 0);
    }

    public static LectureDto fromEntity(Lecture lecture, long segmentCount, int hasRecording) {
        if (lecture == null) return null;

        LectureDto dto = new LectureDto();
        dto.id = lecture.getId();
        dto.lectureId = lecture.getId();
        dto.roomId = lecture.getRoomId();
        dto.roomIdSnake = lecture.getRoomId();
        dto.title = lecture.getTitle();
        dto.description = lecture.getDescription();

        if (lecture.getHost() != null) {
            dto.hostId = lecture.getHost().getId();
            dto.hostIdSnake = lecture.getHost().getId();
            dto.hostName = lecture.getHost().getName();
            dto.hostNameSnake = lecture.getHost().getName();
            dto.hostEmail = lecture.getHost().getEmail();
            dto.hostEmailSnake = lecture.getHost().getEmail();
        }

        dto.scheduledAt = lecture.getScheduledAt();
        dto.startTime = lecture.getStartTime();
        dto.endTime = lecture.getEndTime();
        dto.status = lecture.getStatus() != null ? lecture.getStatus().name() : "SCHEDULED";
        dto.visibility = lecture.getVisibility() != null ? lecture.getVisibility() : "PUBLIC";
        dto.subject = lecture.getSubject() != null ? lecture.getSubject() : "";
        dto.segmentCount = segmentCount;
        dto.segmentCountSnake = segmentCount;
        dto.hasRecording = hasRecording;
        dto.hasRecordingSnake = hasRecording;
        dto.createdAt = lecture.getCreatedAt();

        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLectureId() { return lectureId; }
    public void setLectureId(String lectureId) { this.lectureId = lectureId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) {
        this.roomId = roomId;
        this.roomIdSnake = roomId;
    }

    public String getRoomIdSnake() { return roomIdSnake; }
    public void setRoomIdSnake(String roomIdSnake) {
        this.roomIdSnake = roomIdSnake;
        this.roomId = roomIdSnake;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getHostId() { return hostId; }
    public void setHostId(String hostId) {
        this.hostId = hostId;
        this.hostIdSnake = hostId;
    }

    public String getHostIdSnake() { return hostIdSnake; }
    public void setHostIdSnake(String hostIdSnake) {
        this.hostIdSnake = hostIdSnake;
        this.hostId = hostIdSnake;
    }

    public String getHostName() { return hostName; }
    public void setHostName(String hostName) {
        this.hostName = hostName;
        this.hostNameSnake = hostName;
    }

    public String getHostNameSnake() { return hostNameSnake; }
    public void setHostNameSnake(String hostNameSnake) {
        this.hostNameSnake = hostNameSnake;
        this.hostName = hostNameSnake;
    }

    public String getHostEmail() { return hostEmail; }
    public void setHostEmail(String hostEmail) {
        this.hostEmail = hostEmail;
        this.hostEmailSnake = hostEmail;
    }

    public String getHostEmailSnake() { return hostEmailSnake; }
    public void setHostEmailSnake(String hostEmailSnake) {
        this.hostEmailSnake = hostEmailSnake;
        this.hostEmail = hostEmailSnake;
    }

    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public Long getSegmentCount() { return segmentCount; }
    public void setSegmentCount(Long segmentCount) {
        this.segmentCount = segmentCount;
        this.segmentCountSnake = segmentCount;
    }

    public Long getSegmentCountSnake() { return segmentCountSnake; }
    public void setSegmentCountSnake(Long segmentCountSnake) {
        this.segmentCountSnake = segmentCountSnake;
        this.segmentCount = segmentCountSnake;
    }

    public Integer getHasRecording() { return hasRecording; }
    public void setHasRecording(Integer hasRecording) {
        this.hasRecording = hasRecording;
        this.hasRecordingSnake = hasRecording;
    }

    public Integer getHasRecordingSnake() { return hasRecordingSnake; }
    public void setHasRecordingSnake(Integer hasRecordingSnake) {
        this.hasRecordingSnake = hasRecordingSnake;
        this.hasRecording = hasRecordingSnake;
    }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
