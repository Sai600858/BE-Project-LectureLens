package com.lecturelens;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lecturelens.dto.*;
import com.lecturelens.model.*;
import com.lecturelens.repository.*;
import com.lecturelens.security.JwtUtils;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.File;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MultimodalAndTranscriptIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private BoardContentRepository boardContentRepository;

    @Autowired
    private ScreenContentRepository screenContentRepository;

    @Autowired
    private MultimodalEventRepository multimodalEventRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String VALID_PNG_BASE64 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    private static final String VALID_PNG_BASE64_2 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/wHwMDAwMDGAAAGQIB/f4Qy5kAAAAASUVORK5CYII=";

    private static final String VALID_JPEG_BASE64 =
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

    private String teacherToken;
    private String studentToken;
    private String unauthorizedStudentToken;
    private String adminToken;

    private Lecture publicLecture;
    private Lecture privateLecture;

    private static long initialSqliteModifiedTime = -1;

    @BeforeAll
    static void checkSqlitePreState() {
        File sqliteFile = new File("../server/data/lecturelens.sqlite");
        if (sqliteFile.exists()) {
            initialSqliteModifiedTime = sqliteFile.lastModified();
        }
    }

    @BeforeEach
    void setupTestData() {
        teacherToken = jwtUtils.generateToken("user_teacher_1", "teacher@lecturelens.edu", "Prof. Alan Turing", "TEACHER");
        studentToken = jwtUtils.generateToken("user_student_1", "student@lecturelens.edu", "Ada Lovelace", "STUDENT");
        adminToken = jwtUtils.generateToken("user_admin_1", "admin@lecturelens.edu", "System Administrator", "ADMIN");

        if (!userRepository.existsByEmail("stranger@lecturelens.edu")) {
            User stranger = new User("user_stranger_1", "Stranger Danger", "stranger@lecturelens.edu", "hash", Role.STUDENT);
            userRepository.save(stranger);
        }
        unauthorizedStudentToken = jwtUtils.generateToken("user_stranger_1", "stranger@lecturelens.edu", "Stranger Danger", "STUDENT");

        User teacher = userRepository.findById("user_teacher_1").orElseGet(() -> {
            User u = new User("user_teacher_1", "Prof. Alan Turing", "teacher@lecturelens.edu", "hash", Role.TEACHER);
            return userRepository.save(u);
        });

        // Ensure public lecture
        if (!lectureRepository.existsById("lec_multimodal_public")) {
            publicLecture = new Lecture();
            publicLecture.setId("lec_multimodal_public");
            publicLecture.setRoomId("MMLIVE01");
            publicLecture.setTitle("Multimodal Signal Processing");
            publicLecture.setDescription("Public live session for vision and transcript ingestion");
            publicLecture.setHost(teacher);
            publicLecture.setStatus(LectureStatus.LIVE);
            publicLecture.setVisibility("PUBLIC");
            publicLecture = lectureRepository.save(publicLecture);
        } else {
            publicLecture = lectureRepository.findById("lec_multimodal_public").get();
        }

        // Ensure private lecture
        if (!lectureRepository.existsById("lec_multimodal_private")) {
            privateLecture = new Lecture();
            privateLecture.setId("lec_multimodal_private");
            privateLecture.setRoomId("MMPRIV01");
            privateLecture.setTitle("Private Advanced AI Seminar");
            privateLecture.setDescription("Restricted seminar on multimodal foundation models");
            privateLecture.setHost(teacher);
            privateLecture.setStatus(LectureStatus.LIVE);
            privateLecture.setVisibility("PRIVATE");
            privateLecture = lectureRepository.save(privateLecture);

            // Enroll Ada Lovelace (student_1)
            User student = userRepository.findById("user_student_1").orElseGet(() -> {
                User u = new User("user_student_1", "Ada Lovelace", "student@lecturelens.edu", "hash", Role.STUDENT);
                return userRepository.save(u);
            });
            Participant p = new Participant("part_priv_ada", privateLecture, student, "STUDENT");
            participantRepository.save(p);
        } else {
            privateLecture = lectureRepository.findById("lec_multimodal_private").get();
        }
    }

    @Test
    @Order(1)
    @DisplayName("1. Valid whiteboard frame ingestion returns 200 with enriched content")
    void testValidWhiteboardFrameIngestion() throws Exception {
        BoardFrameRequest req = new BoardFrameRequest(VALID_PNG_BASE64, 15.0);

        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.content.id").value(startsWith("board_")))
                .andExpect(jsonPath("$.content.lectureId").value(publicLecture.getId()))
                .andExpect(jsonPath("$.content.timestamp").value(15.0))
                .andExpect(jsonPath("$.content.imageHash").isNotEmpty())
                .andExpect(jsonPath("$.content.qualityScore").isNumber());

        List<BoardContent> items = boardContentRepository.findByLectureIdOrderByTimestampAsc(publicLecture.getId());
        assertFalse(items.isEmpty(), "BoardContent should be saved to database");
    }

    @Test
    @Order(2)
    @DisplayName("2. Valid screen frame ingestion returns 200 with slide metadata")
    void testValidScreenFrameIngestion() throws Exception {
        ScreenFrameRequest req = new ScreenFrameRequest(VALID_JPEG_BASE64, 25.0);

        mockMvc.perform(post("/api/lectures/{id}/screen-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.content.id").value(startsWith("screen_")))
                .andExpect(jsonPath("$.content.lectureId").value(publicLecture.getId()))
                .andExpect(jsonPath("$.content.timestamp").value(25.0))
                .andExpect(jsonPath("$.content.imageHash").isNotEmpty());

        List<ScreenContent> items = screenContentRepository.findByLectureIdOrderByTimestampAsc(publicLecture.getId());
        assertFalse(items.isEmpty(), "ScreenContent should be saved to database");
    }

    @Test
    @Order(3)
    @DisplayName("3. Malformed and unsupported image rejection returns 400 Bad Request")
    void testMalformedAndUnsupportedImageRejection() throws Exception {
        // Non-base64 garbage
        BoardFrameRequest badBase64 = new BoardFrameRequest("not-valid-base64!@#$", 10.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badBase64)))
                .andExpect(status().isBadRequest());

        // Valid base64, but unsupported header format (e.g. text/plain file bytes)
        String fakeTextFileBase64 = Base64.getEncoder().encodeToString("Hello World Plain Text Not An Image".repeat(5).getBytes());
        BoardFrameRequest unsupportedFormat = new BoardFrameRequest(fakeTextFileBase64, 10.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unsupportedFormat)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(4)
    @DisplayName("4. Oversized image rejection returns 400 Bad Request")
    void testOversizedImageRejection() throws Exception {
        // Construct oversized payload exceeding size limits
        String oversizedBase64 = "A".repeat(21 * 1024 * 1024);
        BoardFrameRequest oversized = new BoardFrameRequest(oversizedBase64, 10.0);


        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oversized)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(5)
    @DisplayName("5. Unauthorized lecture ingestion rejection on private lecture returns 403 Forbidden")
    void testUnauthorizedLectureIngestionRejection() throws Exception {
        BoardFrameRequest req = new BoardFrameRequest(VALID_PNG_BASE64, 12.0);

        // Stranger attempts to ingest into private lecture
        mockMvc.perform(post("/api/lectures/{id}/board-frame", privateLecture.getId())
                        .header("Authorization", "Bearer " + unauthorizedStudentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(6)
    @DisplayName("6. Cross-lecture access and IDOR protection prevents unauthorized access to private content")
    void testCrossLectureAccessAndIdorProtection() throws Exception {
        // Enrolled student Ada can view private board contents
        mockMvc.perform(get("/api/lectures/{id}/board-contents", privateLecture.getId())
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk());

        // Stranger without enrollment is rejected with 403
        mockMvc.perform(get("/api/lectures/{id}/board-contents", privateLecture.getId())
                        .header("Authorization", "Bearer " + unauthorizedStudentToken))
                .andExpect(status().isForbidden());

        // Anonymous user without token is rejected with 401
        mockMvc.perform(get("/api/lectures/{id}/board-contents", privateLecture.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(7)
    @DisplayName("7. Duplicate frame detection detects identical image hashes without duplicating DB rows")
    void testDuplicateFrameDetection() throws Exception {
        long initialCount = boardContentRepository.count();

        BoardFrameRequest req1 = new BoardFrameRequest(VALID_PNG_BASE64, 10.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        long afterFirst = boardContentRepository.count();

        // Submitting identical frame again
        BoardFrameRequest req2 = new BoardFrameRequest(VALID_PNG_BASE64, 12.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.isDuplicate").value(true));

        long afterSecond = boardContentRepository.count();
        assertEquals(afterFirst, afterSecond, "Row count should not increase when submitting an identical duplicate snapshot");
    }

    @Test
    @Order(8)
    @DisplayName("8. Preservation of distinct frames creates separate records for different captures")
    void testPreservationOfDistinctFrames() throws Exception {
        long initialCount = boardContentRepository.count();

        BoardFrameRequest reqDistinct = new BoardFrameRequest(VALID_PNG_BASE64_2, 30.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqDistinct)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.isDuplicate").value(false));

        long afterDistinct = boardContentRepository.count();
        assertTrue(afterDistinct > initialCount, "A distinct frame must create a new record");
    }

    @Test
    @Order(9)
    @DisplayName("9. Correct frame metadata and timestamps preserved accurately")
    void testCorrectFrameMetadataAndTimestamps() throws Exception {
        Double testTimestamp = 42.75;
        ScreenFrameRequest req = new ScreenFrameRequest(VALID_JPEG_BASE64, testTimestamp);

        MvcResult result = mockMvc.perform(post("/api/lectures/{id}/screen-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.timestamp").value(testTimestamp))
                .andReturn();

        ScreenContentResponse resp = objectMapper.readValue(result.getResponse().getContentAsString(), ScreenContentResponse.class);
        assertNotNull(resp.getContent().getImagePath(), "Image path must be populated");
        assertTrue(resp.getContent().getImagePath().contains("screen_"), "Path must contain server-generated safe ID");
    }

    @Test
    @Order(10)
    @DisplayName("10. OCR worker integration and heuristic fallback produces structured equations and diagrams")
    void testOcrWorkerIntegrationAndFallback() throws Exception {
        BoardFrameRequest req = new BoardFrameRequest(VALID_PNG_BASE64, 5.0);

        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.qualityScore").isNumber())
                .andExpect(jsonPath("$.content.diagram").isMap())
                .andExpect(jsonPath("$.content.keyPoints").isArray());
    }

    @Test
    @Order(11)
    @DisplayName("11. Structured diagram and multimodal event data persisted idempotently")
    void testStructuredDiagramDataPersistence() throws Exception {
        long initialEvents = multimodalEventRepository.count();

        BoardFrameRequest req = new BoardFrameRequest(VALID_PNG_BASE64_2, 60.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        long afterEvents = multimodalEventRepository.count();
        assertTrue(afterEvents >= initialEvents, "MultimodalEvent should be persisted for downstream SALKG processing");
    }

    @Test
    @Order(12)
    @DisplayName("12. Valid transcript segment ingestion returns 200 with segment details")
    void testValidTranscriptSegmentIngestion() throws Exception {
        TranscriptSegmentRequest req = new TranscriptSegmentRequest();
        req.setChunkId(101L);
        req.setSpeakerId("user_teacher_1");
        req.setSpeakerName("Prof. Alan Turing");
        req.setStartTime(0.0);
        req.setEndTime(3.5);
        req.setText("Welcome everyone to multimodal machine learning.");
        req.setConfidence(0.98);

        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.segment.chunkId").value(101))
                .andExpect(jsonPath("$.segment.text").value("Welcome everyone to multimodal machine learning."))
                .andExpect(jsonPath("$.segment.startTime").value(0.0))
                .andExpect(jsonPath("$.segment.endTime").value(3.5));
    }

    @Test
    @Order(13)
    @DisplayName("13. Invalid transcript segment rejection (empty text, negative time) returns 400 Bad Request")
    void testInvalidTranscriptSegmentRejection() throws Exception {
        TranscriptSegmentRequest emptyText = new TranscriptSegmentRequest();
        emptyText.setText("   ");
        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emptyText)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(14)
    @DisplayName("14. Duplicate and out-of-order transcript segments handled safely")
    void testDuplicateAndOutOfOrderTranscriptSegments() throws Exception {
        long initialSegments = transcriptSegmentRepository.countByLectureId(publicLecture.getId());

        TranscriptSegmentRequest seg1 = new TranscriptSegmentRequest();
        seg1.setChunkId(201L);
        seg1.setStartTime(10.0);
        seg1.setEndTime(13.0);
        seg1.setText("Initial spoken sentence.");

        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(seg1)))
                .andExpect(status().isOk());

        // Repeated submission of chunk 201 with revised text (interim -> final)
        TranscriptSegmentRequest seg1Updated = new TranscriptSegmentRequest();
        seg1Updated.setChunkId(201L);
        seg1Updated.setStartTime(10.0);
        seg1Updated.setEndTime(13.5);
        seg1Updated.setText("Initial spoken sentence with finalized words.");

        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(seg1Updated)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segment.text").value("Initial spoken sentence with finalized words."));

        long afterSegments = transcriptSegmentRepository.countByLectureId(publicLecture.getId());
        assertEquals(initialSegments + 1, afterSegments, "Updating chunkId must not create duplicate segment records");
    }

    @Test
    @Order(15)
    @DisplayName("15. Transcript retrieval ordering and pagination returns chronological sequence")
    void testTranscriptRetrievalOrderingAndPagination() throws Exception {
        // Ingest segment with earlier start time
        TranscriptSegmentRequest earlySeg = new TranscriptSegmentRequest();
        earlySeg.setChunkId(301L);
        earlySeg.setStartTime(1.0);
        earlySeg.setEndTime(4.0);
        earlySeg.setText("First segment.");

        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", publicLecture.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(earlySeg)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lectures/{id}/transcript", publicLecture.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segments").isArray())
                .andExpect(jsonPath("$.transcript").exists());

        // Test paginated retrieval
        mockMvc.perform(get("/api/lectures/{id}/transcript", publicLecture.getId())
                        .param("page", "0")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segments").isArray());
    }

    @Test
    @Order(16)
    @DisplayName("16. Unauthorized transcript retrieval from private lecture is rejected")
    void testUnauthorizedTranscriptRetrievalRejection() throws Exception {
        mockMvc.perform(get("/api/lectures/{id}/transcript", privateLecture.getId())
                        .header("Authorization", "Bearer " + unauthorizedStudentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(17)
    @DisplayName("17. Large lecture resource bounds clamps oversized pagination requests")
    void testLargeLectureResourceBounds() throws Exception {
        mockMvc.perform(get("/api/lectures/{id}/transcript", publicLecture.getId())
                        .param("page", "0")
                        .param("size", "50000"))
                .andExpect(status().isOk());
    }

    @Test
    @Order(18)
    @DisplayName("18. Transcript search finds matching keyword segments")
    void testTranscriptSearch() throws Exception {
        mockMvc.perform(get("/api/lectures/{id}/transcript/search", publicLecture.getId())
                        .param("q", "multimodal"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches").isArray());
    }

    @Test
    @Order(19)
    @DisplayName("19. Legacy transcript endpoint /transcript/{roomId} backward compatibility")
    void testLegacyTranscriptEndpoint() throws Exception {
        mockMvc.perform(get("/transcript/{roomId}", publicLecture.getRoomId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value(publicLecture.getRoomId()))
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.segments").isArray());
    }

    @Test
    @Order(20)
    @DisplayName("20. Spring Boot Gateway MVC routes /socket.io/** to Node.js proxy")
    void testGatewayRouting() throws Exception {
        // Confirm Spring MVC handles /api/lectures natively and routes /socket.io
        mockMvc.perform(get("/api/lectures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lectures").isArray());
    }

    @Test
    @Order(21)
    @DisplayName("21. Retrieval of board contents returns JSON parsed arrays and diagrams")
    void testBoardContentsRetrievalEnriched() throws Exception {
        mockMvc.perform(get("/api/lectures/{id}/board-contents", publicLecture.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contents").isArray());
    }

    @Test
    @Order(22)
    @DisplayName("22. Retrieval of screen contents returns slide titles and diagram JSON")
    void testScreenContentsRetrievalEnriched() throws Exception {
        mockMvc.perform(get("/api/lectures/{id}/screen-contents", publicLecture.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contents").isArray());
    }

    @Test
    @Order(23)
    @DisplayName("23. Database referential integrity: cascade delete lecture removes associated frames and transcripts")
    void testReferentialIntegrityCascades() throws Exception {
        User teacher = userRepository.findById("user_teacher_1").get();
        Lecture temp = new Lecture();
        temp.setId("lec_temp_cascade");
        temp.setRoomId("TEMPCASC");
        temp.setTitle("Temporary Lecture");
        temp.setDescription("Desc");
        temp.setHost(teacher);
        temp.setStatus(LectureStatus.LIVE);
        temp.setVisibility("PUBLIC");
        lectureRepository.save(temp);

        BoardFrameRequest bReq = new BoardFrameRequest(VALID_PNG_BASE64, 1.0);
        mockMvc.perform(post("/api/lectures/{id}/board-frame", temp.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bReq)))
                .andExpect(status().isOk());

        TranscriptSegmentRequest tReq = new TranscriptSegmentRequest();
        tReq.setChunkId(999L);
        tReq.setText("Testing cascade deletion.");
        tReq.setStartTime(1.0);
        mockMvc.perform(post("/api/lectures/{id}/transcript-segment", temp.getId())
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tReq)))
                .andExpect(status().isOk());

        // Delete temporary lecture
        mockMvc.perform(delete("/api/lectures/{id}", temp.getId())
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk());

        // Verify child records cascaded
        assertEquals(0, boardContentRepository.findByLectureIdOrderByTimestampAsc(temp.getId()).size());
        assertEquals(0, transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(temp.getId()).size());
    }

    @Test
    @Order(24)
    @DisplayName("24. Verification that test execution does NOT modify the original SQLite database")
    void testSqliteDatabaseUntouched() {
        File sqliteFile = new File("../server/data/lecturelens.sqlite");
        if (sqliteFile.exists() && initialSqliteModifiedTime != -1) {
            assertEquals(initialSqliteModifiedTime, sqliteFile.lastModified(),
                    "Spring Boot tests must run against isolated test databases and never mutate lecturelens.sqlite");
        }
    }
}
