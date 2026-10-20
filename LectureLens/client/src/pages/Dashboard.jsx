import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, lectureApi } from '../services/api';

/* ─── Inject responsive CSS once ─── */
const RESPONSIVE_CSS = `
  @media (max-width: 640px) {
    .dash-nav { padding: 10px 14px !important; flex-wrap: wrap; gap: 8px; }
    .dash-badge { display: none !important; }
    .dash-main { padding: 16px 12px !important; }
    .dash-hero { padding: 20px 16px !important; }
    .dash-hero-title { font-size: 20px !important; }
    .dash-hero-subtitle { font-size: 12px !important; }
    .dash-hero-actions { flex-direction: column !important; align-items: stretch !important; }
    .dash-join-box { flex-direction: column !important; }
    .dash-join-input { width: 100% !important; }
    .dash-join-btn { width: 100% !important; padding: 12px !important; font-size: 14px !important; }
    .dash-create-btn { width: 100% !important; padding: 12px !important; font-size: 14px !important; text-align: center; }
    .dash-section-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
    .dash-section-btns { align-self: flex-end; }
    .dash-grid { grid-template-columns: 1fr !important; }
    .dash-card-actions { flex-direction: column !important; }
    .dash-card-actions button { width: 100% !important; padding: 10px !important; font-size: 13px !important; }
    .dash-modal { padding: 20px 14px !important; }
    .dash-modal-btns { flex-direction: column !important; gap: 8px !important; }
    .dash-modal-btns button { width: 100% !important; padding: 10px !important; }
    .dash-user-info { display: none !important; }
    .dash-logout { font-size: 13px !important; padding: 8px 14px !important; }
  }
  @media (max-width: 900px) {
    .dash-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important; }
  }
  .dash-card:hover { border-color: #38bdf866 !important; box-shadow: 0 0 0 1px #38bdf822; transform: translateY(-1px); transition: all 0.15s ease; }
  .dash-open-btn:hover { opacity: 0.88; }
  .dash-delete-btn:hover { color: #ef4444 !important; background: #ef444415 !important; }
  .dash-refresh-btn:hover { background: #3f3f46 !important; color: #e4e4e7 !important; }
  .dash-clear-btn:hover { background: #ef444433 !important; }
`;

function injectCSS() {
  if (document.getElementById('dash-responsive-css')) return;
  const el = document.createElement('style');
  el.id = 'dash-responsive-css';
  el.textContent = RESPONSIVE_CSS;
  document.head.appendChild(el);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(authApi.getCurrentUser());
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // lectureId to confirm delete

  // Create lecture modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    injectCSS();
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

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(code);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleClearAllLectures = async () => {
    if (!window.confirm('Are you sure you want to delete ALL lecture history? This will permanently remove all sessions, transcripts, notes, and recordings.')) return;
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
      const newLec = await lectureApi.createLecture({ title, description, visibility });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      const targetRoomId = newLec?.roomId || newLec?.room_id;
      if (!targetRoomId) throw new Error('Server did not return a valid Room Code');
      navigate(`/room/${targetRoomId}?role=host`);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        alert('Your instructor session has expired. Please sign in again.');
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
    if (!code) return setJoinError('Please enter the room code');
    if (code.length < 4) return setJoinError('Code is too short');
    const matched = lectures.find((l) => (l.room_id || l.roomId) === code);
    if (matched && (matched.status === 'ENDED' || matched.status === 'COMPLETED')) {
      navigate(`/lecture/${matched.id || matched.lectureId}/review`);
      return;
    }
    navigate(`/room/${code}?role=participant`);
  };

  /** Open lecture card based on its status */
  const handleOpenLecture = (lec) => {
    const lecId = lec.id || lec.lectureId;
    const roomCode = lec.room_id || lec.roomId;
    if (lec.status === 'ENDED' || lec.status === 'COMPLETED') {
      navigate(`/lecture/${lecId}/review`);
    } else if (lec.status === 'LIVE') {
      navigate(`/room/${roomCode}?role=${isTeacher ? 'host' : 'participant'}`);
    } else {
      // SCHEDULED or default
      if (isTeacher) {
        navigate(`/room/${roomCode}?role=host`);
      } else {
        navigate(`/lecture/${lecId}/review`);
      }
    }
  };

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const statusLabel = (s) => {
    if (s === 'LIVE') return { text: '🔴 LIVE', bg: '#ef444433', color: '#f87171' };
    if (s === 'ENDED' || s === 'COMPLETED') return { text: '✅ DONE', bg: '#10b98133', color: '#34d399' };
    return { text: '⏳ SCHEDULED', bg: '#64748b33', color: '#94a3b8' };
  };

  return (
    <div style={S.container}>
      {/* ── Navbar ── */}
      <nav style={S.nav} className="dash-nav">
        <div style={S.navBrand}>
          <span style={S.logo}>🎓 LectureLens</span>
          <span style={S.badge} className="dash-badge">Multimodal AI Platform</span>
        </div>
        <div style={S.navUser}>
          <div style={S.userInfo} className="dash-user-info">
            <span style={S.userName}>{user?.name || 'Guest'}</span>
            <span style={roleTagStyle(user?.role)}>{user?.role || 'STUDENT'}</span>
          </div>
          <button onClick={handleLogout} style={S.logoutBtn} className="dash-logout">
            Logout
          </button>
        </div>
      </nav>

      <main style={S.main} className="dash-main">
        {/* ── Hero Card ── */}
        <div style={S.heroCard} className="dash-hero">
          <div>
            <h1 style={S.heroTitle} className="dash-hero-title">Interactive Multimodal Lectures</h1>
            <p style={S.heroSubtitle} className="dash-hero-subtitle">
              Live WebRTC video · Speech-to-text · Whiteboard AI · Gemini Study synthesis
            </p>
          </div>

          <div style={S.heroActions} className="dash-hero-actions">
            {isTeacher && (
              <button onClick={() => setShowCreateModal(true)} style={S.createBtn} className="dash-create-btn">
                ➕ Create &amp; Start Lecture
              </button>
            )}
            <div style={S.joinBox} className="dash-join-box">
              <input
                placeholder="Enter Room Code to join"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value); setJoinError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                style={S.joinInput}
                className="dash-join-input"
              />
              <button onClick={handleJoinByCode} style={S.joinBtn} className="dash-join-btn">
                Join Room
              </button>
            </div>
            {joinError && <span style={S.errorText}>{joinError}</span>}
          </div>
        </div>

        {/* ── Section Header ── */}
        <div style={S.sectionHeader} className="dash-section-header">
          <h2 style={S.sectionTitle}>📚 Lecture History &amp; Sessions</h2>
          <div style={{ display: 'flex', gap: '8px' }} className="dash-section-btns">
            <button onClick={fetchLectures} style={S.refreshBtn} className="dash-refresh-btn">🔄 Refresh</button>
            {isTeacher && lectures.length > 0 && (
              <button onClick={handleClearAllLectures} style={S.clearBtn} className="dash-clear-btn">🗑️ Clear All</button>
            )}
          </div>
        </div>

        {/* ── Lecture Grid ── */}
        {loading ? (
          <div style={S.loading}>Loading lectures…</div>
        ) : lectures.length === 0 ? (
          <div style={S.emptyState}>
            <span style={{ fontSize: '40px' }}>📭</span>
            <p style={{ margin: 0 }}>No lectures recorded yet.</p>
            {isTeacher && (
              <button onClick={() => setShowCreateModal(true)} style={S.createBtn}>
                Host your first lecture
              </button>
            )}
          </div>
        ) : (
          <div style={S.grid} className="dash-grid">
            {lectures.map((lec) => {
              const lecId = lec.id || lec.lectureId;
              const roomCode = lec.room_id || lec.roomId;
              const status = statusLabel(lec.status);
              const isLive = lec.status === 'LIVE';
              const isDone = lec.status === 'ENDED' || lec.status === 'COMPLETED';

              return (
                <div
                  key={lecId}
                  style={S.card}
                  className="dash-card"
                  onClick={() => handleOpenLecture(lec)}
                  title={isDone ? 'Open AI Notes & Review' : isLive ? 'Join live lecture' : 'Open lecture'}
                >
                  {/* Card Top: status + delete */}
                  <div style={S.cardTop}>
                    <span style={{ ...S.statusPill, background: status.bg, color: status.color }}>
                      {status.text}
                    </span>
                    {isTeacher && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(lecId); }}
                        style={S.deleteBtn}
                        className="dash-delete-btn"
                        title="Delete lecture"
                        aria-label="Delete lecture"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Title & Desc */}
                  <h3 style={S.cardTitle}>{lec.title}</h3>
                  <p style={S.cardDesc}>{lec.description || 'Multimodal university lecture session.'}</p>

                  {/* Meta */}
                  <div style={S.metaRow}>
                    <span>👨‍🏫 {lec.host_name || 'Instructor'}</span>
                    <span>🗓️ {new Date(lec.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Room Code row (only for non-done) */}
                  {!isDone && roomCode && (
                    <div style={S.codeRow} onClick={(e) => e.stopPropagation()}>
                      <span style={S.codeBadge}>CODE: {roomCode}</span>
                      <button
                        onClick={(e) => handleCopyCode(e, roomCode)}
                        style={S.copyBtn}
                        title="Copy room code"
                      >
                        {copiedCodeId === roomCode ? '✓ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={S.actionRow} className="dash-card-actions" onClick={(e) => e.stopPropagation()}>
                    {isLive ? (
                      <>
                        <button
                          onClick={() => navigate(`/room/${roomCode}?role=${isTeacher ? 'host' : 'participant'}`)}
                          style={S.liveBtn}
                        >
                          🔴 {isTeacher ? 'Return to Room' : 'Join Live'}
                        </button>
                        <button
                          onClick={() => navigate(`/lecture/${lecId}/review`)}
                          style={S.reviewBtn}
                        >
                          📖 AI Notes
                        </button>
                      </>
                    ) : isDone ? (
                      <>
                        <button
                          onClick={() => navigate(`/lecture/${lecId}/review`)}
                          style={S.reviewHighlightBtn}
                        >
                          📖 Open AI Notes &amp; Review
                        </button>
                        {isTeacher && (
                          <button
                            onClick={() => navigate(`/room/${roomCode}?role=host`)}
                            style={S.reopenBtn}
                            title="Reopen as host"
                          >
                            🔁 Reopen
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {isTeacher ? (
                          <button
                            onClick={() => navigate(`/room/${roomCode}?role=host`)}
                            style={S.startBtn}
                          >
                            ▶️ Start Lecture
                          </button>
                        ) : (
                          <span style={S.scheduledLabel}>⏳ Not started yet</span>
                        )}
                        <button
                          onClick={() => navigate(`/lecture/${lecId}/review`)}
                          style={S.reviewBtn}
                        >
                          📖 Overview
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create Lecture Modal ── */}
      {showCreateModal && (
        <div style={S.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={S.modal} className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={S.modalTitle}>Host a New Lecture</h3>
              <button onClick={() => setShowCreateModal(false)} style={S.modalCloseBtn}>✕</button>
            </div>
            <form onSubmit={handleCreateLecture} style={S.modalForm}>
              <label style={S.label}>Lecture Title *</label>
              <input
                placeholder="e.g. Distributed Systems & Consensus"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={S.input}
                required
                autoFocus
              />
              <label style={S.label}>Description / Syllabus</label>
              <textarea
                placeholder="Overview of topics, proofs, demos..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={S.textarea}
                rows={3}
              />
              <label style={S.label}>Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={S.select}>
                <option value="PUBLIC">Public – Any student can join</option>
                <option value="PRIVATE">Private – Restricted access</option>
              </select>
              <div style={S.modalBtns} className="dash-modal-btns">
                <button type="button" onClick={() => setShowCreateModal(false)} style={S.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={createLoading} style={S.submitBtn}>
                  {createLoading ? 'Starting…' : '🚀 Start Live Lecture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div style={S.modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...S.modal, maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ ...S.modalTitle, textAlign: 'center', marginBottom: '8px' }}>Delete Lecture?</h3>
            <p style={{ fontSize: '13px', color: '#a1a1aa', textAlign: 'center', marginBottom: '20px' }}>
              This will permanently remove the session, transcript, notes, and all related data.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...S.cancelBtn, flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLecture(deleteConfirm)}
                style={{ ...S.submitBtn, flex: 1, background: '#dc2626' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Role tag style helper ── */
function roleTagStyle(role) {
  return {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    background: role === 'TEACHER' ? '#3b82f633' : role === 'ADMIN' ? '#f59e0b33' : '#10b98133',
    color: role === 'TEACHER' ? '#60a5fa' : role === 'ADMIN' ? '#fbbf24' : '#34d399',
  };
}

/* ── Styles ── */
const S = {
  container: { minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, sans-serif' },

  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 28px', background: '#18181b', borderBottom: '1px solid #27272a',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { fontSize: '20px', fontWeight: '800', color: '#38bdf8' },
  badge: {
    fontSize: '11px', background: '#0284c733', color: '#38bdf8',
    padding: '3px 8px', borderRadius: '999px', border: '1px solid #0284c766',
  },
  navUser: { display: 'flex', alignItems: 'center', gap: '12px' },
  userInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  userName: { fontSize: '14px', fontWeight: '600', color: '#fff' },
  logoutBtn: {
    background: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa',
    padding: '7px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
    minHeight: '36px',
  },

  main: { maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' },

  heroCard: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
    border: '1px solid #312e81', borderRadius: '16px',
    padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px',
  },
  heroTitle: { fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '6px', margin: '0 0 6px' },
  heroSubtitle: { fontSize: '14px', color: '#cbd5e1', maxWidth: '680px', lineHeight: 1.6, margin: 0 },
  heroActions: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  createBtn: {
    background: '#3b82f6', color: '#fff', border: 'none',
    padding: '11px 22px', borderRadius: '8px', fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', minHeight: '44px',
  },
  joinBox: { display: 'flex', gap: '8px' },
  joinInput: {
    background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
    padding: '10px 14px', color: '#fff', fontSize: '14px', width: '200px', outline: 'none',
    minHeight: '44px',
  },
  joinBtn: {
    background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 18px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', minHeight: '44px',
  },
  errorText: { color: '#f87171', fontSize: '12px', display: 'block', width: '100%', marginTop: '-4px' },

  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 },
  refreshBtn: {
    background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46',
    borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', minHeight: '36px',
  },
  clearBtn: {
    background: '#ef444422', color: '#f87171', border: '1px solid #ef444455',
    borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', minHeight: '36px',
  },

  loading: { textAlign: 'center', color: '#71717a', padding: '60px', fontSize: '15px' },
  emptyState: {
    textAlign: 'center', padding: '60px 20px', background: '#18181b',
    borderRadius: '12px', border: '1px dashed #27272a', color: '#71717a',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' },

  card: {
    background: '#18181b', border: '1px solid #27272a', borderRadius: '14px',
    padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px',
    cursor: 'pointer', transition: 'all 0.15s ease', position: 'relative',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px' },
  deleteBtn: {
    background: 'transparent', color: '#52525b', border: 'none',
    fontSize: '14px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
    minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#fff', lineHeight: 1.4, margin: 0 },
  cardDesc: { fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5, flex: 1, margin: 0 },
  metaRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#71717a',
    borderTop: '1px solid #27272a', paddingTop: '8px',
  },
  codeRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  codeBadge: {
    fontFamily: 'monospace', fontSize: '12px', background: '#27272a',
    padding: '3px 10px', borderRadius: '4px', color: '#38bdf8', letterSpacing: '1px',
  },
  copyBtn: {
    background: '#27272a', color: '#38bdf8', border: '1px solid #38bdf855',
    borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
  },

  actionRow: { display: 'flex', gap: '8px', marginTop: '2px' },
  liveBtn: {
    flex: 2, background: '#dc2626', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '40px',
  },
  startBtn: {
    flex: 2, background: '#16a34a', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '40px',
  },
  reviewHighlightBtn: {
    flex: 3, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', minHeight: '40px',
  },
  reviewBtn: {
    flex: 1, background: '#0284c7', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '40px',
  },
  reopenBtn: {
    flex: 1, background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46',
    borderRadius: '8px', padding: '9px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    textAlign: 'center', minHeight: '40px',
  },
  scheduledLabel: { flex: 1, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center' },

  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px',
  },
  modal: {
    background: '#18181b', border: '1px solid #27272a',
    borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px',
  },
  modalTitle: { fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 },
  modalCloseBtn: {
    background: 'transparent', border: 'none', color: '#71717a',
    fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
  },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#a1a1aa', marginBottom: '-4px' },
  input: {
    background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px',
    padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', minHeight: '42px',
  },
  textarea: {
    background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px',
    padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical',
  },
  select: {
    background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px',
    padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', minHeight: '42px',
  },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' },
  cancelBtn: {
    background: 'transparent', border: '1px solid #3f3f46', color: '#a1a1aa',
    borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer', minHeight: '40px',
  },
  submitBtn: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700',
    cursor: 'pointer', minHeight: '40px',
  },
};
