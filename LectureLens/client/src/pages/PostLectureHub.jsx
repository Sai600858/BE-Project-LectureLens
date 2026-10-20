import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lectureApi, aiApi } from '../services/api';
import { BoardSnapshot } from '../components/BoardSnapshot';
import StudyNotesViewer from '../components/StudyNotesViewer';

export default function PostLectureHub() {
  const { lectureId } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'recording' | 'transcript' | 'summary' | 'notes' | 'rag' | 'chapters' | 'quiz' | 'flashcards'
  const [loading, setLoading] = useState(true);

  // Video recording
  const videoRef = useRef(null);
  const [hasRecording, setHasRecording] = useState(false);

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

  // Chapters
  const [chapters, setChapters] = useState([]);

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

  useEffect(() => {
    loadAllData();
  }, [lectureId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const lec = await lectureApi.getLecture(lectureId);
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
        setTranscriptSegments(t.segments || []);
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
      console.warn('Error loading lecture data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Jump video timestamp
  const jumpToTimestamp = (sec) => {
    if (videoRef.current && sec != null) {
      videoRef.current.currentTime = sec;
      videoRef.current.play();
      setActiveTab('recording');
    }
  };

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
    if (!quizData?.quiz?.id) return;
    try {
      setIsSubmittingQuiz(true);
      const res = await aiApi.submitQuiz(lectureId, quizData.quiz.id, quizAnswers);
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
    } catch (e) {}
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>🎓 Loading Multimodal Lecture Intelligence…</div>
      </div>
    );
  }

  const recordingUrl = aiApi.getRecordingStreamUrl(lectureId);
  const currentCard = flashcards[currentCardIdx];

  return (
    <div style={styles.page}>
      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            ← Dashboard
          </button>
          <div>
            <h1 style={styles.lectureTitle}>{lecture?.title || 'Lecture Session'}</h1>
            <p style={styles.lectureMeta}>
              Instructor: {lecture?.host_name || 'Professor'}  •  Date: {new Date(lecture?.created_at).toLocaleDateString()}  •  Status: {lecture?.status}
            </p>
          </div>
        </div>

        {/* PDF Download Action Bar */}
        <div style={styles.pdfActions}>
          <a
            href={aiApi.getPdfUrl(lectureId, 'transcript')}
            download
            style={styles.pdfBtn('#0284c7')}
          >
            📄 Transcript PDF
          </a>
          <a
            href={aiApi.getPdfUrl(lectureId, 'summary')}
            download
            style={styles.pdfBtn('#0f766e')}
          >
            📊 Summary PDF
          </a>
          <a
            href={aiApi.getPdfUrl(lectureId, 'study-notes')}
            download
            style={styles.pdfBtn('#4338ca')}
          >
            📑 Complete Notes PDF
          </a>
        </div>
      </header>

      {/* ── 7-Tab Sub-Navigation ───────────────────────────────────────────── */}
      <div style={styles.tabBar}>
        <button
          style={styles.tabItem(activeTab === 'recording')}
          onClick={() => setActiveTab('recording')}
        >
          🎥 Video Playback
        </button>
        <button
          style={styles.tabItem(activeTab === 'transcript')}
          onClick={() => setActiveTab('transcript')}
        >
          🔍 Search Transcript ({transcriptSegments.length})
        </button>
        <button
          style={styles.tabItem(activeTab === 'summary')}
          onClick={() => setActiveTab('summary')}
        >
          🧠 AI Summary
        </button>
        <button
          style={styles.tabItem(activeTab === 'notes')}
          onClick={() => setActiveTab('notes')}
        >
          📝 Study Notes
        </button>
        <button
          style={styles.tabItem(activeTab === 'rag')}
          onClick={() => setActiveTab('rag')}
        >
          💬 Ask This Lecture (RAG)
        </button>
        <button
          style={styles.tabItem(activeTab === 'quiz')}
          onClick={() => setActiveTab('quiz')}
        >
          🎯 Quiz & Flashcards
        </button>
        <button
          style={styles.tabItem(activeTab === 'board')}
          onClick={() => setActiveTab('board')}
        >
          📐 Whiteboard & Slides ({boardContents.length})
        </button>
      </div>

      {/* ── Main Tab Content ──────────────────────────────────────────────── */}
      <main style={styles.content}>
        {/* 1. Video Playback Tab */}
        {activeTab === 'recording' && (
          <div style={styles.tabPane}>
            <div style={styles.videoCard}>
              <h3 style={styles.paneTitle}>Recorded Lecture Video Stream</h3>
              <video
                ref={videoRef}
                controls
                src={recordingUrl}
                style={styles.videoPlayer}
                poster=""
              >
                Your browser does not support HTML5 video streaming.
              </video>
              <div style={styles.videoHint}>
                💡 You can jump to exact moments discussed in the lecture by clicking timestamps in the Transcript or Ask AI tabs.
              </div>
            </div>
          </div>
        )}

        {/* 2. Searchable Transcript Tab */}
        {activeTab === 'transcript' && (
          <div style={styles.tabPane}>
            <div style={styles.searchBarContainer}>
              <input
                placeholder="Search lecture words (e.g. replication, consensus, theorem)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={styles.searchInput}
              />
              <span style={styles.searchCount}>
                {searchQuery ? `${searchResults.length} matching segment(s)` : `${transcriptSegments.length} total segments`}
              </span>
            </div>

            <div style={styles.transcriptList}>
              {(searchQuery ? searchResults : transcriptSegments).map((seg, i) => (
                <div key={i} style={styles.transcriptRow}>
                  <button
                    onClick={() => jumpToTimestamp(seg.start_time || seg.startOffset)}
                    style={styles.timestampBtn}
                    title="Jump to video timestamp"
                  >
                    ⏱️ {formatTime(seg.start_time || seg.startOffset)}
                  </button>
                  <div style={styles.segTextCol}>
                    <strong style={styles.speakerName}>{seg.speaker_name || seg.speakerName || 'Teacher'}:</strong>
                    <span style={styles.segBody}>{seg.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. AI Summary Tab */}
        {activeTab === 'summary' && (
          <div style={styles.tabPane}>
            {!summary ? (
              <div style={styles.emptyCard}>Generating executive lecture summary…</div>
            ) : (
              <div style={styles.summaryGrid}>
                {/* Executive Short Summary */}
                <div style={styles.infoCard}>
                  <h3 style={styles.cardHeader}>📝 1. Executive Summary</h3>
                  <div style={styles.bulletsText}>
                    {summary.shortSummary}
                  </div>
                </div>

                {/* Key Concepts */}
                <div style={styles.infoCard}>
                  <h3 style={styles.cardHeader}>💡 2. Important Concepts</h3>
                  <div style={styles.conceptGrid}>
                    {summary.keyConcepts?.map((kc, i) => (
                      <div key={i} style={styles.conceptBox}>
                        <h4 style={styles.conceptName}>{kc.concept}</h4>
                        <p style={styles.conceptDesc}>{kc.description || kc.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Academic Definitions */}
                {summary.definitions?.length > 0 && (
                  <div style={styles.infoCard}>
                    <h3 style={styles.cardHeader}>📖 3. Formal Definitions</h3>
                    <div style={styles.defList}>
                      {summary.definitions.map((d, i) => (
                        <div key={i} style={styles.defItem}>
                          <span style={styles.defTerm}>{d.term}:</span>
                          <span style={styles.defBody}>{d.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructor Examples */}
                {summary.examples?.length > 0 && (
                  <div style={styles.infoCard}>
                    <h3 style={styles.cardHeader}>🧪 4. Practical Examples Used</h3>
                    <div style={styles.defList}>
                      {summary.examples.map((ex, i) => (
                        <div key={i} style={styles.exampleItem}>
                          <strong style={{ color: '#38bdf8' }}>[{ex.topic || 'Case'}]:</strong> {ex.example}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Takeaways */}
                {summary.keyTakeaways?.length > 0 && (
                  <div style={styles.infoCard}>
                    <h3 style={styles.cardHeader}>🎯 5. Key Takeaways</h3>
                    <ul style={styles.takeawaysList}>
                      {summary.keyTakeaways.map((t, i) => (
                        <li key={i} style={styles.takeawayItem}>{t}</li>
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
            {/* Notes Mode Selector */}
            <div style={styles.modeBar}>
              <span style={styles.modeLabel}>Note-Taking Format:</span>
              {['short', 'detailed', 'exam', 'beginner'].map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  style={styles.modeBtn(notesMode === m)}
                >
                  {m === 'short' && '⚡ Short Notes'}
                  {m === 'detailed' && '📚 Detailed Notes'}
                  {m === 'exam' && '🎯 Exam-Oriented Notes'}
                  {m === 'beginner' && '🌱 Beginner-Friendly'}
                </button>
              ))}
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
            <div style={styles.ragHeader}>
              <h3 style={styles.paneTitle}>Lecture-Grounded AI Assistant</h3>
              <p style={styles.paneSubtitle}>
                Ask any question about this lecture. Answers are synthesized strictly from spoken audio, slides, and whiteboard notes, citing exact timestamps.
              </p>
            </div>

            {/* Suggested Quick Questions */}
            <div style={styles.quickPrompts}>
              <span style={{ fontSize: '12px', color: '#71717a' }}>Suggested Questions:</span>
              <button
                onClick={() => handleAskRag('What are the main concepts covered in this lecture?')}
                style={styles.promptChip}
              >
                What are the main concepts?
              </button>
              <button
                onClick={() => handleAskRag('What formulas or equations did the teacher explain?')}
                style={styles.promptChip}
              >
                What formulas were explained?
              </button>
              <button
                onClick={() => handleAskRag('What real-world examples were discussed?')}
                style={styles.promptChip}
              >
                What real-world examples were given?
              </button>
            </div>

            {/* Question Input */}
            <div style={styles.ragInputRow}>
              <input
                placeholder="Ask anything about this lecture session..."
                value={ragQuestion}
                onChange={(e) => setRagQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskRag()}
                style={styles.ragInput}
              />
              <button
                onClick={() => handleAskRag()}
                disabled={isAskingRag}
                style={styles.ragSubmitBtn}
              >
                {isAskingRag ? 'Consulting Lecture…' : 'Ask AI'}
              </button>
            </div>

            {/* Q&A Thread */}
            <div style={styles.ragThread}>
              {ragHistory.map((item, idx) => (
                <div key={idx} style={styles.ragCard}>
                  <div style={styles.ragQuestionRow}>
                    <span style={styles.qBadge}>Q:</span>
                    <span style={styles.ragQuestionText}>{item.question}</span>
                  </div>

                  <div style={styles.ragAnswerRow}>
                    <span style={styles.aBadge}>AI:</span>
                    <p style={styles.ragAnswerText}>{item.answer}</p>
                  </div>

                  {item.relevantTimestamp && (
                    <div style={styles.citationRow}>
                      <span style={styles.citeLabel}>Timestamp Citation:</span>
                      <button
                        onClick={() => jumpToTimestamp(item.timestampSeconds)}
                        style={styles.citeTimestampBtn}
                      >
                        ⏱️ Lecture timestamp {item.relevantTimestamp}
                      </button>
                    </div>
                  )}

                  {item.sources && item.sources.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#71717a' }}>Referenced Segments:</span>
                      {item.sources.map((src, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => jumpToTimestamp(src.timestampSeconds)}
                          title={src.snippet}
                          style={{
                            background: '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#38bdf8',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>⏱️ {src.timestamp}</span>
                          <span style={{ color: '#71717a', fontSize: '10px' }}>({src.type})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Quiz & Flashcards Tab */}
        {activeTab === 'quiz' && (
          <div style={styles.tabPane}>
            <div style={styles.quizFlashTabs}>
              <div style={styles.quizInnerSection}>
                <h3 style={styles.paneTitle}>📝 Interactive Lecture Quiz</h3>

                {quizResult && (
                  <div style={styles.scoreBanner(quizResult.percentage)}>
                    <h4>Quiz Completed! Score: {quizResult.score} / {quizResult.totalQuestions} ({quizResult.percentage}%)</h4>
                    {quizResult.weakTopics?.length > 0 && (
                      <p style={{ marginTop: '6px' }}>
                        Areas for improvement: <strong>{quizResult.weakTopics.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div style={styles.questionList}>
                  {quizData?.questions?.map((q, idx) => {
                    const resultItem = quizResult?.results?.find((r) => r.questionId === q.id);

                    return (
                      <div key={q.id} style={styles.qCard}>
                        <div style={styles.qHeader}>
                          <span style={styles.qNum}>Question {idx + 1}</span>
                          <span style={styles.qDiff(q.difficulty)}>{q.difficulty}</span>
                        </div>
                        <p style={styles.qBody}>{q.question_text || q.questionText}</p>

                        {/* Options */}
                        {q.options?.length > 0 ? (
                          <div style={styles.optionsList}>
                            {q.options.map((opt, optIdx) => (
                              <label key={optIdx} style={styles.optionLabel}>
                                <input
                                  type="radio"
                                  name={`q_${q.id}`}
                                  value={opt}
                                  checked={quizAnswers[q.id] === opt}
                                  onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                                  disabled={Boolean(quizResult)}
                                />
                                <span>{opt}</span>
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

                        {resultItem && (
                          <div style={styles.resultFeedback(resultItem.isCorrect)}>
                            <div>{resultItem.isCorrect ? '✅ Correct!' : `❌ Incorrect. Correct Answer: ${resultItem.correctAnswer}`}</div>
                            {resultItem.explanation && <div style={{ marginTop: '4px', fontSize: '12px' }}>💡 {resultItem.explanation}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!quizResult && (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmittingQuiz}
                    style={styles.submitQuizBtn}
                  >
                    {isSubmittingQuiz ? 'Evaluating Answers…' : 'Submit Quiz for Grading'}
                  </button>
                )}
              </div>

              {/* Flashcards Sub-section */}
              <div style={styles.flashcardSection}>
                <h3 style={styles.paneTitle}>🗂️ Interactive Study Flashcards</h3>
                {flashcards.length === 0 ? (
                  <div style={styles.emptyCard}>No flashcards generated yet.</div>
                ) : (
                  <div style={styles.flashcardContainer}>
                    <div style={styles.fcMeta}>
                      Card {currentCardIdx + 1} of {flashcards.length}  •  Topic: {currentCard?.topic}  •  Difficulty: {currentCard?.difficulty}
                    </div>

                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      style={styles.flashcardCard(isFlipped)}
                    >
                      <div style={styles.cardSideLabel}>{isFlipped ? 'BACK (ANSWER)' : 'FRONT (QUESTION)'}</div>
                      <div style={styles.cardContentText}>
                        {isFlipped ? currentCard?.answer : currentCard?.question}
                      </div>
                      <div style={styles.flipHint}>(Click card to flip)</div>
                    </div>

                    <div style={styles.fcControls}>
                      <button onClick={prevCard} style={styles.fcNavBtn}>← Previous</button>
                      <button onClick={() => handleFlashcardStatus('difficult')} style={styles.fcDiffBtn}>
                        ⚠️ Mark Difficult
                      </button>
                      <button onClick={() => handleFlashcardStatus('learned')} style={styles.fcLearnBtn}>
                        ✅ Mark Learned
                      </button>
                      <button onClick={nextCard} style={styles.fcNavBtn}>Next →</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 8. Whiteboard & Slide Snapshots Tab */}
        {activeTab === 'board' && (
          <div style={styles.tabPane}>
            <div style={styles.searchBarContainer}>
              <div>
                <h3 style={styles.paneTitle}>📐 Whiteboard · Formulas · Diagrams</h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: '4px 0 0' }}>
                  Gemini Vision AI extracts equations (rendered as LaTeX), step-by-step diagrams, and key teaching points from each snapshot.
                </p>
              </div>
              <span style={styles.searchCount}>{boardContents.length} snapshot(s)</span>
            </div>

            {boardContents.length === 0 ? (
              <div style={{
                padding: '48px 32px',
                background: '#18181b',
                borderRadius: '12px',
                border: '1px solid #27272a',
                textAlign: 'center',
                color: '#71717a',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📸</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  No whiteboard or slide snapshots were captured during this lecture session.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#52525b' }}>
                  Use the "📸 Snap Board" button in the live room to capture formulas and diagrams.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '20px',
                marginTop: '16px',
              }}>
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

function formatTime(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#09090b',
    color: '#f4f4f5',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#09090b',
    color: '#38bdf8',
    fontSize: '18px',
  },
  spinner: {
    padding: '40px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    background: '#18181b',
    borderBottom: '1px solid #27272a',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  backBtn: {
    background: '#27272a',
    color: '#a1a1aa',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  lectureTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#fff',
    margin: 0,
  },
  lectureMeta: {
    fontSize: '12px',
    color: '#a1a1aa',
    marginTop: '4px',
  },
  pdfActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  pdfBtn: (color) => ({
    background: color,
    color: '#fff',
    textDecoration: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  tabBar: {
    display: 'flex',
    background: '#121215',
    borderBottom: '1px solid #27272a',
    padding: '0 32px',
    overflowX: 'auto',
  },
  tabItem: (active) => ({
    padding: '14px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '3px solid #38bdf8' : '3px solid transparent',
    color: active ? '#38bdf8' : '#71717a',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  }),
  content: {
    flex: 1,
    padding: '32px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
  },
  tabPane: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  paneTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  paneSubtitle: {
    fontSize: '13px',
    color: '#a1a1aa',
    marginTop: '4px',
  },
  videoCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '540px',
    borderRadius: '12px',
    background: '#000',
  },
  videoHint: {
    fontSize: '12px',
    color: '#94a3b8',
    background: '#0f172a',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  searchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  searchInput: {
    flex: 1,
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  searchCount: {
    fontSize: '12px',
    color: '#a1a1aa',
  },
  transcriptList: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '650px',
    overflowY: 'auto',
  },
  transcriptRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#27272a33',
  },
  timestampBtn: {
    background: '#0284c722',
    color: '#38bdf8',
    border: '1px solid #0284c744',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
  },
  segTextCol: {
    flex: 1,
    fontSize: '13px',
    lineHeight: 1.5,
  },
  speakerName: {
    color: '#60a5fa',
    marginRight: '8px',
  },
  segBody: {
    color: '#e4e4e7',
  },
  summaryGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  infoCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '24px',
  },
  cardHeader: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: '14px',
  },
  bulletsText: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#d4d4d8',
    whiteSpace: 'pre-line',
  },
  conceptGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  conceptBox: {
    background: '#27272a',
    borderRadius: '8px',
    padding: '14px',
  },
  conceptName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f4f4f5',
    margin: '0 0 6px 0',
  },
  conceptDesc: {
    fontSize: '12px',
    color: '#a1a1aa',
    margin: 0,
    lineHeight: 1.4,
  },
  defList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  defItem: {
    fontSize: '13px',
    lineHeight: 1.5,
  },
  defTerm: {
    fontWeight: 'bold',
    color: '#a78bfa',
    marginRight: '8px',
  },
  defBody: {
    color: '#d4d4d8',
  },
  exampleItem: {
    fontSize: '13px',
    background: '#27272a',
    padding: '10px 14px',
    borderRadius: '6px',
    color: '#d4d4d8',
  },
  takeawaysList: {
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#d4d4d8',
    lineHeight: 1.6,
  },
  takeawayItem: {
    marginBottom: '6px',
  },
  modeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modeLabel: {
    fontSize: '13px',
    color: '#a1a1aa',
    fontWeight: '600',
  },
  modeBtn: (active) => ({
    background: active ? '#2563eb' : '#27272a',
    color: active ? '#fff' : '#a1a1aa',
    border: '1px solid',
    borderColor: active ? '#3b82f6' : '#3f3f46',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
  notesContainer: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  notesMarkdown: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#e4e4e7',
  },
  markdownPre: {
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    margin: 0,
  },
  formulasBox: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '16px',
  },
  boxTitle: {
    fontSize: '14px',
    color: '#38bdf8',
    marginBottom: '10px',
  },
  formulaItem: {
    fontSize: '13px',
    marginBottom: '8px',
    color: '#cbd5e1',
  },
  latexCode: {
    background: '#1e293b',
    padding: '2px 8px',
    borderRadius: '4px',
    color: '#4ade80',
    fontFamily: 'monospace',
  },
  questionsBox: {
    background: '#1f1b2e',
    border: '1px solid #2e284a',
    borderRadius: '8px',
    padding: '16px',
  },
  questionItem: {
    marginBottom: '10px',
  },
  qText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f4f4f5',
  },
  qHint: {
    fontSize: '12px',
    color: '#a78bfa',
    marginTop: '2px',
  },
  ragHeader: {
    marginBottom: '8px',
  },
  quickPrompts: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  promptChip: {
    background: '#27272a',
    border: '1px solid #3f3f46',
    color: '#38bdf8',
    borderRadius: '999px',
    padding: '4px 12px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  ragInputRow: {
    display: 'flex',
    gap: '12px',
  },
  ragInput: {
    flex: 1,
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  ragSubmitBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
  },
  ragThread: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  ragCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  ragQuestionRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  qBadge: {
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  ragQuestionText: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
  },
  ragAnswerRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  aBadge: {
    background: '#10b981',
    color: '#fff',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  ragAnswerText: {
    fontSize: '14px',
    color: '#d4d4d8',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  citationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderTop: '1px solid #27272a',
    paddingTop: '10px',
  },
  citeLabel: {
    fontSize: '12px',
    color: '#71717a',
  },
  citeTimestampBtn: {
    background: '#0284c722',
    color: '#38bdf8',
    border: '1px solid #0284c744',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  chaptersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  chapterCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  chTimeCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  chTimeBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  chDuration: {
    fontSize: '11px',
    color: '#71717a',
  },
  chContentCol: {
    flex: 1,
  },
  chTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  chSummary: {
    fontSize: '13px',
    color: '#a1a1aa',
    margin: 0,
    lineHeight: 1.4,
  },
  quizFlashTabs: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '32px',
  },
  quizInnerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreBanner: (perc) => ({
    background: perc >= 70 ? '#10b98122' : '#f59e0b22',
    border: '1px solid',
    borderColor: perc >= 70 ? '#10b981' : '#f59e0b',
    borderRadius: '8px',
    padding: '16px',
    color: perc >= 70 ? '#6ee7b7' : '#fcd34d',
  }),
  questionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  qCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '16px',
  },
  qHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  qNum: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  qDiff: (d) => ({
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: d === 'Easy' ? '#10b98122' : d === 'Hard' ? '#ef444422' : '#f59e0b22',
    color: d === 'Easy' ? '#34d399' : d === 'Hard' ? '#f87171' : '#fbbf24',
  }),
  qBody: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: '12px',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#d4d4d8',
    cursor: 'pointer',
    background: '#27272a',
    padding: '8px 12px',
    borderRadius: '6px',
  },
  textAnswerInput: {
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '10px',
    color: '#fff',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  },
  resultFeedback: (correct) => ({
    marginTop: '12px',
    background: correct ? '#10b98122' : '#ef444422',
    border: '1px solid',
    borderColor: correct ? '#10b981' : '#ef4444',
    padding: '10px',
    borderRadius: '6px',
    color: correct ? '#34d399' : '#fca5a5',
    fontSize: '13px',
  }),
  submitQuizBtn: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
  },
  flashcardSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  flashcardContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fcMeta: {
    fontSize: '12px',
    color: '#71717a',
  },
  flashcardCard: (flipped) => ({
    background: flipped ? '#1e1b4b' : '#18181b',
    border: '1px solid',
    borderColor: flipped ? '#4338ca' : '#27272a',
    borderRadius: '16px',
    padding: '40px 24px',
    minHeight: '260px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  }),
  cardSideLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#38bdf8',
    letterSpacing: '0.05em',
  },
  cardContentText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    lineHeight: 1.5,
  },
  flipHint: {
    fontSize: '11px',
    color: '#71717a',
  },
  fcControls: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  fcNavBtn: {
    background: '#27272a',
    color: '#fff',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  fcDiffBtn: {
    background: '#ef444422',
    color: '#f87171',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  fcLearnBtn: {
    background: '#10b98122',
    color: '#34d399',
    border: '1px solid #10b981',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  emptyCard: {
    background: '#18181b',
    border: '1px dashed #27272a',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    color: '#71717a',
  },
};
