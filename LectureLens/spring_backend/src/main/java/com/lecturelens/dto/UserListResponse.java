package com.lecturelens.dto;

import java.util.List;

public class UserListResponse {

    private List<UserDto> users;

    public UserListResponse() {}

    public UserListResponse(List<UserDto> users) {
        this.users = users;
    }

    public List<UserDto> getUsers() {
        return users;
    }

    public void setUsers(List<UserDto> users) {
        this.users = users;
    }
}
