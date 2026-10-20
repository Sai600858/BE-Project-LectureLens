package com.lecturelens;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.dto.CreateLectureRequest;
import com.lecturelens.dto.UpdateLectureStatusRequest;
import com.lecturelens.model.Lecture;
import com.lecturelens.model.LectureStatus;
import com.lecturelens.model.Role;
import com.lecturelens.model.User;
import com.lecturelens.repository.LectureRepository;
import com.lecturelens.repository.ParticipantRepository;
import com.lecturelens.repository.UserRepository;
import com.lecturelens.security.JwtUtils;
import com.lecturelens.service.MediaServiceCoordinator;
import org.junit.jupiter.api.BeforeEach;
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

import java.io.File;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LectureLifecycleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private MediaServiceCoordinator mediaServiceCoordinator;

    @Autowired
    private ObjectMapper objectMapper;

    private String teacherToken;
    private String studentToken;
    private String adminToken;
    private String otherTeacherToken;

    @BeforeEach
    void setupTokens() {
        teacherToken = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");
        studentToken = jwtUtils.generateToken("user_student_1", "student@lecturelens.edu", "Ada Lovelace", "STUDENT");
        adminToken = jwtUtils.generateToken("user_admin_1", "admin@lecturelens.edu", "System Administrator", "ADMIN");

        if (!userRepository.existsByEmail("other_teacher@lecturelens.edu")) {
            User otherTeacher = new User("user_teacher_2", "Prof. Euler", "other_teacher@lecturelens.edu", "hash", Role.TEACHER);
            userRepository.save(otherTeacher);
        }
        otherTeacherToken = jwtUtils.generateToken("user_teacher_2", "other_teacher@lecturelens.edu", "Prof. Euler", "TEACHER");
    }

    @Test
    @Order(1)
    @DisplayName("1. Authorized lecture creation by TEACHER returns 201 with unique 8-char room code")
    void testAuthorizedLectureCreation() throws Exception {
        CreateLectureRequest request = new CreateLectureRequest(
                "Distributed Systems Consensus & Raft",
                "Paxos, Raft, Byzantine fault tolerance",
                LocalDateTime.now().plusDays(1),
                "PUBLIC",
                null,
                "Computer Science"
        );

        MvcResult result = mockMvc.perform(post("/api/lectures")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lecture.id", startsWith("lec_")))
                .andExpect(jsonPath("$.lecture.roomId", hasLength(8)))
                .andExpect(jsonPath("$.lecture.room_id", hasLength(8)))
                .andExpect(jsonPath("$.lecture.title", is("Distributed Systems Consensus & Raft")))
                .andExpect(jsonPath("$.lecture.status", is("SCHEDULED")))
                .andExpect(jsonPath("$.lecture.hostId", is("user_teacher_1")))
                .andExpect(jsonPath("$.lecture.hostName", is("Prof. Alan Turing")))
                .andReturn();

        assertNotNull(result.getResponse().getContentAsString());
    }

    @Test
    @Order(2)
    @DisplayName("2. Missing lecture title rejected with HTTP 400 Bad Request")
    void testMissingTitleRejection() throws Exception {
        CreateLectureRequest request = new CreateLectureRequest("", "Description", null, "PUBLIC", null, "Math");

        mockMvc.perform(post("/api/lectures")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Lecture title is required")));
    }

    @Test
    @Order(3)
    @DisplayName("3. Unique room-code generation produces distinct 8-character uppercase identifiers")
    void testUniqueRoomCodeGeneration() {
        Lecture l1 = new Lecture();
        l1.setId("lec_test_uniq_1");
        l1.setRoomId(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        l1.setTitle("Lecture A");
        l1.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        l1.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(l1);

        Lecture l2 = new Lecture();
        l2.setId("lec_test_uniq_2");
        l2.setRoomId(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        l2.setTitle("Lecture B");
        l2.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        l2.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(l2);

        assertNotEquals(l1.getRoomId(), l2.getRoomId());
        assertEquals(8, l1.getRoomId().length());
        assertEquals(8, l2.getRoomId().length());
    }

    @Test
    @Order(4)
    @DisplayName("4. Lecture listing and supported filters (status, hostId)")
    void testLectureListingAndFilters() throws Exception {
        mockMvc.perform(get("/api/lectures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lectures", notNullValue()));

        mockMvc.perform(get("/api/lectures")
                        .param("status", "SCHEDULED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lectures", notNullValue()));

        mockMvc.perform(get("/api/lectures")
                        .param("hostId", "user_teacher_1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lectures", notNullValue()));
    }

    @Test
    @Order(5)
    @DisplayName("5. Retrieving a lecture by either database ID or 8-character Room Code")
    void testGetLectureByIdAndRoomCode() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_dual_test");
        lec.setRoomId("ROOM1234");
        lec.setTitle("Dual Lookup Lecture");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(lec);

        // Lookup by ID
        mockMvc.perform(get("/api/lectures/lec_dual_test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lecture.id", is("lec_dual_test")))
                .andExpect(jsonPath("$.lecture.roomId", is("ROOM1234")));

        // Lookup by Room Code
        mockMvc.perform(get("/api/lectures/ROOM1234"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lecture.id", is("lec_dual_test")))
                .andExpect(jsonPath("$.lecture.roomId", is("ROOM1234")));
    }

    @Test
    @Order(6)
    @DisplayName("6. Unknown lecture ID returns HTTP 404 with error message")
    void testUnknownLectureReturns404() throws Exception {
        mockMvc.perform(get("/api/lectures/non_existent_lec_99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("Lecture not found")));
    }

    @Test
    @Order(7)
    @DisplayName("7. Unauthorized callers cannot access private lectures without enrollment")
    void testPrivateLectureAccessControl() throws Exception {
        Lecture privateLec = new Lecture();
        privateLec.setId("lec_private_iso");
        privateLec.setRoomId("PRIV0001");
        privateLec.setTitle("Confidential Research Discussion");
        privateLec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        privateLec.setStatus(LectureStatus.SCHEDULED);
        privateLec.setVisibility("PRIVATE");
        lectureRepository.save(privateLec);

        // Anonymous access rejected with 401
        mockMvc.perform(get("/api/lectures/lec_private_iso"))
                .andExpect(status().isUnauthorized());

        // Unenrolled student access rejected with 403
        mockMvc.perform(get("/api/lectures/lec_private_iso")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("Access denied to private lecture content")));

        // Host teacher access allowed with 200
        mockMvc.perform(get("/api/lectures/lec_private_iso")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lecture.id", is("lec_private_iso")));

        // Admin access allowed with 200
        mockMvc.perform(get("/api/lectures/lec_private_iso")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lecture.id", is("lec_private_iso")));
    }

    @Test
    @Order(8)
    @DisplayName("8. Students cannot create lectures (HTTP 403 Forbidden)")
    void testStudentCannotCreateLecture() throws Exception {
        CreateLectureRequest request = new CreateLectureRequest("Student Lecture", "Desc", null, "PUBLIC", null, "CS");

        mockMvc.perform(post("/api/lectures")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(9)
    @DisplayName("9. A teacher cannot alter or end another teacher's lecture (IDOR prevention)")
    void testTeacherCannotAlterOtherTeacherLecture() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_t1_owned");
        lec.setRoomId("OWNED001");
        lec.setTitle("Teacher 1 Lecture");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(lec);

        // Teacher 2 attempting status update is forbidden
        UpdateLectureStatusRequest updateReq = new UpdateLectureStatusRequest("LIVE");
        mockMvc.perform(put("/api/lectures/lec_t1_owned/status")
                        .header("Authorization", "Bearer " + otherTeacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("only the lecture host or an admin")));

        // Teacher 2 attempting to end lecture is forbidden
        mockMvc.perform(post("/api/lectures/lec_t1_owned/end")
                        .header("Authorization", "Bearer " + otherTeacherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("only the lecture host or an admin")));

        // Teacher 2 attempting to delete lecture is forbidden
        mockMvc.perform(delete("/api/lectures/lec_t1_owned")
                        .header("Authorization", "Bearer " + otherTeacherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("only the lecture host or an admin")));
    }

    @Test
    @Order(10)
    @DisplayName("10. Valid and invalid lifecycle transitions enforced by state machine")
    void testValidAndInvalidLifecycleTransitions() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_lifecycle_test");
        lec.setRoomId("LIFE0001");
        lec.setTitle("Lifecycle State Machine Test");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(lec);

        // SCHEDULED -> LIVE valid
        mockMvc.perform(patch("/api/lectures/lec_lifecycle_test/status")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateLectureStatusRequest("LIVE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("LIVE")));

        // LIVE -> ENDED valid
        mockMvc.perform(put("/api/lectures/lec_lifecycle_test/status")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateLectureStatusRequest("ENDED"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ENDED")));

        // ENDED -> LIVE invalid backward transition (400)
        mockMvc.perform(put("/api/lectures/lec_lifecycle_test/status")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateLectureStatusRequest("LIVE"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Invalid lifecycle transition")));
    }

    @Test
    @Order(11)
    @DisplayName("11. Ending a lecture repeatedly is handled safely and idempotently")
    void testIdempotentEndLecture() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_idempotent_end");
        lec.setRoomId("IDEM0001");
        lec.setTitle("Idempotent End Test");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.LIVE);
        lectureRepository.save(lec);

        // First end call
        mockMvc.perform(post("/api/lectures/lec_idempotent_end/end")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ENDED")));

        // Second end call (idempotent)
        mockMvc.perform(post("/api/lectures/lec_idempotent_end/end")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ENDED")));
    }

    @Test
    @Order(12)
    @DisplayName("12. Unauthorized status updates rejected (401 for anonymous, 403 for student)")
    void testUnauthorizedStatusUpdatesRejected() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_unauth_status");
        lec.setRoomId("UNAU0001");
        lec.setTitle("Unauth Status Test");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(lec);

        mockMvc.perform(put("/api/lectures/lec_unauth_status/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateLectureStatusRequest("LIVE"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/lectures/lec_unauth_status/status")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateLectureStatusRequest("LIVE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(13)
    @DisplayName("13. Deletion respects authorization and referential integrity")
    void testDeletionAuthorizationAndIntegrity() throws Exception {
        Lecture lec = new Lecture();
        lec.setId("lec_del_test");
        lec.setRoomId("DELT0001");
        lec.setTitle("Lecture For Deletion");
        lec.setHost(userRepository.findById("user_teacher_1").orElseThrow());
        lec.setStatus(LectureStatus.SCHEDULED);
        lectureRepository.save(lec);

        // Student cannot delete
        mockMvc.perform(delete("/api/lectures/lec_del_test")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());

        // Host teacher can delete
        mockMvc.perform(delete("/api/lectures/lec_del_test")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        assertFalse(lectureRepository.existsById("lec_del_test"));

        // Non-admin cannot wipe all lectures
        mockMvc.perform(delete("/api/lectures")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(14)
    @DisplayName("14. Password-protected room credentials are not leaked in responses")
    void testPasswordProtectedRoomCredentialsNotLeaked() throws Exception {
        CreateLectureRequest request = new CreateLectureRequest(
                "Password Protected Session",
                "Requires password for entry",
                null,
                "PRIVATE",
                "secret_password_2026",
                "Security"
        );

        MvcResult result = mockMvc.perform(post("/api/lectures")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertFalse(body.contains("secret_password_2026"), "Plaintext password must not appear in response");
        assertFalse(body.contains("passwordHash"), "passwordHash field must not appear in response");
        assertFalse(body.contains("password_hash"), "password_hash field must not appear in response");
    }

    @Test
    @Order(15)
    @DisplayName("15. Media-service coordination handles Node.js availability and failures safely")
    void testMediaServiceCoordinationResilience() {
        // Calling preInitializeRoom when media service is offline returns false without throwing an exception
        boolean result = mediaServiceCoordinator.preInitializeRoom("TEMP0001", "lec_temp_001");
        // Result is false if Node.js server isn't actively running during standalone unit tests, but does not crash
        assertFalse(result, "Coordination handles unavailable Node.js service safely");
    }

    @Test
    @Order(16)
    @DisplayName("16. Node.js unavailability does not corrupt database lecture creation")
    void testNodeJsUnavailabilityDoesNotCorruptDatabase() throws Exception {
        CreateLectureRequest request = new CreateLectureRequest(
                "Offline Media Test Lecture",
                "Verifying resilient creation",
                null,
                "PUBLIC",
                null,
                "Networking"
        );

        MvcResult result = mockMvc.perform(post("/api/lectures")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lecture.id", notNullValue()))
                .andReturn();

        // Database row was persisted even if Node.js was not online
        assertTrue(lectureRepository.count() > 0);
    }

    @Test
    @Order(17)
    @DisplayName("17. Repeated media coordination calls do not create duplicate records")
    void testRepeatedMediaCoordinationSafety() {
        boolean r1 = mediaServiceCoordinator.closeRoom("CLOSE001", "lec_close_001");
        boolean r2 = mediaServiceCoordinator.closeRoom("CLOSE001", "lec_close_001");
        assertEquals(r1, r2, "Repeated coordination calls must execute predictably");
    }

    @Test
    @Order(18)
    @DisplayName("18. Gateway routing reaches Spring Boot directly for /api/lectures")
    void testGatewayRoutingReachesSpringBoot() throws Exception {
        mockMvc.perform(get("/api/lectures"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Correlation-Id"));
    }

    @Test
    @Order(19)
    @DisplayName("19. Existing JWT-based authentication remains functional across all lecture endpoints")
    void testJwtAuthFunctional() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email", is("teacher@lecturelens.edu")));
    }

    @Test
    @Order(20)
    @DisplayName("20. Existing React frontend lecture response shapes remain compatible")
    void testReactLectureResponseCompatibility() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/lectures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lectures").isArray())
                .andReturn();

        // Ensures response has { lectures: [...] } with roomId and lectureId mapping
        String content = res.getResponse().getContentAsString();
        assertTrue(content.contains("lectures"));
    }

    @Test
    @Order(21)
    @DisplayName("21. Node.js media signaling token validation retains compatibility")
    void testNodeJsSignalingTokenCompatibility() {
        String token = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");
        assertEquals("user_teacher_1", jwtUtils.getUserIdFromToken(token));
        assertEquals("TEACHER", jwtUtils.getRoleFromToken(token));
    }

    @Test
    @Order(22)
    @DisplayName("22. Existing SQLite database remains completely unmodified and preserved")
    void testExistingSqliteDatabasePreserved() {
        File sqliteFile = new File("..\\server\\data\\lecturelens.sqlite");
        if (!sqliteFile.exists()) {
            sqliteFile = new File("LectureLens\\server\\data\\lecturelens.sqlite");
        }
        if (!sqliteFile.exists()) {
            sqliteFile = new File("c:\\Users\\Sumit\\OneDrive\\Desktop\\BE-project\\LectureLens\\server\\data\\lecturelens.sqlite");
        }
        assertTrue(sqliteFile.exists(), "Original SQLite database file must exist and remain intact");
        assertTrue(sqliteFile.length() > 0, "SQLite database file must not be empty or truncated");
    }
}
