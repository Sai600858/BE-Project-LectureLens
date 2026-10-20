const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'lecturelens.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[Database] Failed to connect to SQLite:', err.message);
  } else {
    console.log('[Database] Connected to persistent SQLite database at:', DB_PATH);
    // Bug #8 fix: Enable foreign keys immediately on this connection
    db.run('PRAGMA foreign_keys = ON;', (fkErr) => {
      if (fkErr) console.warn('[Database] Failed to enable foreign keys:', fkErr.message);
      else console.log('[Database] Foreign key enforcement enabled.');
    });
  }
});

// Run with promises helper
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  // Bug #8 fix: Re-enforce foreign keys at init time (belt-and-suspenders with connection-level PRAGMA)
  await run(`PRAGMA foreign_keys = ON;`);

  // 1. Users
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'TEACHER', 'STUDENT')),
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Lectures
  await run(`
    CREATE TABLE IF NOT EXISTS lectures (
      id TEXT PRIMARY KEY,
      room_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      host_id TEXT NOT NULL,
      scheduled_at DATETIME,
      start_time DATETIME,
      end_time DATETIME,
      status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'LIVE', 'ENDED', 'PROCESSING', 'COMPLETED')),
      visibility TEXT NOT NULL DEFAULT 'PUBLIC' CHECK(visibility IN ('PUBLIC', 'PRIVATE')),
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Participants
  await run(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STUDENT',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 4. Transcripts
  await run(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      lecture_id TEXT UNIQUE NOT NULL,
      full_text TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'live' CHECK(status IN ('live', 'complete')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 5. Transcript Segments
  await run(`
    CREATE TABLE IF NOT EXISTS transcript_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lecture_id TEXT NOT NULL,
      chunk_id INTEGER,
      speaker_id TEXT,
      speaker_name TEXT,
      start_time REAL NOT NULL,
      end_time REAL,
      text TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 6. Board Contents
  await run(`
    CREATE TABLE IF NOT EXISTS board_contents (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      timestamp REAL NOT NULL,
      image_path TEXT,
      extracted_text TEXT,
      equation TEXT,
      diagram_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 7. Screen Contents
  await run(`
    CREATE TABLE IF NOT EXISTS screen_contents (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      timestamp REAL NOT NULL,
      image_path TEXT,
      slide_title TEXT,
      extracted_text TEXT,
      code_snippet TEXT,
      diagram_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 8. Multimodal Events
  await run(`
    CREATE TABLE IF NOT EXISTS multimodal_events (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      timestamp REAL NOT NULL,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      audio_text TEXT,
      visual_content TEXT,
      combined_insight TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 9. Lecture Chapters
  // Bug #28 fix: UNIQUE on (lecture_id, title, start_time) prevents duplicate chapter rows
  await run(`
    CREATE TABLE IF NOT EXISTS lecture_chapters (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lecture_id, title, start_time),
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 10. Summaries
  await run(`
    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY,
      lecture_id TEXT UNIQUE NOT NULL,
      short_summary TEXT,
      detailed_summary TEXT,
      key_concepts_json TEXT,
      definitions_json TEXT,
      examples_json TEXT,
      key_takeaways_json TEXT,
      topics_covered_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 11. Study Notes
  // Bug #27 fix: UNIQUE on (lecture_id, mode) prevents duplicate note rows
  await run(`
    CREATE TABLE IF NOT EXISTS study_notes (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('short', 'detailed', 'exam', 'beginner')),
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      formulas_json TEXT,
      diagrams_json TEXT,
      questions_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lecture_id, mode),
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 12. Quizzes & Questions
  await run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      lecture_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')),
      options_json TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answers_json TEXT,
      weak_topics_json TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 13. Flashcards & Progress
  await run(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      topic TEXT,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS flashcard_progress (
      id TEXT PRIMARY KEY,
      flashcard_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unlearned' CHECK(status IN ('unlearned', 'learned', 'difficult')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(flashcard_id, user_id),
      FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 14. Recordings
  await run(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      lecture_id TEXT UNIQUE NOT NULL,
      file_path TEXT NOT NULL,
      duration_seconds REAL DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT 'video/webm',
      status TEXT DEFAULT 'COMPLETED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 15. Generated Documents (PDFs)
  await run(`
    CREATE TABLE IF NOT EXISTS generated_documents (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('TRANSCRIPT_PDF', 'SUMMARY_PDF', 'STUDY_NOTES_PDF')),
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 16. Chat Messages
  await run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      user_id TEXT,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 17. SALKG Alignment & Knowledge Graph Cache
  await run(`
    CREATE TABLE IF NOT EXISTS salkg_cache (
      lecture_id TEXT PRIMARY KEY,
      inferred_subject TEXT,
      alignment_json TEXT NOT NULL,
      knowledge_graph_json TEXT NOT NULL,
      validation_report_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // 18. SALKG-Guard Machine-Readable Validation Reports
  await run(`
    CREATE TABLE IF NOT EXISTS salkg_guard_reports (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      lecture_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      domain TEXT,
      decision TEXT NOT NULL,
      decision_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      report_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // Create Indexes
  await run(`CREATE INDEX IF NOT EXISTS idx_lectures_host ON lectures(host_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_lectures_room ON lectures(room_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_segments_lecture ON transcript_segments(lecture_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_board_lecture ON board_contents(lecture_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_screen_lecture ON screen_contents(lecture_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_chapters_lecture ON lecture_chapters(lecture_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_chat_lecture ON chat_messages(lecture_id);`);

  // ── Schema migrations: add new rich-structure columns (safe: ignored if column exists) ──
  const boardMigrations = [
    `ALTER TABLE board_contents ADD COLUMN equations_json TEXT DEFAULT '[]'`,
    `ALTER TABLE board_contents ADD COLUMN diagram_json TEXT DEFAULT '{}'`,
    `ALTER TABLE board_contents ADD COLUMN key_points_json TEXT DEFAULT '[]'`,
    `ALTER TABLE board_contents ADD COLUMN concept_diagram_json TEXT DEFAULT '{}'`,
    `ALTER TABLE board_contents ADD COLUMN main_concept TEXT DEFAULT ''`,
    `ALTER TABLE board_contents ADD COLUMN structured_content_json TEXT DEFAULT '[]'`,
  ];
  for (const sql of boardMigrations) {
    // Bug #29 fix: Only ignore "duplicate column" errors; log other failures
    await run(sql).catch((e) => {
      if (!e.message?.includes('duplicate column')) {
        console.warn('[Database] Migration warning:', e.message);
      }
    });
  }

  const screenMigrations = [
    `ALTER TABLE screen_contents ADD COLUMN equations_json TEXT DEFAULT '[]'`,
    `ALTER TABLE screen_contents ADD COLUMN diagram_json TEXT DEFAULT '{}'`,
    `ALTER TABLE screen_contents ADD COLUMN code_language TEXT DEFAULT ''`,
    `ALTER TABLE screen_contents ADD COLUMN key_points_json TEXT DEFAULT '[]'`,
    `ALTER TABLE screen_contents ADD COLUMN concept_diagram_json TEXT DEFAULT '{}'`,
    `ALTER TABLE screen_contents ADD COLUMN main_concept TEXT DEFAULT ''`,
    `ALTER TABLE screen_contents ADD COLUMN structured_content_json TEXT DEFAULT '[]'`,
  ];
  for (const sql of screenMigrations) {
    await run(sql).catch((e) => {
      if (!e.message?.includes('duplicate column')) {
        console.warn('[Database] Migration warning:', e.message);
      }
    });
  }

  const notesMigrations = [
    `ALTER TABLE study_notes ADD COLUMN sections_json TEXT DEFAULT '[]'`,
    `ALTER TABLE study_notes ADD COLUMN visualizations_json TEXT DEFAULT '[]'`,
  ];
  for (const sql of notesMigrations) {
    await run(sql).catch((e) => {
      if (!e.message?.includes('duplicate column')) {
        console.warn('[Database] Migration warning:', e.message);
      }
    });
  }

  const deduplicationMigrations = [
    `ALTER TABLE board_contents ADD COLUMN image_hash TEXT DEFAULT ''`,
    `ALTER TABLE board_contents ADD COLUMN quality_score INTEGER DEFAULT 0`,
    `ALTER TABLE screen_contents ADD COLUMN image_hash TEXT DEFAULT ''`,
    `ALTER TABLE screen_contents ADD COLUMN quality_score INTEGER DEFAULT 0`,
    `ALTER TABLE lectures ADD COLUMN subject TEXT DEFAULT ''`,
    `ALTER TABLE lectures ADD COLUMN domain_context_json TEXT DEFAULT '{}'`,
  ];
  for (const sql of deduplicationMigrations) {
    await run(sql).catch((e) => {
      if (!e.message?.includes('duplicate column')) {
        console.warn('[Database] Migration warning:', e.message);
      }
    });
  }

  // 19. Metadata-Content Consistency Reports Table
  await run(`
    CREATE TABLE IF NOT EXISTS metadata_consistency_reports (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      declared_title TEXT NOT NULL,
      declared_subject TEXT,
      inferred_subject TEXT,
      consistency_status TEXT NOT NULL CHECK(consistency_status IN ('CONSISTENT', 'POSSIBLE_MISMATCH', 'INSUFFICIENT_EVIDENCE')),
      match_type TEXT NOT NULL,
      confidence TEXT NOT NULL,
      explanation TEXT,
      evidence_refs_json TEXT,
      is_provisional INTEGER DEFAULT 0,
      teacher_confirmed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_consistency_lecture ON metadata_consistency_reports(lecture_id);`);

  // Seed default demo accounts
  await seedDefaultUsers();
}

async function seedDefaultUsers() {
  const teacherEmail = 'teacher@lecturelens.edu';
  const existingTeacher = await get(`SELECT id FROM users WHERE email = ?`, [teacherEmail]);
  if (!existingTeacher) {
    const pwHash = await bcrypt.hash('password123', 10);
    await run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      ['user_teacher_1', 'Prof. Alan Turing', teacherEmail, pwHash, 'TEACHER']
    );
    console.log('[Database] Seeded default teacher user: teacher@lecturelens.edu');
  }

  const studentEmail = 'student@lecturelens.edu';
  const existingStudent = await get(`SELECT id FROM users WHERE email = ?`, [studentEmail]);
  if (!existingStudent) {
    const pwHash = await bcrypt.hash('password123', 10);
    await run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      ['user_student_1', 'Ada Lovelace', studentEmail, pwHash, 'STUDENT']
    );
    console.log('[Database] Seeded default student user: student@lecturelens.edu');
  }

  const adminEmail = 'admin@lecturelens.edu';
  const existingAdmin = await get(`SELECT id FROM users WHERE email = ?`, [adminEmail]);
  if (!existingAdmin) {
    const pwHash = await bcrypt.hash('admin123', 10);
    await run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      ['user_admin_1', 'System Administrator', adminEmail, pwHash, 'ADMIN']
    );
    console.log('[Database] Seeded default admin user: admin@lecturelens.edu');
  }
}

initDb().catch((err) => {
  console.error('[Database] Failed to initialize schema:', err);
});

module.exports = {
  db,
  run,
  get,
  all,
};
