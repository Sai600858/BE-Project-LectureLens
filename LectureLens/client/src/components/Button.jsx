import React from 'react';

/**
 * Reusable accessible Button component with mobile-first touch target sizing (>= 44px),
 * keyboard focus visible rings, and loading states.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  type = 'button',
  onClick,
  className = '',
  style = {},
  ariaLabel,
  ...props
}) {
  const variantStyles = {
    primary: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
      color: '#ffffff',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: '#f8fafc',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
    },
    emerald: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#ffffff',
      border: '1px solid rgba(16, 185, 129, 0.4)',
      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: '#cbd5e1',
      border: '1px solid transparent',
      boxShadow: 'none',
    },
  };

  const sizeStyles = {
    sm: {
      minHeight: '38px',
      padding: '6px 14px',
      fontSize: '13px',
      gap: '6px',
    },
    md: {
      minHeight: '44px', // WCAG minimum recommended touch target
      padding: '10px 18px',
      fontSize: '14px',
      gap: '8px',
    },
    lg: {
      minHeight: '50px',
      padding: '14px 24px',
      fontSize: '15px',
      gap: '10px',
    },
  };

  const chosenVariant = variantStyles[variant] || variantStyles.primary;
  const chosenSize = sizeStyles[size] || sizeStyles.md;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontWeight: '600',
    fontFamily: 'var(--font-body)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
    textDecoration: 'none',
    ...chosenVariant,
    ...chosenSize,
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`btn-accessible ${className}`}
      style={baseStyle}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : icon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
