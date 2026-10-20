-- V4__init_research_and_consistency_schema.sql
-- LectureLens PostgreSQL Versioned Migration: SALKG, SALKG-Guard, and Metadata Consistency

CREATE TABLE IF NOT EXISTS salkg_cache (
    lecture_id VARCHAR(64) PRIMARY KEY,
    inferred_subject VARCHAR(255),
    alignment_json TEXT NOT NULL,
    knowledge_graph_json TEXT NOT NULL,
    validation_report_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_salkg_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS salkg_guard_reports (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    lecture_id VARCHAR(64) NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    domain VARCHAR(255),
    decision VARCHAR(64) NOT NULL,
    decision_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    report_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guard_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metadata_consistency_reports (
    id VARCHAR(64) PRIMARY KEY,
    lecture_id VARCHAR(64) NOT NULL,
    declared_title VARCHAR(255) NOT NULL,
    declared_subject VARCHAR(255),
    inferred_subject VARCHAR(255),
    consistency_status VARCHAR(64) NOT NULL CHECK(consistency_status IN ('CONSISTENT', 'POSSIBLE_MISMATCH', 'INSUFFICIENT_EVIDENCE')),
    match_type VARCHAR(64) NOT NULL,
    confidence VARCHAR(64) NOT NULL,
    explanation TEXT,
    evidence_refs_json TEXT,
    is_provisional INTEGER DEFAULT 0,
    teacher_confirmed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consistency_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guard_lecture ON salkg_guard_reports(lecture_id);
CREATE INDEX IF NOT EXISTS idx_consistency_lecture ON metadata_consistency_reports(lecture_id);
