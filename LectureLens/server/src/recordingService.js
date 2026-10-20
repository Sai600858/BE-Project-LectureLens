const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { run, get } = require('./db');

const RECORDINGS_DIR = path.join(__dirname, '..', 'data', 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

/**
 * Save an uploaded recording file
 */
async function saveRecording({ lectureId, tempFilePath, mimeType = 'video/webm', durationSeconds = 0 }) {
  const recordingId = 'rec_' + uuidv4().slice(0, 8);
  const targetFilename = `${lectureId}_${Date.now()}.webm`;
  const targetPath = path.join(RECORDINGS_DIR, targetFilename);

  fs.copyFileSync(tempFilePath, targetPath);
  try {
    fs.unlinkSync(tempFilePath);
  } catch (e) {}

  const stats = fs.statSync(targetPath);

  // Update or insert recording record
  const existing = await get('SELECT id FROM recordings WHERE lecture_id = ?', [lectureId]);
  if (existing) {
    await run(
      `UPDATE recordings
       SET file_path = ?, file_size = ?, duration_seconds = ?, mime_type = ?, status = 'COMPLETED'
       WHERE lecture_id = ?`,
      [targetPath, stats.size, durationSeconds, mimeType, lectureId]
    );
  } else {
    await run(
      `INSERT INTO recordings (id, lecture_id, file_path, duration_seconds, file_size, mime_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [recordingId, lectureId, targetPath, durationSeconds, stats.size, mimeType]
    );
  }

  // Update lecture status to ENDED / COMPLETED
  await run(`UPDATE lectures SET status = 'COMPLETED' WHERE id = ?`, [lectureId]);

  return {
    recordingId: existing ? existing.id : recordingId,
    lectureId,
    filePath: targetPath,
    fileSize: stats.size,
    durationSeconds,
  };
}

/**
 * Stream recording with HTTP Range support for video scrubbing
 */
function streamRecording(req, res, filePath, mimeType = 'video/webm') {
  // Bug #12 fix: Prevent path traversal — only allow files inside RECORDINGS_DIR
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(RECORDINGS_DIR);
  if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
    return res.status(403).json({ error: 'Access denied: invalid recording path' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Recording file not found on disk' });
  }

  const stat = fs.statSync(resolvedPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(resolvedPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
    };
    res.writeHead(200, head);
    fs.createReadStream(resolvedPath).pipe(res);
  }
}

module.exports = {
  saveRecording,
  streamRecording,
  RECORDINGS_DIR,
};
