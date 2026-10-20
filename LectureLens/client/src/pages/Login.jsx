import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import Navbar from '../components/Navbar';
import Button from '../components/Button';

/**
 * Premium, accessible Login page with desktop split-panel and mobile-first responsive layout.
 * Enforces strict credential privacy, visible focus states, and 44px minimum touch targets.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email address and password are required.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await authApi.login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      const serverMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMessage || 'Unable to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <main id="main-content" style={styles.mainWrapper}>
        <div style={styles.authLayout} className="auth-split-layout">
          {/* Left Showcase Panel (Visible on Desktop/Tablet) */}
          <div style={styles.showcasePanel} className="auth-showcase-panel">
            <div style={styles.showcaseBadge}>
              <span style={styles.pulseDot} aria-hidden="true"></span>
              <span>AI-Assisted Lecture Platform</span>
            </div>

            <h1 style={styles.showcaseTitle}>
              Turn live classroom dialogue into <br />
              <span className="gradient-text">verifiable knowledge</span>
            </h1>

            <p style={styles.showcaseDesc}>
              LectureLens continuously aligns spoken audio, handwritten whiteboard equations, and slide diagrams
              into structured study notes, spaced-repetition flashcards, and grounded RAG citations.
            </p>

            <div style={styles.featurePillList}>
              <div style={styles.featurePillItem}>
                <span style={styles.featurePillIcon} aria-hidden="true">🎙️</span>
                <span>Low-latency WebRTC SFU streaming & real-time subtitles</span>
              </div>
              <div style={styles.featurePillItem}>
                <span style={styles.featurePillIcon} aria-hidden="true">📐</span>
                <span>Whiteboard OCR with KaTeX LaTeX formula rendering</span>
              </div>
              <div style={styles.featurePillItem}>
                <span style={styles.featurePillIcon} aria-hidden="true">🛡️</span>
                <span>Dual-axis SALKG-Guard hallucination prevention</span>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div style={styles.formCard} className="glass-panel-elevated">
            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>Sign In</h2>
              <p style={styles.formSubtitle}>Access your classroom sessions and study materials</p>
            </div>

            {error && (
              <div style={styles.errorAlert} role="alert" aria-live="polite">
                <span style={{ fontSize: '16px' }} aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={styles.form} noValidate>
              <div style={styles.fieldGroup}>
                <label htmlFor="login-email" style={styles.label}>
                  Email Address <span style={styles.requiredStar}>*</span>
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  style={styles.input}
                  disabled={loading}
                />
              </div>

              <div style={styles.fieldGroup}>
                <div style={styles.labelRow}>
                  <label htmlFor="login-password" style={styles.label}>
                    Password <span style={styles.requiredStar}>*</span>
                  </label>
                </div>
                <div style={styles.passwordInputWrap}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    style={{ ...styles.input, paddingRight: '48px' }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeToggleBtn}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading}
                style={{ width: '100%', marginTop: '6px' }}
              >
                {loading ? 'Signing In…' : 'Sign In to Account'}
              </Button>
            </form>

            <div style={styles.footerRow}>
              <span style={{ color: '#94a3b8', fontSize: '13.5px' }}>Don't have an account?</span>{' '}
              <Link to="/register" style={styles.footerLink}>
                Register here
              </Link>
            </div>
          </div>
        </div>
      </main>
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
  mainWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px 48px',
  },
  authLayout: {
    width: '100%',
    maxWidth: '1000px',
    display: 'flex',
    alignItems: 'stretch',
    gap: '36px',
    margin: '0 auto',
  },
  showcasePanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '32px 24px',
  },
  showcaseBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '9999px',
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: '20px',
  },
  pulseDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#38bdf8',
    boxShadow: '0 0 8px #38bdf8',
  },
  showcaseTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
    marginBottom: '16px',
  },
  showcaseDesc: {
    fontSize: '15px',
    color: '#94a3b8',
    lineHeight: 1.6,
    marginBottom: '28px',
  },
  featurePillList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  featurePillItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '13.5px',
    color: '#e2e8f0',
    fontWeight: '500',
  },
  featurePillIcon: {
    fontSize: '18px',
  },
  formCard: {
    width: '100%',
    maxWidth: '440px',
    borderRadius: '18px',
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  formHeader: {
    marginBottom: '24px',
  },
  formTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  formSubtitle: {
    fontSize: '13.5px',
    color: '#94a3b8',
    margin: 0,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#fca5a5',
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    lineHeight: 1.45,
    marginBottom: '18px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#ffffff',
    fontSize: '14px',
    minHeight: '44px',
    outline: 'none',
    transition: 'border-color 0.18s, box-shadow 0.18s',
  },
  passwordInputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  eyeToggleBtn: {
    position: 'absolute',
    right: '6px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    borderRadius: '6px',
    boxShadow: 'none',
  },
  footerRow: {
    marginTop: '24px',
    textAlign: 'center',
    paddingTop: '18px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footerLink: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: '13.5px',
    textDecoration: 'none',
    marginLeft: '4px',
  },
};
