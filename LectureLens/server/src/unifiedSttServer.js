/**
 * unifiedSttServer.js
 * 
 * Unified Speech-to-Text (STT) Socket.IO Server for LectureLens.
 * Simplifies and unifies multiple disparate STT scripts (mock, Gemini, OpenAI)
 * into a single configurable runtime with automatic provider selection and fallback.
 * 
 * Supported Providers:
 * - 'gemini': Google Gemini Multimodal Audio transcription (default if GEMINI_API_KEY is present)
 * - 'openai': OpenAI Whisper API transcription (default if OPENAI_API_KEY is present and no Gemini)
 * - 'mock': Local offline educational transcript simulator
 * - 'auto': Auto-detects based on environment keys, falling back gracefully to mock
 * 
 * Configuration via environment variables:
 * - STT_PROVIDER: 'auto' | 'gemini' | 'openai' | 'mock'
 * - LLM_PORT: Port to listen on (default: 5000)
 * - GEMINI_API_KEY / OPENAI_API_KEY
 * - CORS_ORIGIN: Allowed origins whitelist
 */

require('dotenv').config();
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.LLM_PORT, 10) || 5000;

// Allowed CORS origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

const io = new Server(PORT, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy on STT Server'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Provider selection
let configuredProvider = (process.env.STT_PROVIDER || 'auto').toLowerCase().trim();

// ── Gemini Setup ────────────────────────────────────────────────────────────
let geminiInstances = [];
let geminiKeyIndex = 0;
const rawGeminiKeys = (process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k && !k.includes('your_gemini_api_key'));

if (rawGeminiKeys.length > 0) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    geminiInstances = rawGeminiKeys.map((k) => new GoogleGenerativeAI(k));
  } catch (e) {
    console.warn('[Unified STT] Could not load @google/generative-ai:', e.message);
  }
}

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
    if (geminiInstances.length > 0) return 'gemini';
    console.warn('[Unified STT] Provider requested is gemini, but no GEMINI_API_KEY found. Falling back to mock.');
    return 'mock';
  }
  if (configuredProvider === 'openai') {
    if (openaiClient) return 'openai';
    console.warn('[Unified STT] Provider requested is openai, but no OPENAI_API_KEY found. Falling back to mock.');
    return 'mock';
  }
  if (configuredProvider === 'mock') {
    return 'mock';
  }
  // Auto-detect
  if (geminiInstances.length > 0) return 'gemini';
  if (openaiClient) return 'openai';
  return 'mock';
}

const activeProvider = resolveActiveProvider();
console.log(`[Unified STT Server] Initialized on port ${PORT} using provider: [${activeProvider.toUpperCase()}]`);

// ── Mock Phrases ────────────────────────────────────────────────────────────
const SAMPLE_PHRASES = [
  "Welcome everyone to today's lecture on distributed systems.",
  "Today we will cover WebRTC media streaming and Selective Forwarding Units.",
  "As you can see on the screen, low-latency audio packet processing is critical.",
  "Let me pause here and ask if anyone has questions about the architecture.",
  "In the next section, we will analyze data serialization and socket events.",
  "Notice how audio chunks are captured every 3 seconds and sent over WebSockets.",
  "This enables seamless real-time captions directly in your browser.",
  "Let's review the main takeaways before concluding today's session."
];
const sessionCounters = new Map();

// Temp directory for file-based providers (OpenAI Whisper)
const tempDir = path.join(__dirname, '..', 'temp_audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ── Socket.IO Event Handlers ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Unified STT] Client connected: ${socket.id}`);

  socket.on('startSession', ({ sessionId }) => {
    sessionCounters.set(sessionId, 0);
    console.log(`[Unified STT] Session started for room: ${sessionId} (provider: ${activeProvider})`);
  });

  socket.on('audioChunk', async ({ sessionId, chunk, startOffset = 0, chunkId, language = 'en' }) => {
    const count = sessionCounters.get(sessionId) || 0;
    sessionCounters.set(sessionId, count + 1);

    if (!chunk || chunk.length < 1000) {
      return; // Ignore tiny packets / silence
    }

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const endOffset = parseFloat((startOffset + 3.0).toFixed(2));

    // 1. GEMINI PROVIDER
    if (activeProvider === 'gemini') {
      try {
        const ai = geminiInstances[geminiKeyIndex % geminiInstances.length];
        geminiKeyIndex++;

        const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const audioPart = {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'audio/webm',
          },
        };

        const result = await model.generateContent([
          `You are an accurate real-time speech transcriber. Transcribe this audio clip exactly as spoken in ${language}. Return ONLY the transcribed words with zero commentary or punctuation explanations. If the audio is silence or unintelligible noise, return [SILENCE].`,
          audioPart,
        ]);

        const text = result.response.text().trim();
        if (text && text !== '[SILENCE]') {
          socket.emit('transcriptSegment', {
            sessionId,
            chunkId,
            text,
            startOffset,
            endOffset,
          });
        }
        return;
      } catch (err) {
        console.warn(`[Unified STT] Gemini error for chunk #${count + 1}: ${err.message}. Falling back to sample phrase.`);
      }
    }

    // 2. OPENAI PROVIDER
    if (activeProvider === 'openai') {
      const tempFile = path.join(tempDir, `chunk_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`);
      try {
        fs.writeFileSync(tempFile, buffer);
        const transcription = await openaiClient.audio.transcriptions.create({
          file: fs.createReadStream(tempFile),
          model: 'whisper-1',
          language,
        });

        const text = (transcription.text || '').trim();
        if (text) {
          socket.emit('transcriptSegment', {
            sessionId,
            chunkId,
            text,
            startOffset,
            endOffset,
          });
        }
        return;
      } catch (err) {
        console.warn(`[Unified STT] OpenAI error for chunk #${count + 1}: ${err.message}. Falling back to sample phrase.`);
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlink(tempFile, () => {});
        }
      }
    }

    // 3. MOCK / FALLBACK PROVIDER
    const phraseIndex = count % SAMPLE_PHRASES.length;
    const text = SAMPLE_PHRASES[phraseIndex];
    setTimeout(() => {
      socket.emit('transcriptSegment', {
        sessionId,
        chunkId,
        text,
        startOffset,
        endOffset,
      });
    }, 300);
  });

  socket.on('endSession', ({ sessionId }) => {
    sessionCounters.delete(sessionId);
    console.log(`[Unified STT] Session ended for room: ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Unified STT] Client disconnected: ${socket.id}`);
  });
});

module.exports = { io, resolveActiveProvider };
