-- V3__init_study_and_documents_schema.sql
-- LectureLens PostgreSQL Versioned Migration: Study Materials and Documents

CREATE TABLE IF NOT EXISTS lecture_chapters (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time DOUBLE PRECISION NOT NULL,
    end_time DOUBLE PRECISION,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chapters_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    CONSTRAINT uq_chapters_lecture_title_time UNIQUE (lecture_id, title, start_time)
);

CREATE TABLE IF NOT EXISTS summaries (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) UNIQUE NOT NULL,
    short_summary TEXT,
    detailed_summary TEXT,
    key_concepts_json TEXT,
    definitions_json TEXT,
    examples_json TEXT,
    key_takeaways_json TEXT,
    topics_covered_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_summaries_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_notes (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    mode VARCHAR(32) NOT NULL CHECK(mode IN ('short', 'detailed', 'exam', 'beginner')),
    title VARCHAR(255) NOT NULL,
    content_markdown TEXT NOT NULL,
    formulas_json TEXT,
    diagrams_json TEXT,
    questions_json TEXT,
    sections_json TEXT DEFAULT '[]',
    visualizations_json TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_study_notes_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    CONSTRAINT uq_study_notes_lecture_mode UNIQUE (lecture_id, mode)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quizzes_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(64) PRIMARY KEY,
    quiz_id VARCHAR(64) NOT NULL,
    question_text TEXT NOT NULL,
    type VARCHAR(32) NOT NULL CHECK(type IN ('MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')),
    options_json TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(32) NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    topic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id VARCHAR(64) PRIMARY KEY,
    quiz_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    answers_json TEXT,
    weak_topics_json TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcards (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    topic VARCHAR(255),
    difficulty VARCHAR(32) NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_flashcards_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcard_progress (
    id VARCHAR(64) PRIMARY KEY,
    flashcard_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unlearned' CHECK(status IN ('unlearned', 'learned', 'difficult')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_progress_flashcard FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE,
    CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_flashcard_progress_user UNIQUE (flashcard_id, user_id)
);

CREATE TABLE IF NOT EXISTS recordings (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) UNIQUE NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    duration_seconds DOUBLE PRECISION DEFAULT 0,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(64) DEFAULT 'video/webm',
    status VARCHAR(32) DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recordings_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_documents (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    doc_type VARCHAR(32) NOT NULL CHECK(doc_type IN ('TRANSCRIPT_PDF', 'SUMMARY_PDF', 'STUDY_NOTES_PDF')),
    file_path VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    sender_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    pinned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chapters_lecture ON lecture_chapters(lecture_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_lecture ON flashcards(lecture_id);
CREATE INDEX IF NOT EXISTS idx_chat_lecture ON chat_messages(lecture_id);
