package com.lecturelens;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class FlywayMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Flyway V1-V4 migrations execute successfully and create all core tables")
    public void testAllTablesCreatedByMigrations() {
        // Core tables from V1
        assertTableExists("users");
        assertTableExists("lectures");
        assertTableExists("participants");

        // Transcripts & Vision tables from V2
        assertTableExists("transcripts");
        assertTableExists("transcript_segments");
        assertTableExists("board_contents");
        assertTableExists("screen_contents");
        assertTableExists("multimodal_events");

        // Study & Documents tables from V3
        assertTableExists("lecture_chapters");
        assertTableExists("summaries");
        assertTableExists("study_notes");
        assertTableExists("quizzes");
        assertTableExists("quiz_questions");
        assertTableExists("quiz_attempts");
        assertTableExists("flashcards");
        assertTableExists("flashcard_progress");
        assertTableExists("recordings");
        assertTableExists("generated_documents");
        assertTableExists("chat_messages");

        // Research & Consistency tables from V4
        assertTableExists("salkg_cache");
        assertTableExists("salkg_guard_reports");
        assertTableExists("metadata_consistency_reports");
    }

    private void assertTableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE lower(table_name) = lower(?)",
                Integer.class,
                tableName
        );
        assertNotNull(count, "Query for table " + tableName + " should return a count");
        assertTrue(count > 0, "Table '" + tableName + "' must exist after Flyway migrations");
    }
}
