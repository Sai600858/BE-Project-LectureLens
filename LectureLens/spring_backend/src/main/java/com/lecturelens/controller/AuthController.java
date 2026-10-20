package com.lecturelens.controller;

import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name = body.get("name");
        String password = body.get("password");
        String roleStr = body.getOrDefault("role", "STUDENT");

        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
        }

        Role role = Role.valueOf(roleStr.toUpperCase());
        String userId = "usr_" + UUID.randomUUID().toString().substring(0, 8);
        User user = new User(userId, name, email, passwordEncoder.encode(password), role);
        userRepository.save(user);

        String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getRole().name());

        Map<String, Object> resp = new HashMap<>();
        resp.put("user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "role", user.getRole()));
        resp.put("token", token);

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }

        String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getRole().name());

        Map<String, Object> resp = new HashMap<>();
        resp.put("user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "role", user.getRole()));
        resp.put("token", token);

        return ResponseEntity.ok(resp);
    }
}
