import React from 'react';

/**
 * Reusable accessible Badge / Status Pill component.
 * Supports variants: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral'
 */
export default function Badge({
  children,
  variant = 'cyan',
  icon = null,
  size = 'md',
  className = '',
  style = {},
  ...props
}) {
  const variantStyles = {
    cyan: {
      background: 'var(--status-cyan-bg, rgba(56, 189, 248, 0.1))',
      color: 'var(--accent-cyan, #38bdf8)',
      borderColor: 'var(--status-cyan-border, rgba(56, 189, 248, 0.3))',
    },
    emerald: {
      background: 'var(--status-emerald-bg, rgba(16, 185, 129, 0.12))',
      color: 'var(--accent-emerald, #10b981)',
      borderColor: 'var(--status-emerald-border, rgba(16, 185, 129, 0.3))',
    },
    amber: {
      background: 'var(--status-amber-bg, rgba(245, 158, 11, 0.12))',
      color: 'var(--accent-amber, #f59e0b)',
      borderColor: 'var(--status-amber-border, rgba(245, 158, 11, 0.3))',
    },
    rose: {
      background: 'var(--status-rose-bg, rgba(244, 63, 94, 0.12))',
      color: 'var(--accent-rose, #f43f5e)',
      borderColor: 'var(--status-rose-border, rgba(244, 63, 94, 0.3))',
    },
    indigo: {
      background: 'rgba(99, 102, 241, 0.12)',
      color: '#818cf8',
      borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    neutral: {
      background: 'rgba(255, 255, 255, 0.06)',
      color: '#94a3b8',
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
  };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '11px', gap: '4px' },
    md: { padding: '4px 12px', fontSize: '12px', gap: '6px' },
    lg: { padding: '6px 16px', fontSize: '13px', gap: '8px' },
  };

  const chosenVariant = variantStyles[variant] || variantStyles.cyan;
  const chosenSize = sizeStyles[size] || sizeStyles.md;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    border: '1px solid',
    fontWeight: '600',
    letterSpacing: '0.02em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...chosenVariant,
    ...chosenSize,
    ...style,
  };

  return (
    <span className={`badge-pill ${className}`} style={baseStyle} {...props}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
