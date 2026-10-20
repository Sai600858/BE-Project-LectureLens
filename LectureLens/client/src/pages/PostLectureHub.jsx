import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lectureApi, aiApi } from '../services/api';
import { BoardSnapshot } from '../components/BoardSnapshot';
import StudyNotesViewer from '../components/StudyNotesViewer';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Button from '../components/Button';

function formatTime(sec = 0) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Premium, accessible Recorded Lecture Workspace.
 * Synchronizes video playback with chapters and transcript timestamps,
 * provides rich KaTeX study notes, RAG Q&A with citations, interactive quizzes,
 * and spaced-repetition flashcards.
 */
export default function PostLectureHub() {
  const { lectureId } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'recording' | 'transcript' | 'summary' | 'notes' | 'rag' | 'quiz' | 'board'
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Video recording & Chapters
  const videoRef = useRef(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chapters, setChapters] = useState([]);

  // Transcript & Search
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // AI Summary
  const [summary, setSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Study Notes
  const [notesMode, setNotesMode] = useState('detailed');
  const [studyNotes, setStudyNotes] = useState(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // RAG Q&A
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragHistory, setRagHistory] = useState([]);
  const [isAskingRag, setIsAskingRag] = useState(false);

  // Quiz
  const [quizData, setQuizData] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  // Flashcards
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Whiteboard & Slide Snapshots
  const [boardContents, setBoardContents] = useState([]);

  // PDF Export Feedback
  const [exportNotice, setExportNotice] = useState(null);

  useEffect(() => {
    loadAllData();
  }, [lectureId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const lec = await lectureApi.getLecture(lectureId);
      if (!lec) {
        throw new Error('Lecture session not found.');
      }
      setLecture(lec);
      const targetId = lec?.id || lec?.lectureId || lectureId;

      // Check recording
      try {
        const rec = await aiApi.getRecording(targetId);
        if (rec) setHasRecording(true);
      } catch (e) {}

      // Load Transcript
      try {
        const t = await aiApi.getTranscript(targetId);
        setTranscriptSegments(t?.segments || []);
      } catch (e) {}

      // Load Summary
      try {
        const s = await aiApi.getSummary(targetId);
        setSummary(s);
      } catch (e) {}

      // Load Notes
      try {
        const n = await aiApi.getStudyNotes(targetId, notesMode);
        setStudyNotes(n);
      } catch (e) {}

      // Load Chapters
      try {
        const ch = await aiApi.getChapters(targetId);
        setChapters(ch || []);
      } catch (e) {}

      // Load Quiz
      try {
        const q = await aiApi.getQuiz(targetId);
        setQuizData(q);
      } catch (e) {}

      // Load Flashcards
      try {
        const fc = await aiApi.getFlashcards(targetId);
        setFlashcards(fc || []);
      } catch (e) {}

      // Load Whiteboard & Slide Notes
      try {
        const [bc, sc] = await Promise.all([
          aiApi.getBoardContents(targetId).catch(() => []),
          aiApi.getScreenContents(targetId).catch(() => []),
        ]);
        const combined = [...(bc || []), ...(sc || [])].sort(
          (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
        );
        setBoardContents(combined);
      } catch (e) {}
    } catch (err) {
      console.warn('Error loading lecture workspace:', err);
      setLoadError(err.response?.data?.error || err.message || 'Failed to load lecture workspace.');
    } finally {
      setLoading(false);
    }
  };

  // Jump video timestamp and switch to recording tab
  const jumpToTimestamp = (sec) => {
    if (sec != null) {
      setActiveTab('recording');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = sec;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
  };

  // Video time tracking for active chapter
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Active chapter based on currentTime
  const activeChapterIndex = useMemo(() => {
    if (!chapters || chapters.length === 0) return -1;
    return chapters.findIndex((ch, idx) => {
      const start = ch.startTime ?? ch.start_time ?? 0;
      const nextCh = chapters[idx + 1];
      const end = ch.endTime ?? ch.end_time ?? (nextCh ? (nextCh.startTime ?? nextCh.start_time) : Infinity);
      return currentTime >= start && currentTime < end;
    });
  }, [chapters, currentTime]);

  // Transcript Search
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await aiApi.searchTranscript(lectureId, query);
      setSearchResults(results || []);
    } catch (e) {
      console.warn(e);
    }
  };

  // Switch study notes mode
  const handleModeChange = async (mode) => {
    setNotesMode(mode);
    try {
      setIsGeneratingNotes(true);
      const n = await aiApi.getStudyNotes(lectureId, mode);
      setStudyNotes(n);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Generate Summary
  const handleGenerateSummary = async () => {
    try {
      setIsGeneratingSummary(true);
      const s = await aiApi.generateSummary(lectureId);
      setSummary(s);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Ask RAG
  const handleAskRag = async (qText) => {
    const q = (qText || ragQuestion).trim();
    if (!q) return;
    try {
      setIsAskingRag(true);
      const res = await aiApi.askLecture(lectureId, q);
      setRagHistory((prev) => [res, ...prev]);
      setRagQuestion('');
    } catch (e) {
      alert(e.response?.data?.error || 'AI Tutor query failed');
    } finally {
      setIsAskingRag(false);
    }
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    const quizId = quizData?.quiz?.id || quizData?.id;
    if (!quizId) return;
    try {
      setIsSubmittingQuiz(true);
      const res = await aiApi.submitQuiz(lectureId, quizId, quizAnswers);
      setQuizResult(res);
    } catch (e) {
      alert(e.response?.data?.error || 'Quiz submission failed');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Flashcards navigation
  const nextCard = () => {
    setIsFlipped(false);
    setCurrentCardIdx((prev) => (prev + 1) % flashcards.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCurrentCardIdx((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleFlashcardStatus = async (status) => {
    const card = flashcards[currentCardIdx];
    if (!card) return;
    try {
      await aiApi.updateFlashcardProgress(lectureId, card.id, status);
      nextCard();
    } catch (e) {
      console.warn('Failed to update flashcard progress:', e);
    }
  };

  // PDF Export Feedback
  const handlePdfClick = (type) => {
    setExportNotice(`Preparing ${type.replace('-', ' ')} PDF download…`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Navbar />
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} aria-hidden="true" />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc', margin: '12px 0 4px' }}>
            Loading Lecture Workspace
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0 }}>
            Retrieving transcripts, AI notes, and multimodal chapters…
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.page}>
        <Navbar />
        <div style={styles.errorContainer}>
          <div style={{ fontSize: '42px', marginBottom: '8px' }} aria-hidden="true">⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f87171' }}>Access Error</h2>
          <p style={{ color: '#94a3b8', maxWidth: '440px', lineHeight: 1.55 }}>{loadError}</p>
          <Button onClick={() => navigate('/dashboard')} variant="primary" size="md" style={{ marginTop: '16px' }}>
            ← Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const recordingUrl = aiApi.getRecordingStreamUrl(lectureId);
  const currentCard = flashcards[currentCardIdx];
  const isDone = lecture?.status === 'ENDED' || lecture?.status === 'COMPLETED';
  const isLive = lecture?.status === 'LIVE';

  return (
    <div style={styles.page}>
      <Navbar />

      {/* ── Top Workspace Header ────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerContainer}>
          <div style={styles.headerLeft}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.backBtn}
              aria-label="Back to dashboard"
            >
              ← Dashboard
            </button>
            <div style={styles.titleWrap}>
              <div style={styles.headerBadgesRow}>
                <Badge variant={isLive ? 'rose' : isDone ? 'emerald' : 'amber'} size="sm">
                  {isLive ? '🔴 LIVE' : isDone ? '✅ COMPLETED' : '⏳ SCHEDULED'}
                </Badge>
                <Badge variant="neutral" size="sm">
                  {lecture?.visibility || 'PUBLIC'}
                </Badge>
                {lecture?.room_id && (
                  <Badge variant="cyan" size="sm">
                    ROOM: {lecture?.room_id}
                  </Badge>
                )}
              </div>
              <h1 style={styles.lectureTitle}>{lecture?.title || 'Lecture Workspace'}</h1>
              <p style={styles.lectureMeta}>
                Instructor: {lecture?.host_name || 'Professor'}  •  Session Date: {lecture?.created_at ? new Date(lecture.created_at).toLocaleDateString() : 'Active'}
              </p>
            </div>
          </div>

          {/* Export Action Bar */}
          <div style={styles.exportBar}>
            <span style={styles.exportLabel}>EXPORT PDF:</span>
            <div style={styles.exportBtnGroup}>
              <a
                href={aiApi.getPdfUrl(lectureId, 'transcript')}
                download
                onClick={() => handlePdfClick('transcript')}
                style={styles.exportBtn}
                title="Download full transcript PDF"
              >
                📄 Transcript
              </a>
              <a
                href={aiApi.getPdfUrl(lectureId, 'summary')}
                download
                onClick={() => handlePdfClick('summary')}
                style={styles.exportBtn}
                title="Download executive summary PDF"
              >
                📊 Summary
              </a>
              <a
                href={aiApi.getPdfUrl(lectureId, 'study-notes')}
                download
                onClick={() => handlePdfClick('study-notes')}
                style={styles.exportBtnPrimary}
                title="Download formatted KaTeX notes with diagrams"
              >
                📑 Study Notes
              </a>
            </div>
          </div>
        </div>

        {exportNotice && (
          <div style={styles.noticeToast} role="status">
            <span>ℹ️ {exportNotice}</span>
          </div>
        )}
      </header>

      {/* ── Sub-Navigation Pill Bar (Responsive Touch Scrolling) ─────────────── */}
      <nav style={styles.tabNav} aria-label="Lecture study tabs">
        <div style={styles.tabNavContainer}>
          {[
            { id: 'recording', label: '🎥 Video & Chapters', count: chapters.length },
            { id: 'transcript', label: '🔍 Transcript', count: transcriptSegments.length },
            { id: 'summary', label: '🧠 AI Summary' },
            { id: 'notes', label: '📝 Study Notes' },
            { id: 'rag', label: '💬 Ask Lecture (RAG)', count: ragHistory.length },
            { id: 'quiz', label: '🎯 Quiz & Flashcards', count: flashcards.length },
            { id: 'board', label: '📐 Whiteboard OCR', count: boardContents.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tabPill,
                ...(activeTab === tab.id ? styles.tabPillActive : {}),
              }}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span style={styles.tabBadge(activeTab === tab.id)}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main Tab Content Workspace ──────────────────────────────────────── */}
      <main id="main-content" style={styles.mainContainer}>
        {/* 1. Video Playback & Chapters Tab */}
        {activeTab === 'recording' && (
          <div style={styles.tabPane}>
            <div style={styles.recordingWorkspace} className="recording-split-layout">
              {/* Left / Center: Video Player */}
              <div style={styles.videoPlayerCard} className="glass-panel">
                <div style={styles.cardHeaderSmall}>
                  <h2 style={styles.paneTitle}>Lecture Video Stream</h2>
                  {chapters.length > 0 && (
                    <span style={styles.chapterBadge}>
                      {chapters.length} Synchronized Chapter{chapters.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div style={styles.videoPlayerWrapper}>
                  <video
                    ref={videoRef}
                    controls
                    src={recordingUrl}
                    onTimeUpdate={handleVideoTimeUpdate}
                    style={styles.videoPlayer}
                    playsInline
                  >
                    Your browser does not support HTML5 video streaming.
                  </video>
                </div>

                <div style={styles.videoInfoNotice}>
                  <span aria-hidden="true">💡</span>
                  <span>
                    Select any chapter or transcript segment timestamp to immediately seek video playback.
                  </span>
                </div>
              </div>

              {/* Right / Side Panel: Synchronized Chapters */}
              <div style={styles.chaptersCard} className="glass-panel">
                <div style={styles.cardHeaderSmall}>
                  <h3 style={styles.paneSubHeading}>📚 Lecture Chapters</h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {chapters.length} Topic{chapters.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {chapters.length === 0 ? (
                  <div style={styles.emptyChapterBox}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                      No automated chapters generated for this recording.
                    </p>
                  </div>
                ) : (
                  <div style={styles.chaptersList}>
                    {chapters.map((ch, idx) => {
                      const startTime = ch.startTime ?? ch.start_time ?? 0;
                      const endTime = ch.endTime ?? ch.end_time;
                      const isActive = activeChapterIndex === idx;

                      return (
                        <div
                          key={ch.id || idx}
                          onClick={() => jumpToTimestamp(startTime)}
                          style={{
                            ...styles.chapterItem,
                            ...(isActive ? styles.chapterItemActive : {}),
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Chapter ${idx + 1}: ${ch.title}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              jumpToTimestamp(startTime);
                            }
                          }}
                        >
                          <div style={styles.chapterTopRow}>
                            <span style={styles.chapterNumber(isActive)}>
                              {idx + 1}
                            </span>
                            <h4 style={styles.chapterItemTitle}>{ch.title}</h4>
                            <span style={styles.chapterTimeBadge}>
                              ⏱️ {formatTime(startTime)}
                              {endTime != null && ` - ${formatTime(endTime)}`}
                            </span>
                          </div>
                          {ch.summary && (
                            <p style={styles.chapterItemSummary}>{ch.summary}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Searchable Transcript Tab */}
        {activeTab === 'transcript' && (
          <div style={styles.tabPane}>
            <div style={styles.transcriptCard} className="glass-panel">
              <div style={styles.transcriptToolbar}>
                <div style={styles.searchContainer}>
                  <span style={styles.searchIcon} aria-hidden="true">🔍</span>
                  <input
                    aria-label="Search lecture transcript"
                    placeholder="Search spoken transcript (e.g. consensus, equation, algorithm)..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={styles.searchInput}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearch('')}
                      style={styles.clearSearchBtn}
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={styles.transcriptMeta}>
                  <Badge variant="cyan" size="md">
                    {searchQuery ? `${searchResults.length} matching segment(s)` : `${transcriptSegments.length} total segments`}
                  </Badge>
                </div>
              </div>

              {transcriptSegments.length === 0 ? (
                <div style={styles.emptyCard}>
                  <span style={{ fontSize: '36px' }} aria-hidden="true">🎙️</span>
                  <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>
                    No transcript segments recorded for this lecture.
                  </p>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div style={styles.emptyCard}>
                  <span style={{ fontSize: '32px' }} aria-hidden="true">🔍</span>
                  <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>
                    No transcript segments matching "{searchQuery}".
                  </p>
                  <Button onClick={() => handleSearch('')} variant="secondary" size="sm" style={{ marginTop: '12px' }}>
                    Clear Search Query
                  </Button>
                </div>
              ) : (
                <div style={styles.transcriptList}>
                  {(searchQuery ? searchResults : transcriptSegments).map((seg, i) => {
                    const time = seg.start_time ?? seg.startOffset ?? 0;
                    return (
                      <div key={i} style={styles.transcriptRow}>
                        <button
                          onClick={() => jumpToTimestamp(time)}
                          style={styles.timestampBtn}
                          title="Seek video to timestamp"
                          aria-label={`Jump to video at ${formatTime(time)}`}
                        >
                          ⏱️ {formatTime(time)}
                        </button>
                        <div style={styles.segContentCol}>
                          <span style={styles.speakerPill}>
                            {seg.speaker_name || seg.speakerName || 'Instructor'}
                          </span>
                          <p style={styles.segText}>{seg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Executive AI Summary Tab */}
        {activeTab === 'summary' && (
          <div style={styles.tabPane}>
            {!summary ? (
              <div style={styles.emptyCard} className="glass-panel">
                <span style={{ fontSize: '42px', marginBottom: '8px' }} aria-hidden="true">🧠</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
                  No Executive Summary Available
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '480px', lineHeight: 1.55 }}>
                  Synthesize the core concepts, academic definitions, instructor examples, and key takeaways from this lecture.
                </p>
                <Button
                  onClick={handleGenerateSummary}
                  variant="primary"
                  size="md"
                  loading={isGeneratingSummary}
                  disabled={isGeneratingSummary}
                  icon="⚡"
                  style={{ marginTop: '16px' }}
                >
                  {isGeneratingSummary ? 'Synthesizing Summary…' : 'Generate AI Summary'}
                </Button>
              </div>
            ) : (
              <div style={styles.summaryContainer}>
                {/* 1. Executive Overview */}
                <div style={styles.summaryCard} className="glass-panel">
                  <div style={styles.sectionHeadingWrap}>
                    <span style={styles.sectionNumber}>1</span>
                    <h3 style={styles.summarySectionTitle}>Executive Overview</h3>
                  </div>
                  <div style={styles.summaryBodyText}>
                    {summary.shortSummary || summary.overview || 'Comprehensive lecture overview captured.'}
                  </div>
                </div>

                {/* 2. Key Concepts */}
                {summary.keyConcepts?.length > 0 && (
                  <div style={styles.summaryCard} className="glass-panel">
                    <div style={styles.sectionHeadingWrap}>
                      <span style={styles.sectionNumber}>2</span>
                      <h3 style={styles.summarySectionTitle}>Core Educational Concepts</h3>
                    </div>
                    <div style={styles.conceptGrid}>
                      {summary.keyConcepts.map((kc, i) => (
                        <div key={i} style={styles.conceptBox}>
                          <h4 style={styles.conceptName}>{kc.concept}</h4>
                          <p style={styles.conceptDesc}>{kc.description || kc.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Academic Definitions */}
                {summary.definitions?.length > 0 && (
                  <div style={styles.summaryCard} className="glass-panel">
                    <div style={styles.sectionHeadingWrap}>
                      <span style={styles.sectionNumber}>3</span>
                      <h3 style={styles.summarySectionTitle}>Formal Academic Definitions</h3>
                    </div>
                    <div style={styles.defList}>
                      {summary.definitions.map((d, i) => (
                        <div key={i} style={styles.defItem}>
                          <strong style={styles.defTerm}>{d.term}:</strong>
                          <span style={styles.defBody}>{d.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Instructor Practical Examples */}
                {summary.examples?.length > 0 && (
                  <div style={styles.summaryCard} className="glass-panel">
                    <div style={styles.sectionHeadingWrap}>
                      <span style={styles.sectionNumber}>4</span>
                      <h3 style={styles.summarySectionTitle}>Practical Classroom Examples</h3>
                    </div>
                    <div style={styles.examplesList}>
                      {summary.examples.map((ex, i) => (
                        <div key={i} style={styles.exampleItem}>
                          <span style={styles.exampleTopic}>[{ex.topic || 'Case'}]:</span>
                          <span style={styles.exampleText}>{ex.example}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Key Takeaways */}
                {summary.keyTakeaways?.length > 0 && (
                  <div style={styles.summaryCard} className="glass-panel">
                    <div style={styles.sectionHeadingWrap}>
                      <span style={styles.sectionNumber}>5</span>
                      <h3 style={styles.summarySectionTitle}>Key Learning Takeaways</h3>
                    </div>
                    <ul style={styles.takeawaysList}>
                      {summary.keyTakeaways.map((t, i) => (
                        <li key={i} style={styles.takeawayItem}>
                          <span style={{ color: '#38bdf8', marginRight: '8px' }}>✓</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Structured Study Notes Tab */}
        {activeTab === 'notes' && (
          <div style={styles.tabPane}>
            <div style={styles.notesModeBar} className="glass-panel">
              <span style={styles.modeLabel}>Note-Taking Format:</span>
              <div style={styles.modePillGroup}>
                {[
                  { id: 'short', label: '⚡ Short Notes' },
                  { id: 'detailed', label: '📚 Detailed Notes' },
                  { id: 'exam', label: '🎯 Exam-Oriented' },
                  { id: 'beginner', label: '🌱 Beginner-Friendly' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModeChange(m.id)}
                    style={{
                      ...styles.modeBtn,
                      ...(notesMode === m.id ? styles.modeBtnActive : {}),
                    }}
                    aria-pressed={notesMode === m.id}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <StudyNotesViewer
                studyNotes={studyNotes}
                isLoading={isGeneratingNotes}
              />
            </div>
          </div>
        )}

        {/* 5. Ask This Lecture (RAG Q&A) Tab */}
        {activeTab === 'rag' && (
          <div style={styles.tabPane}>
            <div style={styles.ragHeader} className="glass-panel">
              <h2 style={styles.paneTitle}>💬 Ask This Lecture (Grounded RAG)</h2>
              <p style={styles.paneSubtitle}>
                Inquire about equations, algorithms, or theories discussed in this session.
                Answers are grounded strictly in the speech transcript, whiteboard OCR, and slide captures, with verifiable timestamp citations.
              </p>

              {/* Suggested Quick Prompts */}
              <div style={styles.quickPrompts}>
                <span style={styles.quickPromptLabel}>Suggested Inquiries:</span>
                {[
                  'What are the core concepts covered in this lecture?',
                  'What mathematical equations were written on the board?',
                  'What practical real-world examples were discussed?',
                ].map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => handleAskRag(promptText)}
                    style={styles.promptChip}
                  >
                    {promptText}
                  </button>
                ))}
              </div>

              {/* Question Input */}
              <div style={styles.ragInputRow}>
                <input
                  aria-label="Ask a question about this lecture"
                  placeholder="Ask any question about this lecture session..."
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskRag()}
                  style={styles.ragInput}
                  disabled={isAskingRag}
                />
                <Button
                  onClick={() => handleAskRag()}
                  disabled={isAskingRag || !ragQuestion.trim()}
                  loading={isAskingRag}
                  variant="primary"
                  size="md"
                  style={{ minWidth: '120px' }}
                >
                  {isAskingRag ? 'Consulting…' : 'Ask AI'}
                </Button>
              </div>
            </div>

            {/* Q&A Conversation Thread */}
            <div style={styles.ragThread}>
              {ragHistory.length === 0 ? (
                <div style={styles.emptyCard} className="glass-panel">
                  <span style={{ fontSize: '32px' }} aria-hidden="true">💡</span>
                  <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
                    No questions asked yet. Type a question or select a suggested prompt above.
                  </p>
                </div>
              ) : (
                ragHistory.map((item, idx) => (
                  <div key={idx} style={styles.ragCard} className="glass-panel">
                    <div style={styles.ragQuestionRow}>
                      <span style={styles.qBadge}>Q:</span>
                      <strong style={styles.ragQuestionText}>{item.question}</strong>
                    </div>

                    <div style={styles.ragAnswerRow}>
                      <span style={styles.aBadge}>AI:</span>
                      <p style={styles.ragAnswerText}>{item.answer}</p>
                    </div>

                    {/* Timestamp Citation */}
                    {item.relevantTimestamp && (
                      <div style={styles.citationRow}>
                        <span style={styles.citeLabel}>Timestamp Citation:</span>
                        <button
                          onClick={() => jumpToTimestamp(item.timestampSeconds)}
                          style={styles.citeTimestampBtn}
                          title="Seek video to referenced timestamp"
                        >
                          ⏱️ {item.relevantTimestamp}
                        </button>
                      </div>
                    )}

                    {/* Referenced Segments */}
                    {item.sources && item.sources.length > 0 && (
                      <div style={styles.sourcesRow}>
                        <span style={styles.citeLabel}>Referenced Segments:</span>
                        <div style={styles.sourceChips}>
                          {item.sources.map((src, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => jumpToTimestamp(src.timestampSeconds)}
                              title={src.snippet}
                              style={styles.sourceChip}
                            >
                              <span>⏱️ {src.timestamp}</span>
                              <span style={{ color: '#64748b' }}>({src.type})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. Quiz & Spaced-Repetition Flashcards Tab */}
        {activeTab === 'quiz' && (
          <div style={styles.tabPane}>
            <div style={styles.quizAndFlashcardContainer} className="quiz-flash-split">
              {/* Left / Top: Interactive Quiz */}
              <div style={styles.quizSection} className="glass-panel">
                <div style={styles.cardHeaderSmall}>
                  <h3 style={styles.paneTitle}>📝 Interactive Lecture Assessment</h3>
                  {quizData?.questions?.length > 0 && (
                    <Badge variant="cyan" size="sm">
                      {quizData.questions.length} Question{quizData.questions.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {quizResult && (
                  <div
                    style={{
                      ...styles.scoreBanner,
                      borderColor: quizResult.percentage >= 70 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
                      background: quizResult.percentage >= 70 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    }}
                    role="status"
                  >
                    <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                      Assessment Score: {quizResult.score} / {quizResult.totalQuestions} ({quizResult.percentage}%)
                    </h4>
                    {quizResult.weakTopics?.length > 0 && (
                      <p style={{ marginTop: '6px', fontSize: '13px', color: '#e2e8f0', margin: '6px 0 0' }}>
                        Recommended review focus: <strong>{quizResult.weakTopics.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                )}

                {!quizData?.questions || quizData.questions.length === 0 ? (
                  <div style={styles.emptyCard}>
                    <p style={{ margin: 0, color: '#94a3b8' }}>No assessment questions generated yet.</p>
                  </div>
                ) : (
                  <div style={styles.questionList}>
                    {quizData.questions.map((q, idx) => {
                      const resultItem = quizResult?.results?.find((r) => r.questionId === q.id);

                      return (
                        <div key={q.id || idx} style={styles.qCard}>
                          <div style={styles.qHeader}>
                            <span style={styles.qNum}>Question {idx + 1}</span>
                            <Badge variant="neutral" size="sm">{q.difficulty || 'Normal'}</Badge>
                          </div>
                          <p style={styles.qBody}>{q.question_text || q.questionText}</p>

                          {/* Options list */}
                          {q.options?.length > 0 ? (
                            <div style={styles.optionsList} role="radiogroup" aria-label={`Question ${idx + 1} options`}>
                              {q.options.map((opt, optIdx) => (
                                <label key={optIdx} style={styles.optionLabel}>
                                  <input
                                    type="radio"
                                    name={`q_${q.id}`}
                                    value={opt}
                                    checked={quizAnswers[q.id] === opt}
                                    onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                                    disabled={Boolean(quizResult)}
                                    style={styles.radioInput}
                                  />
                                  <span style={styles.optionText}>{opt}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              placeholder="Type your answer here..."
                              value={quizAnswers[q.id] || ''}
                              onChange={(e) => setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                              style={styles.textAnswerInput}
                              disabled={Boolean(quizResult)}
                            />
                          )}

                          {/* Server-Side Grading Result */}
                          {resultItem && (
                            <div
                              style={{
                                ...styles.resultFeedback,
                                background: resultItem.isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                borderColor: resultItem.isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                              }}
                            >
                              <div style={{ fontWeight: '700', color: resultItem.isCorrect ? '#34d399' : '#f87171' }}>
                                {resultItem.isCorrect ? '✅ Correct Answer!' : `❌ Incorrect. Correct: ${resultItem.correctAnswer}`}
                              </div>
                              {resultItem.explanation && (
                                <div style={styles.resultExplanation}>
                                  💡 <strong>Explanation:</strong> {resultItem.explanation}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!quizResult && (
                      <Button
                        onClick={handleSubmitQuiz}
                        disabled={isSubmittingQuiz}
                        loading={isSubmittingQuiz}
                        variant="emerald"
                        size="md"
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        {isSubmittingQuiz ? 'Grading on Server…' : 'Submit Quiz for Grading'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Right / Bottom: Spaced-Repetition Flashcards */}
              <div style={styles.flashcardSection} className="glass-panel">
                <div style={styles.cardHeaderSmall}>
                  <h3 style={styles.paneTitle}>🗂️ Spaced-Repetition Flashcards</h3>
                  {flashcards.length > 0 && (
                    <Badge variant="cyan" size="sm">
                      {currentCardIdx + 1} / {flashcards.length}
                    </Badge>
                  )}
                </div>

                {flashcards.length === 0 ? (
                  <div style={styles.emptyCard}>
                    <p style={{ margin: 0, color: '#94a3b8' }}>No study flashcards available for this session.</p>
                  </div>
                ) : (
                  <div style={styles.flashcardCardArea}>
                    <div style={styles.fcMetaRow}>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                        Topic: <strong style={{ color: '#ffffff' }}>{currentCard?.topic || 'General'}</strong>
                      </span>
                      <Badge variant="amber" size="sm">
                        {currentCard?.difficulty || 'Medium'}
                      </Badge>
                    </div>

                    {/* Interactive 3D Flip Flashcard */}
                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      style={{
                        ...styles.flashcard,
                        borderColor: isFlipped ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.12)',
                        background: isFlipped ? 'rgba(30, 27, 75, 0.5)' : 'rgba(15, 23, 42, 0.8)',
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Flashcard: ${isFlipped ? 'Answer' : 'Question'}. Click to flip.`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsFlipped(!isFlipped);
                        }
                      }}
                    >
                      <span style={styles.cardSideBadge}>
                        {isFlipped ? 'BACK — ANSWER' : 'FRONT — CONCEPT QUESTION'}
                      </span>
                      <p style={styles.flashcardText}>
                        {isFlipped ? currentCard?.answer : currentCard?.question}
                      </p>
                      <span style={styles.flipNotice}>(Tap or click to flip)</span>
                    </div>

                    {/* Card Actions */}
                    <div style={styles.fcControlRow}>
                      <button onClick={prevCard} style={styles.fcNavBtn} aria-label="Previous card">
                        ← Prev
                      </button>
                      <button
                        onClick={() => handleFlashcardStatus('difficult')}
                        style={styles.fcDiffBtn}
                        aria-label="Mark flashcard as difficult"
                      >
                        ⚠️ Difficult
                      </button>
                      <button
                        onClick={() => handleFlashcardStatus('learned')}
                        style={styles.fcLearnBtn}
                        aria-label="Mark flashcard as learned"
                      >
                        ✅ Mastered
                      </button>
                      <button onClick={nextCard} style={styles.fcNavBtn} aria-label="Next card">
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. Whiteboard & Slide OCR Snapshots Tab */}
        {activeTab === 'board' && (
          <div style={styles.tabPane}>
            <div style={styles.boardHeader} className="glass-panel">
              <h2 style={styles.paneTitle}>📐 Whiteboard · Formulas · Slide OCR</h2>
              <p style={styles.paneSubtitle}>
                Gemini Vision AI extracts mathematical equations, diagrams, and code snippets from captured blackboard frames.
              </p>
              <Badge variant="cyan" size="md" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                {boardContents.length} Captured Snapshot{boardContents.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {boardContents.length === 0 ? (
              <div style={styles.emptyCard} className="glass-panel">
                <span style={{ fontSize: '40px', marginBottom: '8px' }} aria-hidden="true">📸</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
                  No Blackboard Frames Captured
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '4px 0 0' }}>
                  Whiteboard captures taken during the live session will appear here with parsed KaTeX formulas and isolated vector diagrams.
                </p>
              </div>
            ) : (
              <div style={styles.boardGrid} className="dash-lecture-grid">
                {boardContents.map((b, idx) => (
                  <BoardSnapshot
                    key={b.id || idx}
                    snapshot={b}
                    onJumpTimestamp={jumpToTimestamp}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-dark, #080c14)',
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 20px',
  },
  errorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 20px',
    textAlign: 'center',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  header: {
    background: 'rgba(15, 23, 42, 0.75)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '16px 20px',
  },
  headerContainer: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '40px',
    whiteSpace: 'nowrap',
    marginTop: '2px',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  headerBadgesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  lectureTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: '2px 0 0',
  },
  lectureMeta: {
    fontSize: '12.5px',
    color: '#94a3b8',
    margin: 0,
  },
  exportBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  exportLabel: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.06em',
  },
  exportBtnGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  exportBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12.5px',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '40px',
  },
  exportBtnPrimary: {
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12.5px',
    fontWeight: '700',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '40px',
    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)',
  },
  noticeToast: {
    maxWidth: '1280px',
    margin: '10px auto 0',
    background: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: '#38bdf8',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12.5px',
  },
  tabNav: {
    background: 'rgba(8, 12, 20, 0.9)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  tabNavContainer: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 'max-content',
  },
  tabPill: {
    background: 'transparent',
    border: '1px solid transparent',
    color: '#94a3b8',
    borderRadius: '9999px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.18s',
  },
  tabPillActive: {
    background: 'rgba(56, 189, 248, 0.14)',
    color: '#38bdf8',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  tabBadge: (active) => ({
    background: active ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)',
    color: active ? '#040812' : '#cbd5e1',
    borderRadius: '9999px',
    padding: '1px 6px',
    fontSize: '11px',
    fontWeight: '700',
  }),
  mainContainer: {
    flex: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    padding: '24px 16px 64px',
  },
  tabPane: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  cardHeaderSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  paneTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  paneSubtitle: {
    fontSize: '13.5px',
    color: '#94a3b8',
    lineHeight: 1.55,
    margin: '6px 0 0',
  },
  paneSubHeading: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  recordingWorkspace: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
    gap: '24px',
  },
  videoPlayerCard: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chapterBadge: {
    fontSize: '11.5px',
    fontWeight: '600',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '9999px',
    padding: '4px 10px',
  },
  videoPlayerWrapper: {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%', // 16:9 ratio
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#000000',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '12px',
    outline: 'none',
  },
  videoInfoNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '12.5px',
    color: '#94a3b8',
  },
  chaptersCard: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '620px',
  },
  chaptersList: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingRight: '4px',
  },
  chapterItem: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'all 0.18s',
  },
  chapterItemActive: {
    borderColor: 'var(--accent-cyan)',
    background: 'rgba(56, 189, 248, 0.1)',
  },
  chapterTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  chapterNumber: (active) => ({
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: active ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
    color: active ? '#040812' : '#94a3b8',
    fontSize: '11px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  chapterItemTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    margin: 0,
  },
  chapterTimeBadge: {
    fontSize: '11.5px',
    color: '#38bdf8',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  chapterItemSummary: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '6px 0 0 32px',
    lineHeight: 1.45,
  },
  emptyChapterBox: {
    padding: '32px 16px',
    textAlign: 'center',
  },
  transcriptCard: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  transcriptToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchContainer: {
    position: 'relative',
    flex: 1,
    minWidth: '280px',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '14px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    paddingLeft: '38px',
    paddingRight: '36px',
    background: 'rgba(8, 12, 20, 0.85)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    minHeight: '44px',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '8px',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    padding: 0,
    boxShadow: 'none',
  },
  transcriptMeta: {
    display: 'flex',
    alignItems: 'center',
  },
  transcriptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '600px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  transcriptRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  timestampBtn: {
    background: 'rgba(56, 189, 248, 0.1)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    minHeight: '34px',
    boxShadow: 'none',
  },
  segContentCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  speakerPill: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  segText: {
    fontSize: '13.5px',
    color: '#e2e8f0',
    lineHeight: 1.55,
    margin: 0,
  },
  emptyCard: {
    padding: '48px 24px',
    textAlign: 'center',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  summaryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  summaryCard: {
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionHeadingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sectionNumber: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    color: '#ffffff',
    fontWeight: '800',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySectionTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  summaryBodyText: {
    fontSize: '14.5px',
    color: '#e2e8f0',
    lineHeight: 1.65,
  },
  conceptGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  conceptBox: {
    background: 'rgba(8, 12, 20, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '12px',
    padding: '16px',
  },
  conceptName: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: '6px',
  },
  conceptDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    margin: 0,
  },
  defList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  defItem: {
    background: 'rgba(8, 12, 20, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '13.5px',
  },
  defTerm: {
    color: '#38bdf8',
    marginRight: '6px',
  },
  defBody: {
    color: '#e2e8f0',
  },
  examplesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  exampleItem: {
    background: 'rgba(8, 12, 20, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '13.5px',
  },
  exampleTopic: {
    color: '#38bdf8',
    fontWeight: '700',
    marginRight: '6px',
  },
  exampleText: {
    color: '#e2e8f0',
  },
  takeawaysList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  takeawayItem: {
    display: 'flex',
    alignItems: 'flex-start',
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.5,
  },
  notesModeBar: {
    padding: '12px 18px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  modeLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#94a3b8',
  },
  modePillGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modeBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '38px',
    transition: 'all 0.16s',
  },
  modeBtnActive: {
    background: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  ragHeader: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  quickPrompts: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  quickPromptLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '700',
  },
  promptChip: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '9999px',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: 'none',
  },
  ragInputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  ragInput: {
    flex: 1,
    background: 'rgba(8, 12, 20, 0.9)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 16px',
    color: '#ffffff',
    fontSize: '14px',
    minHeight: '44px',
  },
  ragThread: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  ragCard: {
    padding: '20px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  ragQuestionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  qBadge: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: '14px',
  },
  ragQuestionText: {
    color: '#ffffff',
    fontSize: '14.5px',
  },
  ragAnswerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  aBadge: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: '14px',
  },
  ragAnswerText: {
    color: '#e2e8f0',
    fontSize: '14px',
    lineHeight: 1.6,
    margin: 0,
  },
  citationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  citeLabel: {
    fontSize: '11.5px',
    color: '#64748b',
    fontWeight: '600',
  },
  citeTimestampBtn: {
    background: 'rgba(56, 189, 248, 0.12)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: 'none',
  },
  sourcesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  sourceChips: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  sourceChip: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '11px',
    color: '#38bdf8',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: 'none',
  },
  quizAndFlashcardContainer: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '24px',
  },
  quizSection: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreBanner: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid',
  },
  questionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  qCard: {
    background: 'rgba(8, 12, 20, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  qHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qNum: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  qBody: {
    fontSize: '14.5px',
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 1.45,
    margin: 0,
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    minHeight: '44px',
    fontSize: '13.5px',
  },
  radioInput: {
    accentColor: '#38bdf8',
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  optionText: {
    color: '#e2e8f0',
    flex: 1,
  },
  textAnswerInput: {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#ffffff',
    fontSize: '13.5px',
    minHeight: '44px',
  },
  resultFeedback: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
  },
  resultExplanation: {
    marginTop: '6px',
    fontSize: '12.5px',
    color: '#cbd5e1',
    lineHeight: 1.45,
  },
  flashcardSection: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  flashcardCardArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fcMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flashcard: {
    borderRadius: '16px',
    border: '1px solid',
    padding: '36px 20px',
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.25s',
  },
  cardSideBadge: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '0.06em',
  },
  flashcardText: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 1.55,
    margin: '16px 0',
  },
  flipNotice: {
    fontSize: '11.5px',
    color: '#64748b',
  },
  fcControlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  fcNavBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    flex: 1,
    boxShadow: 'none',
  },
  fcDiffBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    flex: 1.2,
    boxShadow: 'none',
  },
  fcLearnBtn: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    flex: 1.2,
    boxShadow: 'none',
  },
  boardHeader: {
    padding: '24px',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  boardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
};
