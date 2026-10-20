/**
 * Real-time Speech-to-Text Server using Google Gemini API (gemini-1.5-flash)
 * 
 * Setup:
 *   1. Add GEMINI_API_KEY=your_key in server/.env
 *   2. Run: npm run stt-gemini
 */

require('dotenv').config();
const { Server } = require('socket.io');

const PORT = process.env.LLM_PORT || 5000;
const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i);

const { getDefaultKeyManager } = require('./geminiKeyManager');
const geminiManager = getDefaultKeyManager();

if (geminiManager.getActiveKeyCount() > 0) {
  console.log(`[Gemini STT Server] Loaded ${geminiManager.getActiveKeyCount()} Gemini API Key(s) for automatic rotation!`);
} else {
  console.warn('[Gemini STT Server] WARNING: No valid GEMINI_API_KEY found in server/.env');
}

io.on('connection', (socket) => {
  console.log(`[Gemini STT Server] Client connected: ${socket.id}`);

  socket.on('startSession', ({ sessionId }) => {
    console.log(`[Gemini STT Server] Started session for room: ${sessionId}`);
  });

  socket.on('audioChunk', async ({ sessionId, chunk, startOffset, chunkId, language }) => {
    if (aiInstances.length === 0) {
      console.error('[Gemini STT Server] No GEMINI_API_KEY available in server/.env');
      return;
    }

    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!buffer || buffer.length < 1500) {
        // Skip tiny/empty audio packets (under 1.5 KB usually represents silence/null buffer)
        return;
      }

      const audioPart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'audio/webm',
        },
      };

      const langNames = {
        hi: 'Hindi',
        mr: 'Marathi',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
      };
      const requestedLangName = language && language !== 'en' ? langNames[language] : null;

      let prompt = 'Listen to the audio recording carefully and transcribe spoken speech into text. Output ONLY the raw transcribed words. Do not add timestamps, quotes, markdown formatting, or comments. If the audio contains only silence, breathing, or background noise, output ONLY the single word: SILENCE.';
      if (requestedLangName) {
        prompt = `Listen to the audio recording carefully and transcribe the spoken speech. If it is in a different language, translate it directly into ${requestedLangName}. Output ONLY the resulting speech text in ${requestedLangName}. Do not add timestamps, quotes, markdown formatting, or comments. If the audio contains only silence, breathing, or background noise, output ONLY the single word: SILENCE.`;
      }

      let result = null;
      let lastError = null;

      const result = await geminiManager.executeWithRotation(async (genAI, keyIndex) => {
        let lastModelErr = null;
        for (const modelName of CANDIDATE_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            return await model.generateContent([prompt, audioPart]);
          } catch (e) {
            lastModelErr = e;
            const errMsg = String(e.message || '');
            if (errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('resource_exhausted')) {
              throw e; // Immediately let manager rotate key
            }
            if (errMsg.includes('404') || errMsg.includes('not found')) {
              console.warn(`[Gemini STT] Model ${modelName} on Key #${keyIndex + 1} not found. Trying next candidate model...`);
              continue;
            }
            throw e;
          }
        }
        throw lastModelErr || new Error(`All candidate models failed on Key #${keyIndex + 1}`);
      });

      const responseText = result.response.text();
      let transcribedText = responseText ? responseText.trim().replace(/^["']|["']$/g, '') : '';

      // Check if text is non-speech / noise / silence hallucination
      const lower = transcribedText.toLowerCase();
      const isNoise =
        !transcribedText ||
        lower === 'silence' ||
        lower === 'silence.' ||
        lower === 'empty' ||
        lower === '.' ||
        lower.startsWith('<noise') ||
        lower.startsWith('[noise') ||
        lower === 'dance' ||
        lower === 'cerrar' ||
        /^\d{1,2}:\d{2}$/.test(transcribedText) || // e.g. "00:03", "00:04"
        /^<[^>]+>$/.test(transcribedText) ||
        /^\[[^\]]+\]$/.test(transcribedText);

      if (!isNoise) {
        console.log(`[Gemini STT Transcribed @ ${startOffset}s] (chunkId: ${chunkId || 'n/a'}${requestedLangName ? `, lang: ${requestedLangName}` : ''}): ${transcribedText}`);
        socket.emit('transcriptSegment', {
          sessionId,
          chunkId,
          text: transcribedText,
          startOffset,
          endOffset: parseFloat((startOffset + 5.0).toFixed(2)),
          language: language || 'en',
        });
      }
    } catch (error) {
      console.error('[Gemini STT Error]:', error.message);
    }
  });

  socket.on('endSession', ({ sessionId }) => {
    console.log(`[Gemini STT Server] Session ended for room: ${sessionId}`);
  });
});

console.log(`[Gemini STT Server] Listening on http://localhost:${PORT}`);
