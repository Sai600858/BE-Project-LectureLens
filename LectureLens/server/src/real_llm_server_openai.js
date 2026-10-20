/**
 * Real-time Speech-to-Text Server using OpenAI Whisper API
 * 
 * Requirements:
 *   npm install openai socket.io
 *   set OPENAI_API_KEY=your_actual_api_key
 *   node src/real_llm_server_openai.js
 */

require('dotenv').config();
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.LLM_PORT || 5000;
const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

let openai = null;

try {
  const { OpenAI } = require('openai');
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    openai = new OpenAI({ apiKey });
    console.log('[OpenAI STT Server] OpenAI API Client initialized successfully.');
  } else {
    console.warn('[OpenAI STT Server] WARNING: OPENAI_API_KEY is missing or set to placeholder in server/.env');
  }
} catch (err) {
  console.warn('[OpenAI STT Server] `openai` package error:', err.message);
}

const tempDir = path.join(__dirname, '../temp_audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

io.on('connection', (socket) => {
  console.log(`[OpenAI STT Server] Client connected: ${socket.id}`);

  socket.on('startSession', ({ sessionId }) => {
    console.log(`[OpenAI STT Server] Session started for room: ${sessionId}`);
  });

  socket.on('audioChunk', async ({ sessionId, chunk, startOffset, chunkId }) => {
    if (!openai) {
      console.error('[OpenAI STT Server] Cannot transcribe: OPENAI_API_KEY is missing or `openai` package not installed.');
      return;
    }

    const tempFile = path.join(tempDir, `chunk_${sessionId}_${Date.now()}.webm`);

    try {
      // Save WebM audio chunk to temporary file
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      fs.writeFileSync(tempFile, buffer);

      // Call OpenAI Whisper API
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: 'en',
      });

      const text = response.text ? response.text.trim() : '';

      if (text) {
        console.log(`[STT Transcribed @ ${startOffset}s] (chunkId: ${chunkId || 'n/a'}): ${text}`);
        socket.emit('transcriptSegment', {
          sessionId,
          chunkId,
          text,
          startOffset,
          endOffset: parseFloat((startOffset + 3.0).toFixed(2)),
        });
      }
    } catch (error) {
      console.error('[OpenAI STT Error]:', error.message);
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  socket.on('endSession', ({ sessionId }) => {
    console.log(`[OpenAI STT Server] Session ended for room: ${sessionId}`);
  });
});

console.log(`[OpenAI STT Server] Listening on http://localhost:${PORT}`);
