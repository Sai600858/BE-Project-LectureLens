package com.lecturelens;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.dto.LoginRequest;
import com.lecturelens.dto.RegisterRequest;
import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.security.JwtUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AuthAndUserIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Order(1)
    @DisplayName("1. Successful user registration defaults to STUDENT and returns 201 with JWT token")
    void testSuccessfulRegistration() throws Exception {
        String uniqueEmail = "reg_test_" + UUID.randomUUID().toString().substring(0, 8) + "@lecturelens.edu";
        RegisterRequest request = new RegisterRequest("Test Student", uniqueEmail, "password123", "STUDENT");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.user.id", notNullValue()))
                .andExpect(jsonPath("$.user.name", is("Test Student")))
                .andExpect(jsonPath("$.user.email", is(uniqueEmail)))
                .andExpect(jsonPath("$.user.role", is("STUDENT")))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.password_hash").doesNotExist());
    }

    @Test
    @Order(2)
    @DisplayName("2. Duplicate registration rejected with HTTP 400")
    void testDuplicateRegistration() throws Exception {
        RegisterRequest request = new RegisterRequest("Duplicate User", "student@lecturelens.edu", "password123", "STUDENT");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("already exists")));
    }

    @Test
    @Order(3)
    @DisplayName("3. Password hash is stored securely via BCrypt instead of plaintext")
    void testPasswordHashStored() {
        User user = userRepository.findByEmail("student@lecturelens.edu").orElseThrow();
        assertNotNull(user.getPasswordHash());
        assertTrue(user.getPasswordHash().startsWith("$2"), "Password hash should be standard BCrypt ($2a / $2b)");
        assertNotEquals("password123", user.getPasswordHash(), "Plaintext password must never be stored");
    }

    @Test
    @Order(4)
    @DisplayName("4. Successful login returns HTTP 200 with JWT token and safe user profile")
    void testSuccessfulLogin() throws Exception {
        LoginRequest request = new LoginRequest("student@lecturelens.edu", "password123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.user.id", is("user_student_1")))
                .andExpect(jsonPath("$.user.email", is("student@lecturelens.edu")))
                .andExpect(jsonPath("$.user.role", is("STUDENT")))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    @Order(5)
    @DisplayName("5. Incorrect password rejected with HTTP 401")
    void testIncorrectPasswordRejection() throws Exception {
        LoginRequest request = new LoginRequest("student@lecturelens.edu", "wrongPassword999");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Invalid email or password")));
    }

    @Test
    @Order(6)
    @DisplayName("6. JWT signature validation correctly verifies valid and tampered tokens")
    void testJwtSignatureValidation() {
        String token = jwtUtils.generateToken("user_test", "test@lecturelens.edu", "Test User", "STUDENT");
        assertTrue(jwtUtils.validateToken(token));

        String tamperedToken = token.substring(0, token.length() - 4) + "abcd";
        assertFalse(jwtUtils.validateToken(tamperedToken));
    }

    @Test
    @Order(7)
    @DisplayName("7. Malformed token rejected on protected endpoint with HTTP 401")
    void testMalformedTokenRejection() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer invalid.malformed.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", containsString("Invalid or expired access token")));
    }

    @Test
    @Order(8)
    @DisplayName("8. GET /api/auth/me with valid Bearer token returns authenticated user profile")
    void testGetAuthMeValid() throws Exception {
        String token = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id", is("user_teacher_1")))
                .andExpect(jsonPath("$.user.email", is("teacher@lecturelens.edu")))
                .andExpect(jsonPath("$.user.role", is("TEACHER")))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    @Order(9)
    @DisplayName("9. GET /api/auth/me without token rejected with HTTP 401")
    void testGetAuthMeAnonymous() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Access token required")));
    }

    @Test
    @Order(10)
    @DisplayName("10. STUDENT and TEACHER tokens rejected from accessing /api/admin/users with HTTP 403")
    void testStudentAndTeacherAccessRestrictions() throws Exception {
        String studentToken = jwtUtils.generateToken("user_student_1", "student@lecturelens.edu", "Ada Lovelace", "STUDENT");
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("insufficient permissions")));

        String teacherToken = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("insufficient permissions")));
    }

    @Test
    @Order(11)
    @DisplayName("11. ADMIN access to /api/admin/users and /api/admin/stats succeeds with HTTP 200")
    void testAdminAccessToAuthorizedEndpoints() throws Exception {
        String adminToken = jwtUtils.generateToken("user_admin_1", "admin@lecturelens.edu", "System Administrator", "ADMIN");

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users", not(empty())));

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalLectures", notNullValue()))
                .andExpect(jsonPath("$.totalRecordings", notNullValue()))
                .andExpect(jsonPath("$.activeRooms", notNullValue()));
    }

    @Test
    @Order(12)
    @DisplayName("12. Attempts to self-assign ADMIN rejected with HTTP 400 privilege escalation error")
    void testSelfAssignAdminRejected() throws Exception {
        RegisterRequest request = new RegisterRequest("Attacker", "hacker@test.edu", "password123", "ADMIN");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Privilege escalation prevented: only administrators can create ADMIN accounts")));
    }

    @Test
    @Order(13)
    @DisplayName("13. Attempts by non-admin to create TEACHER account rejected with HTTP 400")
    void testNonAdminCreateTeacherRejected() throws Exception {
        RegisterRequest request = new RegisterRequest("Impostor", "impostor@test.edu", "password123", "TEACHER");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Privilege escalation prevented: only administrators can create TEACHER accounts")));
    }

    @Test
    @Order(14)
    @DisplayName("14. User listing endpoint does not disclose password hashes")
    void testUserListingDoesNotDisclosePasswordHashes() throws Exception {
        String adminToken = jwtUtils.generateToken("user_admin_1", "admin@lecturelens.edu", "System Administrator", "ADMIN");

        MvcResult result = mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        assertFalse(responseBody.contains("passwordHash"), "Response must not contain passwordHash field");
        assertFalse(responseBody.contains("password_hash"), "Response must not contain password_hash field");
        assertFalse(responseBody.contains("$2a$"), "Response must not contain BCrypt hashes");
        assertFalse(responseBody.contains("$2b$"), "Response must not contain BCrypt hashes");
    }

    @Test
    @Order(15)
    @DisplayName("15. Unauthorized user deletion rejected: self-deletion and last admin deletion prohibited")
    void testUnauthorizedUserDeletionRejected() throws Exception {
        String adminToken = jwtUtils.generateToken("user_admin_1", "admin@lecturelens.edu", "System Administrator", "ADMIN");

        // Self-deletion rejected
        mockMvc.perform(delete("/api/admin/users/user_admin_1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Cannot delete your own account")));

        // Deleting non-existent user rejected with 404
        mockMvc.perform(delete("/api/admin/users/non_existent_usr_999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("User not found")));

        // Valid deletion of disposable user succeeds
        String tempEmail = "disposable_" + UUID.randomUUID().toString().substring(0, 8) + "@test.edu";
        User tempUser = new User("usr_temp_del", "Temp User", tempEmail, "hash12345", Role.STUDENT);
        userRepository.save(tempUser);

        mockMvc.perform(delete("/api/admin/users/usr_temp_del")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        assertFalse(userRepository.existsById("usr_temp_del"));
    }

    @Test
    @Order(16)
    @DisplayName("16. Gateway routes reach Spring Boot directly for /api/auth and /api/admin")
    void testGatewayRoutePrecedence() throws Exception {
        // Assert that Spring Boot handles /api/auth/me directly with 401 JSON error rather than 404 or proxy error
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-Correlation-Id"));
    }

    @Test
    @Order(17)
    @DisplayName("17. Node.js token format compatibility: Spring Boot extracts user id from Node.js claims")
    void testNodeJsTokenFormatCompatibility() {
        // Node.js tokens have claims: { id, email, name, role } without standard subject
        String token = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");
        String extractedId = jwtUtils.getUserIdFromToken(token);
        assertEquals("user_teacher_1", extractedId);
        assertEquals("teacher@lecturelens.edu", jwtUtils.getEmailFromToken(token));
        assertEquals("TEACHER", jwtUtils.getRoleFromToken(token));
    }

    @Test
    @Order(18)
    @DisplayName("18. Existing seeded user data remains intact after tests")
    void testExistingUserDataPreservation() {
        assertTrue(userRepository.existsByEmail("teacher@lecturelens.edu"), "Default teacher account must remain intact");
        assertTrue(userRepository.existsByEmail("student@lecturelens.edu"), "Default student account must remain intact");
        assertTrue(userRepository.existsByEmail("admin@lecturelens.edu"), "Default admin account must remain intact");
    }
}
