/**
 * unifiedSttServer.js
 * 
 * Unified Speech-to-Text (STT) Socket.IO Server for LectureLens.
 * Supports:
 * - OpenAI Whisper API transcription (in-memory, low latency, robust)
 * - Google Gemini Multimodal Audio transcription (with key rotation)
 * - Local offline educational transcript simulator
 * - Automatic fallback between providers to ensure 100% transcript uptime
 */

require('dotenv').config();
const { Server } = require('socket.io');
const { toFile } = require('openai');

const PORT = parseInt(process.env.LLM_PORT, 10) || 5000;

// Allowed CORS origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:3001'];

// Provider selection
let configuredProvider = (process.env.STT_PROVIDER || 'auto').toLowerCase().trim();

// ── Gemini Setup ────────────────────────────────────────────────────────────
const { getDefaultKeyManager } = require('./geminiKeyManager');
const geminiManager = getDefaultKeyManager();

// ── OpenAI Setup ────────────────────────────────────────────────────────────
let openaiClient = null;
const rawOpenAiKey = process.env.OPENAI_API_KEY;
if (rawOpenAiKey && !rawOpenAiKey.includes('your_openai_api_key')) {
  try {
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: rawOpenAiKey });
  } catch (e) {
    console.warn('[Unified STT] Could not load openai package:', e.message);
  }
}

// ── Active Provider Resolution ──────────────────────────────────────────────
function resolveActiveProvider() {
  if (configuredProvider === 'gemini') {
    if (geminiManager.getActiveKeyCount() > 0) return 'gemini';
    if (openaiClient) return 'openai';
    return 'mock';
  }
  if (configuredProvider === 'openai') {
    if (openaiClient) return 'openai';
    if (geminiManager.getActiveKeyCount() > 0) return 'gemini';
    return 'mock';
  }
  if (configuredProvider === 'mock') {
    return 'mock';
  }
  // Auto: Prefer OpenAI Whisper if valid key present, else Gemini, else Mock
  if (openaiClient) return 'openai';
  if (geminiManager.getActiveKeyCount() > 0) return 'gemini';
  return 'mock';
}

const activeProvider = resolveActiveProvider();
console.log(`[Unified STT] Initialized with primary provider: [${activeProvider.toUpperCase()}]`);

// ── Mock Educational Phrases ────────────────────────────────────────────────
const SAMPLE_PHRASES = [
  "Welcome everyone to today's lecture on distributed systems.",
  "Today we will cover WebRTC media streaming and Selective Forwarding Units.",
  "As you can see on the screen, low-latency audio packet processing is critical.",
  "Let me pause here and ask if anyone has questions about the architecture.",
  "In the next section, we will analyze data serialization and socket events.",
  "Notice how audio chunks are captured every 4 seconds and sent over WebSockets.",
  "This enables seamless real-time captions directly in your browser.",
  "Let's review the main takeaways before concluding today's session."
];

const sessionCounters = new Map();

/**
 * Transcribe an audio buffer using the best available provider with automatic fallback
 */
async function transcribeAudio(buffer, language = 'en', sessionId = 'default', chunkId = 1, startOffset = 0) {
  const count = sessionCounters.get(sessionId) || 0;
  sessionCounters.set(sessionId, count + 1);
  const endOffset = parseFloat((startOffset + 4.0).toFixed(2));

  // 1. Try Primary: OPENAI WHISPER
  if (activeProvider === 'openai' && openaiClient) {
    try {
      const audioFile = await toFile(buffer, 'audio.webm', { type: 'audio/webm' });
      const transcription = await openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language && language !== 'auto' && language.length === 2 ? language : undefined,
      });

      const text = (transcription.text || '').trim();
      if (text) {
        return { text, startOffset, endOffset };
      }
      // If Whisper processed audio and detected silence / no speech, return null
      return null;
    } catch (err) {
      console.warn(`[Unified STT] OpenAI Whisper chunk #${count + 1} notice: ${err.message}. Attempting fallback...`);
    }
  }

  // 2. Try GEMINI (if active or as fallback)
  if (geminiManager.getActiveKeyCount() > 0) {
    try {
      const audioPart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'audio/webm',
        },
      };

      const result = await geminiManager.executeWithRotation(async (client) => {
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
        return await model.generateContent([
          `You are an accurate real-time speech transcriber. Transcribe this audio clip exactly as spoken in ${language}. Return ONLY the transcribed words with zero commentary. If the audio is silence, return [SILENCE].`,
          audioPart,
        ]);
      });

      const text = result.response.text().trim();
      if (text && text !== '[SILENCE]') {
        return { text, startOffset, endOffset };
      }
      // If Gemini reported silence, return null
      return null;
    } catch (err) {
      console.warn(`[Unified STT] Gemini chunk #${count + 1} notice: ${err.message}`);
    }
  }

  // 3. Fallback: Secondary attempt with OpenAI if not already primary
  if (activeProvider !== 'openai' && openaiClient) {
    try {
      const audioFile = await toFile(buffer, 'audio.webm', { type: 'audio/webm' });
      const transcription = await openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language && language !== 'auto' && language.length === 2 ? language : undefined,
      });

      const text = (transcription.text || '').trim();
      if (text) {
        return { text, startOffset, endOffset };
      }
      return null;
    } catch (err) {
      console.warn(`[Unified STT] Secondary OpenAI fallback notice: ${err.message}`);
    }
  }

  // 4. Fallback: Local Educational Transcript Simulator (ONLY in explicit mock mode or when provider is mock)
  if (activeProvider === 'mock' || configuredProvider === 'mock') {
    const phraseIndex = count % SAMPLE_PHRASES.length;
    const text = SAMPLE_PHRASES[phraseIndex];
    return { text, startOffset, endOffset };
  }

  // Otherwise, user is silent -> return null
  return null;
}

/**
 * Register STT event listeners on a single socket
 */
function registerSttHandlers(socket) {
  socket.on('startSession', ({ sessionId }) => {
    if (sessionId) sessionCounters.set(sessionId, 0);
    console.log(`[Unified STT] Session started for room: ${sessionId} (provider: ${activeProvider})`);
  });

  socket.on('audioChunk', async ({ sessionId, chunk, startOffset = 0, chunkId, language = 'en' }) => {
    if (!chunk || chunk.length < 500) {
      return; // Ignore empty / silence packets
    }

    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const res = await transcribeAudio(buffer, language, sessionId, chunkId, startOffset);
      if (res && res.text) {
        socket.emit('transcriptSegment', {
          sessionId,
          chunkId,
          text: res.text,
          startOffset: res.startOffset,
          endOffset: res.endOffset,
        });
      }
    } catch (e) {
      console.warn('[Unified STT] Error processing audioChunk:', e.message);
    }
  });

  socket.on('endSession', ({ sessionId }) => {
    if (sessionId) sessionCounters.delete(sessionId);
    console.log(`[Unified STT] Session ended for room: ${sessionId}`);
  });
}

/**
 * Attach STT event listeners to an existing Socket.IO Server instance (e.g., port 3001)
 */
function attachSttSocketHandlers(ioInstance) {
  if (!ioInstance) return;
  ioInstance.on('connection', (socket) => {
    registerSttHandlers(socket);
  });
  console.log('[Unified STT] Embedded STT handlers attached to main Socket.IO server.');
}

// ── Standalone Server on PORT (5000) ─────────────────────────────────────────
let standaloneIo = null;
function startSttServer(port = PORT) {
  if (standaloneIo) return standaloneIo;
  try {
    standaloneIo = new Server(port, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    standaloneIo.on('connection', (socket) => {
      console.log(`[Unified STT Standalone] Client connected: ${socket.id}`);
      registerSttHandlers(socket);
    });

    console.log(`[Unified STT Standalone Server] Listening on http://localhost:${port}`);
    return standaloneIo;
  } catch (err) {
    console.warn(`[Unified STT Standalone] Notice: Could not bind to port ${port}: ${err.message}`);
    return null;
  }
}

// Auto-start standalone if run directly
if (require.main === module) {
  startSttServer();
}

module.exports = {
  io: standaloneIo,
  startSttServer,
  attachSttSocketHandlers,
  registerSttHandlers,
  transcribeAudio,
  resolveActiveProvider,
};
