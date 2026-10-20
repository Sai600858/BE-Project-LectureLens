package com.lecturelens.dto;

public class AdminStatsResponse {

    private long totalUsers;
    private long totalLectures;
    private long totalRecordings;
    private int activeRooms;

    public AdminStatsResponse() {}

    public AdminStatsResponse(long totalUsers, long totalLectures, long totalRecordings, int activeRooms) {
        this.totalUsers = totalUsers;
        this.totalLectures = totalLectures;
        this.totalRecordings = totalRecordings;
        this.activeRooms = activeRooms;
    }

    public long getTotalUsers() {
        return totalUsers;
    }

    public void setTotalUsers(long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public long getTotalLectures() {
        return totalLectures;
    }

    public void setTotalLectures(long totalLectures) {
        this.totalLectures = totalLectures;
    }

    public long getTotalRecordings() {
        return totalRecordings;
    }

    public void setTotalRecordings(long totalRecordings) {
        this.totalRecordings = totalRecordings;
    }

    public int getActiveRooms() {
        return activeRooms;
    }

    public void setActiveRooms(int activeRooms) {
        this.activeRooms = activeRooms;
    }
}
