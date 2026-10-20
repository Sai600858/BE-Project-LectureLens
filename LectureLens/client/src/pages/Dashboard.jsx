import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, lectureApi } from '../services/api';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Button from '../components/Button';

/**
 * Premium, mobile-first Dashboard tailored to student vs. instructor roles.
 * Provides live room status, real-time filtering, accessible touch controls,
 * and zero horizontal scroll overflow.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authApi.getCurrentUser());
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'LIVE' | 'COMPLETED' | 'PUBLIC' | 'PRIVATE'

  // Create lecture modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [createLoading, setCreateLoading] = useState(false);

  // Room code copy state
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    fetchLectures();
  }, []);

  const fetchLectures = async () => {
    try {
      setLoading(true);
      const list = await lectureApi.getLectures();
      setLectures(list || []);
    } catch (e) {
      console.warn('Failed to fetch lectures:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(code);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleClearAllLectures = async () => {
    if (!window.confirm('Are you sure you want to delete ALL lecture history? This will permanently remove all sessions, transcripts, notes, and recordings.')) {
      return;
    }
    try {
      await lectureApi.clearAllLectures();
      setLectures([]);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to clear lecture history');
    }
  };

  const handleDeleteLecture = async (id) => {
    try {
      await lectureApi.deleteLecture(id);
      setLectures((prev) => prev.filter((l) => (l.id || l.lectureId) !== id));
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to delete lecture');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setCreateLoading(true);
      const newLec = await lectureApi.createLecture({ title: title.trim(), description: description.trim(), visibility });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      const targetRoomId = newLec?.roomId || newLec?.room_id;
      if (!targetRoomId) throw new Error('Server did not return a valid Room Code');
      navigate(`/room/${targetRoomId}?role=host`);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        alert('Your session has expired. Please sign in again.');
        authApi.logout();
        navigate('/login');
        return;
      }
      alert(err.response?.data?.error || err.message || 'Failed to create lecture');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return setJoinError('Please enter a room code');
    if (code.length < 4) return setJoinError('Code must be at least 4 characters');
    const matched = lectures.find((l) => (l.room_id || l.roomId) === code);
    if (matched && (matched.status === 'ENDED' || matched.status === 'COMPLETED')) {
      navigate(`/lecture/${matched.id || matched.lectureId}/review`);
      return;
    }
    navigate(`/room/${code}?role=participant`);
  };

  const handleOpenLecture = (lec) => {
    const lecId = lec.id || lec.lectureId;
    const roomCode = lec.room_id || lec.roomId;
    if (lec.status === 'ENDED' || lec.status === 'COMPLETED') {
      navigate(`/lecture/${lecId}/review`);
    } else if (lec.status === 'LIVE') {
      navigate(`/room/${roomCode}?role=${isTeacher ? 'host' : 'participant'}`);
    } else {
      if (isTeacher) {
        navigate(`/room/${roomCode}?role=host`);
      } else {
        navigate(`/lecture/${lecId}/review`);
      }
    }
  };

  // Real filtered lectures derived from local state
  const filteredLectures = useMemo(() => {
    return lectures.filter((lec) => {
      // Status & visibility filter
      if (activeFilter === 'LIVE' && lec.status !== 'LIVE') return false;
      if (activeFilter === 'COMPLETED' && lec.status !== 'ENDED' && lec.status !== 'COMPLETED') return false;
      if (activeFilter === 'PUBLIC' && lec.visibility !== 'PUBLIC') return false;
      if (activeFilter === 'PRIVATE' && lec.visibility !== 'PRIVATE') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (lec.title || '').toLowerCase();
        const d = (lec.description || '').toLowerCase();
        const h = (lec.host_name || '').toLowerCase();
        const c = (lec.room_id || lec.roomId || '').toLowerCase();
        return t.includes(q) || d.includes(q) || h.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [lectures, activeFilter, searchQuery]);

  // Real metric counters from actual backend data
  const liveCount = useMemo(() => lectures.filter((l) => l.status === 'LIVE').length, [lectures]);
  const completedCount = useMemo(
    () => lectures.filter((l) => l.status === 'ENDED' || l.status === 'COMPLETED').length,
    [lectures]
  );

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <main id="main-content" style={styles.mainContent}>
        <div style={styles.container}>
          {/* ── Command Center Hero ── */}
          <section style={styles.heroCard} className="glass-panel-elevated">
            <div style={styles.heroTopRow}>
              <div>
                <div style={styles.roleTagWrap}>
                  <Badge variant={isTeacher ? 'cyan' : 'emerald'} size="md">
                    {isTeacher ? 'Instructor Command Center' : 'Student Learning Hub'}
                  </Badge>
                  {liveCount > 0 && (
                    <Badge variant="rose" size="md" icon="🔴">
                      {liveCount} Session{liveCount > 1 ? 's' : ''} Live Now
                    </Badge>
                  )}
                </div>

                <h1 style={styles.heroTitle}>
                  {isTeacher ? 'Host & Orchestrate AI Classrooms' : 'Your Enrolled Classrooms & Notes'}
                </h1>
                <p style={styles.heroSubtitle}>
                  {isTeacher
                    ? 'Launch live sessions with real-time speech transcription, whiteboard OCR, and automated study notes synthesis.'
                    : 'Join ongoing interactive lectures, review synthesized KaTeX notes, take quizzes, and master spaced-repetition flashcards.'}
                </p>
              </div>

              {/* Primary Action Button */}
              {isTeacher && (
                <div style={styles.heroPrimaryAction}>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="primary"
                    size="lg"
                    icon="➕"
                    style={{ whiteSpace: 'nowrap', width: '100%' }}
                  >
                    Host New Lecture
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Access Join Box & Live Stats */}
            <div style={styles.heroMetricsAndJoin}>
              {/* Join Box */}
              <div style={styles.joinBox} className="dash-join-box">
                <div style={styles.joinInputWrap}>
                  <span style={styles.joinInputIcon} aria-hidden="true">🔑</span>
                  <input
                    aria-label="Enter room code to join"
                    placeholder="Enter 8-digit Room Code (e.g. MATH101)"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value);
                      if (joinError) setJoinError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                    style={styles.joinInput}
                  />
                </div>
                <Button
                  onClick={handleJoinByCode}
                  variant="emerald"
                  size="md"
                  style={{ minWidth: '120px' }}
                >
                  Join Room
                </Button>
              </div>

              {/* Real Metric Indicators */}
              <div style={styles.metricsPillsRow}>
                <div style={styles.metricPill}>
                  <span style={styles.metricNumber}>{lectures.length}</span>
                  <span style={styles.metricLabel}>Total Sessions</span>
                </div>
                <div style={styles.metricPill}>
                  <span style={{ ...styles.metricNumber, color: '#f87171' }}>{liveCount}</span>
                  <span style={styles.metricLabel}>Live Now</span>
                </div>
                <div style={styles.metricPill}>
                  <span style={{ ...styles.metricNumber, color: '#34d399' }}>{completedCount}</span>
                  <span style={styles.metricLabel}>Study Ready</span>
                </div>
              </div>
            </div>

            {joinError && <p style={styles.errorText} role="alert">⚠️ {joinError}</p>}
          </section>

          {/* ── 3D Educational Visualization Lab Quick Access Banner ── */}
          <section
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px', flex: 1 }}>
              <span style={{ fontSize: '28px' }} aria-hidden="true">🔬</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px', color: '#f8fafc' }}>
                    Interactive 3D Educational Lab
                  </span>
                  <Badge variant="cyan" size="sm">New</Badge>
                  <Badge variant="neutral" size="sm">Three.js</Badge>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Master complex CS concepts in 3D: Raft leader elections & quorum arithmetic, AVL tree rotations, and neural network matrix multiplication.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/lab')}
              aria-label="Launch 3D Educational Visualization Lab"
            >
              Open 3D Lab →
            </Button>
          </section>

          {/* ── Search & Filter Controls ── */}
          <section style={styles.controlBar} className="dash-control-bar">
            {/* Search Input */}
            <div style={styles.searchWrap}>
              <span style={styles.searchIcon} aria-hidden="true">🔍</span>
              <input
                type="search"
                aria-label="Search lectures by title or instructor"
                placeholder="Search lectures by title, topic, or instructor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* Filter Pills */}
            <div style={styles.filterGroup} role="group" aria-label="Filter lectures">
              {[
                { id: 'ALL', label: `All (${lectures.length})` },
                { id: 'LIVE', label: `🔴 Live (${liveCount})` },
                { id: 'COMPLETED', label: `✅ Done (${completedCount})` },
                { id: 'PUBLIC', label: 'Public' },
                { id: 'PRIVATE', label: 'Private' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  style={{
                    ...styles.filterChip,
                    ...(activeFilter === f.id ? styles.filterChipActive : {}),
                  }}
                  aria-pressed={activeFilter === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Auxiliary actions */}
            <div style={styles.auxActions}>
              <button
                onClick={fetchLectures}
                style={styles.refreshBtn}
                title="Refresh lecture list"
                aria-label="Refresh lecture list"
              >
                🔄 Refresh
              </button>
              {isTeacher && lectures.length > 0 && (
                <button
                  onClick={handleClearAllLectures}
                  style={styles.clearBtn}
                  title="Clear all lecture history"
                  aria-label="Clear all lecture history"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </section>

          {/* ── Lecture Cards Grid ── */}
          <section aria-label="Lecture Sessions List">
            {loading ? (
              <div style={styles.loadingState}>
                <div style={styles.spinner} aria-hidden="true" />
                <p style={{ color: '#94a3b8', fontSize: '15px' }}>Retrieving lecture sessions…</p>
              </div>
            ) : filteredLectures.length === 0 ? (
              <div style={styles.emptyState} className="glass-panel">
                <span style={{ fontSize: '48px', marginBottom: '8px' }} aria-hidden="true">📭</span>
                <h2 style={styles.emptyTitle}>
                  {searchQuery || activeFilter !== 'ALL'
                    ? 'No lectures match your search or filter'
                    : 'No lecture sessions recorded yet'}
                </h2>
                <p style={styles.emptyDesc}>
                  {searchQuery || activeFilter !== 'ALL'
                    ? 'Try clearing the search query or changing your filter criteria.'
                    : isTeacher
                    ? 'Click the button below to start broadcasting your first live classroom session.'
                    : 'Check back soon or ask your instructor for an 8-digit room code to join.'}
                </p>
                {isTeacher && !searchQuery && activeFilter === 'ALL' && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="primary"
                    size="md"
                    icon="➕"
                    style={{ marginTop: '16px' }}
                  >
                    Host Your First Lecture
                  </Button>
                )}
              </div>
            ) : (
              <div style={styles.lectureGrid} className="dash-lecture-grid">
                {filteredLectures.map((lec) => {
                  const lecId = lec.id || lec.lectureId;
                  const roomCode = lec.room_id || lec.roomId;
                  const isLive = lec.status === 'LIVE';
                  const isDone = lec.status === 'ENDED' || lec.status === 'COMPLETED';

                  return (
                    <article
                      key={lecId}
                      style={styles.lectureCard}
                      className="glass-panel dash-card"
                      onClick={() => handleOpenLecture(lec)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenLecture(lec);
                        }
                      }}
                      aria-label={`${lec.title}, status: ${lec.status}`}
                    >
                      {/* Card Top: Badges & Delete */}
                      <div style={styles.cardHeader}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <Badge
                            variant={isLive ? 'rose' : isDone ? 'emerald' : 'amber'}
                            size="sm"
                          >
                            {isLive ? '🔴 LIVE' : isDone ? '✅ COMPLETED' : '⏳ SCHEDULED'}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {lec.visibility || 'PUBLIC'}
                          </Badge>
                        </div>

                        {isTeacher && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(lecId);
                            }}
                            style={styles.deleteCardBtn}
                            title="Delete this lecture session"
                            aria-label={`Delete ${lec.title}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 style={styles.cardTitle}>{lec.title}</h3>
                      <p style={styles.cardDesc}>
                        {lec.description || 'Multimodal university lecture session.'}
                      </p>

                      {/* Instructor & Date Meta */}
                      <div style={styles.metaRow}>
                        <span style={styles.metaItem}>
                          <span aria-hidden="true">👨‍🏫</span> {lec.host_name || 'Instructor'}
                        </span>
                        <span style={styles.metaItem}>
                          <span aria-hidden="true">🗓️</span>{' '}
                          {lec.created_at ? new Date(lec.created_at).toLocaleDateString() : 'Active'}
                        </span>
                      </div>

                      {/* Room Code Badge (when active) */}
                      {roomCode && (
                        <div
                          style={styles.codeRow}
                          onClick={(e) => e.stopPropagation()}
                          role="region"
                          aria-label="Room code"
                        >
                          <div style={styles.codeText}>
                            <span style={styles.codePrefix}>CODE:</span>
                            <span style={styles.codeValue}>{roomCode}</span>
                          </div>
                          <button
                            onClick={(e) => handleCopyCode(e, roomCode)}
                            style={styles.copyBtn}
                            aria-label={`Copy room code ${roomCode}`}
                          >
                            {copiedCodeId === roomCode ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      )}

                      {/* Action Controls */}
                      <div
                        style={styles.actionRow}
                        className="dash-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isLive ? (
                          <>
                            <Button
                              onClick={() =>
                                navigate(`/room/${roomCode}?role=${isTeacher ? 'host' : 'participant'}`)
                              }
                              variant="emerald"
                              size="sm"
                              style={{ flex: 1 }}
                            >
                              🔴 {isTeacher ? 'Return to Room' : 'Join Live'}
                            </Button>
                            <Button
                              onClick={() => navigate(`/lecture/${lecId}/review`)}
                              variant="secondary"
                              size="sm"
                              style={{ flex: 1 }}
                            >
                              📖 AI Notes
                            </Button>
                          </>
                        ) : isDone ? (
                          <>
                            <Button
                              onClick={() => navigate(`/lecture/${lecId}/review`)}
                              variant="primary"
                              size="sm"
                              style={{ flex: 1 }}
                            >
                              📖 AI Notes & Review
                            </Button>
                            {isTeacher && (
                              <Button
                                onClick={() => navigate(`/room/${roomCode}?role=host`)}
                                variant="secondary"
                                size="sm"
                                title="Reopen live classroom session"
                              >
                                🔁 Reopen
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {isTeacher ? (
                              <Button
                                onClick={() => navigate(`/room/${roomCode}?role=host`)}
                                variant="primary"
                                size="sm"
                                style={{ flex: 1 }}
                              >
                                ▶️ Start Lecture
                              </Button>
                            ) : (
                              <span style={styles.scheduledNotice}>⏳ Session scheduled</span>
                            )}
                            <Button
                              onClick={() => navigate(`/lecture/${lecId}/review`)}
                              variant="secondary"
                              size="sm"
                              style={{ flex: 1 }}
                            >
                              📖 Overview
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Create Lecture Modal ── */}
      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowCreateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-lecture-title"
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 id="create-lecture-title" style={styles.modalTitle}>Host a New Lecture</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLecture} style={styles.modalForm}>
              <div style={styles.modalField}>
                <label htmlFor="create-title" style={styles.label}>
                  Lecture Title <span style={styles.requiredStar}>*</span>
                </label>
                <input
                  id="create-title"
                  placeholder="e.g. Distributed Consensus & Raft Protocol"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={styles.input}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.modalField}>
                <label htmlFor="create-desc" style={styles.label}>
                  Description & Syllabus Topics
                </label>
                <textarea
                  id="create-desc"
                  placeholder="Summary of topics, algorithms, proofs, and expected learning outcomes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              <div style={styles.modalField}>
                <label htmlFor="create-visibility" style={styles.label}>
                  Access Visibility
                </label>
                <select
                  id="create-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  style={styles.select}
                >
                  <option value="PUBLIC">Public – Any enrolled student can join</option>
                  <option value="PRIVATE">Private – Restricted to authorized participants</option>
                </select>
              </div>

              <div style={styles.modalActions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={createLoading}
                  disabled={createLoading}
                  style={{ flex: 1 }}
                >
                  {createLoading ? 'Allocating Room…' : '🚀 Start Live Lecture'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div
          style={styles.modalOverlay}
          onClick={() => setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div style={{ ...styles.modalCard, maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '8px' }} aria-hidden="true">
              🗑️
            </div>
            <h2 id="delete-confirm-title" style={{ ...styles.modalTitle, textAlign: 'center' }}>
              Delete Lecture Session?
            </h2>
            <p style={styles.deleteWarningText}>
              This action permanently removes the session, transcript segments, AI study notes, and quiz records.
              This cannot be undone.
            </p>
            <div style={styles.modalActions}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={() => handleDeleteLecture(deleteConfirm)}
                style={{ flex: 1 }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-dark, #080c14)',
  },
  mainContent: {
    flex: 1,
    padding: '24px 16px 64px',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  heroCard: {
    padding: '28px 24px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  heroTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    flexWrap: 'wrap',
  },
  roleTagWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  heroTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.025em',
    marginBottom: '8px',
  },
  heroSubtitle: {
    fontSize: '14.5px',
    color: '#94a3b8',
    lineHeight: 1.55,
    maxWidth: '780px',
    margin: 0,
  },
  heroPrimaryAction: {
    alignSelf: 'center',
    minWidth: '200px',
  },
  heroMetricsAndJoin: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    flexWrap: 'wrap',
  },
  joinBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: '280px',
    maxWidth: '540px',
  },
  joinInputWrap: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  joinInputIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '14px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  joinInput: {
    width: '100%',
    paddingLeft: '38px',
    background: 'rgba(8, 12, 20, 0.8)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    minHeight: '44px',
  },
  metricsPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  metricPill: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '10px',
    minWidth: '85px',
  },
  metricNumber: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#38bdf8',
    lineHeight: 1.2,
  },
  metricLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  errorText: {
    color: '#f87171',
    fontSize: '12.5px',
    fontWeight: '600',
    margin: '-8px 0 0',
  },
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    flex: 1,
    minWidth: '260px',
    maxWidth: '440px',
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
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    minHeight: '42px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filterChip: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
    transition: 'all 0.16s',
  },
  filterChipActive: {
    background: 'rgba(56, 189, 248, 0.14)',
    color: '#38bdf8',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  auxActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  refreshBtn: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  clearBtn: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 16px',
    gap: '12px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  emptyState: {
    textAlign: 'center',
    padding: '56px 20px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '560px',
    margin: '32px auto',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '6px',
  },
  emptyDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: 1.55,
    margin: 0,
    maxWidth: '440px',
  },
  lectureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  lectureCard: {
    padding: '20px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    cursor: 'pointer',
    transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  deleteCardBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    boxShadow: 'none',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 1.3,
    margin: '2px 0 0',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    margin: 0,
    flex: 1,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#64748b',
    paddingTop: '6px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '6px 10px',
  },
  codeText: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  codePrefix: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '700',
  },
  codeValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    color: '#38bdf8',
    fontWeight: '700',
    letterSpacing: '0.04em',
  },
  copyBtn: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '28px',
    boxShadow: 'none',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  scheduledNotice: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(4, 7, 13, 0.82)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '18px',
    padding: '28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '18px',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    borderRadius: '6px',
    boxShadow: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  requiredStar: {
    color: '#f87171',
  },
  input: {
    background: 'rgba(8, 12, 20, 0.85)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#ffffff',
    fontSize: '14px',
    minHeight: '44px',
  },
  textarea: {
    background: 'rgba(8, 12, 20, 0.85)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#ffffff',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'var(--font-body)',
  },
  select: {
    background: 'rgba(8, 12, 20, 0.85)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#ffffff',
    fontSize: '14px',
    minHeight: '44px',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  deleteWarningText: {
    fontSize: '13.5px',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '0 0 20px',
  },
};
