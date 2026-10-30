import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';

/**
 * Floating Dock Navigation inspired by ganeshdev.me
 * Minimalist, elegant bottom floating pill with glassmorphism,
 * keyboard accessibility, and subtle active state indicator.
 */
export default function FloatingDock() {
  const location = useLocation();
  const user = authApi.getCurrentUser();

  // Hide dock inside active live classroom video call to avoid covering control dock
  if (location.pathname.startsWith('/room/')) {
    return null;
  }

  return (
    <nav className="floating-dock-wrap" aria-label="Quick Dock Navigation">
      <NavLink
        to="/"
        className={({ isActive }) => `floating-dock-btn ${isActive ? 'active' : ''}`}
        title="Home Landing"
      >
        <span className="dock-icon" aria-hidden="true">🏛️</span>
        <span className="dock-label">Home</span>
      </NavLink>

      {user && (
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `floating-dock-btn ${isActive ? 'active' : ''}`}
          title="Classroom Dashboard"
        >
          <span className="dock-icon" aria-hidden="true">📋</span>
          <span className="dock-label">Dashboard</span>
        </NavLink>
      )}

      <NavLink
        to="/lab"
        className={({ isActive }) => `floating-dock-btn ${isActive ? 'active' : ''}`}
        title="Interactive Simulations"
      >
        <span className="dock-icon" aria-hidden="true">🔬</span>
        <span className="dock-label">Simulations</span>
      </NavLink>

      {/* Role Indicator Chip inside Dock */}
      {user ? (
        <span
          style={{
            marginLeft: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            cursor: 'default',
          }}
          title={`Signed in as ${user.name} (${user.role})`}
        >
          {user.role === 'TEACHER' ? 'Instructor' : user.role === 'ADMIN' ? 'Admin' : 'Student'}
        </span>
      ) : (
        <NavLink
          to="/login"
          className={({ isActive }) => `floating-dock-btn ${isActive ? 'active' : ''}`}
          title="Sign In"
        >
          <span className="dock-icon" aria-hidden="true">🔑</span>
          <span className="dock-label">Sign In</span>
        </NavLink>
      )}
    </nav>
  );
}
