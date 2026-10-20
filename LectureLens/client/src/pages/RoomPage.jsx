import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMediasoup } from '../hooks/useMediasoup';
import { useTranscript } from '../hooks/useTranscript';
import socket from '../socket';
import { lectureApi } from '../services/api';
import { BoardSnapshotCompact } from '../components/BoardSnapshot';
import Badge from '../components/Badge';

/** Video Tile Component */
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
      <div style={styles.tileOverlay}>
        <span style={styles.label}>{label}</span>
      </div>
    </div>
  );
}

/** Invisible Audio Player for remote audio-only streams */
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

  useEffect(() => {
    join();
  }, [join]);

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
    if (!chatInput.trim()) return;
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

  // Connection dot styling
  const qualityColor =
    connectionQuality === 'Excellent' || connectionQuality === 'Good'
      ? '#10b981'
      : connectionQuality === 'Fair'
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div className="room-layout">
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <header className="room-header">
        <div className="room-header-left">
          <div style={styles.brandGroup}>
            <span style={styles.brandTitle}>🎓 LectureLens</span>
            <span style={styles.liveBadge}>
              <span className="room-pulse-dot" /> LIVE
            </span>
          </div>

          <div style={styles.roomCodeBox} className="room-code-badge">
            <span style={styles.roomCodeLabel}>ROOM:</span>
            <span style={styles.roomCodeValue}>{displayRoomId}</span>
            <button
              onClick={handleCopyCode}
              style={styles.roomCopyBtn}
              title="Copy 8-digit Room Code for students"
              aria-label="Copy room code"
            >
              {copiedCode ? '✓ Copied' : '📋 Code'}
            </button>
            <button
              onClick={handleCopyLink}
              style={styles.roomCopyBtn}
              title="Copy direct invite link for students"
              aria-label="Copy invite link"
            >
              {copiedLink ? '✓ Copied' : '🔗 Link'}
            </button>
          </div>

          <Badge variant={role === 'host' ? 'indigo' : 'emerald'}>
            {role === 'host' ? 'Instructor / Host' : 'Student'}
          </Badge>

          <div style={styles.connQuality}>
            <span style={{ ...styles.statusDot, background: qualityColor }} />
            <span style={styles.connText}>{connectionQuality}</span>
          </div>
        </div>

        <div style={styles.headerRight}>
          <button
            onClick={handleEndLecture}
            style={role === 'host' ? styles.endBtn : styles.leaveBtn}
            title={role === 'host' ? 'Conclude lecture and view AI study hub' : 'Exit live room'}
          >
            {role === 'host' ? '🔴 End & Review' : '🚪 Leave'}
          </button>
        </div>
      </header>

      {/* ── Host Room Code Share Banner ─────────────────────────────────── */}
      {role === 'host' && displayRoomId && displayRoomId !== 'Generating…' && (
        <div style={styles.shareBanner}>
          <div style={styles.shareBannerLeft}>
            <span style={styles.shareIcon}>📢</span>
            <span style={styles.shareBannerText}>
              Student Join Code: <strong style={{ color: '#38bdf8' }}>{displayRoomId}</strong> — Students can enter using this 8-digit code or direct link.
            </span>
          </div>
          <div style={styles.shareBannerActions}>
            <button onClick={handleCopyCode} style={styles.bannerBtn}>
              {copiedCode ? '✓ Code Copied' : '📋 Copy Code'}
            </button>
            <button onClick={handleCopyLink} style={styles.bannerBtn}>
              {copiedLink ? '✓ Link Copied' : '🔗 Copy Direct Link'}
            </button>
          </div>
        </div>
      )}

      {/* ── Connecting Status Banner ──────────────────────────────────── */}
      {status === 'connecting' && (
        <div style={styles.connectingBanner}>
          <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⚡</span>
          <span>Connecting to WebRTC media server…</span>
        </div>
      )}

      {/* ── Main Layout: Stage + Sidebar ───────────────────────────────── */}
      <div className="room-main-container">
        {/* Stage Area */}
        <main className="room-stage-container">
          {activeScreen ? (
            /* Dedicated Large Screen View */
            <div style={styles.screenShareContainer}>
              <div style={styles.screenMainView}>
                <VideoTile
                  stream={activeScreen}
                  muted={Boolean(screenStream)}
                  label={screenStream ? 'Your Shared Screen (Live)' : 'Instructor Shared Screen'}
                  isScreen={true}
                />
              </div>

              {/* Smaller overlay participant tiles strip */}
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
            /* Standard Adaptive Video Grid */
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
                <div style={styles.waitingCard}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎓</div>
                  <h3 style={styles.waitingTitle}>Waiting for students or instructor to join</h3>
                  <p style={styles.waitingDesc}>
                    Share Room Code: <strong style={{ color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '1px' }}>{displayRoomId}</strong>
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    <button onClick={handleCopyCode} style={styles.waitingCopyBtn}>
                      {copiedCode ? '✓ Copied' : '📋 Copy Code'}
                    </button>
                    <button onClick={handleCopyLink} style={styles.waitingCopyBtn}>
                      {copiedLink ? '✓ Copied' : '🔗 Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Floating / Pinned Meeting Control Dock ────────────────────── */}
          <div className="room-control-dock">
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              style={micEnabled ? styles.dockBtn : styles.dockBtnMuted}
              title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              aria-label={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micEnabled ? '🎙️ Mic ON' : '🔇 Muted'}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              style={cameraEnabled ? styles.dockBtn : styles.dockBtnMuted}
              title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
              aria-label={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            >
              {cameraEnabled ? '📷 Video ON' : '🚫 Video OFF'}
            </button>

            {/* Screen Share (Host Only) */}
            {role === 'host' && (
              <button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                style={isScreenSharing ? styles.dockBtnActiveScreen : styles.dockBtn}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Presentation Slide or Screen'}
                aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Presentation Slide or Screen'}
              >
                {isScreenSharing ? '⏹️ Stop Share' : '🖥️ Share Screen'}
              </button>
            )}

            {/* Board / Camera Vision AI Capture */}
            <button
              onClick={handleCaptureCamera}
              disabled={isCapturingBoard}
              style={styles.dockBtnCyan}
              title="Snap camera frame to extract formulas and diagrams with Gemini Vision AI"
              aria-label="Snap camera frame"
            >
              {isCapturingBoard ? '📸 Analyzing…' : '📸 Snap Board'}
            </button>

            {/* Screen Slide Vision AI Capture */}
            {(activeScreen || isScreenSharing) && (
              <button
                onClick={handleCaptureScreen}
                disabled={isCapturingBoard}
                style={styles.dockBtnBlue}
                title="Snap presentation slide to extract technical equations and concept charts"
                aria-label="Snap presentation slide"
              >
                {isCapturingBoard ? '🖥️ Analyzing…' : '🖥️ Snap Slide'}
              </button>
            )}

            {/* Lecture Recording (Host Only) */}
            {role === 'host' && (
              <button
                onClick={isLectureRecording ? stopLectureRecording : startLectureRecording}
                style={isLectureRecording ? styles.dockBtnRecording : styles.dockBtn}
                title="Record video & audio of lecture session"
                aria-label={isLectureRecording ? 'Stop Recording' : 'Start Recording Lecture'}
              >
                {isLectureRecording ? '⏹️ Recording...' : '🔴 Record'}
              </button>
            )}

            {/* Live Transcription Toggle (Host Only) */}
            {role === 'host' && (
              <button
                onClick={isRecording ? stopTranscription : startTranscription}
                style={isRecording ? styles.dockBtnActiveGreen : styles.dockBtn}
                title="Toggle real-time speech transcription"
                aria-label="Toggle real-time captions"
              >
                {isRecording ? '⏹️ Captions ON' : '📝 Start Captions'}
              </button>
            )}

            {/* Auto-Snap Toggle (Host Only) */}
            {role === 'host' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={toggleAutoSnap}
                  style={autoSnapEnabled ? styles.dockBtnActiveAmber : styles.dockBtn}
                  title={
                    autoSnapEnabled
                      ? `Auto-Snap ON — capturing every ${autoSnapIntervalSec}s. Click to pause.`
                      : 'Enable automatic periodic board & slide snapshots'
                  }
                  aria-label="Toggle Auto-Snap"
                >
                  {autoSnapEnabled ? '🤖 Auto-Snap ON' : '🤖 Auto-Snap'}
                </button>
                {autoSnapEnabled && (
                  <select
                    value={autoSnapIntervalSec}
                    onChange={(e) => updateAutoSnapInterval(Number(e.target.value))}
                    style={styles.autoSnapSelect}
                    title="Snapshot interval in seconds"
                    aria-label="Auto-snap interval"
                  >
                    <option value={10}>10s</option>
                    <option value={20}>20s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                )}
              </div>
            )}

            {/* Mobile/Tablet Panel Toggle */}
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              style={sidebarOpen ? styles.dockBtnActivePanel : styles.dockBtn}
              title={sidebarOpen ? 'Collapse study & chat panel' : 'Open study & chat panel'}
              aria-label="Toggle panel"
            >
              💬 Panel ({messages.length + segments.length + boardContents.length})
            </button>
          </div>
        </main>

        {/* ── Tabbed Study & Communication Sidebar ─────────────────────── */}
        {sidebarOpen && (
          <aside className="room-sidebar-panel">
            {/* Tab Headers */}
            <div style={styles.tabHeaders} role="tablist">
              <button
                style={styles.sidebarTab(activeTab === 'chat')}
                onClick={() => setActiveTab('chat')}
                role="tab"
                aria-selected={activeTab === 'chat'}
              >
                💬 Chat {messages.length > 0 && <span style={styles.tabBadge}>{messages.length}</span>}
              </button>
              <button
                style={styles.sidebarTab(activeTab === 'transcript')}
                onClick={() => {
                  if (role !== 'host' && segments.length === 0) fetchTranscript();
                  setActiveTab('transcript');
                }}
                role="tab"
                aria-selected={activeTab === 'transcript'}
              >
                📜 Captions {segments.length > 0 && <span style={styles.tabBadge}>{segments.length}</span>}
              </button>
              <button
                style={styles.sidebarTab(activeTab === 'board')}
                onClick={() => setActiveTab('board')}
                role="tab"
                aria-selected={activeTab === 'board'}
              >
                📐 Board AI {boardContents.length > 0 && <span style={styles.tabBadge}>{boardContents.length}</span>}
              </button>
              <button
                style={styles.sidebarTab(activeTab === 'participants')}
                onClick={() => setActiveTab('participants')}
                role="tab"
                aria-selected={activeTab === 'participants'}
              >
                👥 Peers
              </button>
            </div>

            {/* Tab 1: Live Chat */}
            {activeTab === 'chat' && (
              <div style={styles.tabContent}>
                <div style={styles.chatScroll}>
                  {messages.length === 0 ? (
                    <div style={styles.emptyNotice}>
                      <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>💬</span>
                      No messages yet. Send a question or note to the class.
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isSelf = msg.peerId === 'self';
                      return (
                        <div
                          key={i}
                          style={isSelf ? styles.msgSelf : styles.msgOther}
                        >
                          <div style={styles.msgSenderRow}>
                            <span style={isSelf ? styles.msgPeerSelf : styles.msgPeerOther}>
                              {msg.senderName || (isSelf ? 'You' : 'Student')}
                            </span>
                            <span style={styles.msgTime}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span style={styles.msgText}>{msg.message}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div style={styles.chatInputRow}>
                  <input
                    style={styles.chatInput}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask a question or send message…"
                    aria-label="Chat message input"
                  />
                  <button style={styles.sendBtn} onClick={handleSend} aria-label="Send message">
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Live Transcript & Captions */}
            {activeTab === 'transcript' && (
              <div style={styles.tabContent}>
                <div style={styles.transcriptToolbar}>
                  <label htmlFor="transcript-lang" style={styles.subLabel}>Language:</label>
                  <select
                    id="transcript-lang"
                    value={selectedLanguage}
                    onChange={(e) => changeLanguage(e.target.value)}
                    style={styles.langSelect}
                    aria-label="Select translation language"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="mr">Marathi (मराठी)</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="fr">French (Français)</option>
                    <option value="de">German (Deutsch)</option>
                  </select>
                  {isRecording && (
                    <span style={styles.liveSpeechIndicator}>
                      <span className="room-pulse-dot" style={{ width: 6, height: 6 }} /> Listening
                    </span>
                  )}
                </div>

                <div style={styles.transcriptScroll}>
                  {segments.length === 0 ? (
                    <div style={styles.emptyNotice}>
                      <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>🎙️</span>
                      {isRecording ? 'Listening for speech… spoken audio will stream here.' : 'Speech-to-text is inactive. Instructor can click "Start Captions" to begin.'}
                    </div>
                  ) : (
                    segments.map((seg) => {
                      const trans = translatedSegments[`${seg.id}_${selectedLanguage}`];
                      const text = selectedLanguage !== 'en' ? (trans || seg.text) : seg.text;

                      return (
                        <div key={seg.id} style={styles.segCard}>
                          <div style={styles.segHeader}>
                            <span style={styles.segSpeaker}>{seg.speakerName || 'Speaker'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {selectedLanguage !== 'en' && trans && (
                                <span style={styles.transTag}>
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
                      title="Snap Shared Screen / Slide"
                    >
                      🖥️ Slide
                    </button>
                  </div>
                </div>

                {boardNotice && (
                  <div style={{
                    padding: '10px 14px',
                    margin: '8px 12px 0',
                    background: boardNotice.startsWith('✅') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    border: `1px solid ${boardNotice.startsWith('✅') ? '#10b981' : '#38bdf8'}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
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
                          <strong>Auto-Snap is active</strong> — snapshots are captured automatically every <strong>{autoSnapIntervalSec}s</strong>.
                        </>
                      ) : (
                        <>
                          Click <strong>"📸 Camera"</strong> or <strong>"🖥️ Slide"</strong> to extract whiteboard formulas &amp; diagrams with Gemini Vision AI, or enable <strong>🤖 Auto-Snap</strong>.
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

            {/* Tab 4: Peers & Moderation */}
            {activeTab === 'participants' && (
              <div style={styles.tabContent}>
                <div style={styles.peerList}>
                  <div style={styles.peerRow}>
                    <div>
                      <strong>You</strong> <span style={{ color: '#94a3b8', fontSize: '12px' }}>({role})</span>
                    </div>
                    <Badge variant="emerald">Active</Badge>
                  </div>

                  {participants.map((p, i) => (
                    <div key={i} style={styles.peerRow}>
                      <div>
                        <strong>{p.user?.name || 'Student'}</strong>{' '}
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>({p.user?.role || 'STUDENT'})</span>
                      </div>
                      {role === 'host' && (
                        <button
                          onClick={() => removeParticipant(p.peerId)}
                          style={styles.kickBtn}
                          title="Remove participant from room"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

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
                aria-label="Room code retry input"
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

      {/* Hidden audio players for audio-only streams */}
      {remoteEntries
        .filter(([, data]) => data.stream.getVideoTracks().length === 0)
        .map(([key, data]) => (
          <AudioPlayer key={key} stream={data.stream} />
        ))}
    </div>
  );
}

function formatOffset(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const styles = {
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '-0.02em',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#f87171',
    borderRadius: '999px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '0.06em',
  },
  roomCodeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '4px 8px',
  },
  roomCodeLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.05em',
  },
  roomCodeValue: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '0.06em',
  },
  roomCopyBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#e2e8f0',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '28px',
  },
  connQuality: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  connText: {
    fontSize: '11.5px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  leaveBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
  },
  endBtn: {
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)',
  },
  shareBanner: {
    background: 'rgba(2, 132, 199, 0.15)',
    borderBottom: '1px solid rgba(2, 132, 199, 0.3)',
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
    fontSize: '15px',
  },
  shareBannerText: {
    color: '#e0f2fe',
  },
  shareBannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  bannerBtn: {
    background: '#0284c7',
    border: 'none',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '34px',
  },
  connectingBanner: {
    background: 'rgba(99, 102, 241, 0.2)',
    borderBottom: '1px solid rgba(99, 102, 241, 0.35)',
    color: '#c7d2fe',
    fontSize: '13px',
    fontWeight: '600',
    padding: '8px 16px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  videoGrid: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    padding: '16px',
    overflowY: 'auto',
    alignContent: 'flex-start',
  },
  tile: {
    position: 'relative',
    width: '360px',
    background: '#0a0f1d',
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    aspectRatio: '16/9',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
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
  tileOverlay: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    pointerEvents: 'none',
  },
  label: {
    background: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff',
    fontSize: '11.5px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '6px',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  waitingCard: {
    margin: 'auto',
    textAlign: 'center',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px dashed rgba(56, 189, 248, 0.3)',
    borderRadius: '16px',
    padding: '36px 28px',
    maxWidth: '460px',
  },
  waitingTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 6px 0',
  },
  waitingDesc: {
    fontSize: '13.5px',
    color: '#94a3b8',
    margin: 0,
  },
  waitingCopyBtn: {
    background: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    color: '#38bdf8',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '38px',
  },
  screenShareContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  screenMainView: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#04070e',
    overflow: 'hidden',
  },
  screenTileStrip: {
    height: '110px',
    background: 'rgba(15, 23, 42, 0.8)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    gap: '10px',
    padding: '10px 14px',
    overflowX: 'auto',
  },
  miniTile: {
    width: '150px',
    height: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  /* Dock Buttons */
  dockBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  dockBtnMuted: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#fca5a5',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  dockBtnCyan: {
    background: 'rgba(13, 148, 136, 0.25)',
    border: '1px solid rgba(20, 184, 166, 0.4)',
    color: '#5eead4',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnBlue: {
    background: 'rgba(37, 99, 235, 0.25)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    color: '#93c5fd',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnRecording: {
    background: 'rgba(220, 38, 38, 0.3)',
    border: '1px solid #ef4444',
    color: '#fecaca',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnActiveScreen: {
    background: 'rgba(234, 88, 12, 0.25)',
    border: '1px solid #f97316',
    color: '#fdba74',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnActiveGreen: {
    background: 'rgba(16, 185, 129, 0.25)',
    border: '1px solid #10b981',
    color: '#6ee7b7',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnActiveAmber: {
    background: 'rgba(217, 119, 6, 0.25)',
    border: '1px solid #f59e0b',
    color: '#fde68a',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  dockBtnActivePanel: {
    background: 'rgba(56, 189, 248, 0.2)',
    border: '1px solid rgba(56, 189, 248, 0.45)',
    color: '#38bdf8',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  autoSnapSelect: {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#f8fafc',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    minHeight: '44px',
  },
  /* Tab Headers */
  tabHeaders: {
    display: 'flex',
    background: 'rgba(15, 23, 42, 0.8)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  sidebarTab: (active) => ({
    flex: 1,
    padding: '14px 6px',
    background: active ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
    color: active ? '#38bdf8' : '#94a3b8',
    border: 'none',
    borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  }),
  tabBadge: {
    background: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    fontSize: '10px',
    fontWeight: '800',
    padding: '1px 6px',
    borderRadius: '999px',
  },
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  /* Chat */
  chatScroll: {
    flex: 1,
    padding: '14px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  msgSelf: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    borderRadius: '14px 14px 2px 14px',
    padding: '10px 14px',
    maxWidth: '85%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  msgOther: {
    alignSelf: 'flex-start',
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    borderRadius: '14px 14px 14px 2px',
    padding: '10px 14px',
    maxWidth: '85%',
  },
  msgSenderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  },
  msgPeerSelf: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#bfdbfe',
  },
  msgPeerOther: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
  },
  msgTime: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  msgText: {
    fontSize: '13.5px',
    lineHeight: 1.45,
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(15, 23, 42, 0.9)',
  },
  chatInput: {
    flex: 1,
    background: 'rgba(8, 12, 20, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
    minHeight: '44px',
  },
  sendBtn: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    minHeight: '44px',
  },
  /* Captions */
  transcriptToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.85)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  subLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  langSelect: {
    background: 'rgba(8, 12, 20, 0.9)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
    minHeight: '34px',
  },
  liveSpeechIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#10b981',
  },
  transcriptScroll: {
    flex: 1,
    padding: '14px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  segCard: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  segHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  segSpeaker: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#38bdf8',
  },
  transTag: {
    fontSize: '10px',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '700',
  },
  segTime: {
    fontSize: '10.5px',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  segBody: {
    fontSize: '13.5px',
    color: '#e2e8f0',
    lineHeight: 1.5,
    margin: 0,
  },
  segPending: {
    fontSize: '13px',
    color: '#94a3b8',
    fontStyle: 'italic',
    margin: 0,
  },
  /* Board Feed */
  boardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.85)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  boardHeadTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
  },
  autoSnapBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '999px',
    background: 'rgba(217, 119, 6, 0.2)',
    color: '#fbbf24',
    border: '1px solid rgba(217, 119, 6, 0.4)',
  },
  snapSmallBtn: {
    background: 'rgba(13, 148, 136, 0.3)',
    border: '1px solid rgba(20, 184, 166, 0.4)',
    color: '#5eead4',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '34px',
  },
  boardScroll: {
    flex: 1,
    padding: '14px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  /* Peers */
  peerList: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  peerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '13.5px',
  },
  kickBtn: {
    background: 'rgba(220, 38, 38, 0.2)',
    border: '1px solid rgba(220, 38, 38, 0.4)',
    color: '#f87171',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '34px',
  },
  emptyNotice: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
    marginTop: '36px',
    padding: '0 20px',
    lineHeight: 1.5,
  },
  /* Error Overlay */
  errorOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  errorCard: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid #ef4444',
    borderRadius: '16px',
    padding: '32px 24px',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
  },
  errorCardIcon: {
    fontSize: '36px',
    marginBottom: '10px',
  },
  errorCardTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  errorCardMsg: {
    fontSize: '13px',
    color: '#fca5a5',
    margin: '0 0 16px 0',
    lineHeight: 1.45,
  },
  errorCardInputRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '14px',
  },
  errorCardInput: {
    flex: 1,
    background: 'rgba(8, 12, 20, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#ffffff',
    fontSize: '13.5px',
    fontFamily: 'monospace',
    letterSpacing: '1px',
    outline: 'none',
    minHeight: '44px',
  },
  errorCardBtn: {
    background: '#38bdf8',
    color: '#080c14',
    fontWeight: '800',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    minHeight: '44px',
  },
  errorCardBackBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '12.5px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '8px',
  },
};
