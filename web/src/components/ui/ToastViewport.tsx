import React from 'react';
import type { CSSProperties } from 'react';
import { useToastStore, type ToastItem } from '../../store/toast-store';

const VIEWPORT: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 50,
  display: 'grid',
  gap: '0.75rem',
  width: 'min(360px, calc(100vw - 2rem))',
};

const CARD: CSSProperties = {
  borderRadius: '14px',
  padding: '0.875rem 1rem',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
  border: '1px solid transparent',
  background: '#fff',
  display: 'grid',
  gap: '0.25rem',
};

function getTone(level: ToastItem['level']): { bg: string; border: string; text: string; label: string } {
  if (level === 'success') {
    return { bg: '#ecfdf5', border: '#86efac', text: '#166534', label: 'Success' };
  }
  if (level === 'error') {
    return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'Error' };
  }
  return { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', label: 'Info' };
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={VIEWPORT} aria-live="polite" aria-atomic="true" data-testid="toast-viewport">
      {toasts.map((toast) => {
        const tone = getTone(toast.level);
        return (
          <div
            key={toast.id}
            role="status"
            data-testid={`toast-${toast.level}`}
            style={{ ...CARD, background: tone.bg, borderColor: tone.border, color: tone.text }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: '0.125rem' }}>
                <strong style={{ fontSize: '0.8125rem' }}>{tone.label}</strong>
                <span style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: tone.text,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
