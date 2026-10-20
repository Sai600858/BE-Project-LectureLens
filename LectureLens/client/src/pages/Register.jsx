import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return setError('All fields are required');
    try {
      setLoading(true);
      setError('');
      await authApi.register(name, email, password, role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>🎓 LectureLens</div>
          <h2 style={styles.title}>Create your account</h2>
          <p style={styles.subtitle}>Join live AI-assisted university lectures</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleRegister} style={styles.form}>
          <label style={styles.label}>Full Name</label>
          <input
            type="text"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            placeholder="ada@university.edu"
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

          <label style={styles.label}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.select}>
            <option value="STUDENT">Student (Join & Learn)</option>
            <option value="TEACHER">Teacher / Professor (Host Lectures)</option>
            <option value="ADMIN">Administrator</option>
          </select>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Creating Account…' : 'Complete Registration'}
          </button>
        </form>

        <div style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
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
    maxWidth: '440px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
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
  select: {
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  submitBtn: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontWeight: '600',
    fontSize: '14px',
    marginTop: '8px',
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
