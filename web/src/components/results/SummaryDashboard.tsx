import type { CSSProperties } from 'react';
import type { SimulationSummary } from '../../types/sim';

interface SummaryDashboardProps {
  summary: SimulationSummary;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatDps(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '0.75rem',
};

const CARD: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '1rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const LABEL: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const VALUE: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#0f172a',
};

const OWNER_ROW: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.8125rem',
  padding: '0.25rem 0',
  borderBottom: '1px solid #f1f5f9',
};

export function SummaryDashboard({ summary }: SummaryDashboardProps) {
  const ownerEntries = Object.entries(summary.per_owner_damage);

  return (
    <section data-testid="summary-dashboard">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f172a' }}>
        Simulation Summary
      </h3>
      <div style={GRID}>
        <div style={CARD}>
          <span style={LABEL}>Total Damage</span>
          <span style={VALUE} data-testid="summary-total-damage">{formatNumber(summary.total_damage)}</span>
        </div>
        <div style={CARD}>
          <span style={LABEL}>DPS</span>
          <span style={VALUE} data-testid="summary-dps">{formatDps(summary.dps)}</span>
        </div>
        <div style={CARD}>
          <span style={LABEL}>Attack Count</span>
          <span style={VALUE} data-testid="summary-attack-count">{formatNumber(summary.attack_count)}</span>
        </div>
        <div style={CARD}>
          <span style={LABEL}>Periodic Damage</span>
          <span style={VALUE} data-testid="summary-periodic-damage">{formatNumber(summary.periodic_damage_total)}</span>
        </div>
        <div style={CARD}>
          <span style={LABEL}>Periodic Ticks</span>
          <span style={VALUE} data-testid="summary-periodic-ticks">{formatNumber(summary.periodic_tick_count)}</span>
        </div>
        <div style={CARD}>
          <span style={LABEL}>Total Events</span>
          <span style={VALUE} data-testid="summary-event-count">{formatNumber(summary.event_count)}</span>
        </div>
      </div>

      {ownerEntries.length > 0 && (
        <div style={{ marginTop: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', background: '#f8fafc' }}>
          <span style={LABEL}>Damage by Owner</span>
          <div style={{ marginTop: '0.5rem' }}>
            {ownerEntries.map(([owner, damage]) => (
              <div key={owner} style={OWNER_ROW}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{owner}</span>
                <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>{formatNumber(damage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
