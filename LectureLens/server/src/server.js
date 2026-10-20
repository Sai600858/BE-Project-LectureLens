require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const { db, run, get, all } = require('./db');
const {
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireRole,
  registerUser,
  loginUser,
} = require('./auth');
const { createWorker } = require('./mediasoupWorker');
const Room = require('./Room');
const { processBoardFrame, processScreenFrame } = require('./visionService');
const {
  gatherLectureMultimodalContext,
  generateLectureSummary,
  generateStudyNotes,
  generateLectureChapters,
} = require('./summaryService');
const { askLecture } = require('./ragService');
const { getOrComputeSALKG } = require('./salkgAdapter');
const { resolveLectureDomainContext } = require('./domainContextService');
const {
  generateQuiz,
  submitQuizAttempt,
  generateFlashcards,
  updateFlashcardProgress,
} = require('./quizService');
const {
  generateTranscriptPdf,
  generateSummaryPdf,
  generateStudyNotesPdf,
} = require('./pdfService');
const { saveRecording, streamRecording } = require('./recordingService');
const { callGemini } = require('./aiModelHelper');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const translationCache = new Map();

const PORT = process.env.PORT || 3001;

// Allowed CORS origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'x-lecture-password'],
  credentials: true,
};

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI generation rate limit reached. Please wait a moment before trying again.' },
});

// Multer upload config with file validation & size limit
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/webm', 'video/mp4', 'audio/webm', 'audio/wav', 'audio/mpeg', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type: only audio, video, and image files are permitted'));
  },
});

const SNAPSHOTS_DIR = path.join(__dirname, '..', 'data', 'snapshots');
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

const app = express();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://generativelanguage.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'http://localhost:*'],
        mediaSrc: ["'self'", 'blob:', 'http://localhost:*'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/snapshots', express.static(SNAPSHOTS_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// rooms: Map<roomId, Room>
const rooms = new Map();

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────

app.post('/api/auth/register', authLimiter, optionalAuth, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await registerUser({ name, email, password, role }, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LECTURE MANAGEMENT ROUTES ───────────────────────────────────────────────

app.post('/api/lectures', authenticateToken, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const { title, description, scheduledAt, visibility = 'PUBLIC', password, subject = '' } = req.body;
    if (!title) return res.status(400).json({ error: 'Lecture title is required' });

    const lectureId = 'lec_' + uuidv4().slice(0, 8);
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    await run(
      `INSERT INTO lectures (id, room_id, title, description, host_id, scheduled_at, status, visibility, password_hash, subject)
       VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?)`,
      [lectureId, roomId, title, description || '', req.user.id, scheduledAt || null, visibility, passwordHash, subject || '']
    );

    // Pre-initialize mediasoup room so students and teachers can join immediately
    try {
      let room = rooms.get(roomId);
      if (!room) {
        room = await new Room(roomId).init();
        room.lectureId = lectureId;
        rooms.set(roomId, room);
      }
    } catch (roomErr) {
      console.warn('[POST /api/lectures] Room pre-init notice:', roomErr.message);
    }

    const lecture = await get('SELECT * FROM lectures WHERE id = ?', [lectureId]);
    res.status(201).json({
      lecture: {
        ...lecture,
        roomId: lecture.room_id,
        lectureId: lecture.id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures', optionalAuth, async (req, res) => {
  try {
    const { status, hostId } = req.query;
    let query = `
      SELECT l.*, u.name as host_name, u.email as host_email,
             (SELECT COUNT(*) FROM transcript_segments WHERE lecture_id = l.id) as segment_count,
             (SELECT COUNT(*) FROM recordings WHERE lecture_id = l.id) as has_recording
      FROM lectures l
      JOIN users u ON l.host_id = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE l.status = ?';
      params.push(status);
    }

    query += ' ORDER BY l.created_at DESC';

    const rawLectures = await all(query, params);
    const lectures = rawLectures.map((l) => ({
      ...l,
      roomId: l.room_id,
      lectureId: l.id,
    }));
    res.json({ lectures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:id', optionalAuth, async (req, res) => {
  try {
    const lecture = await get(
      `SELECT l.*, u.name as host_name, u.email as host_email
       FROM lectures l
       JOIN users u ON l.host_id = u.id
       WHERE l.id = ? OR l.room_id = ?`,
      [req.params.id, req.params.id]
    );

    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    res.json({
      lecture: {
        ...lecture,
        roomId: lecture.room_id,
        lectureId: lecture.id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lectures/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['SCHEDULED', 'LIVE', 'ENDED', 'PROCESSING', 'COMPLETED'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const lec = await get('SELECT id, host_id FROM lectures WHERE id = ? OR room_id = ?', [req.params.id, req.params.id]);
    if (!lec) return res.status(404).json({ error: 'Lecture not found' });
    if (req.user.role !== 'ADMIN' && lec.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the lecture host or an admin can update lecture status' });
    }

    await run('UPDATE lectures SET status = ? WHERE id = ?', [status, lec.id]);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:id/end', authenticateToken, async (req, res) => {
  try {
    const lecture = await get('SELECT id, room_id, host_id FROM lectures WHERE id = ? OR room_id = ?', [req.params.id, req.params.id]);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    if (req.user.role !== 'ADMIN' && lecture.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the lecture host or an admin can end this lecture' });
    }

    const lectureId = lecture.id;
    const roomId = lecture.room_id;

    await run(`UPDATE lectures SET status = 'ENDED', end_time = CURRENT_TIMESTAMP WHERE id = ?`, [lectureId]);
    await run(`UPDATE transcripts SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE lecture_id = ? OR lecture_id = ?`, [lectureId, roomId]);

    // Notify all participants in the room
    io.to(roomId).emit('lectureEnded', { lectureId, roomId, status: 'ENDED' });
    io.to(lectureId).emit('lectureEnded', { lectureId, roomId, status: 'ENDED' });

    // Clean up room in memory
    const room = rooms.get(roomId);
    if (room) {
      rooms.delete(roomId);
    }

    // Trigger AI summary & chapters in background
    generateLectureSummary(lectureId).catch((e) => console.warn('[Auto-Summary] Background error:', e.message));
    generateLectureChapters(lectureId).catch((e) => console.warn('[Auto-Chapters] Background error:', e.message));
    generateStudyNotes(lectureId, 'detailed').catch((e) => console.warn('[Auto-Notes] Background error:', e.message));

    console.log(`[Lecture ${lectureId} / Room ${roomId}] Successfully ended by instructor.`);
    res.json({ success: true, status: 'ENDED', lectureId, roomId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all lectures & clear all history (Admin Only)
app.delete('/api/lectures', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await run('DELETE FROM chat_messages');
    await run('DELETE FROM metadata_consistency_reports');
    await run('DELETE FROM salkg_guard_reports');
    await run('DELETE FROM salkg_cache');
    await run('DELETE FROM generated_documents');
    await run('DELETE FROM recordings');
    await run('DELETE FROM flashcard_progress');
    await run('DELETE FROM flashcards');
    await run('DELETE FROM quiz_attempts');
    await run('DELETE FROM quiz_questions');
    await run('DELETE FROM quizzes');
    await run('DELETE FROM study_notes');
    await run('DELETE FROM summaries');
    await run('DELETE FROM lecture_chapters');
    await run('DELETE FROM multimodal_events');
    await run('DELETE FROM screen_contents');
    await run('DELETE FROM board_contents');
    await run('DELETE FROM transcript_segments');
    await run('DELETE FROM transcripts');
    await run('DELETE FROM participants');
    await run('DELETE FROM lectures');

    rooms.clear();
    translationCache.clear();

    console.log('[Lecture History] All lecture history cleared from database by admin.');
    res.json({ success: true, message: 'All lecture history cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific lecture (Admin or Host Only)
app.delete('/api/lectures/:id', authenticateToken, async (req, res) => {
  try {
    const lecture = await get('SELECT id, room_id, host_id FROM lectures WHERE id = ? OR room_id = ?', [req.params.id, req.params.id]);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    if (req.user.role !== 'ADMIN' && lecture.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the lecture host or an admin can delete this lecture' });
    }

    const lecId = lecture.id;
    const rmId = lecture.room_id;

    await run('DELETE FROM chat_messages WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM metadata_consistency_reports WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM generated_documents WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM recordings WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM study_notes WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM summaries WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM lecture_chapters WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM multimodal_events WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM screen_contents WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM board_contents WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ?', [lecId, rmId]);
    await run('DELETE FROM transcripts WHERE lecture_id = ? OR lecture_id = ?', [lecId, rmId]);
    await run('DELETE FROM participants WHERE lecture_id = ?', [lecId]);
    await run('DELETE FROM lectures WHERE id = ?', [lecId]);

    if (rmId && rooms.has(rmId)) {
      rooms.delete(rmId);
    }

    console.log(`[Lecture History] Deleted lecture ${lecId} / room ${rmId}`);
    res.json({ success: true, message: 'Lecture deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MULTIMODAL VISION ROUTES ────────────────────────────────────────────────

app.post('/api/lectures/:lectureId/board-frame', optionalAuth, async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { imageBase64, timestamp } = req.body;

    const lec = await get('SELECT id, room_id FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
    const resolvedId = lec ? lec.id : lectureId;
    const targetRoomId = lec?.room_id || lectureId;

    const result = await processBoardFrame({
      lectureId: resolvedId,
      imageBase64,
      timestamp: parseFloat(timestamp) || 0,
    });

    // Notify room of new whiteboard concept (emit to both roomId and resolved lectureId)
    io.to(targetRoomId).emit('boardContentAdded', result);
    io.to(resolvedId).emit('boardContentAdded', result);

    res.json({ success: true, content: result });
  } catch (err) {
    console.error('[board-frame] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:lectureId/screen-frame', optionalAuth, async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { imageBase64, timestamp } = req.body;

    const lec = await get('SELECT id, room_id FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
    const resolvedId = lec ? lec.id : lectureId;
    const targetRoomId = lec?.room_id || lectureId;

    const result = await processScreenFrame({
      lectureId: resolvedId,
      imageBase64,
      timestamp: parseFloat(timestamp) || 0,
    });

    io.to(targetRoomId).emit('screenContentAdded', result);
    io.to(resolvedId).emit('screenContentAdded', result);
    io.to(targetRoomId).emit('boardContentAdded', result);
    io.to(resolvedId).emit('boardContentAdded', result);

    res.json({ success: true, content: result });
  } catch (err) {
    console.error('[screen-frame] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function checkLectureAccess(lectureId, user) {
  const lec = await get('SELECT id, room_id, host_id, visibility FROM lectures WHERE id = ? OR room_id = ?', [lectureId, lectureId]);
  if (!lec) return { allowed: false, status: 404, error: 'Lecture not found' };
  if (lec.visibility === 'PRIVATE') {
    if (!user) return { allowed: false, status: 401, error: 'Authentication required to access private lecture content' };
    if (user.role !== 'ADMIN' && lec.host_id !== user.id) {
      const enrolled = await get('SELECT id FROM participants WHERE lecture_id = ? AND user_id = ?', [lec.id, user.id]);
      if (!enrolled) {
        return { allowed: false, status: 403, error: 'Access denied to private lecture content' };
      }
    }
  }
  return { allowed: true, lecture: lec };
}

app.get('/api/lectures/:lectureId/board-contents', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const resolvedId = lec.id;
    const roomId = lec.room_id || resolvedId;
    const items = await all('SELECT * FROM board_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC', [resolvedId, roomId]);
    const enriched = items.map(row => {
      let equations = [], diagram = {}, keyPoints = [], conceptDiagram = {}, structuredContent = [];
      try { equations = JSON.parse(row.equations_json || '[]'); } catch(_) {}
      try { diagram = JSON.parse(row.diagram_json || '{}'); } catch(_) {}
      try { keyPoints = JSON.parse(row.key_points_json || '[]'); } catch(_) {}
      try { conceptDiagram = JSON.parse(row.concept_diagram_json || '{}'); } catch(_) {}
      try { structuredContent = JSON.parse(row.structured_content_json || '[]'); } catch(_) {}
      return {
        ...row,
        equations,
        diagram,
        keyPoints,
        conceptDiagram,
        structuredContent,
        mainConcept: row.main_concept || '',
      };
    });
    res.json({ contents: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/screen-contents', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const resolvedId = lec.id;
    const roomId = lec.room_id || resolvedId;
    const items = await all('SELECT * FROM screen_contents WHERE lecture_id = ? OR lecture_id = ? ORDER BY timestamp ASC', [resolvedId, roomId]);
    const enriched = items.map(row => {
      let equations = [], diagram = {}, keyPoints = [], conceptDiagram = {}, structuredContent = [];
      try { equations = JSON.parse(row.equations_json || '[]'); } catch(_) {}
      try { diagram = JSON.parse(row.diagram_json || '{}'); } catch(_) {}
      try { keyPoints = JSON.parse(row.key_points_json || '[]'); } catch(_) {}
      try { conceptDiagram = JSON.parse(row.concept_diagram_json || '{}'); } catch(_) {}
      try { structuredContent = JSON.parse(row.structured_content_json || '[]'); } catch(_) {}
      return {
        ...row,
        equations,
        diagram,
        keyPoints,
        conceptDiagram,
        structuredContent,
        mainConcept: row.main_concept || '',
      };
    });
    res.json({ contents: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI SUMMARY & STUDY NOTES ROUTES ─────────────────────────────────────────

app.post('/api/lectures/:lectureId/summary', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const summary = await generateLectureSummary(req.params.lectureId);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/summary', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    let summaryRow = await get('SELECT * FROM summaries WHERE lecture_id = ?', [req.params.lectureId]);
    if (!summaryRow) {
      // Auto-generate if not exists
      const generated = await generateLectureSummary(req.params.lectureId);
      return res.json({ summary: generated });
    }

    const summary = {
      id: summaryRow.id,
      lectureId: summaryRow.lecture_id,
      shortSummary: summaryRow.short_summary,
      detailedSummary: summaryRow.detailed_summary,
      keyConcepts: summaryRow.key_concepts_json ? JSON.parse(summaryRow.key_concepts_json) : [],
      definitions: summaryRow.definitions_json ? JSON.parse(summaryRow.definitions_json) : [],
      examples: summaryRow.examples_json ? JSON.parse(summaryRow.examples_json) : [],
      keyTakeaways: summaryRow.key_takeaways_json ? JSON.parse(summaryRow.key_takeaways_json) : [],
      topicsCovered: summaryRow.topics_covered_json ? JSON.parse(summaryRow.topics_covered_json) : [],
    };
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:lectureId/notes', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const mode = req.body.mode || 'detailed';
    const notes = await generateStudyNotes(req.params.lectureId, mode);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/notes', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const mode = req.query.mode || 'detailed';
    let note = await get('SELECT * FROM study_notes WHERE lecture_id = ? AND mode = ?', [req.params.lectureId, mode]);
    if (!note) {
      const generated = await generateStudyNotes(req.params.lectureId, mode);
      return res.json({ notes: generated });
    }

    res.json({
      notes: {
        id: note.id,
        lectureId: note.lecture_id,
        mode: note.mode,
        title: note.title,
        contentMarkdown: note.content_markdown,
        formulas: note.formulas_json ? JSON.parse(note.formulas_json) : [],
        diagrams: note.diagrams_json ? JSON.parse(note.diagrams_json) : [],
        questions: note.questions_json ? JSON.parse(note.questions_json) : [],
        sections: note.sections_json ? JSON.parse(note.sections_json) : [],
        visualizations: note.visualizations_json ? JSON.parse(note.visualizations_json) : [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEARCHABLE TRANSCRIPT & CHAPTERS ROUTES ─────────────────────────────────

app.get('/api/lectures/:lectureId/transcript', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const resolvedId = lec?.id || req.params.lectureId;
    const roomId = lec?.room_id || req.params.lectureId;

    const record = await get('SELECT * FROM transcripts WHERE lecture_id = ? OR lecture_id = ?', [resolvedId, roomId]);
    const segments = await all(
      'SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
      [resolvedId, roomId]
    );
    res.json({ transcript: record, segments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/transcript/search', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const query = (req.query.q || '').trim();
    if (!query) return res.json({ matches: [] });

    const lec = access.lecture;
    const resolvedId = lec?.id || req.params.lectureId;
    const roomId = lec?.room_id || req.params.lectureId;

    const matches = await all(
      `SELECT * FROM transcript_segments
       WHERE (lecture_id = ? OR lecture_id = ?) AND text LIKE ?
       ORDER BY start_time ASC`,
      [resolvedId, roomId, `%${query}%`]
    );
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/chapters', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const chapters = await generateLectureChapters(req.params.lectureId);
    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RAG Q&A ROUTE ("Ask This Lecture") ──────────────────────────────────────

app.post('/api/lectures/:lectureId/ask', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Valid question text is required' });
    }

    const result = await askLecture(req.params.lectureId, question.trim().slice(0, 1000));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SALKG & SALKG-GUARD INSPECTION ROUTES ───────────────────────────────────

app.get('/api/lectures/:lectureId/salkg', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const resolvedId = lec.id;
    const forceRefresh = req.query.refresh === 'true';
    const salkgResult = await getOrComputeSALKG(resolvedId, { forceRefresh });
    res.json(salkgResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/validation-reports', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const resolvedId = lec.id;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const rows = await all(
      'SELECT id, request_id, lecture_id, content_type, domain, decision, decision_reason, retry_count, report_json, created_at FROM salkg_guard_reports WHERE lecture_id = ? ORDER BY created_at DESC LIMIT ?',
      [resolvedId, limit]
    );

    const reports = rows.map((r) => {
      let fullReport = null;
      try {
        fullReport = JSON.parse(r.report_json);
      } catch (_) {}
      return {
        id: r.id,
        requestId: r.request_id,
        lectureId: r.lecture_id,
        contentType: r.content_type,
        domain: r.domain,
        decision: r.decision,
        decisionReason: r.decision_reason,
        retryCount: r.retry_count,
        summaryMetrics: fullReport?.summary_metrics || null,
        createdAt: r.created_at,
        details: fullReport,
      };
    });

    res.json({ reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/validation-reports/:reportId', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const reportRow = await get(
      'SELECT * FROM salkg_guard_reports WHERE id = ? AND lecture_id = ?',
      [req.params.reportId, access.lecture.id]
    );
    if (!reportRow) return res.status(404).json({ error: 'Validation report not found' });

    let fullReport = null;
    try {
      fullReport = JSON.parse(reportRow.report_json);
    } catch (_) {}

    res.json({
      ...reportRow,
      report: fullReport,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DOMAIN CONTEXT & METADATA CONSISTENCY ROUTES ─────────────────────────────

app.get('/api/lectures/:lectureId/domain-context', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const forceRefresh = req.query.refresh === 'true';
    const domainContext = await resolveLectureDomainContext(lec.id, { forceRefresh });
    res.json({ domainContext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:lectureId/domain-context/confirm', authenticateToken, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    if (req.user.role !== 'ADMIN' && lec.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the lecture host or an admin can confirm domain context' });
    }

    const { subject, confirmedDomain } = req.body;
    const finalSubject = (subject || confirmedDomain || '').trim();

    if (finalSubject) {
      await run('UPDATE lectures SET subject = ? WHERE id = ?', [finalSubject, lec.id]);
    }

    // Mark existing reports as teacher confirmed if subject was confirmed
    await run('UPDATE metadata_consistency_reports SET teacher_confirmed = 1 WHERE lecture_id = ?', [lec.id]);

    // Re-resolve domain context with forceRefresh to update the cached profile and DB
    const domainContext = await resolveLectureDomainContext(lec.id, { forceRefresh: true });

    res.json({ success: true, domainContext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/metadata-consistency', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const lec = access.lecture;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const rows = await all(
      `SELECT id, lecture_id, declared_title, declared_subject, inferred_subject,
              consistency_status, match_type, confidence, explanation, evidence_refs_json,
              is_provisional, teacher_confirmed, created_at
       FROM metadata_consistency_reports
       WHERE lecture_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [lec.id, limit]
    );

    const reports = rows.map((r) => {
      let evidenceRefs = [];
      try {
        evidenceRefs = JSON.parse(r.evidence_refs_json || '[]');
      } catch (_) {}
      return {
        id: r.id,
        lectureId: r.lecture_id,
        declaredTitle: r.declared_title,
        declaredSubject: r.declared_subject,
        inferredSubject: r.inferred_subject,
        consistencyStatus: r.consistency_status,
        matchType: r.match_type,
        confidence: r.confidence,
        explanation: r.explanation,
        evidenceRefs,
        isProvisional: Boolean(r.is_provisional),
        teacherConfirmed: Boolean(r.teacher_confirmed),
        createdAt: r.created_at,
      };
    });

    res.json({ reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── QUIZ & FLASHCARDS ROUTES ────────────────────────────────────────────────

app.get('/api/lectures/:lectureId/quiz', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const result = await generateQuiz(req.params.lectureId);
    const isTeacherOrAdmin = req.user && (req.user.role === 'ADMIN' || req.user.id === access.lecture.host_id);
    const questions = (result.questions || []).map((q) => {
      if (isTeacherOrAdmin) return q;
      const { correct_answer, correctAnswer, explanation, ...safeQ } = q;
      return safeQ;
    });
    res.json({ ...result, questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:lectureId/quiz/submit', authenticateToken, async (req, res) => {
  try {
    const { quizId, answers } = req.body;
    const result = await submitQuizAttempt({ quizId, userId: req.user.id, answers });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/flashcards', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const cards = await generateFlashcards(req.params.lectureId);
    res.json({ flashcards: cards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lectures/:lectureId/flashcards/progress', authenticateToken, async (req, res) => {
  try {
    const { flashcardId, status } = req.body;
    const result = await updateFlashcardProgress({ flashcardId, userId: req.user.id, status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PDF DOWNLOAD ROUTES ─────────────────────────────────────────────────────

app.get('/api/lectures/:lectureId/pdf/transcript', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const { filePath, filename } = await generateTranscriptPdf(req.params.lectureId);
    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/pdf/summary', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const { filePath, filename } = await generateSummaryPdf(req.params.lectureId);
    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/pdf/study-notes', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const { filePath, filename } = await generateStudyNotesPdf(req.params.lectureId);
    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RECORDING ROUTES ────────────────────────────────────────────────────────

app.post('/api/lectures/:lectureId/recording', authenticateToken, upload.single('recording'), async (req, res) => {
  try {
    const lec = await get('SELECT id, host_id FROM lectures WHERE id = ? OR room_id = ?', [req.params.lectureId, req.params.lectureId]);
    if (!lec) return res.status(404).json({ error: 'Lecture not found' });
    if (req.user.role !== 'ADMIN' && lec.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the lecture host or an admin can upload recordings' });
    }

    if (!req.file) return res.status(400).json({ error: 'No recording file uploaded' });

    const duration = parseFloat(req.body.duration) || 0;
    const result = await saveRecording({
      lectureId: lec.id,
      tempFilePath: req.file.path,
      durationSeconds: duration,
      mimeType: req.file.mimetype || 'video/webm',
    });

    res.json({ success: true, recording: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/recording/stream', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const rec = await get('SELECT * FROM recordings WHERE lecture_id = ?', [access.lecture.id]);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    streamRecording(req, res, rec.file_path, rec.mime_type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/recording', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.lectureId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const rec = await get('SELECT * FROM recordings WHERE lecture_id = ?', [access.lecture.id]);
    res.json({ recording: rec || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

app.get('/api/admin/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:userId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await run('DELETE FROM users WHERE id = ?', [req.params.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const lectureCount = await get('SELECT COUNT(*) as count FROM lectures');
    const recordingCount = await get('SELECT COUNT(*) as count FROM recordings');
    const activeRooms = rooms.size;

    res.json({
      totalUsers: userCount.count,
      totalLectures: lectureCount.count,
      totalRecordings: recordingCount.count,
      activeRooms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatible transcript endpoint
app.get('/transcript/:roomId', optionalAuth, async (req, res) => {
  try {
    const access = await checkLectureAccess(req.params.roomId, req.user);
    if (!access.allowed) return res.status(access.status).json({ error: access.error });

    const resolvedId = access.lecture.id;
    const roomCode = access.lecture.room_id || req.params.roomId;

    const record = await get('SELECT * FROM transcripts WHERE lecture_id = ? OR lecture_id = ?', [resolvedId, roomCode]);
    const segments = await all(
      'SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
      [resolvedId, roomCode]
    );
    if (!record && segments.length === 0) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    res.json({
      roomId: req.params.roomId,
      status: record?.status || 'complete',
      fullText: record?.full_text || segments.map((s) => s.text).join(' '),
      segments,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', activeRooms: rooms.size }));

// ─── MEDIASOUP INITIALIZATION ────────────────────────────────────────────────

async function bootstrap() {
  await createWorker();
  console.log('[Server] mediasoup worker ready');

  httpServer.listen(PORT, () => {
    console.log(`[Server] LectureLens running on http://localhost:${PORT}`);
  });
}

// ─── SOCKET.IO SIGNALING & EVENTS ────────────────────────────────────────────

io.on('connection', (socket) => {
  let currentUser = null;
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    currentUser = verifyToken(token);
  }

  console.log(`[Socket] Connected: ${socket.id} (User: ${currentUser?.name || 'Anonymous'})`);

  let currentRoomId = null;

  // ── Create Room (Host / Teacher) ──────────────────────────────────────────
  socket.on('createRoom', async (data = {}, callback) => {
    try {
      if (data.token && !currentUser) {
        currentUser = verifyToken(data.token);
      }
      if (!currentUser || (currentUser.role !== 'TEACHER' && currentUser.role !== 'ADMIN')) {
        return callback({ error: 'Authentication required: only teachers and administrators can host lecture sessions.' });
      }

      let rawId = (data.roomId || '').trim();
      if (!rawId || rawId.toLowerCase() === 'undefined' || rawId.toLowerCase() === 'null' || rawId.toLowerCase() === 'new') {
        rawId = null;
      }
      const roomId = (rawId || uuidv4().slice(0, 8)).toUpperCase();
      const lectureTitle = data.title || 'Live Lecture Session';
      const visibility = (data.visibility || 'PUBLIC').toUpperCase();
      const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

      let room = rooms.get(roomId);
      if (!room) {
        room = await new Room(roomId).init();
        rooms.set(roomId, room);
      }

      // Check if lecture exists in DB; if not, persist
      let lecture = await get('SELECT * FROM lectures WHERE room_id = ?', [roomId]);
      if (!lecture) {
        const lectureId = 'lec_' + uuidv4().slice(0, 8);
        const hostId = currentUser.id;

        await run(
          `INSERT INTO lectures (id, room_id, title, description, host_id, status, visibility, password_hash)
           VALUES (?, ?, ?, ?, ?, 'LIVE', ?, ?)`,
          [lectureId, roomId, lectureTitle, data.description || '', hostId, visibility, passwordHash]
        );
        lecture = await get('SELECT * FROM lectures WHERE id = ?', [lectureId]);
      } else {
        await run(`UPDATE lectures SET status = 'LIVE', start_time = CURRENT_TIMESTAMP WHERE id = ?`, [lecture.id]);
      }

      room.lectureId = lecture.id;
      room.addPeer(socket.id, 'host', currentUser);
      socket.join(roomId);
      currentRoomId = roomId;

      console.log(`[Room ${roomId}] Host connected: ${socket.id} (${currentUser.name})`);
      callback({ roomId, lectureId: lecture.id, rtpCapabilities: room.rtpCapabilities });
    } catch (err) {
      console.error('[createRoom] Error:', err);
      callback({ error: err.message });
    }
  });

  // ── Join Room (Student / Participant) ─────────────────────────────────────
  socket.on('joinRoom', async (payload = {}, callback) => {
    try {
      const data = typeof payload === 'string' ? { roomId: payload } : payload;
      if (data.token && !currentUser) {
        currentUser = verifyToken(data.token);
      }
      const normalizedRoomId = (data.roomId || '').trim().toUpperCase();
      if (!normalizedRoomId || normalizedRoomId === 'UNDEFINED' || normalizedRoomId === 'NULL') {
        return callback({ error: 'Please enter a valid 8-digit Room Code to join.' });
      }

      const lecture = await get('SELECT * FROM lectures WHERE room_id = ? OR id = ?', [normalizedRoomId, normalizedRoomId]);

      // Access Control: check private lecture permissions
      if (lecture && lecture.visibility === 'PRIVATE') {
        const isHost = currentUser && lecture.host_id && currentUser.id === lecture.host_id;
        if (!isHost) {
          let authorized = false;
          if (lecture.password_hash) {
            if (data.password) {
              const matched = await bcrypt.compare(data.password, lecture.password_hash);
              if (matched) authorized = true;
            }
          }
          if (!authorized && currentUser?.id) {
            const enrolled = await get('SELECT id FROM participants WHERE lecture_id = ? AND user_id = ?', [lecture.id, currentUser.id]);
            if (enrolled) authorized = true;
          }

          if (!authorized) {
            return callback({
              error: 'This lecture session is private. Access password or instructor authorization required.',
              isPrivate: true,
              requiresPassword: !!lecture.password_hash,
            });
          }
        }
      }

      let room = rooms.get(normalizedRoomId);
      if (!room) {
        // Fallback: Check if lecture exists in database
        if (lecture) {
          if (lecture.status === 'ENDED' || lecture.status === 'COMPLETED') {
            return callback({
              error: 'This lecture session has ended. Redirecting to AI review...',
              ended: true,
              lectureId: lecture.id,
            });
          }
          room = await new Room(normalizedRoomId).init();
          room.lectureId = lecture.id;
          rooms.set(normalizedRoomId, room);
          console.log(`[Room ${normalizedRoomId}] Auto-initialized from DB lecture ${lecture.id} for joining student`);
        } else {
          return callback({
            error: `Room code "${normalizedRoomId}" not found. Please double-check the 8-digit code with your instructor.`
          });
        }
      } else if (room.lectureId) {
        const lec = await get('SELECT status, id FROM lectures WHERE id = ?', [room.lectureId]);
        if (lec && (lec.status === 'ENDED' || lec.status === 'COMPLETED')) {
          return callback({
            error: 'This lecture session has ended. Redirecting to AI review...',
            ended: true,
            lectureId: lec.id,
          });
        }
      }

      room.addPeer(socket.id, 'participant', currentUser);
      socket.join(normalizedRoomId);
      currentRoomId = normalizedRoomId;

      // Track participant in DB if user is logged in
      if (room.lectureId && currentUser?.id) {
        await run(
          `INSERT INTO participants (id, lecture_id, user_id, role)
           VALUES (?, ?, ?, ?)`,
          ['part_' + uuidv4().slice(0, 8), room.lectureId, currentUser.id, currentUser.role || 'STUDENT']
        );
      }

      socket.to(normalizedRoomId).emit('peerJoined', {
        peerId: socket.id,
        user: currentUser || { name: 'Student', role: 'STUDENT' },
      });

      console.log(`[Room ${normalizedRoomId}] Participant joined: ${socket.id} (${currentUser?.name || 'Student'})`);
      callback({ rtpCapabilities: room.rtpCapabilities, lectureId: room.lectureId, roomId: normalizedRoomId });
    } catch (err) {
      console.error('[joinRoom] Error:', err);
      callback({ error: err.message });
    }
  });

  // ── WebRTC Transport ───────────────────────────────────────────────────────
  socket.on('createTransport', async ({ direction }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      const transportParams = await room.createWebRtcTransport(socket.id);
      const peer = room.getPeer(socket.id);
      const transport = peer.transports.get(transportParams.id);
      transport.appData = { direction };

      callback({ transportParams });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      await room.connectTransport(socket.id, transportId, dtlsParameters);
      callback({ connected: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // ── Produce (Camera, Mic, Screen) ─────────────────────────────────────────
  socket.on('produce', async ({ transportId, kind, rtpParameters, appData = {} }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      const producerId = await room.produce(socket.id, transportId, kind, rtpParameters, appData);

      const peer = room.getPeer(socket.id);

      // Broadcast to peers with metadata (distinguishing camera, mic, screen!)
      socket.to(currentRoomId).emit('newProducer', {
        producerId,
        kind,
        type: appData.type || (kind === 'video' ? 'camera' : 'microphone'),
        peerId: socket.id,
        userName: peer?.user?.name || (peer?.role === 'host' ? 'Teacher' : 'Student'),
        userRole: peer?.user?.role || (peer?.role === 'host' ? 'TEACHER' : 'STUDENT'),
      });

      callback({ producerId });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // ── Close Producer (e.g., Teacher stops screen sharing) ───────────────────
  socket.on('closeProducer', ({ producerId }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback?.({ error: 'Room not found' });

      const closed = room.closeProducer(socket.id, producerId);
      if (closed) {
        socket.to(currentRoomId).emit('producerClosed', { producerId, peerId: socket.id });
      }
      callback?.({ closed: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });

  // ── Consume ────────────────────────────────────────────────────────────────
  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      const consumerParams = await room.consume(socket.id, producerId, rtpCapabilities);
      callback({ consumerParams });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      const peer = room.getPeer(socket.id);
      const consumer = peer?.consumers.get(consumerId);
      if (!consumer) return callback({ error: 'Consumer not found' });

      await consumer.resume();
      callback({ resumed: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  socket.on('getProducers', (_data, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Room not found' });

      const producers = room.getProducerList(socket.id);
      callback({ producers });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // ── Transcript: Start ─────────────────────────────────────────────────────
  socket.on('startTranscription', async ({ roomId, lectureId: passedLecId }) => {
    const room = rooms.get(roomId);
    let lectureId = passedLecId || room?.lectureId;
    if (!lectureId) {
      const lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ?', [roomId, roomId]);
      lectureId = lec?.id || roomId;
    }

    const existing = await get('SELECT id FROM transcripts WHERE lecture_id = ?', [lectureId]);
    if (!existing) {
      await run(
        `INSERT INTO transcripts (id, lecture_id, full_text, status) VALUES (?, ?, '', 'live')`,
        ['trans_' + uuidv4().slice(0, 8), lectureId]
      );
    } else {
      await run(`UPDATE transcripts SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE lecture_id = ?`, [lectureId]);
    }

    console.log(`[Transcript ${roomId}] Started for lecture ${lectureId}`);
    socket.to(roomId).emit('transcriptStarted', { roomId, status: 'live' });
  });

  // ── Transcript: Query / Rehydrate on Page Refresh ─────────────────────────
  socket.on('getTranscript', async ({ roomId, lectureId: passedLecId }, callback) => {
    if (typeof callback !== 'function') return;
    try {
      const normRoomId = (roomId || '').trim().toUpperCase();
      const room = rooms.get(normRoomId) || rooms.get(roomId);
      let lectureId = passedLecId || room?.lectureId;
      if (!lectureId) {
        const lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ? OR id = ? OR room_id = ?', [
          roomId,
          roomId,
          normRoomId,
          normRoomId,
        ]);
        lectureId = lec?.id || normRoomId || roomId;
      }

      const transcript = await get(
        'SELECT * FROM transcripts WHERE lecture_id = ? OR lecture_id = ? OR lecture_id = ?',
        [lectureId, normRoomId, roomId]
      );
      const rawSegments = await all(
        'SELECT * FROM transcript_segments WHERE lecture_id = ? OR lecture_id = ? OR lecture_id = ? ORDER BY start_time ASC',
        [lectureId, normRoomId, roomId]
      );

      const segments = rawSegments.map((s) => ({
        id: s.chunk_id || s.id,
        text: s.text,
        speakerName: s.speaker_name || 'Teacher',
        startOffset: s.start_time || 0,
        endOffset: s.end_time || (s.start_time || 0) + 3.0,
        status: 'complete',
        timestamp: s.timestamp || Date.now(),
      }));

      callback({
        status: transcript?.status || 'live',
        fullText: transcript?.full_text || '',
        segments,
      });
    } catch (err) {
      console.warn('[getTranscript] Error:', err.message);
      callback({ error: err.message, segments: [] });
    }
  });

  // ── Transcript: Sync & Persistence ─────────────────────────────────────────
  socket.on('syncTranscript', async ({ roomId, segments = [], fullText = '' }) => {
    const normRoomId = (roomId || '').trim().toUpperCase();
    const room = rooms.get(normRoomId) || rooms.get(roomId);
    let lectureId = room?.lectureId;
    if (!lectureId) {
      const lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ? OR id = ? OR room_id = ?', [
        roomId,
        roomId,
        normRoomId,
        normRoomId,
      ]);
      lectureId = lec?.id || normRoomId || roomId;
    }

    try {
      // Upsert transcript master row
      const existingTrans = await get(
        'SELECT id FROM transcripts WHERE lecture_id = ? OR lecture_id = ? OR lecture_id = ?',
        [lectureId, normRoomId, roomId]
      );
      if (existingTrans) {
        await run(
          `UPDATE transcripts SET full_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [fullText, existingTrans.id]
        );
      } else {
        await run(
          `INSERT INTO transcripts (id, lecture_id, full_text, status) VALUES (?, ?, ?, 'live')`,
          ['trans_' + uuidv4().slice(0, 8), lectureId, fullText]
        );
      }

      // Persist segments to database
      for (const seg of segments) {
        if (!seg.text || seg.status === 'pending') continue;

        const existingSeg = await get(
          `SELECT id FROM transcript_segments WHERE (lecture_id = ? OR lecture_id = ?) AND chunk_id = ?`,
          [lectureId, normRoomId, seg.id]
        );

        const speakerName = seg.speakerName || (currentUser?.name ? currentUser.name : 'Teacher');

        if (!existingSeg) {
          await run(
            `INSERT INTO transcript_segments (lecture_id, chunk_id, speaker_id, speaker_name, start_time, end_time, text)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lectureId, seg.id, currentUser?.id || 'host', speakerName, seg.startOffset, seg.endOffset || seg.startOffset + 3.0, seg.text]
          );
        } else {
          await run(
            `UPDATE transcript_segments SET text = ?, end_time = ? WHERE id = ?`,
            [seg.text, seg.endOffset, existingSeg.id]
          );
        }
      }
    } catch (e) {
      console.warn('[Transcript Sync DB] Error:', e.message);
    }

    // Broadcast live transcript update to all participants in the room
    socket.to(roomId).emit('transcriptUpdated', {
      roomId,
      segments,
      fullText,
      status: 'live',
    });
  });

  // ── Transcript: End ───────────────────────────────────────────────────────
  socket.on('endTranscription', async ({ roomId }) => {
    const room = rooms.get(roomId);
    let lectureId = room?.lectureId;
    if (!lectureId) {
      const lec = await get('SELECT id FROM lectures WHERE id = ? OR room_id = ?', [roomId, roomId]);
      lectureId = lec?.id || roomId;
    }

    await run(`UPDATE transcripts SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE lecture_id = ?`, [lectureId]);
    await run(`UPDATE lectures SET status = 'ENDED', end_time = CURRENT_TIMESTAMP WHERE id = ? OR room_id = ?`, [lectureId, roomId]);

    console.log(`[Transcript ${roomId}] Complete`);
    socket.to(roomId).emit('transcriptEnded', { roomId, status: 'complete' });

    // Trigger background generation of summary and chapters
    generateLectureSummary(lectureId).catch((e) => console.warn('[Auto-Summary] Background error:', e.message));
    generateLectureChapters(lectureId).catch((e) => console.warn('[Auto-Chapters] Background error:', e.message));
  });

  // ── End Lecture Entirely (Host action) ────────────────────────────────────
  socket.on('endLecture', async ({ roomId, lectureId: reqLecId }, callback) => {
    try {
      const room = rooms.get(roomId);
      const lecture = await get('SELECT id, room_id, host_id FROM lectures WHERE id = ? OR room_id = ?', [reqLecId || roomId, roomId || reqLecId]);
      const lectureId = lecture ? lecture.id : (room?.lectureId || roomId);
      const resolvedRoomId = lecture ? lecture.room_id : roomId;

      const isAuthorized =
        (currentUser && lecture && (currentUser.id === lecture.host_id || currentUser.role === 'ADMIN')) ||
        room?.getHost()?.id === socket.id;

      if (!isAuthorized) {
        return callback?.({ error: 'Forbidden: only the lecture host or an administrator can end the session.' });
      }

      await run(`UPDATE lectures SET status = 'ENDED', end_time = CURRENT_TIMESTAMP WHERE id = ? OR room_id = ?`, [lectureId, resolvedRoomId]);
      await run(`UPDATE transcripts SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE lecture_id = ? OR lecture_id = ?`, [lectureId, resolvedRoomId]);

      console.log(`[Socket endLecture] Room ${resolvedRoomId} / Lecture ${lectureId} ended by authorized host.`);

      // Broadcast to room that lecture has ended
      io.to(resolvedRoomId).emit('lectureEnded', { roomId: resolvedRoomId, lectureId, status: 'ENDED' });
      io.to(lectureId).emit('lectureEnded', { roomId: resolvedRoomId, lectureId, status: 'ENDED' });

      if (room) {
        rooms.delete(resolvedRoomId);
      }

      // Background AI generation
      generateLectureSummary(lectureId).catch((e) => console.warn('[Auto-Summary] Background error:', e.message));
      generateLectureChapters(lectureId).catch((e) => console.warn('[Auto-Chapters] Background error:', e.message));
      generateStudyNotes(lectureId, 'detailed').catch((e) => console.warn('[Auto-Notes] Background error:', e.message));

      callback?.({ success: true, lectureId, roomId: resolvedRoomId });
    } catch (err) {
      console.warn('[Socket endLecture] Error:', err.message);
      callback?.({ error: err.message });
    }
  });

  socket.on('getTranscript', async ({ roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      const lectureId = room?.lectureId || roomId;

      const record = await get('SELECT * FROM transcripts WHERE lecture_id = ?', [lectureId]);
      const segments = await all(
        'SELECT * FROM transcript_segments WHERE lecture_id = ? ORDER BY start_time ASC',
        [lectureId]
      );
      callback?.({
        roomId,
        status: record?.status || 'complete',
        segments: segments.map((s) => ({
          id: s.chunk_id,
          text: s.text,
          startOffset: s.start_time,
          endOffset: s.end_time,
          speakerName: s.speaker_name,
          status: 'complete',
        })),
        fullText: record?.full_text || segments.map((s) => s.text).join(' '),
      });
    } catch (e) {
      callback?.({ error: e.message });
    }
  });

  // ── Live Chat with Persistence & Moderation ────────────────────────────────
  socket.on('chatMessage', async ({ message }, callback) => {
    try {
      const room = rooms.get(currentRoomId);
      if (!room) return callback?.({ error: 'Room not found' });

      if (!message || typeof message !== 'string' || !message.trim()) {
        return callback?.({ error: 'Message cannot be empty' });
      }

      const cleanMessage = message.trim().slice(0, 1000);
      const msgId = 'msg_' + uuidv4().slice(0, 8);
      const senderName = currentUser?.name || (room.getHost()?.id === socket.id ? 'Teacher' : 'Student');
      const timestamp = Date.now();

      // Persist to DB
      if (room.lectureId) {
        await run(
          `INSERT INTO chat_messages (id, lecture_id, user_id, sender_name, message, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [msgId, room.lectureId, currentUser?.id || null, senderName, cleanMessage, timestamp]
        );
      }

      socket.to(currentRoomId).emit('chatMessage', {
        id: msgId,
        peerId: socket.id,
        senderName,
        senderRole: currentUser?.role || (room.getHost()?.id === socket.id ? 'TEACHER' : 'STUDENT'),
        message: cleanMessage,
        timestamp,
      });

      callback?.({ sent: true, id: msgId });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });

  // ── Real-Time Multilingual Translation ────────────────────────────────────
  socket.on('translateText', async ({ text, targetLang }, callback) => {
    if (!text || typeof text !== 'string' || !text.trim() || !targetLang || targetLang === 'en') {
      return callback?.({ translatedText: text || '' });
    }

    const trimmed = text.trim().slice(0, 500);
    const cacheKey = `${targetLang}_${trimmed.toLowerCase()}`;
    if (translationCache.has(cacheKey)) {
      return callback?.({ translatedText: translationCache.get(cacheKey) });
    }

    const langNames = {
      hi: 'Hindi',
      mr: 'Marathi',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
    };
    const targetName = langNames[targetLang] || targetLang;

    try {
      const prompt = `Translate the following text into ${targetName}. Output ONLY the direct translated sentence in ${targetName}, nothing else: "${trimmed}"`;
      const translated = await callGemini(async (model) => {
        const resp = await model.generateContent(prompt);
        return resp.response.text().trim();
      });

      const cleanText = translated.replace(/^["'`]|["'`]$/g, '').trim() || trimmed;
      translationCache.set(cacheKey, cleanText);
      console.log(`[Translation -> ${targetName}] "${trimmed}" => "${cleanText}"`);
      callback?.({ translatedText: cleanText });
    } catch (err) {
      console.warn(`[Translate Error ${targetLang}]:`, err.message);
      callback?.({ translatedText: trimmed, error: err.message });
    }
  });

  // Host Moderation: Remove participant
  socket.on('removeParticipant', ({ peerId }, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room || room.getHost()?.id !== socket.id) {
      return callback?.({ error: 'Only the host can remove participants' });
    }

    io.to(peerId).emit('removedFromRoom', { reason: 'Removed by instructor' });
    callback?.({ success: true });
  });

  // ── Disconnect / Cleanup ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.removePeer(socket.id);
    socket.to(currentRoomId).emit('peerLeft', { peerId: socket.id });

    if (room.isEmpty()) {
      if (room.lectureId) {
        run(`UPDATE lectures SET status = 'ENDED', end_time = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`, [room.lectureId]).catch(console.warn);
      }
      rooms.delete(currentRoomId);
      console.log(`[Room ${currentRoomId}] Deleted (empty)`);
    }
  });
});

// ─── START ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[Server] Fatal error during bootstrap:', err);
    process.exit(1);
  });
}

module.exports = { app, httpServer, io, bootstrap };
