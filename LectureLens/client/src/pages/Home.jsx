import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import Navbar from '../components/Navbar';

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const user = authApi.getCurrentUser();

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError('Please enter an 8-character room code');
    navigate(`/room/${code}?role=participant`);
  };

  const handleStartHost = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Reusable Responsive Navigation */}
      <Navbar
        customRightAction={
          <div style={styles.systemStatusPill} aria-label="System status: SFU Media Engine Ready">
            <span style={styles.statusDot} aria-hidden="true"></span>
            <span>SFU Media Engine Ready</span>
          </div>
        }
      />

      {/* Hero Section */}
      <main id="main-content" style={styles.hero}>
        <div style={styles.badgeWrap}>
          <span style={styles.badgePulse}></span>
          <span style={styles.badgeText}>Next-Generation Educational Intelligence & SFU Streaming</span>
        </div>

        <h1 style={styles.heroHeading}>
          Where Live Lectures Become <br />
          <span style={styles.gradientText}>Structured Study Intelligence</span>
        </h1>

        <p style={styles.heroSub}>
          Conduct live interactive classrooms with low-latency WebRTC media, screen sharing, and continuous speech transcription. 
          LectureLens automatically transforms spoken words, whiteboard math equations, and slide diagrams into 
          verifiable study notes, interactive quizzes, and lecture-grounded RAG Q&A.
        </p>

        {/* Quick Join / Host Card */}
        <div style={styles.actionCard}>
          <div style={styles.cardHeaderSmall}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ Instant Classroom Access
            </span>
          </div>

          <div className="home-join-row" style={styles.joinRow}>
            <div style={styles.inputContainer}>
              <span style={styles.inputIcon} aria-hidden="true">🔑</span>
              <input
                aria-label="Enter 8-digit room code"
                placeholder="Enter 8-digit Room Code (e.g. MATH101)"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                style={{ ...styles.input, minHeight: '44px' }}
              />
            </div>
            <button
              onClick={handleJoin}
              className="home-join-btn"
              style={{ ...styles.joinBtn, minHeight: '44px' }}
              aria-label="Join live classroom session"
            >
              Join Live Class →
            </button>
          </div>
          {error && <p style={styles.errorText}>⚠️ {error}</p>}

          <div style={styles.dividerRow}>
            <div style={styles.line} />
            <span style={styles.orText}>INSTRUCTOR CONTROLS</span>
            <div style={styles.line} />
          </div>

          <button onClick={handleStartHost} style={styles.hostBtn}>
            <span>👨‍🏫</span>
            <span>Host & Broadcast a Lecture Session</span>
          </button>
        </div>

        {/* 4 Feature Pillars Grid */}
        <div style={styles.featuresSection}>
          <div style={styles.featuresHeader}>
            <h2 style={styles.sectionTitle}>Four Autonomous Intelligence Pillars</h2>
            <p style={styles.sectionSub}>Everything that happens on screen or in voice is captured, verified, and synthesized.</p>
          </div>

          <div style={styles.featuresGrid}>
            <div style={styles.featureBox}>
              <div style={styles.iconCircle('#0284c7')}>🎙️</div>
              <h3 style={styles.featureTitle}>Speech Recognition & Subtitles</h3>
              <p style={styles.featureDesc}>
                Continuous speech recognition with instantaneous multi-language subtitle translation (Spanish, Hindi, French, German).
              </p>
              <div style={styles.pillTag}>Real-Time WebSocket Stream</div>
            </div>

            <div style={styles.featureBox}>
              <div style={styles.iconCircle('#059669')}>📐</div>
              <h3 style={styles.featureTitle}>Whiteboard Vision & LaTeX OCR</h3>
              <p style={styles.featureDesc}>
                Gemini Vision extracts handwritten formulas into KaTeX LaTeX and isolates architectural diagrams with 8% boundary padding.
              </p>
              <div style={styles.pillTag}>High-Res Frame Sampling</div>
            </div>

            <div style={styles.featureBox}>
              <div style={styles.iconCircle('#6366f1')}>🧠</div>
              <h3 style={styles.featureTitle}>SALKG Knowledge Graph</h3>
              <p style={styles.featureDesc}>
                Subject-adaptive multimodal alignment connects spoken voice to whiteboard equations, mapping conceptual prerequisites.
              </p>
              <div style={styles.pillTag}>DAG Dependency Mapping</div>
            </div>

            <div style={styles.featureBox}>
              <div style={styles.iconCircle('#d97706')}>🛡️</div>
              <h3 style={styles.featureTitle}>SALKG-Guard Hallucination Filter</h3>
              <p style={styles.featureDesc}>
                Dual-axis validator cross-checks all notes, quizzes, and RAG answers against lecture evidence and domain ontology before display.
              </p>
              <div style={styles.pillTag}>Dual-Axis Verification</div>
            </div>
          </div>
        </div>

        {/* Technical Architecture Badge Footer */}
        <div style={styles.techBanner}>
          <span style={styles.techBannerTitle}>BUILT WITH MODERN FULL-STACK ARCHITECTURE:</span>
          <div style={styles.techPills}>
            <span style={styles.techPill}>Mediasoup SFU (WebRTC)</span>
            <span style={styles.techPill}>React 18 + Vite</span>
            <span style={styles.techPill}>Node.js + Socket.IO</span>
            <span style={styles.techPill}>Gemini 1.5 Flash Vision</span>
            <span style={styles.techPill}>KaTeX Math Notation</span>
            <span style={styles.techPill}>PDFKit Vector Engine</span>
            <span style={styles.techPill}>Python SALKG Research Engine</span>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflowX: 'hidden',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 36px',
    background: 'rgba(9, 13, 22, 0.75)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
  },
  brandLogo: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    display: 'block',
  },
  brandSub: {
    fontSize: '11px',
    color: '#38bdf8',
    fontWeight: '600',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  systemStatusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '9999px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#34d399',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  dashBtn: {
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '9px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  loginBtn: {
    color: '#cbd5e1',
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'color 0.2s',
  },
  registerBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  hero: {
    flex: 1,
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '60px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badgeWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    padding: '6px 16px',
    borderRadius: '9999px',
    marginBottom: '24px',
  },
  badgePulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#38bdf8',
    boxShadow: '0 0 10px #38bdf8',
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.02em',
  },
  heroHeading: {
    fontSize: '48px',
    fontWeight: '900',
    lineHeight: 1.18,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    marginBottom: '20px',
    maxWidth: '920px',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
  },
  heroSub: {
    fontSize: '16px',
    lineHeight: 1.65,
    color: '#94a3b8',
    maxWidth: '760px',
    marginBottom: '40px',
  },
  actionCard: {
    background: 'rgba(19, 27, 46, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '18px',
    padding: '28px',
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1)',
    marginBottom: '64px',
  },
  cardHeaderSmall: {
    textAlign: 'left',
    marginBottom: '-4px',
  },
  joinRow: {
    display: 'flex',
    gap: '10px',
  },
  inputContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '14px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    paddingLeft: '38px',
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '13.5px',
    fontWeight: '600',
  },
  joinBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
  },
  errorText: {
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '600',
    margin: '-4px 0 0',
    textAlign: 'left',
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '4px 0',
  },
  line: {
    flex: 1,
    height: '1px',
    background: 'rgba(255, 255, 255, 0.08)',
  },
  orText: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: '0.06em',
  },
  hostBtn: {
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
  },
  featuresSection: {
    width: '100%',
    marginBottom: '60px',
  },
  featuresHeader: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    marginBottom: '8px',
  },
  sectionSub: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '24px',
    width: '100%',
    textAlign: 'left',
  },
  featureBox: {
    background: 'rgba(19, 27, 46, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  iconCircle: (color) => ({
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: `${color}22`,
    border: `1px solid ${color}55`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    marginBottom: '4px',
  }),
  featureTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  featureDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.55,
    margin: 0,
    flex: 1,
  },
  pillTag: {
    alignSelf: 'flex-start',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '9999px',
    padding: '3px 10px',
    fontSize: '10.5px',
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: '6px',
  },
  techBanner: {
    width: '100%',
    padding: '24px',
    borderRadius: '16px',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  techBannerTitle: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.08em',
  },
  techPills: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
  },
  techPill: {
    background: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#93c5fd',
  },
};
