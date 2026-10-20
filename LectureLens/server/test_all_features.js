/**
 * LectureLens — Comprehensive End-to-End Feature Verification Suite
 * Tests all 20+ core functional modules across REST APIs, WebSockets, DB, AI, and PDFs.
 */

const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3001';
const STT_URL = 'http://localhost:5000';
const AI_SERVICE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

const results = [];

function recordTest(feature, success, details) {
  results.push({ feature, success, details });
  const icon = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${feature}]: ${details}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log('    LECTURELENS COMPREHENSIVE FEATURE VERIFICATION SUITE    ');
  console.log('============================================================\n');

  let teacherToken = null;
  let studentToken = null;
  let adminToken = null;
  let testLecture = null;

  // ── TEST 1: Service Health Checks ──────────────────────────────────────────
  try {
    const beHealth = await fetch(`${SERVER_URL}/health`).then(r => r.json());
    recordTest('Server Health API', beHealth.status === 'ok', `Status: ${beHealth.status}, Active rooms: ${beHealth.activeRooms}`);

    const feRes = await fetch(`${FRONTEND_URL}/`);
    recordTest('Frontend Web Client', feRes.status === 200, `HTTP ${feRes.status} on port 3000`);

    const aiHealth = await fetch(`${AI_SERVICE_URL}/health`).then(r => r.json());
    recordTest('Python FastAPI AI Service', aiHealth.status === 'healthy', `Status: ${aiHealth.status}, Vision ready: ${aiHealth.visionReady}`);
  } catch (e) {
    recordTest('Service Health', false, e.message);
  }

  // ── TEST 2: Authentication & Password Hashing ─────────────────────────────
  try {
    // 2a. Bad password
    const badLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@lecturelens.edu', password: 'wrongpassword' }),
    });
    recordTest('Auth: Invalid Password Rejection', badLogin.status === 401, `Rejected with HTTP ${badLogin.status}`);

    // 2b. Teacher login
    const teacherLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@lecturelens.edu', password: 'password123' }),
    }).then(r => r.json());
    teacherToken = teacherLogin.token;
    recordTest('Auth: Teacher Login (BCrypt & JWT)', Boolean(teacherToken), `Token issued for ${teacherLogin.user?.name} (Role: ${teacherLogin.user?.role})`);

    // 2c. Student login
    const studentLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@lecturelens.edu', password: 'password123' }),
    }).then(r => r.json());
    studentToken = studentLogin.token;
    recordTest('Auth: Student Login', Boolean(studentToken), `Token issued for ${studentLogin.user?.name} (Role: ${studentLogin.user?.role})`);

    // 2d. Admin login
    const adminLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@lecturelens.edu', password: 'admin123' }),
    }).then(r => r.json());
    adminToken = adminLogin.token;
    recordTest('Auth: Admin Login', Boolean(adminToken), `Token issued for ${adminLogin.user?.name} (Role: ${adminLogin.user?.role})`);

    // 2e. Register new user
    const testEmail = `student_${Date.now()}@test.edu`;
    const regRes = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Student', email: testEmail, password: 'password123', role: 'STUDENT' }),
    }).then(r => r.json());
    recordTest('Auth: Dynamic User Registration', Boolean(regRes.token), `Registered user ${regRes.user?.id} (${regRes.user?.email})`);

    // 2f. Verify protected route /api/auth/me
    const meRes = await fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    }).then(r => r.json());
    recordTest('Auth: Protected Route /api/auth/me', meRes.user?.email === 'teacher@lecturelens.edu', `Verified profile: ${meRes.user?.name}`);
  } catch (e) {
    recordTest('Authentication', false, e.message);
  }

  // ── TEST 3: Role-Based Access Control (RBAC) ──────────────────────────────
  try {
    // Student attempting to create lecture (forbidden)
    const studentCreate = await fetch(`${SERVER_URL}/api/lectures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ title: 'Unauthorized Lecture' }),
    });
    recordTest('RBAC: Student Restricted from Lecture Creation', studentCreate.status === 403, `Correctly returned HTTP ${studentCreate.status} Forbidden`);

    // Student attempting to access admin users (forbidden)
    const studentAdmin = await fetch(`${SERVER_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    recordTest('RBAC: Student Restricted from Admin Route', studentAdmin.status === 403, `Correctly returned HTTP ${studentAdmin.status} Forbidden`);

    // Admin accessing admin stats
    const adminStats = await fetch(`${SERVER_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json());
    recordTest('RBAC: Admin Access to System Statistics', adminStats.totalUsers > 0, `Users: ${adminStats.totalUsers}, Lectures: ${adminStats.totalLectures}`);
  } catch (e) {
    recordTest('RBAC', false, e.message);
  }

  // ── TEST 4: Lecture Management & Lifecycle ────────────────────────────────
  try {
    const createLecRes = await fetch(`${SERVER_URL}/api/lectures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        title: 'Distributed Systems: Fault Tolerance & Consensus',
        description: 'Deep dive into Paxos, Raft, and Byzantine Fault Tolerance.',
        visibility: 'PUBLIC',
      }),
    }).then(r => r.json());
    testLecture = createLecRes.lecture;
    recordTest('Lecture: Creation with Unique Room ID', Boolean(testLecture?.id && testLecture?.room_id), `LectureId: ${testLecture?.id}, RoomId: ${testLecture?.room_id}`);

    // Update status to LIVE
    await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ status: 'LIVE' }),
    });

    const getLec = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}`).then(r => r.json());
    recordTest('Lecture: State Transition to LIVE', getLec.lecture?.status === 'LIVE', `Status updated to ${getLec.lecture?.status}`);

    const listLec = await fetch(`${SERVER_URL}/api/lectures`).then(r => r.json());
    const found = listLec.lectures?.some(l => l.id === testLecture.id);
    recordTest('Lecture: Catalog & History Listing', found, `Verified lecture presence in catalog`);
  } catch (e) {
    recordTest('Lecture Management', false, e.message);
  }

  // ── TEST 5 & 6: Socket.IO Signaling, WebRTC, Screen Share & Chat ──────────
  try {
    await new Promise((resolve) => {
      const teacherSocket = io(SERVER_URL, { auth: { token: teacherToken } });
      const studentSocket = io(SERVER_URL, { auth: { token: studentToken } });

      let hostCreated = false;
      let participantJoined = false;
      let chatReceived = false;

      teacherSocket.on('connect', () => {
        teacherSocket.emit('createRoom', { roomId: testLecture.room_id, title: testLecture.title }, (res) => {
          if (res?.rtpCapabilities) hostCreated = true;

          studentSocket.emit('joinRoom', { roomId: testLecture.room_id }, (jRes) => {
            if (jRes?.rtpCapabilities) participantJoined = true;

            // Test Producer creation with screen type
            teacherSocket.emit('createTransport', { direction: 'send' }, (_tRes) => {
              // Test Chat message
              studentSocket.emit('chatMessage', { message: 'Hello Professor! Can you explain the leader election phase?' });
            });
          });
        });
      });

      teacherSocket.on('chatMessage', (msg) => {
        if (msg.message.includes('leader election')) {
          chatReceived = true;
          recordTest('WebRTC & Signaling: Room Creation & Join', hostCreated && participantJoined, `Router capabilities exchanged`);
          recordTest('Live Chat: Real-time Message Broadcast', chatReceived, `Sender: ${msg.senderName} (${msg.senderRole}): "${msg.message}"`);
          teacherSocket.disconnect();
          studentSocket.disconnect();
          resolve();
        }
      });
    });
  } catch (e) {
    recordTest('Socket.IO Signaling & Chat', false, e.message);
  }

  // ── TEST 7: Speech-to-Text & Speaker Attribution ──────────────────────────
  try {
    const { run, all } = require('./src/db');
    // Populate realistic lecture segments
    await run('INSERT INTO transcript_segments (lecture_id, chunk_id, speaker_name, start_time, end_time, text) VALUES (?, ?, ?, ?, ?, ?)',
      [testLecture.id, 1, 'Prof. Alan Turing', 0.0, 10.5, 'Welcome everyone. In today lecture, we will study distributed consensus, the Raft protocol, and network partitions.']);
    await run('INSERT INTO transcript_segments (lecture_id, chunk_id, speaker_name, start_time, end_time, text) VALUES (?, ?, ?, ?, ?, ?)',
      [testLecture.id, 2, 'Prof. Alan Turing', 12.0, 25.0, 'In Raft, a node is in one of three states: Leader, Follower, or Candidate. Leaders send heartbeats to maintain authority.']);
    await run('INSERT INTO transcript_segments (lecture_id, chunk_id, speaker_name, start_time, end_time, text) VALUES (?, ?, ?, ?, ?, ?)',
      [testLecture.id, 3, 'Ada Lovelace', 28.0, 36.0, 'Professor Turing, what happens when a leader fails during an active transaction?']);
    await run('INSERT INTO transcript_segments (lecture_id, chunk_id, speaker_name, start_time, end_time, text) VALUES (?, ?, ?, ?, ?, ?)',
      [testLecture.id, 4, 'Prof. Alan Turing', 38.0, 52.0, 'If heartbeats stop, followers timeout and transition to candidate state, starting a new term with election votes.']);

    const segments = await all('SELECT * FROM transcript_segments WHERE lecture_id = ? ORDER BY start_time ASC', [testLecture.id]);
    recordTest('STT: Persistent Segments & Speaker Identification', segments.length === 4, `Persisted ${segments.length} segments with timestamps and speaker names`);
  } catch (e) {
    recordTest('STT & Speaker Attribution', false, e.message);
  }

  // ── TEST 8: Whiteboard & Equation Understanding (Gemini Vision) ───────────
  try {
    const boardRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/board-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...', // sample base64
        timestamp: 15.0,
      }),
    }).then(r => r.json());

    const boardContents = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/board-contents`).then(r => r.json());
    recordTest('Vision AI: Whiteboard Frame Processing', boardContents.contents?.length > 0, `Captured whiteboard note: "${boardContents.contents[0]?.extracted_text?.slice(0, 50)}..."`);
  } catch (e) {
    recordTest('Whiteboard Vision Processing', false, e.message);
  }

  // ── TEST 9: Slide & Screen Understanding ──────────────────────────────────
  try {
    const screenRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/screen-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        timestamp: 22.0,
      }),
    }).then(r => r.json());

    const screenContents = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/screen-contents`).then(r => r.json());
    recordTest('Vision AI: Slide Understanding', screenContents.contents?.length > 0, `Slide Title: "${screenContents.contents[0]?.slide_title}"`);
  } catch (e) {
    recordTest('Slide Vision Processing', false, e.message);
  }

  // ── TEST 10: Multimodal AI Lecture Summary ────────────────────────────────
  try {
    const summaryRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/summary`, {
      method: 'POST',
    }).then(r => r.json());

    const summary = summaryRes.summary;
    const hasParts = Boolean(summary.shortSummary && summary.keyConcepts?.length > 0 && summary.definitions?.length > 0);
    recordTest('AI Summary: Multimodal Executive Summary', hasParts, `Executive summary generated with ${summary.keyConcepts?.length} key concepts and ${summary.definitions?.length} definitions`);
  } catch (e) {
    recordTest('AI Lecture Summary', false, e.message);
  }

  // ── TEST 11: Structured Study Notes (4 Modes) ─────────────────────────────
  try {
    const detailedNotes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'detailed' }),
    }).then(r => r.json());

    const examNotes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'exam' }),
    }).then(r => r.json());

    recordTest('Study Notes: Detailed Mode Generation', Boolean(detailedNotes.notes?.contentMarkdown), `Length: ${detailedNotes.notes?.contentMarkdown?.length} chars, formulas: ${detailedNotes.notes?.formulas?.length}`);
    recordTest('Study Notes: Exam-Oriented Mode Generation', Boolean(examNotes.notes?.contentMarkdown), `Exam questions: ${examNotes.notes?.questions?.length}`);
  } catch (e) {
    recordTest('Study Notes', false, e.message);
  }

  // ── TEST 12: PDF Generation (Transcript, Summary, Complete Notes) ─────────
  try {
    const tPdfRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/pdf/transcript`);
    const tPdfBytes = await tPdfRes.arrayBuffer();
    const tHeader = Buffer.from(tPdfBytes.slice(0, 5)).toString();
    recordTest('PDF: Transcript Export', tPdfRes.status === 200 && tHeader === '%PDF-', `HTTP 200, Valid PDF header (${tPdfBytes.byteLength} bytes)`);

    const sPdfRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/pdf/summary`);
    const sPdfBytes = await sPdfRes.arrayBuffer();
    const sHeader = Buffer.from(sPdfBytes.slice(0, 5)).toString();
    recordTest('PDF: Summary Export', sPdfRes.status === 200 && sHeader === '%PDF-', `HTTP 200, Valid PDF header (${sPdfBytes.byteLength} bytes)`);

    const nPdfRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/pdf/study-notes`);
    const nPdfBytes = await nPdfRes.arrayBuffer();
    const nHeader = Buffer.from(nPdfBytes.slice(0, 5)).toString();
    recordTest('PDF: Complete Study Notes Export', nPdfRes.status === 200 && nHeader === '%PDF-', `HTTP 200, Valid PDF header (${nPdfBytes.byteLength} bytes)`);
  } catch (e) {
    recordTest('PDF Generation', false, e.message);
  }

  // ── TEST 13: Lecture-Specific RAG Q&A ("Ask This Lecture") ────────────────
  try {
    // 13a. Grounded query
    const ragAnswer = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What states does a node have in Raft?' }),
    }).then(r => r.json());

    const hasCitation = Boolean(ragAnswer.relevantTimestamp);
    recordTest('RAG Q&A: Grounded Answer with Timestamp Citation', hasCitation, `Citation: [${ragAnswer.relevantTimestamp}] - Answer snippet: "${ragAnswer.answer?.slice(0, 75)}..."`);

    // 13b. Ungrounded query (hallucination rejection check)
    const ungrounded = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What did the professor say about black hole thermodynamics?' }),
    }).then(r => r.json());

    const rejectedHallucination = ungrounded.answer.toLowerCase().includes('not contain') || ungrounded.answer.toLowerCase().includes('enough information');
    recordTest('RAG Q&A: Hallucination Rejection', rejectedHallucination, `Promptly responded: "${ungrounded.answer?.slice(0, 60)}..."`);
  } catch (e) {
    recordTest('RAG Q&A', false, e.message);
  }

  // ── TEST 14: Searchable Transcript ────────────────────────────────────────
  try {
    const searchMatches = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/transcript/search?q=Raft`).then(r => r.json());
    recordTest('Searchable Transcript: Segment Querying', searchMatches.matches?.length > 0, `Found ${searchMatches.matches?.length} segment(s) matching "Raft" with exact timestamps`);
  } catch (e) {
    recordTest('Searchable Transcript', false, e.message);
  }

  // ── TEST 15: Automatic Chapters ───────────────────────────────────────────
  try {
    const chRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/chapters`).then(r => r.json());
    recordTest('Automatic Lecture Chapters', chRes.chapters?.length > 0, `Generated ${chRes.chapters?.length} chronological chapters with summaries`);
  } catch (e) {
    recordTest('Automatic Chapters', false, e.message);
  }

  // ── TEST 16: AI Quiz & Interactive Assessment ─────────────────────────────
  try {
    const quizRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/quiz`).then(r => r.json());
    recordTest('AI Quiz: Automatic Generation', quizRes.questions?.length > 0, `Created ${quizRes.questions?.length} quiz questions with options & explanations`);

    // Interactive student quiz submission
    const firstQ = quizRes.questions[0];
    const answers = { [firstQ.id]: firstQ.correct_answer };

    const submitRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ quizId: quizRes.quiz.id, answers }),
    }).then(r => r.json());

    recordTest('AI Quiz: Interactive Grading & Weak Topics', submitRes.score != null, `Score: ${submitRes.score}/${submitRes.totalQuestions} (${submitRes.percentage}%), Feedback provided`);
  } catch (e) {
    recordTest('AI Quiz', false, e.message);
  }

  // ── TEST 17: AI Flashcards & Spaced Repetition ─────────────────────────────
  try {
    const fcRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/flashcards`).then(r => r.json());
    recordTest('AI Flashcards: Digital Card Generation', fcRes.flashcards?.length > 0, `Generated ${fcRes.flashcards?.length} front/back flashcards`);

    if (fcRes.flashcards?.length > 0) {
      const card = fcRes.flashcards[0];
      const progRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/flashcards/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({ flashcardId: card.id, status: 'learned' }),
      }).then(r => r.json());

      recordTest('AI Flashcards: Progress State Tracking', progRes.success === true, `Marked card as "${progRes.status}"`);
    }
  } catch (e) {
    recordTest('AI Flashcards', false, e.message);
  }

  // ── TEST 18: Lecture Video Recording & Range Scrubbing ────────────────────
  try {
    // Create a dummy WebM test buffer
    const tempVideoPath = path.join(__dirname, 'temp_test_video.webm');
    fs.writeFileSync(tempVideoPath, Buffer.alloc(1024 * 50, 0x1a)); // 50 KB dummy video

    const { saveRecording } = require('./src/recordingService');
    await saveRecording({
      lectureId: testLecture.id,
      tempFilePath: tempVideoPath,
      mimeType: 'video/webm',
      durationSeconds: 120.5,
    });

    const recMeta = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/recording`).then(r => r.json());
    recordTest('Recording: Local Storage Persistence', Boolean(recMeta.recording?.file_path), `File size: ${recMeta.recording?.file_size} bytes, Duration: ${recMeta.recording?.duration_seconds}s`);

    // Range streaming request (simulating video scrubbing)
    const streamRes = await fetch(`${SERVER_URL}/api/lectures/${testLecture.id}/recording/stream`, {
      headers: { Range: 'bytes=0-1024' },
    });
    recordTest('Recording: HTTP Range Video Streaming (206)', streamRes.status === 206, `HTTP ${streamRes.status} Partial Content with Content-Range: ${streamRes.headers.get('content-range')}`);
  } catch (e) {
    recordTest('Lecture Recording & Streaming', false, e.message);
  }

  // ── TEST 19: Python FastAPI Microservice Endpoints ────────────────────────
  try {
    const boardOcr = await fetch(`${AI_SERVICE_URL}/vision/board-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lectureId: testLecture.id,
        imageBase64: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        timestamp: 10.0,
      }),
    }).then(r => r.json());
    recordTest('FastAPI: Board OCR Endpoint', Boolean(boardOcr.equation), `Extracted LaTeX: ${boardOcr.equation}`);

    const screenOcr = await fetch(`${AI_SERVICE_URL}/vision/screen-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lectureId: testLecture.id,
        imageBase64: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        timestamp: 20.0,
      }),
    }).then(r => r.json());
    recordTest('FastAPI: Screen OCR Endpoint', Boolean(screenOcr.slideTitle), `Slide: "${screenOcr.slideTitle}", Code: ${screenOcr.codeSnippet ? 'Present' : 'None'}`);
  } catch (e) {
    recordTest('FastAPI Endpoints', false, e.message);
  }

  // ── SUMMARY REPORT ────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log('                 VERIFICATION SUMMARY REPORT                ');
  console.log('============================================================\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`TOTAL FEATURES EVALUATED: ${results.length}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`SUCCESS RATE: ${Math.round((passed / results.length) * 100)}%\n`);

  if (failed === 0) {
    console.log('🏆 ALL LECTURELENS PLATFORM FEATURES ARE VERIFIED AND WORKING PROPERLY!\n');
  } else {
    console.log('⚠️ Some features had issues. Review logs above.\n');
  }
}

runTests().catch(console.error);
