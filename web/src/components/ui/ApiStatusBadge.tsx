import type { CSSProperties } from 'react';

export type ApiStatus = 'online' | 'degraded' | 'offline';

interface ApiStatusBadgeProps {
  endpoint: string;
  mode: string;
  status: ApiStatus;
}

const STATUS_META: Record<ApiStatus, { icon: string; label: string; color: string; background: string }> = {
  online: {
    icon: '🟢',
    label: 'Connected',
    color: '#166534',
    background: '#dcfce7',
  },
  degraded: {
    icon: '🟡',
    label: 'Fallback',
    color: '#854d0e',
    background: '#fef9c3',
  },
  offline: {
    icon: '🔴',
    label: 'Unavailable',
    color: '#991b1b',
    background: '#fee2e2',
  },
};

export function ApiStatusBadge({ endpoint, mode, status }: ApiStatusBadgeProps) {
  const meta = STATUS_META[status];
  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderRadius: '999px',
    padding: '0.4rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: meta.color,
    background: meta.background,
  };

  const detailStyle: CSSProperties = {
    marginTop: '0.5rem',
    color: '#475569',
    fontSize: '0.875rem',
  };

  return (
    <section>
      <div style={badgeStyle} aria-live="polite">
        <span role="img" aria-label={meta.label}>{meta.icon}</span>
        <span>{meta.label}</span>
        <span>mode={mode}</span>
      </div>
      <div style={detailStyle}>endpoint: {endpoint}</div>
    </section>
  );
}
