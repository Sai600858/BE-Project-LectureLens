package com.lecturelens;

import com.lecturelens.model.*;
import com.lecturelens.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class EntityMappingTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LectureRepository lectureRepository;

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private TranscriptSegmentRepository transcriptSegmentRepository;

    @Autowired
    private BoardContentRepository boardContentRepository;

    @Autowired
    private ScreenContentRepository screenContentRepository;

    @Autowired
    private QuizRepository quizRepository;

    @Autowired
    private QuizQuestionRepository quizQuestionRepository;

    @Autowired
    private FlashcardRepository flashcardRepository;

    @Autowired
    private FlashcardProgressRepository flashcardProgressRepository;

    @Autowired
    private SalkgCacheRepository salkgCacheRepository;

    @Autowired
    private MetadataConsistencyReportRepository metadataConsistencyReportRepository;

    @Test
    @DisplayName("Persist and query User entity with Role validation")
    public void testUserEntityPersistence() {
        String userId = "usr_" + UUID.randomUUID().toString().substring(0, 8);
        User user = new User(userId, "Test Professor", "prof." + userId + "@lecturelens.edu", "$2a$10$hashedpw", Role.TEACHER);
        user.setAvatarUrl("https://lecturelens.edu/avatars/prof.png");

        userRepository.save(user);

        User found = userRepository.findById(userId).orElse(null);
        assertNotNull(found);
        assertEquals("Test Professor", found.getName());
        assertEquals(Role.TEACHER, found.getRole());
        assertTrue(userRepository.existsByEmail(user.getEmail()));
    }

    @Test
    @DisplayName("Persist Lecture and Participant with relational integrity")
    public void testLectureAndParticipantPersistence() {
        String hostId = "usr_host_" + UUID.randomUUID().toString().substring(0, 8);
        User host = userRepository.save(new User(hostId, "Host Teacher", "host." + hostId + "@lecturelens.edu", "pw", Role.TEACHER));

        String studentId = "usr_stud_" + UUID.randomUUID().toString().substring(0, 8);
        User student = userRepository.save(new User(studentId, "Student One", "stud." + studentId + "@lecturelens.edu", "pw", Role.STUDENT));

        String lectureId = "lec_" + UUID.randomUUID().toString().substring(0, 8);
        Lecture lecture = new Lecture();
        lecture.setId(lectureId);
        lecture.setRoomId(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        lecture.setTitle("Distributed Systems Architecture");
        lecture.setDescription("Deep dive into microservices and consensus");
        lecture.setHost(host);
        lecture.setStatus(LectureStatus.SCHEDULED);
        lecture.setSubject("Computer Science");
        lecture.setDomainContextJson("{\"domain\":\"Engineering\"}");
        lectureRepository.save(lecture);

        Participant participant = new Participant("part_" + UUID.randomUUID().toString().substring(0, 8), lecture, student, "STUDENT");
        participantRepository.save(participant);

        assertTrue(participantRepository.existsByLectureIdAndUserId(lectureId, studentId));
        assertEquals(1, participantRepository.findByLectureId(lectureId).size());
    }

    @Test
    @DisplayName("Persist Transcript and TranscriptSegments with ordered retrieval")
    public void testTranscriptAndSegments() {
        User host = userRepository.save(new User("usr_h_" + UUID.randomUUID().toString().substring(0, 8), "Host", "h@edu.org", "pw", Role.TEACHER));
        Lecture lecture = new Lecture();
        lecture.setId("lec_t_" + UUID.randomUUID().toString().substring(0, 8));
        lecture.setRoomId("ROOM_" + UUID.randomUUID().toString().substring(0, 4));
        lecture.setTitle("Quantum Physics");
        lecture.setHost(host);
        lectureRepository.save(lecture);

        Transcript transcript = new Transcript();
        transcript.setId("tr_" + UUID.randomUUID().toString().substring(0, 8));
        transcript.setLectureId(lecture.getId());
        transcript.setFullText("Initial lecture speech text.");
        transcriptRepository.save(transcript);

        TranscriptSegment seg1 = new TranscriptSegment();
        seg1.setLectureId(lecture.getId());
        seg1.setSpeakerId("spk_1");
        seg1.setSpeakerName("Host");
        seg1.setStartTime(0.0);
        seg1.setEndTime(5.0);
        seg1.setText("Welcome everyone.");

        TranscriptSegment seg2 = new TranscriptSegment();
        seg2.setLectureId(lecture.getId());
        seg2.setSpeakerId("spk_1");
        seg2.setSpeakerName("Host");
        seg2.setStartTime(5.5);
        seg2.setEndTime(12.0);
        seg2.setText("Today we cover wave functions.");

        transcriptSegmentRepository.save(seg1);
        transcriptSegmentRepository.save(seg2);

        var segments = transcriptSegmentRepository.findByLectureIdOrderByStartTimeAsc(lecture.getId());
        assertEquals(2, segments.size());
        assertEquals("Welcome everyone.", segments.get(0).getText());
    }

    @Test
    @DisplayName("Persist BoardContent and ScreenContent with deduplication hash")
    public void testBoardAndScreenContentsWithHash() {
        User host = userRepository.save(new User("usr_b_" + UUID.randomUUID().toString().substring(0, 8), "Host", "b@edu.org", "pw", Role.TEACHER));
        Lecture lecture = new Lecture();
        lecture.setId("lec_b_" + UUID.randomUUID().toString().substring(0, 8));
        lecture.setRoomId("ROOM_B" + UUID.randomUUID().toString().substring(0, 4));
        lecture.setTitle("Organic Chemistry");
        lecture.setHost(host);
        lectureRepository.save(lecture);

        BoardContent board = new BoardContent();
        board.setId("bc_" + UUID.randomUUID().toString().substring(0, 8));
        board.setLecture(lecture);
        board.setTimestamp(14.2);
        board.setExtractedText("Benzene ring synthesis mechanism");
        board.setImageHash("sha256_mock_hash_12345");
        board.setEquationsJson("[{\"eq\":\"C6H6\"}]");
        boardContentRepository.save(board);

        var foundBoard = boardContentRepository.findByLectureIdAndImageHash(lecture.getId(), "sha256_mock_hash_12345");
        assertTrue(foundBoard.isPresent());
        assertEquals("Benzene ring synthesis mechanism", foundBoard.get().getExtractedText());
    }

    @Test
    @DisplayName("Persist Quiz and FlashcardProgress with unique constraints")
    public void testQuizAndFlashcardProgress() {
        User teacher = userRepository.save(new User("usr_q_" + UUID.randomUUID().toString().substring(0, 8), "Teacher", "t@edu.org", "pw", Role.TEACHER));
        User student = userRepository.save(new User("usr_s_" + UUID.randomUUID().toString().substring(0, 8), "Student", "s@edu.org", "pw", Role.STUDENT));

        Lecture lecture = new Lecture();
        lecture.setId("lec_q_" + UUID.randomUUID().toString().substring(0, 8));
        lecture.setRoomId("ROOM_Q" + UUID.randomUUID().toString().substring(0, 4));
        lecture.setTitle("Data Structures");
        lecture.setHost(teacher);
        lectureRepository.save(lecture);

        Quiz quiz = new Quiz();
        quiz.setId("qz_" + UUID.randomUUID().toString().substring(0, 8));
        quiz.setLectureId(lecture.getId());
        quiz.setTitle("Binary Search Trees Quiz");
        quizRepository.save(quiz);

        QuizQuestion q1 = new QuizQuestion();
        q1.setId("qq_1");
        q1.setQuizId(quiz.getId());
        q1.setQuestionText("What is the search complexity of a balanced BST?");
        q1.setType("MCQ");
        q1.setOptionsJson("[\"O(1)\", \"O(log n)\", \"O(n)\"]");
        q1.setCorrectAnswer("O(log n)");
        q1.setExplanation("Balanced trees divide search space in half");
        q1.setDifficulty("Medium");
        q1.setTopic("Trees");
        quizQuestionRepository.save(q1);

        Flashcard flashcard = new Flashcard();
        flashcard.setId("fc_1");
        flashcard.setLectureId(lecture.getId());
        flashcard.setQuestion("In-order traversal order");
        flashcard.setAnswer("Left, Root, Right");
        flashcard.setTopic("Trees");
        flashcard.setDifficulty("Easy");
        flashcardRepository.save(flashcard);

        FlashcardProgress progress = new FlashcardProgress("fcp_1", flashcard, student, "learned");
        flashcardProgressRepository.save(progress);

        var foundProgress = flashcardProgressRepository.findByFlashcardIdAndUserId("fc_1", student.getId());
        assertTrue(foundProgress.isPresent());
        assertEquals("learned", foundProgress.get().getStatus());
    }

    @Test
    @DisplayName("Persist Research SALKG Cache and Metadata Consistency Report")
    public void testResearchAndConsistencyPersistence() {
        User teacher = userRepository.save(new User("usr_res_" + UUID.randomUUID().toString().substring(0, 8), "Teacher", "res@edu.org", "pw", Role.TEACHER));
        Lecture lecture = new Lecture();
        lecture.setId("lec_res_" + UUID.randomUUID().toString().substring(0, 8));
        lecture.setRoomId("ROOM_R" + UUID.randomUUID().toString().substring(0, 4));
        lecture.setTitle("AI & Ethics");
        lecture.setHost(teacher);
        lectureRepository.save(lecture);

        SalkgCache cache = new SalkgCache(lecture.getId(), "Computer Science", "{\"matches\":[]}", "{\"nodes\":[]}", "{\"status\":\"valid\"}");
        salkgCacheRepository.save(cache);

        MetadataConsistencyReport report = new MetadataConsistencyReport();
        report.setId("mcr_" + UUID.randomUUID().toString().substring(0, 8));
        report.setLecture(lecture);
        report.setDeclaredTitle("AI & Ethics");
        report.setInferredSubject("Computer Science");
        report.setConsistencyStatus("CONSISTENT");
        report.setMatchType("EXACT_DOMAIN_ALIGNMENT");
        report.setConfidence("HIGH");
        metadataConsistencyReportRepository.save(report);

        var cached = salkgCacheRepository.findByLectureId(lecture.getId());
        assertTrue(cached.isPresent());
        assertEquals("Computer Science", cached.get().getInferredSubject());

        var fetchedReport = metadataConsistencyReportRepository.findTopByLectureIdOrderByCreatedAtDesc(lecture.getId());
        assertTrue(fetchedReport.isPresent());
        assertEquals("CONSISTENT", fetchedReport.get().getConsistencyStatus());
    }
}
