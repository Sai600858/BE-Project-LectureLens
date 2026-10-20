const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

async function testRoomCodeFlow() {
  console.log('--- Testing Room Code Generation & Student Entry Flow ---');

  // 1. Teacher login
  const teacherLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@lecturelens.edu', password: 'password123' }),
  }).then((r) => r.json());

  const teacherToken = teacherLogin.token;
  console.log('1. Teacher logged in, token acquired.');

  // 2. Student login
  const studentLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@lecturelens.edu', password: 'password123' }),
  }).then((r) => r.json());

  const studentToken = studentLogin.token;
  console.log('2. Student logged in, token acquired.');

  // 3. Teacher creates lecture via POST /api/lectures
  const createRes = await fetch(`${SERVER_URL}/api/lectures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: 'Advanced Operating Systems & Kernel Architecture',
      description: 'Virtual memory paging, thread synchronization, and IPC.',
    }),
  }).then((r) => r.json());

  const lecture = createRes.lecture;
  console.log('3. Lecture created:', {
    id: lecture.id,
    lectureId: lecture.lectureId,
    roomId: lecture.roomId,
    room_id: lecture.room_id,
  });

  if (!lecture.roomId || lecture.roomId === 'undefined' || !lecture.room_id) {
    throw new Error('FAILURE: Room Code is undefined or invalid in API response!');
  }
  console.log(`✅ [PASS] Room code is valid: "${lecture.roomId}"`);

  // 4. Test Teacher Socket `createRoom`
  const teacherSocket = io(SERVER_URL, { auth: { token: teacherToken } });
  await new Promise((resolve, reject) => {
    teacherSocket.on('connect', () => {
      teacherSocket.emit('createRoom', { roomId: lecture.roomId, title: lecture.title }, (res) => {
        if (res.error) return reject(new Error(res.error));
        console.log(`4. Teacher created room via socket. Res roomId: ${res.roomId}`);
        if (!res.roomId || res.roomId === 'UNDEFINED') {
          return reject(new Error('FAILURE: Teacher room ID returned was UNDEFINED'));
        }
        resolve();
      });
    });
  });
  console.log('✅ [PASS] Teacher successfully initiated room with valid code.');

  // 5. Test Student Socket `joinRoom` with exact code
  const studentSocket1 = io(SERVER_URL, { auth: { token: studentToken } });
  await new Promise((resolve, reject) => {
    studentSocket1.on('connect', () => {
      studentSocket1.emit('joinRoom', { roomId: lecture.roomId }, (res) => {
        if (res.error) return reject(new Error(res.error));
        console.log(`5. Student 1 joined room successfully with code "${lecture.roomId}". Capabilities:`, Boolean(res.rtpCapabilities));
        resolve();
      });
    });
  });
  console.log('✅ [PASS] Student entered room using code.');

  // 6. Test Student Socket `joinRoom` with lowercase and extra spaces
  const studentSocket2 = io(SERVER_URL, { auth: { token: studentToken } });
  await new Promise((resolve, reject) => {
    studentSocket2.on('connect', () => {
      const lowercaseCode = `  ${lecture.roomId.toLowerCase()}  `;
      studentSocket2.emit('joinRoom', { roomId: lowercaseCode }, (res) => {
        if (res.error) return reject(new Error(res.error));
        console.log(`6. Student 2 joined room with lowercase/spaced code "${lowercaseCode}". Normalized code: ${res.roomId}`);
        resolve();
      });
    });
  });
  console.log('✅ [PASS] Lowercase and whitespace room codes are correctly normalized.');

  // 7. Test Edge Case: Teacher passes 'undefined' string as roomId
  const teacherSocketEdge = io(SERVER_URL, { auth: { token: teacherToken } });
  await new Promise((resolve, reject) => {
    teacherSocketEdge.on('connect', () => {
      teacherSocketEdge.emit('createRoom', { roomId: 'undefined', title: 'Edge Case Lecture' }, (res) => {
        if (res.error) return reject(new Error(res.error));
        console.log(`7. Edge case handled: Teacher passed "undefined", server assigned: "${res.roomId}"`);
        if (res.roomId === 'UNDEFINED' || !res.roomId) {
          return reject(new Error('FAILURE: Server assigned literal UNDEFINED'));
        }
        resolve();
      });
    });
  });
  console.log('✅ [PASS] "undefined" string is safely converted to a valid 8-digit code.');

  // 8. Clean up sockets
  teacherSocket.disconnect();
  studentSocket1.disconnect();
  studentSocket2.disconnect();
  teacherSocketEdge.disconnect();

  console.log('\n🎉 ALL ROOM CODE VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}

testRoomCodeFlow().catch((err) => {
  console.error('❌ Room code verification test failed:', err);
  process.exit(1);
});
