-- V1__init_auth_and_lecture_schema.sql
-- LectureLens PostgreSQL Versioned Migration: Auth and Lecture Core Schema

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK(role IN ('ADMIN', 'TEACHER', 'STUDENT')),
    avatar_url VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lectures (
    id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    host_id VARCHAR(64) NOT NULL,
    scheduled_at TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'LIVE', 'ENDED', 'PROCESSING', 'COMPLETED')),
    visibility VARCHAR(32) NOT NULL DEFAULT 'PUBLIC' CHECK(visibility IN ('PUBLIC', 'PRIVATE')),
    password_hash VARCHAR(255),
    subject VARCHAR(255) DEFAULT '',
    domain_context_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lectures_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    CONSTRAINT fk_participants_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lectures_host ON lectures(host_id);
CREATE INDEX IF NOT EXISTS idx_lectures_room ON lectures(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_lecture ON participants(lecture_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
