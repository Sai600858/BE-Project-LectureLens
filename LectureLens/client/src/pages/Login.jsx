import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) return setError('Email and password are required');
    try {
      setLoading(true);
      setError('');
      await authApi.login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demoEmail, demoPw) => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setLoading(true);
    authApi
      .login(demoEmail, demoPw)
      .then(() => navigate('/dashboard'))
      .catch((err) => setError(err.response?.data?.error || 'Login failed'))
      .finally(() => setLoading(false));
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>🎓 LectureLens</div>
          <h2 style={styles.title}>Sign in to your account</h2>
          <p style={styles.subtitle}>AI-Powered Multimodal Lecture Platform</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            placeholder="prof@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={styles.demoSection}>
          <p style={styles.demoTitle}>Quick Demo Sign-in:</p>
          <div style={styles.demoBtns}>
            <button
              onClick={() => quickLogin('teacher@lecturelens.edu', 'password123')}
              style={{ ...styles.demoBtn, borderColor: '#3b82f6', color: '#60a5fa' }}
            >
              👨‍🏫 Teacher Demo
            </button>
            <button
              onClick={() => quickLogin('student@lecturelens.edu', 'password123')}
              style={{ ...styles.demoBtn, borderColor: '#10b981', color: '#34d399' }}
            >
              👩‍🎓 Student Demo
            </button>
            <button
              onClick={() => quickLogin('admin@lecturelens.edu', 'admin123')}
              style={{ ...styles.demoBtn, borderColor: '#f59e0b', color: '#fbbf24' }}
            >
              🛡️ Admin Demo
            </button>
          </div>
        </div>

        <div style={styles.footer}>
          Don't have an account? <Link to="/register" style={styles.link}>Register here</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#09090b',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoBadge: {
    display: 'inline-block',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: '10px',
    background: '#0369a122',
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid #0284c744',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#fafafa',
    margin: '4px 0',
  },
  subtitle: {
    fontSize: '13px',
    color: '#a1a1aa',
  },
  errorBox: {
    background: '#ef444422',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#d4d4d8',
    marginBottom: '-6px',
  },
  input: {
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  submitBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontWeight: '600',
    fontSize: '14px',
    marginTop: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  demoSection: {
    marginTop: '24px',
    borderTop: '1px solid #27272a',
    paddingTop: '16px',
  },
  demoTitle: {
    fontSize: '12px',
    color: '#71717a',
    marginBottom: '8px',
  },
  demoBtns: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  demoBtn: {
    flex: 1,
    minWidth: '100px',
    background: '#27272a',
    border: '1px solid',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#71717a',
  },
  link: {
    color: '#38bdf8',
    textDecoration: 'none',
    fontWeight: '600',
  },
};
