const { Server } = require('socket.io');

const PORT = process.env.LLM_PORT || 5000;
const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Sample lecture transcript phrases for demonstration when real STT model is offline
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

io.on('connection', (socket) => {
  console.log(`[LLM STT Server] Connected client: ${socket.id}`);

  socket.on('startSession', ({ sessionId }) => {
    sessionCounters.set(sessionId, 0);
    console.log(`[LLM STT Server] Started transcription session for room: ${sessionId}`);
  });

  socket.on('audioChunk', ({ sessionId, chunk, startOffset, chunkId }) => {
    const count = sessionCounters.get(sessionId) || 0;
    sessionCounters.set(sessionId, count + 1);

    const phraseIndex = count % SAMPLE_PHRASES.length;
    const text = SAMPLE_PHRASES[phraseIndex];
    const endOffset = parseFloat((startOffset + 3.0).toFixed(2));

    console.log(`[LLM STT Server] Processing audio chunk #${count + 1} (${chunk ? chunk.byteLength || chunk.length || 'blob' : 'empty'} bytes) for room ${sessionId} @ ${startOffset}s (chunkId: ${chunkId || 'n/a'})`);

    // Simulate STT processing delay (~400ms)
    setTimeout(() => {
      socket.emit('transcriptSegment', {
        sessionId,
        chunkId,
        text,
        startOffset,
        endOffset,
      });
    }, 400);
  });

  socket.on('endSession', ({ sessionId }) => {
    sessionCounters.delete(sessionId);
    console.log(`[LLM STT Server] Session ended for room: ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[LLM STT Server] Client disconnected: ${socket.id}`);
  });
});

console.log(`[LLM STT Server] Running & listening on http://localhost:${PORT}`);
