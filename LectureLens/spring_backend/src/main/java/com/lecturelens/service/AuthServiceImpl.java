package com.lecturelens.service;

import com.lecturelens.dto.AuthResponse;
import com.lecturelens.dto.LoginRequest;
import com.lecturelens.dto.RegisterRequest;
import com.lecturelens.dto.UserDto;
import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.security.JwtUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})$");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request, String currentUserId, String currentUserRole) {
        if (request == null) {
            throw new IllegalArgumentException("Registration request body is required");
        }

        String name = request.getName();
        String email = request.getEmail();
        String password = request.getPassword();
        String requestedRoleStr = request.getRole();

        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Password is required");
        }

        String cleanEmail = email.toLowerCase().trim();
        if (!EMAIL_PATTERN.matcher(cleanEmail).matches()) {
            throw new IllegalArgumentException("Invalid email format");
        }

        if (password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }

        Role finalRole = Role.STUDENT;
        if (requestedRoleStr != null && !requestedRoleStr.trim().isEmpty()) {
            String roleUpper = requestedRoleStr.trim().toUpperCase();
            try {
                Role parsedRole = Role.valueOf(roleUpper);
                if (parsedRole == Role.ADMIN || parsedRole == Role.TEACHER) {
                    if (currentUserRole == null || !currentUserRole.equalsIgnoreCase("ADMIN")) {
                        throw new IllegalArgumentException("Privilege escalation prevented: only administrators can create " + roleUpper + " accounts");
                    }
                    finalRole = parsedRole;
                } else {
                    finalRole = Role.STUDENT;
                }
            } catch (IllegalArgumentException ex) {
                if (ex.getMessage().startsWith("Privilege escalation prevented")) {
                    throw ex;
                }
                throw new IllegalArgumentException("Role must be one of: " + Arrays.toString(Role.values()));
            }
        }

        if (userRepository.existsByEmail(cleanEmail)) {
            throw new IllegalArgumentException("An account with this email already exists");
        }

        String userId = "usr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String passwordHash = passwordEncoder.encode(password);

        User user = new User(userId, name.trim(), cleanEmail, passwordHash, finalRole);
        userRepository.save(user);

        log.info("[Auth] Registered new user id='{}', email='{}', role='{}'", userId, cleanEmail, finalRole);

        String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getName(), user.getRole().name());
        return new AuthResponse(UserDto.fromEntity(user), token);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Login request body is required");
        }

        String email = request.getEmail();
        String password = request.getPassword();

        if (email == null || email.trim().isEmpty() || password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Email and password are required");
        }

        String cleanEmail = email.toLowerCase().trim();
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        log.info("[Auth] Successful login for user id='{}', role='{}'", user.getId(), user.getRole());

        String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getName(), user.getRole().name());
        return new AuthResponse(UserDto.fromEntity(user), token);
    }
}
