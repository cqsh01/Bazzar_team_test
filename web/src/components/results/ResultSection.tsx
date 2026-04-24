import React from 'react';
import type { CSSProperties } from 'react';
import { useResultStore } from '../../store/result-store';
import { SummaryDashboard } from './SummaryDashboard';
import { CombatTimelineChart } from './CombatTimelineChart';
import { DebugTimelineTable } from './DebugTimelineTable';

const SECTION: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '1.5rem',
  background: '#fff',
  display: 'grid',
  gap: '1.5rem',
};

const SKELETON_CARD: CSSProperties = {
  height: 80,
  borderRadius: '12px',
  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

const SKELETON_CHART: CSSProperties = {
  ...SKELETON_CARD,
  height: 300,
};

const ERROR_BOX: CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '12px',
  padding: '1.25rem',
  display: 'grid',
  gap: '0.75rem',
};

const TOGGLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.875rem',
  color: '#334155',
  cursor: 'pointer',
};

const EMPTY_STATE: CSSProperties = {
  border: '2px dashed #e2e8f0',
  borderRadius: '16px',
  padding: '3rem 1.5rem',
  textAlign: 'center',
  display: 'grid',
  gap: '0.75rem',
  justifyItems: 'center',
};

export function ResultSection() {
  const isLoading = useResultStore((s) => s.isLoading);
  const error = useResultStore((s) => s.error);
  const lastResult = useResultStore((s) => s.lastResult);
  const showDebug = useResultStore((s) => s.showDebug);
  const toggleDebug = useResultStore((s) => s.toggleDebug);
  const clearResult = useResultStore((s) => s.clearResult);

  const resultRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (lastResult && resultRef.current && typeof resultRef.current.scrollIntoView === 'function') {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [lastResult]);

  if (!isLoading && !error && !lastResult) {
    return (
      <div style={EMPTY_STATE} data-testid="result-empty">
        <span style={{ fontSize: '2rem' }} role="img" aria-label="target">🎯</span>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem', color: '#334155' }}>
          No simulation results yet
        </p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', maxWidth: 380, lineHeight: 1.6 }}>
          Configure your unit, items, and skills above, then click <strong>Run Simulation</strong> to see
          damage output, DPS metrics, and combat timeline.
        </p>
      </div>
    );
  }

  return (
    <div ref={resultRef} style={SECTION} data-testid="result-section">
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {isLoading && (
        <div data-testid="result-skeleton" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={SKELETON_CARD} />
            ))}
          </div>
          <div style={SKELETON_CHART} />
        </div>
      )}

      {error && (
        <div style={ERROR_BOX} data-testid="result-error">
          <div>
            <span style={{
              display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '4px',
              fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace',
              background: '#fee2e2', color: '#991b1b',
            }}>
              {error.error.code}
            </span>
          </div>
          <p style={{ margin: 0, color: '#7f1d1d', fontSize: '0.875rem' }}>{error.error.message}</p>
          <button
            type="button"
            onClick={clearResult}
            data-testid="result-retry"
            style={{
              justifySelf: 'start', padding: '0.5rem 1rem', borderRadius: '8px',
              border: '1px solid #dc2626', background: '#fff', color: '#dc2626',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            Dismiss &amp; retry
          </button>
        </div>
      )}

      {lastResult && (
        <>
          <SummaryDashboard summary={lastResult.data.summary} />
          <CombatTimelineChart charts={lastResult.data.charts} />

          {lastResult.data.debug_timeline && lastResult.data.debug_timeline.length > 0 && (
            <>
              <label style={TOGGLE}>
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={toggleDebug}
                  data-testid="debug-toggle"
                />
                Show Debug Timeline ({lastResult.data.debug_timeline.length} events)
              </label>

              {showDebug && (
                <DebugTimelineTable entries={lastResult.data.debug_timeline} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
