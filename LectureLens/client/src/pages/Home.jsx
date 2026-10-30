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
      <Navbar />

      {/* Main Container */}
      <main id="main-content" style={styles.mainWrapper}>
        {/* Academic Eyebrow Breadcrumb */}
        <div style={styles.heroEyebrowRow}>
          <div className="editorial-eyebrow">
            <span className="eyebrow-num">🎓</span>
            <span>ACADEMIC STUDY INTELLIGENCE</span>
          </div>
        </div>

        {/* Hero Section */}
        <section style={styles.heroSection}>
          <div style={styles.heroTextCol}>
            <h1 style={styles.heroTitle}>
              Understand Every Lecture
              <span style={styles.heroSubTitle}>With Total Clarity</span>
            </h1>

            <p style={styles.heroDescription}>
              Transform live classrooms and recordings into timestamp-verified study notes,
              interactive self-quizzes, and 3D visual simulations. Everything spoken, written,
              or demonstrated becomes an interactive study resource.
            </p>

            <div style={styles.metadataLinksRow}>
              <button onClick={() => navigate(user ? '/dashboard' : '/login')} style={styles.quickLinkBtn}>
                <span>{user ? 'MY WORKSPACE' : 'GET STARTED'}</span>
                <span aria-hidden="true">→</span>
              </button>
              <button onClick={() => navigate('/lab')} style={styles.quickLinkBtn}>
                <span>EXPLORE SIMULATIONS</span>
                <span aria-hidden="true">🔬</span>
              </button>
              <a href="#how-it-works" style={styles.quickLinkBtn}>
                <span>HOW IT WORKS</span>
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div style={styles.handwrittenNoteWrap}>
              <span className="handwritten-note">
                (handwritten chalkboard math turns into verified study notes & practice quizzes 📐)
              </span>
            </div>
          </div>

          {/* Quick Classroom Access Card */}
          <div style={styles.actionCardCol}>
            <div className="editorial-card" style={styles.actionCard}>
              <div style={styles.cardHeaderSmall}>
                <span className="editorial-eyebrow">
                  <span className="eyebrow-num">⚡</span>
                  <span>ENTER A CLASSROOM</span>
                </span>
                <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>Live Session</span>
              </div>

              <div style={styles.joinRow}>
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
                    style={styles.input}
                  />
                </div>
                <button
                  onClick={handleJoin}
                  style={styles.joinBtn}
                  aria-label="Join live classroom session"
                >
                  <span>Join Session</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              {error && <p style={styles.errorText}>⚠️ {error}</p>}

              <div style={styles.dividerRow}>
                <div style={styles.line} />
                <span className="editorial-eyebrow" style={{ fontSize: '10px' }}>FOR INSTRUCTORS</span>
                <div style={styles.line} />
              </div>

              <button onClick={handleStartHost} style={styles.hostBtn}>
                <span>Host & Broadcast a Live Lecture</span>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 02: How LectureLens Helps You Learn */}
        <section id="how-it-works" style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div className="editorial-eyebrow">
              <span className="eyebrow-num">01</span>
              <span>—</span>
              <span>HOW IT WORKS</span>
            </div>
            <h2 style={styles.sectionTitle}>From Spoken Words to Exam-Ready Notes</h2>
            <p style={styles.sectionSub}>
              LectureLens captures, transcribes, and organizes lecture material in real time so you can focus on learning.
            </p>
          </div>

          <div style={styles.featuresGrid}>
            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>STEP 01 · AUDIO</span>
                <span style={{ fontSize: '20px' }}>🎙️</span>
              </div>
              <h3 style={styles.featureTitle}>Synchronized Speech & Timestamps</h3>
              <p style={styles.featureDesc}>
                Continuous speech-to-text with clear speaker attribution. Click any transcript phrase to jump directly to that exact moment in the video.
              </p>
            </div>

            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>STEP 02 · VISION</span>
                <span style={{ fontSize: '20px' }}>📐</span>
              </div>
              <h3 style={styles.featureTitle}>Whiteboard & Formula Recognition</h3>
              <p style={styles.featureDesc}>
                Chalkboard derivations, coordinate graphs, and slide diagrams are automatically transcribed into clean mathematical notation.
              </p>
            </div>

            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b' }}>STEP 03 · SYNTHESIS</span>
                <span style={{ fontSize: '20px' }}>🧠</span>
              </div>
              <h3 style={styles.featureTitle}>Verified Notes, Quizzes & Flashcards</h3>
              <p style={styles.featureDesc}>
                Executive summaries, detailed study notes, active-recall flashcards, and self-grading quizzes are generated directly from the lecture material.
              </p>
            </div>

            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>STEP 04 · SIMULATION</span>
                <span style={{ fontSize: '20px' }}>🔬</span>
              </div>
              <h3 style={styles.featureTitle}>Interactive Visual Simulations</h3>
              <p style={styles.featureDesc}>
                Explore abstract topics—like distributed consensus, binary search trees, and neural networks—through interactive 3D and 2D models.
              </p>
            </div>
          </div>
        </section>

        {/* Section 03: Tailored for Students and Instructors */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div className="editorial-eyebrow">
              <span className="eyebrow-num">02</span>
              <span>—</span>
              <span>ACADEMIC COLLABORATION</span>
            </div>
            <h2 style={styles.sectionTitle}>Designed for Students and Instructors</h2>
            <p style={styles.sectionSub}>
              Everything you need for engaging live classes and deep post-lecture revision.
            </p>
          </div>

          <div style={styles.audienceGrid}>
            {/* For Students Card */}
            <div className="editorial-card" style={styles.audienceCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>🎓</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                  For Students
                </h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Never fall behind on complex coursework. Study at your own pace with verified materials.
              </p>
              <ul style={styles.benefitList}>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>1-Click Classroom Entry:</strong> Join any live lecture instantly with an 8-character code.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Searchable Transcripts:</strong> Search for any term and seek video playback directly to that timestamp.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Ask This Lecture:</strong> Ask natural questions and receive answers cited with exact lecture timestamps.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Active Recall:</strong> Test your understanding with auto-generated flashcards and self-grading quizzes.</span>
                </li>
              </ul>
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                style={{ ...styles.quickLinkBtn, alignSelf: 'flex-start', marginTop: '12px' }}
              >
                <span>Go to Student Workspace →</span>
              </button>
            </div>

            {/* For Instructors Card */}
            <div className="editorial-card" style={styles.audienceCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>👨‍🏫</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                  For Instructors
                </h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Focus entirely on teaching while LectureLens handles student notes and comprehension aids.
              </p>
              <ul style={styles.benefitList}>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Zero Setup Broadcast:</strong> Start HD video, screen sharing, and audio streams in seconds.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Chalkboard Digitization:</strong> Handwritten equations and diagrams are converted to math notation automatically.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Instant Class Resources:</strong> Provide students with structured notes, summaries, and PDFs right after class.</span>
                </li>
                <li style={styles.benefitItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span><strong>Adaptive Learning Tools:</strong> Complement your syllabus with interactive 3D simulations.</span>
                </li>
              </ul>
              <button
                onClick={handleStartHost}
                style={{ ...styles.quickLinkBtn, alignSelf: 'flex-start', marginTop: '12px' }}
              >
                <span>Host a Classroom Session →</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 04: Built for Academic Rigor */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div className="editorial-eyebrow">
              <span className="eyebrow-num">03</span>
              <span>—</span>
              <span>ACADEMIC RIGOR</span>
            </div>
            <h2 style={styles.sectionTitle}>Built for Truth, Speed, and Focus</h2>
            <p style={styles.sectionSub}>
              Designed to uphold academic integrity with verified citations and publication-quality exports.
            </p>
          </div>

          <div style={styles.featuresGrid}>
            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>INTEGRITY</span>
                <span style={{ fontSize: '20px' }}>🎯</span>
              </div>
              <h3 style={styles.featureTitle}>Timestamp-Grounded Citations</h3>
              <p style={styles.featureDesc}>
                AI answers strictly cite the exact second in the lecture recording. Unsupported questions trigger honest abstention rather than speculation.
              </p>
            </div>

            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>EXPORTABLE</span>
                <span style={{ fontSize: '20px' }}>📑</span>
              </div>
              <h3 style={styles.featureTitle}>Print-Ready Vector PDFs</h3>
              <p style={styles.featureDesc}>
                Download complete lecture study notes, mathematical formulas, and diagrams as clean vector PDFs with zero trailing blank pages.
              </p>
            </div>

            <div className="editorial-card" style={styles.featureBox}>
              <div style={styles.cardHeaderRow}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b' }}>ACCESSIBLE</span>
                <span style={{ fontSize: '20px' }}>⚡</span>
              </div>
              <h3 style={styles.featureTitle}>Zero Installation Required</h3>
              <p style={styles.featureDesc}>
                Runs directly in any modern web browser on laptops, tablets, and phones. Fast, responsive, and distraction-free.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerContent}>
            <div>
              <span style={{ fontWeight: '800', color: '#ffffff', fontSize: '15px' }}>LectureLens</span>
              <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '10px' }}>
                AI Multimodal Classroom & Study Workspace
              </span>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/lab')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                Simulations
              </button>
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                {user ? 'My Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--color-bg-base)',
    color: 'var(--color-text-primary)',
    display: 'flex',
    flexDirection: 'column',
  },
  mainWrapper: {
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 20px 80px',
    flex: 1,
  },
  heroEyebrowRow: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '40px',
    alignItems: 'center',
    marginBottom: '80px',
  },
  heroTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  heroTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: 'clamp(2.4rem, 4.5vw, 3.6rem)',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
    color: '#ffffff',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  heroSubTitle: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
    letterSpacing: '-0.02em',
    marginTop: '4px',
  },
  heroDescription: {
    fontSize: '1.05rem',
    lineHeight: 1.65,
    color: '#94a3b8',
    maxWidth: '540px',
    margin: 0,
  },
  metadataLinksRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  },
  quickLinkBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#f8fafc',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
    transition: 'all 0.18s ease',
  },
  handwrittenNoteWrap: {
    marginTop: '6px',
  },
  actionCardCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  cardHeaderSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  joinRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  inputContainer: {
    flex: '1 1 200px',
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
    paddingRight: '12px',
    height: '46px',
    background: '#080c14',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '10px',
    color: '#ffffff',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
  },
  joinBtn: {
    height: '46px',
    padding: '0 20px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontFamily: 'var(--font-body)',
    fontWeight: '700',
    fontSize: '13.5px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.18s ease',
  },
  errorText: {
    color: '#f87171',
    fontSize: '12px',
    fontWeight: '600',
    margin: 0,
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  line: {
    flex: 1,
    height: '1px',
    background: 'rgba(255, 255, 255, 0.08)',
  },
  hostBtn: {
    height: '46px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '10px',
    color: '#ffffff',
    fontFamily: 'var(--font-body)',
    fontWeight: '700',
    fontSize: '13.5px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.18s ease',
  },
  sectionBlock: {
    marginBottom: '80px',
  },
  sectionHeader: {
    marginBottom: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: '#ffffff',
    margin: 0,
  },
  sectionSub: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    margin: 0,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
  },
  featureBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
  },
  featureDesc: {
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: '#94a3b8',
    margin: 0,
    flex: 1,
  },
  audienceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  audienceCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '28px',
  },
  benefitList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '0.88rem',
    lineHeight: 1.5,
    color: '#cbd5e1',
  },
  checkIcon: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: '14px',
    marginTop: '1px',
    flexShrink: 0,
  },
  footer: {
    paddingTop: '40px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footerContent: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
};
