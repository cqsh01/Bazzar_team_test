import React from 'react';
import type { CSSProperties } from 'react';
import type { DebugTimelineEntry } from '../../types/sim';

interface DebugTimelineTableProps {
  entries: DebugTimelineEntry[];
}

const DAMAGE_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  NORMAL: { color: '#1e40af', bg: '#dbeafe' },
  FIRE:   { color: '#c2410c', bg: '#ffedd5' },
  TOXIC:  { color: '#7e22ce', bg: '#f3e8ff' },
};

const MAX_DIRECT_RENDER = 1000;

type DamageTypeFilter = 'ALL' | 'NORMAL' | 'FIRE' | 'TOXIC';
type PeriodicFilter = 'ALL' | 'PERIODIC' | 'NON_PERIODIC';

const TH: CSSProperties = {
  position: 'sticky', top: 0, background: '#0f172a', color: '#e2e8f0',
  padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
  textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.04em',
  textTransform: 'uppercase', zIndex: 1,
};

const TD: CSSProperties = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', whiteSpace: 'nowrap',
};

function DamageTypeBadge({ type }: { type: string }) {
  const meta = DAMAGE_TYPE_COLORS[type] ?? { color: '#475569', bg: '#f1f5f9' };
  return (
    <span
      data-testid={`badge-${type}`}
      style={{
        display: 'inline-block', padding: '0.0625rem 0.4rem', borderRadius: '4px',
        fontSize: '0.6875rem', fontWeight: 700, color: meta.color, background: meta.bg,
      }}
    >
      {type}
    </span>
  );
}

export function DebugTimelineTable({ entries }: DebugTimelineTableProps) {
  const [dtFilter, setDtFilter] = React.useState<DamageTypeFilter>('ALL');
  const [periodicFilter, setPeriodicFilter] = React.useState<PeriodicFilter>('ALL');

  const filtered = React.useMemo(() => {
    let result = entries;
    if (dtFilter !== 'ALL') {
      result = result.filter((e) => e.damage_type === dtFilter);
    }
    if (periodicFilter === 'PERIODIC') {
      result = result.filter((e) => e.is_periodic);
    } else if (periodicFilter === 'NON_PERIODIC') {
      result = result.filter((e) => !e.is_periodic);
    }
    return result;
  }, [entries, dtFilter, periodicFilter]);

  const tooLarge = filtered.length > MAX_DIRECT_RENDER;

  const handleExport = React.useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug_timeline.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const selectStyle: CSSProperties = {
    padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1',
    fontSize: '0.8125rem', background: '#fff',
  };

  return (
    <section data-testid="debug-timeline-table">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Debug Timeline</h3>
        <select
          value={dtFilter}
          onChange={(e) => setDtFilter(e.target.value as DamageTypeFilter)}
          style={selectStyle}
          aria-label="Filter by damage type"
        >
          <option value="ALL">All Types</option>
          <option value="NORMAL">NORMAL</option>
          <option value="FIRE">FIRE</option>
          <option value="TOXIC">TOXIC</option>
        </select>
        <select
          value={periodicFilter}
          onChange={(e) => setPeriodicFilter(e.target.value as PeriodicFilter)}
          style={selectStyle}
          aria-label="Filter by periodic"
        >
          <option value="ALL">All Sources</option>
          <option value="PERIODIC">Periodic Only</option>
          <option value="NON_PERIODIC">Non-Periodic Only</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {tooLarge ? (
        <div style={{
          border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem',
          textAlign: 'center', color: '#64748b', fontSize: '0.875rem',
        }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            Too many rows to render ({filtered.length.toLocaleString()}). Export as JSON for analysis.
          </p>
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #2563eb',
              background: '#eff6ff', color: '#1e40af', fontWeight: 600, cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Export JSON
          </button>
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflow: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Time</th>
                <th style={TH}>Source</th>
                <th style={TH}>Damage</th>
                <th style={TH}>Type</th>
                <th style={TH}>Periodic</th>
                <th style={TH}>HP After</th>
                <th style={TH}>Shield After</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={TD}>{row.time.toFixed(2)}s</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{row.source_id}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{row.damage.toLocaleString('en-US')}</td>
                  <td style={TD}><DamageTypeBadge type={row.damage_type} /></td>
                  <td style={TD}>{row.is_periodic ? 'Yes' : 'No'}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{row.hp_after.toLocaleString('en-US')}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{row.shield_after.toLocaleString('en-US')}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                    No matching events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
