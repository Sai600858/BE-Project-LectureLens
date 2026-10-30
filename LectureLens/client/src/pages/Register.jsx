import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import Navbar from '../components/Navbar';
import Button from '../components/Button';

/**
 * Premium, accessible Register page with split-panel desktop layout,
 * mobile-first responsive cards, password toggle, and strict RBAC role restriction.
 */
export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await authApi.register(name.trim(), email.trim(), password, role);
      navigate('/dashboard');
    } catch (err) {
      const serverMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMessage || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <main id="main-content" style={styles.mainWrapper}>
        <div style={styles.authLayout} className="auth-split-layout">
          {/* Left Showcase Panel */}
          <div style={styles.showcasePanel} className="auth-showcase-panel">
            <div style={styles.showcaseBadge}>
              <span style={styles.pulseDot} aria-hidden="true"></span>
              <span>Join LectureLens Community</span>
            </div>

            <h1 style={styles.showcaseTitle}>
              Experience the future of <br />
              <span className="gradient-text">multimodal learning</span>
            </h1>

            <p style={styles.showcaseDesc}>
              Whether hosting university classrooms or studying complex scientific disciplines,
              LectureLens delivers real-time voice transcription, automated KaTeX notes, and interactive quiz generation.
            </p>

            <div style={styles.roleSummaryCards}>
              <div
                style={{
                  ...styles.roleSummaryCard,
                  borderColor: role === 'STUDENT' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={styles.roleCardHeader}>
                  <span style={{ fontSize: '20px' }} aria-hidden="true">👩‍🎓</span>
                  <strong style={{ color: '#ffffff' }}>Student Account</strong>
                </div>
                <p style={styles.roleCardText}>
                  Join live WebRTC classrooms, generate personalized spaced-repetition flashcards, and query the lecture RAG engine.
                </p>
              </div>

              <div
                style={{
                  ...styles.roleSummaryCard,
                  borderColor: role === 'TEACHER' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={styles.roleCardHeader}>
                  <span style={{ fontSize: '20px' }} aria-hidden="true">👨‍🏫</span>
                  <strong style={{ color: '#ffffff' }}>Instructor Account</strong>
                </div>
                <p style={styles.roleCardText}>
                  Broadcast HD audio/video rooms, stream screen and whiteboard captures with OCR, and review lecture analytics.
                </p>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div style={styles.formCard} className="glass-panel-elevated">
            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>Create Account</h2>
              <p style={styles.formSubtitle}>Join live AI-assisted classrooms today</p>
            </div>

            {error && (
              <div style={styles.errorAlert} role="alert" aria-live="polite">
                <span style={{ fontSize: '16px' }} aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} style={styles.form} noValidate>
              <div style={styles.fieldGroup}>
                <label htmlFor="register-name" style={styles.label}>
                  Full Name <span style={styles.requiredStar}>*</span>
                </label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Marie Curie"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  style={styles.input}
                  disabled={loading}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="register-email" style={styles.label}>
                  Email Address <span style={styles.requiredStar}>*</span>
                </label>
                <input
                  id="register-email"
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
                <label htmlFor="register-password" style={styles.label}>
                  Password <span style={styles.requiredStar}>*</span>
                </label>
                <div style={styles.passwordInputWrap}>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password (min 8 chars)"
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

              <div style={styles.fieldGroup}>
                <label htmlFor="register-role" style={styles.label}>
                  Account Type <span style={styles.requiredStar}>*</span>
                </label>
                <select
                  id="register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="STUDENT">Student (Join & Learn)</option>
                  <option value="TEACHER">Instructor / Professor (Host Lectures)</option>
                </select>
                <span style={styles.helperText}>
                  Select your primary platform role. Administrative accounts require verified institutional authorization.
                </span>
              </div>

              <Button
                type="submit"
                variant="emerald"
                size="md"
                loading={loading}
                disabled={loading}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loading ? 'Creating Account…' : 'Complete Registration'}
              </Button>
            </form>

            <div style={styles.footerRow}>
              <span style={{ color: '#94a3b8', fontSize: '13.5px' }}>Already have an account?</span>{' '}
              <Link to="/login" style={styles.footerLink}>
                Sign in
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
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#34d399',
    fontSize: '12px',
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: '20px',
  },
  pulseDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
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
    marginBottom: '24px',
  },
  roleSummaryCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  roleSummaryCard: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid',
    borderRadius: '12px',
    padding: '14px 18px',
    transition: 'border-color 0.2s',
  },
  roleCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '14px',
  },
  roleCardText: {
    fontSize: '12.5px',
    color: '#94a3b8',
    lineHeight: 1.5,
    margin: 0,
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
    marginBottom: '20px',
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
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  fieldGroup: {
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
  select: {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#ffffff',
    fontSize: '14px',
    minHeight: '44px',
    outline: 'none',
    cursor: 'pointer',
  },
  helperText: {
    fontSize: '11.5px',
    color: '#64748b',
    marginTop: '2px',
    lineHeight: 1.4,
  },
  footerRow: {
    marginTop: '22px',
    textAlign: 'center',
    paddingTop: '16px',
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
