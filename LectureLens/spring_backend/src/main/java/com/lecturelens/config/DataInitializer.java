package com.lecturelens.config;

import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedUserIfNotExists("user_teacher_1", "Prof. Alan Turing", "teacher@lecturelens.edu", "password123", Role.TEACHER);
        seedUserIfNotExists("user_student_1", "Ada Lovelace", "student@lecturelens.edu", "password123", Role.STUDENT);
        seedUserIfNotExists("user_admin_1", "System Administrator", "admin@lecturelens.edu", "admin123", Role.ADMIN);
    }

    private void seedUserIfNotExists(String id, String name, String email, String rawPassword, Role role) {
        if (!userRepository.existsByEmail(email)) {
            User user = new User(id, name, email, passwordEncoder.encode(rawPassword), role);
            user.setCreatedAt(LocalDateTime.now());
            userRepository.save(user);
            log.info("[DataInitializer] Seeded baseline {} account: {}", role, email);
        }
    }
}
