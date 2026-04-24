import type { CSSProperties } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from 'recharts';
import type { ChartPoint } from '../../types/sim';

interface CombatTimelineChartProps {
  charts: ChartPoint[];
}

const PLACEHOLDER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 300,
  border: '2px dashed #cbd5e1',
  borderRadius: '14px',
  color: '#94a3b8',
  fontSize: '0.875rem',
  textAlign: 'center',
  padding: '2rem',
};

function formatTime(value: number): string {
  return `${Number(value).toFixed(1)}s`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
      padding: '0.625rem 0.75rem', fontSize: '0.8125rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
        t = {formatTime(label as number)}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey as string} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span>{entry.name}:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CombatTimelineChart({ charts }: CombatTimelineChartProps) {
  if (charts.length === 0) {
    return (
      <div style={PLACEHOLDER} data-testid="chart-placeholder">
        No chart data available. Run a simulation to see the combat timeline.
      </div>
    );
  }

  const shouldAnimate = charts.length <= 300;

  return (
    <section data-testid="combat-timeline-chart">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f172a' }}>
        Combat Timeline
      </h3>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={charts} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#cbd5e1"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#cbd5e1"
            label={{ value: 'DPS', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#cbd5e1"
            label={{ value: 'HP / Shield', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />

          <Area
            yAxisId="right"
            type="stepAfter"
            dataKey="hp_value"
            name="HP"
            fill="#bbf7d0"
            stroke="#22c55e"
            fillOpacity={0.3}
            strokeWidth={1.5}
            isAnimationActive={shouldAnimate}
          />
          <Area
            yAxisId="right"
            type="stepAfter"
            dataKey="shield_value"
            name="Shield"
            fill="#bfdbfe"
            stroke="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={1.5}
            isAnimationActive={shouldAnimate}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total_dps_window"
            name="DPS"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            isAnimationActive={shouldAnimate}
          />

          {charts.length > 30 && (
            <Brush
              dataKey="time"
              height={24}
              stroke="#94a3b8"
              tickFormatter={formatTime}
              fill="#f8fafc"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
