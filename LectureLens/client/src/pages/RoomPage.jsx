import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMediasoup } from '../hooks/useMediasoup';
import { useTranscript } from '../hooks/useTranscript';
import socket from '../socket';
import { lectureApi } from '../services/api';
import { BoardSnapshotCompact } from '../components/BoardSnapshot';

/* ── Inject responsive CSS for mobile ── */
const ROOM_CSS = `
  .room-mobile-toggle { display: none !important; }
  @media (max-width: 768px) {
    .room-mobile-toggle { display: block !important; }
    .room-header { padding: 8px 10px !important; gap: 6px !important; }
    .room-header-left { gap: 6px !important; flex-wrap: wrap; }
    .room-brand { font-size: 14px !important; }
    .room-code-box { display: none !important; }
    .room-controls { gap: 5px !important; }
    .room-controls button { padding: 6px 8px !important; font-size: 11px !important; min-height: 36px !important; }
    .room-main { flex-direction: column !important; }
    .room-stage { min-height: 35vh !important; flex: 0 0 35vh !important; }
    .room-sidebar { width: 100% !important; height: auto !important; flex: 1 !important; border-left: none !important; border-top: 1px solid #27272a !important; }
    .room-share-banner { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; padding: 8px 12px !important; }
    .room-video-tile { width: calc(50vw - 24px) !important; }
    .room-tab-btn { font-size: 10px !important; padding: 10px 3px !important; }
  }
  @media (max-width: 480px) {
    .room-video-tile { width: calc(100vw - 24px) !important; }
    .room-stage { min-height: 30vh !important; flex: 0 0 30vh !important; }
  }
  .room-ctrl-btn-active { transition: background 0.2s; }
  .room-ctrl-btn-active:active { opacity: 0.8; }
`;

function injectRoomCSS() {
  if (document.getElementById('room-responsive-css')) return;
  const el = document.createElement('style');
  el.id = 'room-responsive-css';
  el.textContent = ROOM_CSS;
  document.head.appendChild(el);
}

/** Video Tile */
function VideoTile({ stream, muted = false, label, isScreen = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={isScreen ? styles.screenTile : styles.tile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        data-screen={isScreen ? 'true' : 'false'}
        style={isScreen ? styles.screenVideo : styles.video}
      />
      <span style={styles.label}>{label}</span>
    </div>
  );
}

/** Invisible Audio Player */
function AudioPlayer({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay />;
}

export default function RoomPage() {
  const { roomId: roomIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role') || 'participant';

  const {
    roomId,
    lectureId,
    localStream,
    remoteStreams,
    screenStream,
    remoteScreenStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    messages,
    sendMessage,
    removeParticipant,
    status,
    error,
    join,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    connectionQuality,
    participants,
  } = useMediasoup({ roomId: roomIdParam, role });

  const {
    segments,
    isRecording,
    isLectureRecording,
    startLectureRecording,
    stopLectureRecording,
    transcriptStatus,
    selectedLanguage,
    translatedSegments,
    boardContents,
    isCapturingBoard,
    captureBoardSnapshot,
    captureScreenSnapshot,
    changeLanguage,
    startTranscription,
    stopTranscription,
    fetchTranscript,
    autoSnapEnabled,
    autoSnapIntervalSec,
    toggleAutoSnap,
    updateAutoSnapInterval,
    setAutoSnapSource,
  } = useTranscript({
    roomId: roomId || roomIdParam,
    role,
    localStream,
    micEnabled,
    lectureId,
  });

  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTabState] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('room_active_tab') || 'chat' : 'chat'
  );
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('room_active_tab', tab);
    }
  }, []);
  const [boardNotice, setBoardNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [retryCode, setRetryCode] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    injectRoomCSS();
    join();
  }, []);

  // Listen for lecture conclusion from instructor
  useEffect(() => {
    const handleLectureEnded = ({ lectureId: endedLecId, roomId: endedRoomId }) => {
      const target = endedLecId || endedRoomId || lectureId || roomId || roomIdParam;
      alert('The instructor has concluded this live lecture session. Transitioning to AI Review & Notes Hub...');
      navigate(`/lecture/${target}/review`);
    };

    socket.on('lectureEnded', handleLectureEnded);
    return () => {
      socket.off('lectureEnded', handleLectureEnded);
    };
  }, [lectureId, roomId, roomIdParam, navigate]);

  // Keep auto-snap timer aware of which source to capture (screen or camera)
  useEffect(() => {
    const activeScreenSource = screenStream || remoteScreenStream || null;
    setAutoSnapSource(activeScreenSource);
  }, [screenStream, remoteScreenStream, setAutoSnapSource]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  const handleSend = () => {
    sendMessage(chatInput);
    setChatInput('');
  };

  // 1. Capture Camera / Physical Whiteboard Frame
  const handleCaptureCamera = async () => {
    setActiveTab('board');
    const cameraVideo = document.querySelector('video:not([data-screen="true"])');
    const cameraStream = localStream || remoteEntries.find(([, d]) => d.stream?.getVideoTracks()?.length > 0)?.[1]?.stream;
    const source = (cameraVideo && cameraVideo.videoWidth > 0) ? cameraVideo : (cameraStream || cameraVideo);

    if (!source) {
      alert('No active camera feed found. Please turn on your camera to capture whiteboard notes.');
      return;
    }

    try {
      setBoardNotice('📸 Analyzing whiteboard notes & formulas with Gemini Vision AI...');
      const result = await captureBoardSnapshot(source);
      if (result?.isUpdate) {
        setBoardNotice('✨ Upgraded existing whiteboard note with higher clarity & formulas!');
      } else if (result?.isDuplicate) {
        setBoardNotice('ℹ️ Same topic detected: existing note already has higher clarity (duplicate skipped).');
      } else {
        setBoardNotice('✅ Whiteboard snapshot processed & analyzed successfully!');
      }
      setTimeout(() => setBoardNotice(''), 4500);
    } catch (err) {
      setBoardNotice('⚠️ Camera capture: ' + (err.message || 'Error occurred'));
      setTimeout(() => setBoardNotice(''), 5000);
    }
  };

  // 2. Capture Shared Screen / Presentation Slide
  const handleCaptureScreen = async () => {
    setActiveTab('board');
    let source = null;
    let oneShotStream = null;

    // Check for active rendering screen video in DOM first
    const screenVideo = document.querySelector('video[data-screen="true"]');
    if (screenVideo && screenVideo.videoWidth > 0) {
      source = screenVideo;
    } else if (screenStream || remoteScreenStream) {
      source = screenStream || remoteScreenStream;
    } else {
      // If no screen share is running right now, prompt user to select window/tab/screen to snapshot
      try {
        setBoardNotice('🖥️ Select the presentation slide window or tab to snapshot...');
        oneShotStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'never' },
        });
        source = oneShotStream;
      } catch (cancelErr) {
        setBoardNotice('');
        return; // User cancelled picker
      }
    }

    if (!source) {
      alert('No active presentation slide detected. Please share your screen or pick a slide window.');
      return;
    }

    try {
      setBoardNotice('🖥️ Analyzing presentation slide with Gemini Vision AI...');
      const result = await captureScreenSnapshot(source);
      if (result?.isUpdate) {
        setBoardNotice('✨ Upgraded existing presentation slide with higher clarity & formulas!');
      } else if (result?.isDuplicate) {
        setBoardNotice('ℹ️ Same topic detected: existing slide already has higher clarity (duplicate skipped).');
      } else {
        setBoardNotice('✅ Shared screen slide processed & analyzed successfully!');
      }
      setTimeout(() => setBoardNotice(''), 4500);
    } catch (err) {
      console.error('Slide snap failed:', err);
      setBoardNotice('⚠️ Screen capture: ' + (err.message || 'Error occurred'));
      setTimeout(() => setBoardNotice(''), 5000);
    } finally {
      if (oneShotStream) {
        oneShotStream.getTracks().forEach((t) => t.stop());
      }
    }
  };

  const handleCaptureBoard = async () => {
    if (activeScreen) {
      await handleCaptureScreen();
    } else {
      await handleCaptureCamera();
    }
  };

  const handleEndLecture = async () => {
    const target = lectureId || roomId || roomIdParam;
    if (role === 'host') {
      const confirmed = window.confirm(
        'Are you sure you want to conclude and end this lecture session for all participants?'
      );
      if (!confirmed) return;

      if (isRecording) stopTranscription();
      if (isLectureRecording) stopLectureRecording();

      socket.emit('endLecture', { roomId: roomId || roomIdParam, lectureId: target });
      try {
        await lectureApi.endLecture(target);
      } catch (err) {
        console.warn('API end lecture call notice:', err.message);
      }

      navigate(`/lecture/${target}/review`);
    } else {
      navigate('/dashboard');
    }
  };

  const remoteEntries = Object.entries(remoteStreams);
  const displayRoomId =
    roomId && roomId !== 'undefined' && roomId !== 'null'
      ? roomId
      : roomIdParam && roomIdParam !== 'new' && roomIdParam !== 'undefined' && roomIdParam !== 'null'
      ? roomIdParam.toUpperCase()
      : 'Generating…';

  const handleCopyCode = () => {
    if (!displayRoomId || displayRoomId === 'Generating…') return;
    navigator.clipboard.writeText(displayRoomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    if (!displayRoomId || displayRoomId === 'Generating…') return;
    const url = `${window.location.origin}/room/${displayRoomId}?role=participant`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const activeScreen = screenStream || remoteScreenStream;

  return (
    <div style={styles.page}>
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div style={styles.header} className="room-header">
        <div style={styles.headerLeft} className="room-header-left">
          <span style={styles.brandTitle} className="room-brand">🎓 LectureLens</span>
          <div style={styles.roomCodeBox} className="room-code-box">
            <span style={styles.roomCodeLabel}>ROOM CODE:</span>
            <span style={styles.roomCodeValue}>{displayRoomId}</span>
            <button
              onClick={handleCopyCode}
              style={styles.roomCopyBtn}
              title="Copy 8-digit Room Code for students"
            >
              {copiedCode ? '✓ Copied' : '📋 Copy Code'}
            </button>
            <button
              onClick={handleCopyLink}
              style={styles.roomCopyBtn}
              title="Copy direct invite link for students"
            >
              {copiedLink ? '✓ Copied' : '🔗 Link'}
            </button>
          </div>
          <span style={styles.roleTag(role)}>{role === 'host' ? 'Teacher / Host' : 'Student'}</span>
          <div style={styles.connQuality}>
            <span style={styles.statusDot(status)} />
            <span style={styles.connText}>{connectionQuality}</span>
          </div>
        </div>

        {/* Media Controls */}
        <div style={styles.headerControls} className="room-controls">
          <button
            onClick={toggleMic}
            style={styles.controlBtn(micEnabled)}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? '🎙️ Mic' : '🔇 Muted'}
          </button>
          <button
            onClick={toggleCamera}
            style={styles.controlBtn(cameraEnabled)}
            title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
          >
            {cameraEnabled ? '📷 Video' : '🚫 Video Off'}
          </button>

          {/* Screen Share Button */}
          {role === 'host' && (
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              style={styles.screenBtn(isScreenSharing)}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Presentation or Screen'}
            >
              {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
            </button>
          )}

          {/* Board / Camera Capture Button */}
          <button
            onClick={handleCaptureCamera}
            disabled={isCapturingBoard}
            style={styles.boardCaptureBtn}
            title="Snap camera or physical whiteboard to extract formulas and diagrams"
          >
            {isCapturingBoard ? '📸 Analyzing…' : '📸 Snap Board'}
          </button>

          {/* Screen Share Slide Capture Button */}
          {(activeScreen || isScreenSharing) && (
            <button
              onClick={handleCaptureScreen}
              disabled={isCapturingBoard}
              style={{
                ...styles.boardCaptureBtn,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                borderColor: '#3b82f6',
              }}
              title="Snap shared presentation slide to extract technical content and diagrams"
            >
              {isCapturingBoard ? '🖥️ Analyzing…' : '🖥️ Snap Slide'}
            </button>
          )}

          {/* Lecture Video Recording Toggle (Host Only) */}
          {role === 'host' && (
            <button
              onClick={isLectureRecording ? stopLectureRecording : startLectureRecording}
              style={styles.recordBtn(isLectureRecording)}
              title="Record video & audio of lecture"
            >
              {isLectureRecording ? '⏹️ Recording...' : '🔴 Record Lecture'}
            </button>
          )}

          {/* Live Transcription Toggle (Host Only) */}
          {role === 'host' && (
            <button
              onClick={isRecording ? stopTranscription : startTranscription}
              style={styles.transcriptBtn(isRecording)}
            >
              {isRecording ? '⏹️ Stop Captions' : '📝 Start Captions'}
            </button>
          )}

          {/* ── Auto-Snap Toggle (Host Only) ────────────────────────────── */}
          {role === 'host' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={toggleAutoSnap}
                style={styles.autoSnapBtn(autoSnapEnabled)}
                title={
                  autoSnapEnabled
                    ? `Auto-Snap ON — capturing every ${autoSnapIntervalSec}s. Click to stop.`
                    : 'Enable automatic periodic board & slide snapshots'
                }
              >
                {autoSnapEnabled ? '🤖 Auto-Snap ON' : '🤖 Auto-Snap'}
              </button>
              {/* Interval picker — only visible when auto-snap is active */}
              {autoSnapEnabled && (
                <select
                  value={autoSnapIntervalSec}
                  onChange={(e) => updateAutoSnapInterval(Number(e.target.value))}
                  style={styles.autoSnapSelect}
                  title="Snapshot interval in seconds"
                >
                  <option value={10}>10 s</option>
                  <option value={20}>20 s</option>
                  <option value={30}>30 s</option>
                  <option value={60}>60 s</option>
                </select>
              )}
            </div>
          )}

          <button onClick={handleEndLecture} style={styles.leaveBtn}>
            {role === 'host' ? 'End & Review' : 'Leave'}
          </button>
        </div>
      </div>

      {/* ── Host Room Code Share Banner ─────────────────────────────────── */}
      {role === 'host' && displayRoomId && displayRoomId !== 'Generating…' && (
        <div style={styles.shareBanner} className="room-share-banner">
          <div style={styles.shareBannerLeft}>
            <span style={styles.shareIcon}>📢</span>
            <span style={styles.shareBannerText}>
              Student Join Code: <strong>{displayRoomId}</strong> — Students can enter using this 8-digit code.
            </span>
          </div>
          <div style={styles.shareBannerActions}>
            <button onClick={handleCopyCode} style={styles.bannerBtn}>
              {copiedCode ? '✓ Code Copied' : '📋 Copy Code'}
            </button>
            <button onClick={handleCopyLink} style={styles.bannerBtn}>
              {copiedLink ? '✓ Link Copied' : '🔗 Copy Student Invite Link'}
            </button>
          </div>
        </div>
      )}

      {/* ── Error Recovery Modal for Missing / Invalid Room ───────────── */}
      {error && (
        <div style={styles.errorOverlay}>
          <div style={styles.errorCard}>
            <div style={styles.errorCardIcon}>⚠️</div>
            <h3 style={styles.errorCardTitle}>Unable to Enter Room</h3>
            <p style={styles.errorCardMsg}>{error}</p>
            <div style={styles.errorCardInputRow}>
              <input
                placeholder="Enter 8-digit Room Code"
                value={retryCode}
                onChange={(e) => setRetryCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && retryCode.trim()) {
                    window.location.href = `/room/${retryCode.trim().toUpperCase()}?role=participant`;
                  }
                }}
                style={styles.errorCardInput}
              />
              <button
                onClick={() => {
                  const c = retryCode.trim().toUpperCase();
                  if (c) {
                    window.location.href = `/room/${c}?role=participant`;
                  }
                }}
                style={styles.errorCardBtn}
              >
                Join Room
              </button>
            </div>
            <button onClick={() => navigate('/dashboard')} style={styles.errorCardBackBtn}>
              ← Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Connecting Banner ──────────────────────────────────────────── */}
      {status === 'connecting' && (
        <div style={styles.overlay}>Connecting to WebRTC media server…</div>
      )}

      {/* Hidden audio players for audio streams */}
      {remoteEntries
        .filter(([, data]) => data.stream.getVideoTracks().length === 0)
        .map(([key, data]) => (
          <AudioPlayer key={key} stream={data.stream} />
        ))}

      {/* ── Mobile Sidebar Toggle ──────────────────────────────────────── */}
      <div style={styles.mobileSidebarToggle} className="room-mobile-toggle">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          style={styles.toggleBtn}
          aria-label={sidebarOpen ? 'Hide panel' : 'Show panel'}
        >
          {sidebarOpen ? '⌄ Hide Panel' : '⌃ Show Panel'}
        </button>
      </div>

      {/* ── Main Layout: Stage + Sidebar ───────────────────────────────── */}
      <div style={styles.main} className="room-main">
        {/* Stage Area */}
        <div style={styles.stageArea} className="room-stage">
          {/* If screen sharing is active: Dedicated Large View */}
          {activeScreen ? (
            <div style={styles.screenShareContainer}>
              <div style={styles.screenMainView}>
                <VideoTile
                  stream={activeScreen}
                  muted={Boolean(screenStream)}
                  label={screenStream ? 'Your Shared Screen' : 'Teacher Shared Screen'}
                  isScreen={true}
                />
              </div>

              {/* Smaller overlay participant tiles */}
              <div style={styles.screenTileStrip}>
                {localStream && (
                  <div style={styles.miniTile}>
                    <VideoTile stream={localStream} muted label="You" />
                  </div>
                )}
                {remoteEntries
                  .filter(([, data]) => data.stream.getVideoTracks().length > 0)
                  .map(([key, data]) => (
                    <div key={key} style={styles.miniTile}>
                      <VideoTile
                        stream={data.stream}
                        label={data.userName || 'Peer'}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Normal Video Grid */
            <div style={styles.videoGrid}>
              {localStream && (
                <VideoTile
                  stream={localStream}
                  muted
                  label={`You (${role === 'host' ? 'Teacher' : 'Student'})`}
                />
              )}

              {remoteEntries
                .filter(([, data]) => data.stream.getVideoTracks().length > 0)
                .map(([key, data]) => (
                  <VideoTile
                    key={key}
                    stream={data.stream}
                    label={data.userName || 'Peer'}
                  />
                ))}

              {status === 'connected' && remoteEntries.length === 0 && (
                <div style={styles.waitingNotice}>
                  <span>Waiting for students or teacher to join…</span>
                  <div style={styles.inviteNotice}>
                    Share Room Code: <strong style={{ color: '#38bdf8' }}>{displayRoomId}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tabbed Sidebar ────────────────────────────────────────────── */}
        {sidebarOpen && (
        <div style={styles.sidebar} className="room-sidebar">
          <div style={styles.tabHeaders}>
            <button
              style={styles.sidebarTab(activeTab === 'chat')}
              onClick={() => setActiveTab('chat')}
              className="room-tab-btn"
            >
              💬 Chat ({messages.length})
            </button>
            <button
              style={styles.sidebarTab(activeTab === 'transcript')}
              onClick={() => {
                if (role !== 'host' && segments.length === 0) fetchTranscript();
                setActiveTab('transcript');
              }}
            >
              📜 Captions ({segments.length})
            </button>
            <button
              style={styles.sidebarTab(activeTab === 'board')}
              onClick={() => setActiveTab('board')}
            >
              📐 Board AI ({boardContents.length})
            </button>
            <button
              style={styles.sidebarTab(activeTab === 'participants')}
              onClick={() => setActiveTab('participants')}
            >
              👥 Peers
            </button>
          </div>

          {/* Tab 1: Live Chat */}
          {activeTab === 'chat' && (
            <div style={styles.tabContent}>
              <div style={styles.chatScroll}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={msg.peerId === 'self' ? styles.msgSelf : styles.msgOther}
                  >
                    <div style={styles.msgSenderRow}>
                      <span style={styles.msgPeer}>{msg.senderName || (msg.peerId === 'self' ? 'You' : 'Student')}</span>
                      <span style={styles.msgTime}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span style={styles.msgText}>{msg.message}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div style={styles.chatInputRow}>
                <input
                  style={styles.chatInput}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask a question or send a message…"
                />
                <button style={styles.sendBtn} onClick={handleSend}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Live Transcript */}
          {activeTab === 'transcript' && (
            <div style={styles.tabContent}>
              <div style={styles.transcriptToolbar}>
                <label style={styles.subLabel}>Language:</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => changeLanguage(e.target.value)}
                  style={styles.langSelect}
                >
                  <option value="en">English (US)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="mr">Marathi (मराठी)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                </select>
              </div>

              <div style={styles.transcriptScroll}>
                {segments.length === 0 ? (
                  <div style={styles.emptyNotice}>
                    {isRecording ? 'Listening for speech…' : 'Speech-to-text is inactive.'}
                  </div>
                ) : (
                  segments.map((seg) => {
                    const trans = translatedSegments[`${seg.id}_${selectedLanguage}`];
                    const text = selectedLanguage !== 'en' ? (trans || seg.text) : seg.text;

                    return (
                      <div key={seg.id} style={styles.segCard}>
                        <div style={styles.segHeader}>
                          <span style={styles.segSpeaker}>{seg.speakerName || 'Speaker'}</span>
                          <div>
                            {selectedLanguage !== 'en' && trans && (
                              <span style={{ fontSize: '10px', color: '#38bdf8', background: '#38bdf822', padding: '1px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: '600' }}>
                                {selectedLanguage.toUpperCase()}
                              </span>
                            )}
                            <span style={styles.segTime}>{formatOffset(seg.startOffset)}</span>
                          </div>
                        </div>
                        <p style={seg.status === 'pending' ? styles.segPending : styles.segBody}>
                          {text || '[ transcribing audio… ]'}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}

          {/* Tab 3: Board AI Snapshots */}
          {activeTab === 'board' && (
            <div style={styles.tabContent}>
              <div style={styles.boardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={styles.boardHeadTitle}>📐 Board & Slide Feed</span>
                  {autoSnapEnabled && (
                    <span style={styles.autoSnapBadge}>🤖 Auto • {autoSnapIntervalSec}s</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleCaptureCamera}
                    disabled={isCapturingBoard}
                    style={styles.snapSmallBtn}
                    title="Snap Camera / Whiteboard"
                  >
                    📸 Camera
                  </button>
                  <button
                    onClick={handleCaptureScreen}
                    disabled={isCapturingBoard}
                    style={{
                      ...styles.snapSmallBtn,
                      background: '#2563eb',
                      borderColor: '#3b82f6',
                    }}
                    title="Snap Shared Screen / Presentation Slide"
                  >
                    🖥️ Slide
                  </button>
                </div>
              </div>

              {boardNotice && (
                <div style={{
                  padding: '8px 12px',
                  margin: '8px 12px 0',
                  background: boardNotice.startsWith('✅') ? '#05966922' : '#3b82f622',
                  border: `1px solid ${boardNotice.startsWith('✅') ? '#10b981' : '#3b82f6'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  fontWeight: '600'
                }}>
                  {boardNotice}
                </div>
              )}

              <div style={styles.boardScroll}>
                 {boardContents.length === 0 ? (
                  <div style={styles.emptyNotice}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                      {autoSnapEnabled ? '🤖' : '📸'}
                    </div>
                    {autoSnapEnabled ? (
                      <>
                        <strong>Auto-Snap is active</strong> — a snapshot will be captured automatically every <strong>{autoSnapIntervalSec}s</strong>.
                        {' '}You can also click <strong>"📸 Camera"</strong> or <strong>"🖥️ Slide"</strong> above for an instant manual snap.
                      </>
                    ) : (
                      <>
                        Click <strong>"📸 Camera"</strong> or <strong>"🖥️ Slide"</strong> above to analyze whiteboard equations, formulas &amp; diagrams with Gemini Vision AI,
                        {' '}or enable <strong>🤖 Auto-Snap</strong> in the toolbar to capture them automatically.
                      </>
                    )}
                  </div>
                ) : (
                  boardContents.map((b, idx) => (
                    <BoardSnapshotCompact key={b.id || idx} snapshot={b} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Participants */}
          {activeTab === 'participants' && (
            <div style={styles.tabContent}>
              <div style={styles.peerList}>
                <div style={styles.peerRow}>
                  <div>
                    <strong>You</strong> ({role})
                  </div>
                  <span style={styles.peerRoleBadge}>Active</span>
                </div>

                {participants.map((p, i) => (
                  <div key={i} style={styles.peerRow}>
                    <div>
                      <strong>{p.user?.name || 'Student'}</strong> ({p.user?.role || 'STUDENT'})
                    </div>
                    {role === 'host' && (
                      <button
                        onClick={() => removeParticipant(p.peerId)}
                        style={styles.kickBtn}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function formatOffset(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const styles = {
  page: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#09090b',
    color: '#f4f4f5',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  mobileSidebarToggle: {
    display: 'none',  // hidden on desktop; shown via media query not needed since we use inline toggle
    // On mobile we always show it via CSS below but keep it subtle
    background: '#18181b',
    borderTop: '1px solid #27272a',
    padding: '4px 12px',
    textAlign: 'right',
  },
  toggleBtn: {
    background: '#27272a',
    color: '#a1a1aa',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#18181b',
    borderBottom: '1px solid #27272a',
    gap: '12px',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#38bdf8',
  },
  roomCode: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#a1a1aa',
    background: '#27272a',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  roleTag: (role) => ({
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '999px',
    background: role === 'host' ? '#3b82f633' : '#10b98133',
    color: role === 'host' ? '#60a5fa' : '#34d399',
  }),
  connQuality: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  connText: {
    fontSize: '11px',
    color: '#a1a1aa',
  },
  statusDot: (status) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#facc15',
  }),
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  controlBtn: (active) => ({
    background: active ? '#27272a' : '#dc2626',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
  screenBtn: (sharing) => ({
    background: sharing ? '#ea580c' : '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
  boardCaptureBtn: {
    background: '#0d9488',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  recordBtn: (recording) => ({
    background: recording ? '#dc2626' : '#27272a',
    border: '1px solid',
    borderColor: recording ? '#ef4444' : '#3f3f46',
    color: '#fff',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
  transcriptBtn: (recording) => ({
    background: recording ? '#dc2626' : '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
  roomCodeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  roomCodeLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: '0.5px',
  },
  roomCodeValue: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '1px',
  },
  roomCopyBtn: {
    background: '#18181b',
    border: '1px solid #52525b',
    color: '#e4e4e7',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  shareBanner: {
    background: '#0c4a6e',
    color: '#e0f2fe',
    borderBottom: '1px solid #0284c7',
    padding: '8px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  shareBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  shareIcon: {
    fontSize: '16px',
  },
  shareBannerText: {
    color: '#f0f9ff',
  },
  shareBannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  bannerBtn: {
    background: '#0284c7',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  errorOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  errorCard: {
    background: '#18181b',
    border: '1px solid #ef4444',
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '440px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  errorCardIcon: {
    fontSize: '36px',
    marginBottom: '10px',
  },
  errorCardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 8px 0',
  },
  errorCardMsg: {
    fontSize: '13px',
    color: '#fca5a5',
    margin: '0 0 16px 0',
    lineHeight: '1.4',
  },
  errorCardInputRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  errorCardInput: {
    flex: 1,
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'monospace',
    letterSpacing: '1px',
    outline: 'none',
  },
  errorCardBtn: {
    background: '#38bdf8',
    color: '#000',
    fontWeight: '700',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  errorCardBackBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    fontSize: '12px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  leaveBtn: {
    background: '#b91c1c',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  errorBanner: {
    background: '#ef444422',
    color: '#fca5a5',
    padding: '8px 20px',
    fontSize: '13px',
    borderBottom: '1px solid #ef4444',
  },
  overlay: {
    padding: '12px 20px',
    background: '#1e1b4b',
    color: '#a5b4fc',
    fontSize: '13px',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  stageArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#000',
    position: 'relative',
  },
  screenShareContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  screenMainView: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0c',
    overflow: 'hidden',
  },
  screenTileStrip: {
    height: '120px',
    background: '#141416',
    borderTop: '1px solid #27272a',
    display: 'flex',
    gap: '8px',
    padding: '8px',
    overflowX: 'auto',
  },
  miniTile: {
    width: '160px',
    height: '100%',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  videoGrid: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '16px',
    overflowY: 'auto',
    alignContent: 'flex-start',
  },
  tile: {
    position: 'relative',
    width: '340px',
    background: '#18181b',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #27272a',
    aspectRatio: '16/9',
  },
  screenTile: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  screenVideo: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  label: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    backdropFilter: 'blur(4px)',
  },
  waitingNotice: {
    margin: 'auto',
    textAlign: 'center',
    color: '#71717a',
    fontSize: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inviteNotice: {
    fontSize: '13px',
    color: '#a1a1aa',
  },
  sidebar: {
    width: '360px',
    display: 'flex',
    flexDirection: 'column',
    background: '#121215',
    borderLeft: '1px solid #27272a',
  },
  tabHeaders: {
    display: 'flex',
    background: '#18181b',
    borderBottom: '1px solid #27272a',
  },
  sidebarTab: (active) => ({
    flex: 1,
    padding: '12px 6px',
    background: active ? '#27272a' : 'transparent',
    color: active ? '#38bdf8' : '#71717a',
    border: 'none',
    borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
  }),
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatScroll: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  msgSelf: {
    alignSelf: 'flex-end',
    background: '#2563eb',
    color: '#fff',
    borderRadius: '12px 12px 2px 12px',
    padding: '8px 12px',
    maxWidth: '85%',
  },
  msgOther: {
    alignSelf: 'flex-start',
    background: '#27272a',
    color: '#f4f4f5',
    borderRadius: '12px 12px 12px 2px',
    padding: '8px 12px',
    maxWidth: '85%',
  },
  msgSenderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '3px',
  },
  msgPeer: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#93c5fd',
  },
  msgTime: {
    fontSize: '9px',
    color: '#94a3b8',
  },
  msgText: {
    fontSize: '13px',
    lineHeight: 1.4,
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
    padding: '10px',
    borderTop: '1px solid #27272a',
    background: '#18181b',
  },
  chatInput: {
    flex: 1,
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  },
  sendBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  transcriptToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#18181b',
    borderBottom: '1px solid #27272a',
  },
  subLabel: {
    fontSize: '11px',
    color: '#a1a1aa',
  },
  langSelect: {
    background: '#27272a',
    color: '#fff',
    border: '1px solid #3f3f46',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    outline: 'none',
  },
  transcriptScroll: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  emptyNotice: {
    textAlign: 'center',
    color: '#71717a',
    fontSize: '12px',
    marginTop: '32px',
    padding: '0 16px',
  },
  segCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  segHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  segSpeaker: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  segTime: {
    fontSize: '10px',
    color: '#71717a',
    fontFamily: 'monospace',
  },
  segBody: {
    fontSize: '13px',
    color: '#d4d4d8',
    lineHeight: 1.4,
    margin: 0,
  },
  segPending: {
    fontSize: '13px',
    color: '#71717a',
    fontStyle: 'italic',
    margin: 0,
  },
  boardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#18181b',
    borderBottom: '1px solid #27272a',
  },
  boardHeadTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
  },
  snapSmallBtn: {
    background: '#0d9488',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  autoSnapBtn: (active) => ({
    background: active ? '#d97706' : '#27272a',
    border: `1px solid ${active ? '#f59e0b' : '#3f3f46'}`,
    color: '#fff',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: active ? '0 0 8px #f59e0b55' : 'none',
    transition: 'all 0.2s',
  }),
  autoSnapSelect: {
    background: '#27272a',
    border: '1px solid #3f3f46',
    color: '#f4f4f5',
    borderRadius: '6px',
    padding: '5px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    outline: 'none',
  },
  autoSnapBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '999px',
    background: '#d9770633',
    color: '#fbbf24',
    border: '1px solid #d97706',
    whiteSpace: 'nowrap',
  },
  boardScroll: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  boardItemCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '12px',
  },
  boardItemTime: {
    fontSize: '10px',
    color: '#38bdf8',
    fontFamily: 'monospace',
    marginBottom: '6px',
  },
  boardItemText: {
    fontSize: '12px',
    color: '#e4e4e7',
    marginBottom: '6px',
  },
  boardEq: {
    background: '#0f172a',
    padding: '6px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#4ade80',
    fontFamily: 'monospace',
    marginBottom: '6px',
  },
  boardDiagram: {
    fontSize: '11px',
    color: '#cbd5e1',
  },
  peerList: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  peerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#18181b',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  peerRoleBadge: {
    fontSize: '10px',
    color: '#34d399',
    background: '#10b98122',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  kickBtn: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
  },
};

