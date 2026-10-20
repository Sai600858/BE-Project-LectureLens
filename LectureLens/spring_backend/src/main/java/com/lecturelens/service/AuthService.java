package com.lecturelens.service;

import com.lecturelens.dto.AuthResponse;
import com.lecturelens.dto.LoginRequest;
import com.lecturelens.dto.RegisterRequest;

public interface AuthService {
    AuthResponse register(RegisterRequest request, String currentUserId, String currentUserRole);
    AuthResponse login(LoginRequest request);
}
