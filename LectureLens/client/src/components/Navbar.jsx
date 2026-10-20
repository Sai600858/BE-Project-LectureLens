import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';
import Badge from './Badge';

/**
 * Reusable, accessible Navbar with responsive mobile drawer (320px - 1440px),
 * 44px touch targets, keyboard navigation support, and active role badges.
 */
export default function Navbar({ customRightAction = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(authApi.getCurrentUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(authApi.getCurrentUser());
    setMobileMenuOpen(false); // Close on route change
  }, [location.pathname]);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const getRoleVariant = (role) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'amber';
      case 'TEACHER':
        return 'cyan';
      case 'STUDENT':
        return 'emerald';
      default:
        return 'neutral';
    }
  };

  return (
    <header style={styles.header} role="banner">
      <div style={styles.navContainer}>
        {/* Brand Logo */}
        <Link to="/" style={styles.brandLink} aria-label="LectureLens Home">
          <div style={styles.brandIconWrap} aria-hidden="true">🎓</div>
          <div style={styles.brandTextWrap}>
            <span style={styles.brandTitle}>LectureLens</span>
            <span style={styles.brandTagline}>AI Classroom Intelligence</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar-desktop-nav" style={styles.desktopNav} aria-label="Main Navigation">
          <Link
            to="/"
            style={{
              ...styles.navLink,
              ...(location.pathname === '/' ? styles.navLinkActive : {}),
            }}
          >
            Home
          </Link>
          {user && (
            <Link
              to="/dashboard"
              style={{
                ...styles.navLink,
                ...(location.pathname === '/dashboard' ? styles.navLinkActive : {}),
              }}
            >
              Dashboard
            </Link>
          )}
        </nav>

        {/* Desktop Right Actions */}
        <div className="navbar-desktop-actions" style={styles.desktopActions}>
          {customRightAction}

          {user ? (
            <div style={styles.userProfile}>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user.name || user.email}</span>
                <Badge variant={getRoleVariant(user.role)} size="sm">
                  {user.role || 'USER'}
                </Badge>
              </div>
              <button
                onClick={handleLogout}
                style={styles.signOutBtn}
                aria-label="Sign out of account"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={styles.authButtons}>
              <Link to="/login" style={styles.loginLink}>
                Sign In
              </Link>
              <Link to="/register" style={styles.registerLink}>
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle (Minimum 44x44px touch area) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="navbar-mobile-toggle"
          style={styles.mobileMenuToggle}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
        >
          <span style={styles.hamburgerIcon} aria-hidden="true">
            {mobileMenuOpen ? '✕' : '☰'}
          </span>
        </button>
      </div>

      {/* Mobile Drawer (Responsive down to 320px) */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          style={styles.mobileDrawer}
          role="navigation"
          aria-label="Mobile Navigation"
        >
          <nav style={styles.mobileNavLinks}>
            <Link
              to="/"
              style={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              🏠 Home
            </Link>
            {user && (
              <Link
                to="/dashboard"
                style={styles.mobileNavLink}
                onClick={() => setMobileMenuOpen(false)}
              >
                📊 Dashboard
              </Link>
            )}

            {user ? (
              <div style={styles.mobileUserSection}>
                <div style={styles.mobileUserInfo}>
                  <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '14px' }}>
                    {user.name || user.email}
                  </div>
                  <Badge variant={getRoleVariant(user.role)} size="sm">
                    {user.role || 'USER'}
                  </Badge>
                </div>
                <button
                  onClick={handleLogout}
                  style={styles.mobileSignOutBtn}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={styles.mobileAuthRow}>
                <Link
                  to="/login"
                  style={styles.mobileLoginBtn}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  style={styles.mobileRegisterBtn}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 900,
    background: 'rgba(8, 12, 20, 0.82)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  navContainer: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 16px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  brandLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
    minHeight: '44px',
  },
  brandIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    boxShadow: '0 2px 10px rgba(56, 189, 248, 0.3)',
    flexShrink: 0,
  },
  brandTextWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  brandTagline: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#38bdf8',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  desktopNav: {
    display: 'none',
    alignItems: 'center',
    gap: '24px',
  },
  navLink: {
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'color 0.18s, background 0.18s',
  },
  navLinkActive: {
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.08)',
  },
  desktopActions: {
    display: 'none',
    alignItems: 'center',
    gap: '14px',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    maxWidth: '160px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  signOutBtn: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '8px 14px',
    minHeight: '40px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.18s',
  },
  authButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  loginLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    padding: '8px 16px',
    minHeight: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '13.5px',
    fontWeight: '600',
    borderRadius: '8px',
    transition: 'color 0.18s',
  },
  registerLink: {
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '8px 16px',
    minHeight: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '13.5px',
    fontWeight: '700',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)',
  },
  mobileMenuToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    padding: 0,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    flexShrink: 0,
  },
  hamburgerIcon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  mobileDrawer: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(8, 12, 20, 0.96)',
    padding: '16px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
  },
  mobileNavLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mobileNavLink: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: '10px 14px',
    color: '#f8fafc',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  mobileUserSection: {
    marginTop: '8px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mobileUserInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
  },
  mobileSignOutBtn: {
    width: '100%',
    minHeight: '44px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#f87171',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAuthRow: {
    marginTop: '8px',
    display: 'flex',
    gap: '10px',
  },
  mobileLoginBtn: {
    flex: 1,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: '8px',
  },
  mobileRegisterBtn: {
    flex: 1,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '700',
    fontSize: '14px',
    borderRadius: '8px',
  },
};
