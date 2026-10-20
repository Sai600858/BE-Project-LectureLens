"""
Real-time Local Speech-to-Text Server using Faster-Whisper (100% Free & Offline)

Prerequisites:
  1. Install FFmpeg on your system (e.g. `winget install ffmpeg` on Windows, or `sudo apt install ffmpeg` on Linux)
  2. Install Python packages:
     pip install python-socketio eventlet faster-whisper
  3. Run server:
     python src/real_llm_server_whisper.py
"""

import os
import sys
import tempfile
import socketio
import eventlet

try:
    from faster_whisper import WhisperModel
    print("[Local STT Server] Loading Faster-Whisper model ('base')...")
    # Options: tiny, base, small, medium, large-v3
    model = WhisperModel("base", device="cpu", compute_type="int8")
    print("[Local STT Server] Faster-Whisper model loaded successfully!")
except Exception as e:
    print(f"[Local STT Server] Error loading Whisper model: {e}")
    print("Please install requirements: pip install python-socketio eventlet faster-whisper")
    sys.exit(1)

sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

@sio.event
def connect(sid, environ):
    print(f"[Local STT Server] Client connected: {sid}")

@sio.event
def startSession(sid, data):
    session_id = data.get('sessionId')
    print(f"[Local STT Server] Started session for room: {session_id}")

@sio.event
def audioChunk(sid, data):
    session_id = data.get('sessionId')
    chunk_data = data.get('chunk')
    start_offset = data.get('startOffset', 0.0)
    chunk_id = data.get('chunkId')

    if not chunk_data:
        return

    # Write WebM audio blob to temporary file
    temp_filename = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
            temp_filename = temp_file.name
            if isinstance(chunk_data, bytes):
                temp_file.write(chunk_data)
            else:
                temp_file.write(bytes(chunk_data))

        # Transcribe audio using local Whisper model
        segments, _ = model.transcribe(temp_filename, beam_size=5, language="en")
        transcribed_text = " ".join([seg.text.strip() for seg in segments if seg.text]).strip()

        if transcribed_text:
            print(f"[{session_id} @ {start_offset}s] (chunkId: {chunk_id}): {transcribed_text}")
            sio.emit('transcriptSegment', {
                'sessionId': session_id,
                'chunkId': chunk_id,
                'text': transcribed_text,
                'startOffset': start_offset,
                'endOffset': round(start_offset + 3.0, 2)
            }, room=sid)

    except Exception as err:
        print(f"[Local STT Server Error]: {err}")
    finally:
        if temp_filename and os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except OSError:
                pass

@sio.event
def endSession(sid, data):
    print(f"[Local STT Server] Ended session for room: {data.get('sessionId')}")

@sio.event
def disconnect(sid):
    print(f"[Local STT Server] Client disconnected: {sid}")

if __name__ == '__main__':
    port = 5000
    print(f"[Local STT Server] Listening on http://localhost:{port}")
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', port)), app)
