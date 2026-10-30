import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, lectureApi } from '../services/api';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Button from '../components/Button';

/**
 * Reference-Inspired Content-Driven Dashboard
 * Editorial layout with numbered eyebrows, minimal bracket tags,
 * continue-learning spotlight card, and distinct lecture workspaces.
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
  const [activeFilter, setActiveFilter] = useState('ALL');

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
      if (err.response?.status === 401) {
        alert('Your session has expired. Please sign in again.');
        authApi.logout();
        navigate('/login');
      } else if (err.response?.status === 403) {
        alert(err.response?.data?.error || 'Access denied: Teacher or Administrator account required to create lectures.');
      } else {
        alert(err.response?.data?.error || err.message || 'Failed to create lecture session');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter an 8-character room code');
      return;
    }
    navigate(`/room/${code}?role=participant`);
  };

  const handleOpenLecture = (lec) => {
    const lecId = lec.id || lec.lectureId;
    const roomCode = lec.room_id || lec.roomId;
    if (lec.status === 'LIVE') {
      navigate(`/room/${roomCode}?role=${isTeacher ? 'host' : 'participant'}`);
    } else {
      navigate(`/lecture/${lecId}/review`);
    }
  };

  // Real filtered lectures derived from local state
  const filteredLectures = useMemo(() => {
    return lectures.filter((lec) => {
      if (activeFilter === 'LIVE' && lec.status !== 'LIVE') return false;
      if (activeFilter === 'COMPLETED' && lec.status !== 'ENDED' && lec.status !== 'COMPLETED') return false;
      if (activeFilter === 'PUBLIC' && lec.visibility !== 'PUBLIC') return false;
      if (activeFilter === 'PRIVATE' && lec.visibility !== 'PRIVATE') return false;

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

  // Identify featured lecture (prefer live, then newest completed)
  const featuredLecture = useMemo(() => {
    const live = lectures.find((l) => l.status === 'LIVE');
    if (live) return live;
    return lectures[0] || null;
  }, [lectures]);

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <main id="main-content" style={styles.mainContent}>
        {/* Academic Eyebrow Breadcrumb */}
        <div style={styles.headerRow}>
          <div className="editorial-eyebrow">
            <span className="eyebrow-num">📚</span>
            <span>ACADEMIC WORKSPACE</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#94a3b8' }}>
              {lectures.length} {lectures.length === 1 ? 'Lecture' : 'Lectures'} Available
            </span>
            {liveCount > 0 && (
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                🔴 {liveCount} Live
              </span>
            )}
          </div>
        </div>

        {/* Header Hero */}
        <div style={styles.heroRow}>
          <div>
            <h1 style={styles.heroTitle}>
              {isTeacher ? 'Instructor Classroom Hub' : 'My Learning Workspace'}
              <span style={styles.heroSubtitle}>
                {isTeacher
                  ? 'Host live interactive sessions, share screen feeds, and generate verified study notes'
                  : 'Review lecture notes, practice with quizzes and flashcards, and explore visual simulations'}
              </span>
            </h1>
          </div>

          {isTeacher && (
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              size="md"
              icon="➕"
              style={{ alignSelf: 'flex-start' }}
            >
              Host New Lecture
            </Button>
          )}
        </div>

        {/* Featured Spotlight Card (Continue Learning) */}
        {featuredLecture && !searchQuery && activeFilter === 'ALL' && (
          <section style={styles.featuredSection} aria-label="Featured Lecture Spotlight">
            <div className="editorial-card" style={styles.featuredCard}>
              <div style={styles.featuredHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: featuredLecture.status === 'LIVE' ? '#f87171' : '#38bdf8' }}>
                    {featuredLecture.status === 'LIVE' ? '🔴 LIVE NOW' : '⚡ CONTINUE LEARNING'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    Room: {featuredLecture.room_id || featuredLecture.roomId}
                  </span>
                </div>
                <span className="handwritten-note">(pick up right where you left off ↗)</span>
              </div>

              <div style={styles.featuredBody}>
                <div>
                  <h2 style={styles.featuredTitle}>{featuredLecture.title}</h2>
                  <p style={styles.featuredDesc}>
                    {featuredLecture.description || 'Multimodal university lecture session.'}
                  </p>
                  <div style={styles.metaRow}>
                    <span style={styles.metaItem}>👨‍🏫 {featuredLecture.host_name || 'Instructor'}</span>
                    <span style={styles.metaItem}>🗓️ {featuredLecture.created_at ? new Date(featuredLecture.created_at).toLocaleDateString() : 'Active'}</span>
                  </div>
                </div>

                <div style={styles.featuredActions}>
                  <Button
                    onClick={() => handleOpenLecture(featuredLecture)}
                    variant={featuredLecture.status === 'LIVE' ? 'emerald' : 'primary'}
                    size="md"
                  >
                    {featuredLecture.status === 'LIVE' ? '🔴 Join Live Classroom →' : 'Open Workspace →'}
                  </Button>
                  <Button
                    onClick={() => navigate(`/lecture/${featuredLecture.id || featuredLecture.lectureId}/review`)}
                    variant="outline"
                    size="md"
                  >
                    Study Notes & Quizzes 📑
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Editorial Two-Column Split */}
        <div style={styles.splitLayout}>
          {/* Left Column: Quick Join & Lab Shortcut */}
          <aside style={styles.leftCol}>
            {/* Quick Access Card */}
            <div className="editorial-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="editorial-eyebrow">
                  <span className="eyebrow-num">⚡</span>
                  <span>JOIN A CLASSROOM</span>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  aria-label="Enter room code to join"
                  placeholder="8-char code (e.g. MATH101)"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    if (joinError) setJoinError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                  style={styles.sidebarInput}
                />
                <Button onClick={handleJoinByCode} variant="emerald" size="sm">
                  Join →
                </Button>
              </div>
              {joinError && <p style={{ color: '#f87171', fontSize: '12px', margin: 0 }}>⚠️ {joinError}</p>}
            </div>

            {/* Simulations Lab Card */}
            <div className="editorial-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="editorial-eyebrow">
                  <span className="eyebrow-num">🔬</span>
                  <span>VISUAL LAB</span>
                </span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                Interactive Simulations
              </h3>
              <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                Step through 3D distributed consensus clusters, AVL balance rotations, and neural feedforward propagation.
              </p>
              <Button onClick={() => navigate('/lab')} variant="outline" size="sm" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                Open Simulations Lab →
              </Button>
            </div>

            {/* Learning Overview */}
            <div className="editorial-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span className="editorial-eyebrow">
                <span className="eyebrow-num">📊</span>
                <span>LEARNING OVERVIEW</span>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Total Lectures:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#ffffff' }}>{lectures.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Active Live Broadcasts:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: liveCount > 0 ? '#f87171' : '#64748b' }}>{liveCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Study Notes Ready:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#34d399' }}>{completedCount}</span>
                </div>
              </div>

              {isTeacher && lectures.length > 0 && (
                <button
                  onClick={handleClearAllLectures}
                  style={styles.clearAllBtn}
                  title="Permanently remove all lecture history"
                >
                  🗑️ Clear All Lecture History
                </button>
              )}
            </div>
          </aside>

          {/* Right Column: Search, Filter & Content-Driven Lecture Feed */}
          <section style={styles.rightCol} aria-label="Lectures Catalog">
            {/* Control Bar: Search + Filter Chips */}
            <div style={styles.filterControlBar}>
              <div style={styles.searchContainer}>
                <span style={styles.searchIcon} aria-hidden="true">🔍</span>
                <input
                  type="search"
                  aria-label="Search lectures"
                  placeholder="Search by lecture title, topic, or instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.filterChipsRow}>
                {[
                  { id: 'ALL', label: `All (${lectures.length})` },
                  { id: 'LIVE', label: `🔴 Live (${liveCount})` },
                  { id: 'COMPLETED', label: `Study Ready (${completedCount})` },
                  { id: 'PUBLIC', label: 'Public' },
                  { id: 'PRIVATE', label: 'Private' },
                ].map((f) => {
                  const isActive = activeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isActive ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#38bdf8' : '#94a3b8',
                        transition: 'all 0.18s',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lecture Items List */}
            {loading ? (
              <div style={styles.loadingBox}>
                <div style={styles.spinner} aria-hidden="true" />
                <p style={{ color: '#94a3b8', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>Loading catalog sessions...</p>
              </div>
            ) : filteredLectures.length === 0 ? (
              <div className="editorial-card" style={styles.emptyCard}>
                <span style={{ fontSize: '36px' }}>📭</span>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                  {searchQuery || activeFilter !== 'ALL'
                    ? 'No lectures match your search filter'
                    : 'No lecture sessions recorded yet'}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '400px' }}>
                  {isTeacher
                    ? 'Host a session to start broadcasting live WebRTC video, subtitles, and notes.'
                    : 'Enter an 8-character room code on the left to join an active classroom.'}
                </p>
                {isTeacher && (
                  <Button onClick={() => setShowCreateModal(true)} variant="primary" size="sm" style={{ marginTop: '8px' }}>
                    Host First Session →
                  </Button>
                )}
              </div>
            ) : (
              <div style={styles.lectureList}>
                {filteredLectures.map((lec) => {
                  const lecId = lec.id || lec.lectureId;
                  const roomCode = lec.room_id || lec.roomId;
                  const isLive = lec.status === 'LIVE';

                  return (
                    <article
                      key={lecId}
                      className="editorial-card"
                      style={styles.lectureItem}
                      onClick={() => handleOpenLecture(lec)}
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenLecture(lec)}
                    >
                      <div style={styles.itemHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className={`bracket-tag ${isLive ? 'bracket-tag-amber' : 'bracket-tag-emerald'}`}>
                            {isLive ? '🔴 LIVE NOW' : '✅ COMPLETED'}
                          </span>
                          <span className="bracket-tag">[{lec.visibility || 'PUBLIC'}]</span>
                          {roomCode && (
                            <button
                              onClick={(e) => handleCopyCode(e, roomCode)}
                              style={styles.codePillBtn}
                              title="Click to copy room code"
                            >
                              <span>CODE: {roomCode}</span>
                              <span aria-hidden="true">{copiedCodeId === roomCode ? '✓' : '📋'}</span>
                            </button>
                          )}
                        </div>

                        {isTeacher && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(lecId);
                            }}
                            style={styles.deleteBtn}
                            title="Delete this lecture"
                            aria-label={`Delete ${lec.title}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div style={styles.itemContent}>
                        <h3 style={styles.itemTitle}>{lec.title}</h3>
                        <p style={styles.itemDesc}>
                          {lec.description || 'Multimodal university lecture session.'}
                        </p>

                        <div style={styles.metaRow}>
                          <span style={styles.metaItem}>👨‍🏫 {lec.host_name || 'Instructor'}</span>
                          <span style={styles.metaItem}>🗓️ {lec.created_at ? new Date(lec.created_at).toLocaleDateString() : 'Active'}</span>
                        </div>
                      </div>

                      {/* Action Pill Cluster */}
                      <div style={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                        <Button
                          onClick={() => handleOpenLecture(lec)}
                          variant={isLive ? 'emerald' : 'primary'}
                          size="sm"
                        >
                          {isLive ? '🔴 Join Live Room →' : 'Study Notes 📑'}
                        </Button>
                        <Button
                          onClick={() => navigate(`/lecture/${lecId}/review`)}
                          variant="outline"
                          size="sm"
                        >
                          Review Hub ↗
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div style={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className="editorial-card" style={styles.modalCard}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
                Confirm Session Deletion
              </h3>
              <p style={{ margin: '8px 0 16px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                Are you sure you want to delete this lecture? All transcripts, study notes, and whiteboard records will be permanently removed.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button onClick={() => setDeleteConfirm(null)} variant="secondary" size="sm">
                  Cancel
                </Button>
                <Button onClick={() => handleDeleteLecture(deleteConfirm)} variant="rose" size="sm">
                  Delete Permanently
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Host New Lecture Modal */}
        {showCreateModal && (
          <div style={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className="editorial-card" style={styles.modalCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="editorial-eyebrow">
                  <span className="eyebrow-num">01</span>
                  <span>—</span>
                  <span>NEW LECTURE BROADCAST</span>
                </span>
                <button onClick={() => setShowCreateModal(false)} style={styles.deleteBtn}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLecture} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={styles.fieldLabel}>Lecture Title *</label>
                  <input
                    required
                    placeholder="e.g. Distributed Systems: Raft Consensus"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>

                <div>
                  <label style={styles.fieldLabel}>Course Description / Syllabus Topics</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the topics covered in this lecture..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ ...styles.modalInput, height: 'auto', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={styles.fieldLabel}>Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    style={styles.modalInput}
                  >
                    <option value="PUBLIC">PUBLIC (All Students)</option>
                    <option value="PRIVATE">PRIVATE (Invited Only)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button onClick={() => setShowCreateModal(false)} variant="secondary" size="md" type="button">
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit" disabled={createLoading}>
                    {createLoading ? 'Initializing...' : 'Launch Live Classroom →'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#080c14',
    color: '#f8fafc',
    fontFamily: 'var(--font-body)',
    paddingBottom: '100px',
  },
  mainContent: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '32px 24px 60px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
  },
  heroRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '32px',
  },
  heroTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: 'clamp(2rem, 3.8vw, 2.75rem)',
    fontWeight: '900',
    letterSpacing: '-0.025em',
    color: '#ffffff',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  heroSubtitle: {
    fontSize: '1rem',
    fontWeight: '400',
    color: '#94a3b8',
    letterSpacing: 'normal',
    marginTop: '6px',
  },
  featuredSection: {
    marginBottom: '36px',
  },
  featuredCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
    borderLeft: '3px solid #38bdf8',
  },
  featuredHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  featuredBody: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
  },
  featuredTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.45rem',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 6px',
  },
  featuredDesc: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    margin: '0 0 10px',
    maxWidth: '640px',
    lineHeight: 1.5,
  },
  featuredActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)',
    gap: '28px',
    alignItems: 'flex-start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sidebarInput: {
    flex: 1,
    height: '38px',
    background: '#080c14',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#ffffff',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '0 10px',
    outline: 'none',
  },
  clearAllBtn: {
    background: 'transparent',
    border: '1px dashed rgba(248, 113, 113, 0.3)',
    color: '#f87171',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '6px',
    transition: 'all 0.18s ease',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  filterControlBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '13px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    height: '42px',
    paddingLeft: '38px',
    paddingRight: '14px',
    background: '#0d1424',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
  },
  filterChipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  lectureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  lectureItem: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codePillBtn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '6px',
    padding: '2px 8px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  itemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  itemTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
  },
  itemDesc: {
    fontSize: '0.88rem',
    color: '#94a3b8',
    lineHeight: 1.55,
    margin: 0,
  },
  metaRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  metaItem: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    color: '#64748b',
  },
  itemActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '6px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  loadingBox: {
    padding: '40px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyCard: {
    padding: '36px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    padding: '24px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    background: '#080c14',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
  },
};
