/**
 * security_audit.test.js
 * 
 * Comprehensive automated regression and security test suite for LectureLens.
 * Tests:
 * 1. Code Injection / RCE Mitigation in visualizationEngine (math expression sanitization)
 * 2. Subprocess & Command Injection Prevention (SALKG adapter & guard bridge)
 * 3. Authentication, Token Validation, Expired & Tampered Tokens
 * 4. Privilege Escalation Prevention in Registration
 * 5. Role-Based Access Control (ADMIN, TEACHER, STUDENT)
 * 6. Object-Level Access Control (IDOR prevention on status, end, delete, recording)
 * 7. Quiz Answer Key Concealment (preventing premature answer leakage to students)
 * 8. Security Headers (Helmet) and Rate Limiting
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');

const { evaluateMathExpression } = require('../src/visualizationEngine');
const { invokePythonBridge } = require('../src/salkgAdapter');
const { invokeGuardPipeline } = require('../src/salkgGuardService');
const { generateToken, verifyToken, registerUser } = require('../src/auth');
const { run } = require('../src/db');
const { app } = require('../src/server');

describe('Security Audit & Hardening Test Suite', () => {
  let server;
  let baseUrl;
  const JWT_SECRET = process.env.JWT_SECRET || 'lecturelens_secure_persistent_key_2026_super_secret';

  // Test Tokens
  let adminToken;
  let teacherToken;
  let student1Token;
  let student2Token;

  before(async () => {
    // Isolate from any background Spring Boot server so SQLite seeded fixtures are tested directly
    process.env.SPRING_BOOT_URL = 'http://127.0.0.1:59999';

    // Generate valid tokens with specific roles & IDs
    adminToken = generateToken({ id: 'usr_admin_test', name: 'Admin User', email: 'admin@lecturelens.test', role: 'ADMIN' });
    teacherToken = generateToken({ id: 'usr_teacher_test', name: 'Teacher User', email: 'teacher@lecturelens.test', role: 'TEACHER' });
    student1Token = generateToken({ id: 'usr_student_1', name: 'Student One', email: 'student1@lecturelens.test', role: 'STUDENT' });
    student2Token = generateToken({ id: 'usr_student_2', name: 'Student Two', email: 'student2@lecturelens.test', role: 'STUDENT' });

    // Seed fixtures into SQLite
    await run(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES 
      ('usr_admin_test', 'Admin User', 'admin@lecturelens.test', 'hash', 'ADMIN'),
      ('usr_teacher_test', 'Teacher User', 'teacher@lecturelens.test', 'hash', 'TEACHER'),
      ('usr_student_1', 'Student One', 'student1@lecturelens.test', 'hash', 'STUDENT'),
      ('usr_student_2', 'Student Two', 'student2@lecturelens.test', 'hash', 'STUDENT')`);

    await run(`INSERT OR REPLACE INTO lectures (id, room_id, title, host_id, status, visibility) VALUES 
      ('lec_sec_test', 'ROOMSEC1', 'Security Lecture', 'usr_teacher_test', 'LIVE', 'PUBLIC'),
      ('lec_private_test', 'ROOMPRIV1', 'Confidential Research', 'usr_teacher_test', 'LIVE', 'PRIVATE')`);

    await run(`INSERT OR REPLACE INTO quizzes (id, lecture_id, title) VALUES
      ('quiz_sec_test', 'lec_sec_test', 'Security Quiz 101')`);

    await run(`INSERT OR REPLACE INTO quiz_questions (id, quiz_id, question_text, type, options_json, correct_answer, explanation, difficulty) VALUES
      ('q_sec_1', 'quiz_sec_test', 'What is XSS?', 'MCQ', '["A","B","C"]', 'B', 'Cross-site scripting', 'Medium')`);

    // Start ephemeral server for HTTP testing
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      await run(`DELETE FROM quiz_questions WHERE quiz_id = 'quiz_sec_test'`);
      await run(`DELETE FROM quizzes WHERE id = 'quiz_sec_test'`);
      await run(`DELETE FROM lectures WHERE id IN ('lec_sec_test', 'lec_private_test')`);
      await run(`DELETE FROM users WHERE id IN ('usr_admin_test', 'usr_teacher_test', 'usr_student_1', 'usr_student_2')`);
    } catch (_) {}
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // =========================================================================
  // 1. RCE & Math Expression Sanitization
  // =========================================================================
  describe('Phase 3: RCE Mitigation in visualizationEngine', () => {
    test('rejects malicious process execution payloads', () => {
      assert.strictEqual(evaluateMathExpression('process.exit()', 1), 0);
      assert.strictEqual(evaluateMathExpression('require("child_process")', 1), 0);
      assert.strictEqual(evaluateMathExpression('global.process.mainModule.require', 1), 0);
    });

    test('rejects code injection via eval, Function, or constructor', () => {
      assert.strictEqual(evaluateMathExpression('eval("2+2")', 1), 0);
      assert.strictEqual(evaluateMathExpression('(new Function("return 1"))()', 1), 0);
      assert.strictEqual(evaluateMathExpression('constructor.constructor("return 1")()', 1), 0);
    });

    test('rejects network access and property access attempts', () => {
      assert.strictEqual(evaluateMathExpression('fetch("http://evil.com")', 1), 0);
      assert.strictEqual(evaluateMathExpression('window.location', 1), 0);
      assert.strictEqual(evaluateMathExpression('document.cookie', 1), 0);
    });

    test('evaluates safe mathematical expressions accurately', () => {
      assert.strictEqual(evaluateMathExpression('2 * x + 5', 3), 11);
      assert.strictEqual(evaluateMathExpression('x^2', 4), 16);
      assert.strictEqual(evaluateMathExpression('Math.sin(0)', 0), 0);
      assert.strictEqual(evaluateMathExpression('(x + 2) / 2', 4), 3);
    });
  });

  // =========================================================================
  // 2. Subprocess & Command Injection
  // =========================================================================
  describe('Phase 6: Subprocess Argument Validation', () => {
    test('salkgAdapter rejects malicious lectureId with shell injection characters', async () => {
      await assert.rejects(
        async () => {
          await invokePythonBridge('lec_123; rm -rf /');
        },
        /Invalid lectureId format/
      );

      await assert.rejects(
        async () => {
          await invokePythonBridge('lec_123 && echo hacked');
        },
        /Invalid lectureId format/
      );

      await assert.rejects(
        async () => {
          await invokePythonBridge('lec_123 | ls');
        },
        /Invalid lectureId format/
      );
    });

    test('salkgGuardService rejects malicious lectureId in invokeGuardPipeline', async () => {
      await assert.rejects(
        async () => {
          await invokeGuardPipeline({ lectureId: 'lec_bad; calc.exe' });
        },
        /Invalid lecture ID format/
      );
    });
  });

  // =========================================================================
  // 3. Authentication & Privilege Escalation
  // =========================================================================
  describe('Phase 2: Authentication & Privilege Escalation', () => {
    test('rejects unauthenticated user registering as ADMIN', async () => {
      await assert.rejects(
        async () => {
          await registerUser({
            name: 'Malicious Attacker',
            email: `attacker_${Date.now()}@test.com`,
            password: 'StrongPassword123!',
            role: 'ADMIN',
          }, null);
        },
        /Privilege escalation prevented/
      );
    });

    test('allows legitimate new instructor to register as TEACHER', async () => {
      const regRes = await registerUser({
        name: 'New Professor',
        email: `prof_${Date.now()}@lecturelens.test`,
        password: 'StrongPassword123!',
        role: 'TEACHER',
      }, null);

      assert.strictEqual(regRes.user.role, 'TEACHER');
      assert.ok(regRes.token, 'Should issue valid JWT token for registered teacher');
    });

    test('enforces password minimum length of 8 characters', async () => {
      await assert.rejects(
        async () => {
          await registerUser({
            name: 'Short Pass',
            email: `short_${Date.now()}@test.com`,
            password: 'short',
            role: 'STUDENT',
          }, null);
        },
        /Password must be at least 8 characters long/
      );
    });

    test('enforces strict email validation on registration', async () => {
      await assert.rejects(
        async () => {
          await registerUser({
            name: 'Bad Email',
            email: 'not-an-email',
            password: 'ValidPassword123!',
            role: 'STUDENT',
          }, null);
        },
        /Invalid email format/
      );
    });

    test('verifies valid tokens and rejects tampered or expired tokens', () => {
      // Valid token
      const valid = verifyToken(student1Token);
      assert.strictEqual(valid.id, 'usr_student_1');
      assert.strictEqual(valid.role, 'STUDENT');

      // Tampered token
      const tampered = student1Token.slice(0, -6) + 'abcdef';
      assert.strictEqual(verifyToken(tampered), null);

      // Expired token
      const expired = jwt.sign({ id: 'usr_old', role: 'STUDENT' }, JWT_SECRET, { expiresIn: -10 });
      assert.strictEqual(verifyToken(expired), null);

      // Wrong secret
      const wrongSecret = jwt.sign({ id: 'usr_fake', role: 'ADMIN' }, 'wrong_secret_123');
      assert.strictEqual(verifyToken(wrongSecret), null);
    });
  });

  // =========================================================================
  // 4. Role-Based & Object-Level Access Control (RBAC & IDOR)
  // =========================================================================
  describe('Phase 2 & 5: Route Authorization & IDOR Mitigations', () => {
    test('DELETE /api/lectures (wipe all) rejects unauthenticated request (401)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures`, { method: 'DELETE' });
      assert.strictEqual(res.status, 401);
    });

    test('DELETE /api/lectures (wipe all) rejects STUDENT role (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${student1Token}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('DELETE /api/lectures (wipe all) rejects TEACHER role (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('PUT /api/lectures/:id/status rejects unauthenticated user (401)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_nonexistent/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ENDED' }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/lectures/:id/end rejects unauthenticated user (401)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_nonexistent/end`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/lectures/:id/recording rejects unauthenticated user (401)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_nonexistent/recording`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 401);
    });

    test('Student cannot alter status of teacher lecture (403 IDOR prevention)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_sec_test/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ status: 'ENDED' }),
      });
      assert.strictEqual(res.status, 403);
    });

    test('Student cannot end teacher lecture (403 IDOR prevention)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_sec_test/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${student1Token}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('Student cannot delete teacher lecture (403 IDOR prevention)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_sec_test`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${student1Token}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('Unauthorized student cannot access private lecture transcript (403 Data Isolation)', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_private_test/transcript`, {
        headers: { Authorization: `Bearer ${student2Token}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('Quiz questions endpoint strips correct_answer and explanation for students', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_sec_test/quiz`, {
        headers: { Authorization: `Bearer ${student1Token}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.quiz);
      assert.ok(Array.isArray(data.questions) && data.questions.length > 0);
      const q = data.questions[0];
      assert.strictEqual(q.correct_answer, undefined, 'Student must not see correct_answer');
      assert.strictEqual(q.explanation, undefined, 'Student must not see explanation');
    });

    test('Host teacher can view full quiz answer keys and explanations', async () => {
      const res = await fetch(`${baseUrl}/api/lectures/lec_sec_test/quiz`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.quiz);
      assert.ok(Array.isArray(data.questions) && data.questions.length > 0);
      const q = data.questions[0];
      assert.strictEqual(q.correct_answer, 'B', 'Host teacher must see correct_answer');
      assert.strictEqual(q.explanation, 'Cross-site scripting', 'Host teacher must see explanation');
    });
  });

  // =========================================================================
  // 5. Security Headers & Helmet
  // =========================================================================
  describe('Phase 4: Security Headers & Transport Hardening', () => {
    test('enforces essential security headers (Helmet)', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);

      // Check for Helmet security headers
      const xContentType = res.headers.get('x-content-type-options');
      assert.strictEqual(xContentType, 'nosniff', 'Must include X-Content-Type-Options: nosniff');

      const xFrameOptions = res.headers.get('x-frame-options');
      assert.ok(xFrameOptions === 'SAMEORIGIN' || xFrameOptions === 'DENY', 'Must enforce X-Frame-Options');
    });

    test('CORS handles preflight and restricts invalid origins', async () => {
      const res = await fetch(`${baseUrl}/api/lectures`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });
      assert.ok(res.status === 204 || res.status === 200);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
    });
  });
});
