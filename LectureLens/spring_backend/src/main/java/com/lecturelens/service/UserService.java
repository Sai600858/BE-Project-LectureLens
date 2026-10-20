package com.lecturelens.service;

import com.lecturelens.dto.AdminStatsResponse;
import com.lecturelens.dto.UserDto;
import com.lecturelens.dto.UserListResponse;

public interface UserService {
    UserDto getUserProfile(String userId);
    UserListResponse listAllUsers();
    void deleteUser(String targetUserId, String currentAdminId);
    AdminStatsResponse getAdminStats();
}
