import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SummaryDashboard } from '../src/components/results/SummaryDashboard';
import { CombatTimelineChart } from '../src/components/results/CombatTimelineChart';
import { DebugTimelineTable } from '../src/components/results/DebugTimelineTable';
import { ResultSection } from '../src/components/results/ResultSection';
import { useResultStore } from '../src/store/result-store';
import type {
  ChartPoint,
  DebugTimelineEntry,
  SimulateErrorResponse,
  SimulateSuccessResponse,
  SimulationSummary,
} from '../src/types/sim';

const MOCK_SUMMARY: SimulationSummary = {
  total_damage: 12345,
  dps: 411.50,
  per_owner_damage: { hero: 10000, burn: 2345 },
  event_count: 200,
  attack_count: 31,
  periodic_damage_total: 2345,
  periodic_tick_count: 9,
};

const MOCK_CHARTS: ChartPoint[] = [
  { time: 0, total_dps_window: 0, shield_value: 50, hp_value: 1000 },
  { time: 1, total_dps_window: 100, shield_value: 25, hp_value: 900 },
  { time: 2, total_dps_window: 150, shield_value: 0, hp_value: 800 },
];

const MOCK_DEBUG: DebugTimelineEntry[] = [
  { time: 1.0, source_id: 'hero', damage: 100, damage_type: 'NORMAL', is_periodic: false, hp_after: 900, shield_after: 25 },
  { time: 1.5, source_id: 'burn', damage: 50, damage_type: 'FIRE', is_periodic: true, hp_after: 850, shield_after: 0 },
  { time: 2.0, source_id: 'hero', damage: 100, damage_type: 'TOXIC', is_periodic: false, hp_after: 750, shield_after: 0 },
];

const MOCK_SUCCESS: SimulateSuccessResponse = {
  protocol_version: 'v1.0',
  status: 'success',
  data: {
    summary: MOCK_SUMMARY,
    charts: MOCK_CHARTS,
    input_echo: {
      global_config: {},
      unit_config: { unit_id: 'hero', base_damage: 100, base_attack_cooldown: 1, crit_chance: 0, max_health: 100, initial_shield: 0, initial_heal_pool: 0 },
      item_configs: [],
      skill_configs: [],
    },
    debug_timeline: MOCK_DEBUG,
  },
};

const MOCK_ERROR: SimulateErrorResponse = {
  protocol_version: 'v1.0',
  status: 'error',
  error: { code: 'MISSING_UNIT_CONFIG', message: 'missing required field: unit_config' },
};

function resetResultStore() {
  useResultStore.setState({ isLoading: false, error: null, lastResult: null, showDebug: false });
}

describe('SummaryDashboard', () => {
  it('renders all summary fields with correct formatting', () => {
    render(<SummaryDashboard summary={MOCK_SUMMARY} />);

    expect(screen.getByTestId('summary-total-damage').textContent).toBe('12,345');
    expect(screen.getByTestId('summary-dps').textContent).toBe('411.50');
    expect(screen.getByTestId('summary-attack-count').textContent).toBe('31');
    expect(screen.getByTestId('summary-periodic-damage').textContent).toBe('2,345');
    expect(screen.getByTestId('summary-periodic-ticks').textContent).toBe('9');
    expect(screen.getByTestId('summary-event-count').textContent).toBe('200');
  });

  it('renders per_owner_damage breakdown', () => {
    render(<SummaryDashboard summary={MOCK_SUMMARY} />);

    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('burn')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getAllByText('2,345')).toHaveLength(2);
  });

  it('omits owner section when per_owner_damage is empty', () => {
    render(<SummaryDashboard summary={{ ...MOCK_SUMMARY, per_owner_damage: {} }} />);
    expect(screen.queryByText('Damage by Owner')).toBeNull();
  });
});

describe('CombatTimelineChart', () => {
  it('shows placeholder when charts array is empty', () => {
    render(<CombatTimelineChart charts={[]} />);
    expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
    expect(screen.getByText(/No chart data available/)).toBeInTheDocument();
  });

  it('renders chart container with data', () => {
    render(<CombatTimelineChart charts={MOCK_CHARTS} />);
    expect(screen.getByTestId('combat-timeline-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-placeholder')).toBeNull();
  });
});

describe('DebugTimelineTable', () => {
  it('renders all rows with correct column data', () => {
    render(<DebugTimelineTable entries={MOCK_DEBUG} />);
    expect(screen.getByTestId('debug-timeline-table')).toBeInTheDocument();
    expect(screen.getByText('3 rows')).toBeInTheDocument();

    expect(screen.getAllByTestId('badge-NORMAL')).toHaveLength(1);
    expect(screen.getAllByTestId('badge-FIRE')).toHaveLength(1);
    expect(screen.getAllByTestId('badge-TOXIC')).toHaveLength(1);
  });

  it('applies damage type color badges', () => {
    render(<DebugTimelineTable entries={MOCK_DEBUG} />);

    const normalBadge = screen.getByTestId('badge-NORMAL');
    expect(normalBadge.textContent).toBe('NORMAL');

    const fireBadge = screen.getByTestId('badge-FIRE');
    expect(fireBadge.textContent).toBe('FIRE');
  });

  it('filters by damage type', async () => {
    const user = userEvent.setup();
    render(<DebugTimelineTable entries={MOCK_DEBUG} />);

    const select = screen.getByLabelText('Filter by damage type');
    await user.selectOptions(select, 'FIRE');

    expect(screen.getByText('1 row')).toBeInTheDocument();
    expect(screen.queryByTestId('badge-NORMAL')).toBeNull();
    expect(screen.getByTestId('badge-FIRE')).toBeInTheDocument();
  });

  it('filters by periodic flag', async () => {
    const user = userEvent.setup();
    render(<DebugTimelineTable entries={MOCK_DEBUG} />);

    const select = screen.getByLabelText('Filter by periodic');
    await user.selectOptions(select, 'PERIODIC');

    expect(screen.getByText('1 row')).toBeInTheDocument();
    expect(screen.getByText('burn')).toBeInTheDocument();
    expect(screen.queryByText('hero')).toBeNull();
  });

  it('shows empty state when filters match nothing', async () => {
    const user = userEvent.setup();
    const entries: DebugTimelineEntry[] = [
      { time: 0, source_id: 'x', damage: 0, damage_type: 'NORMAL', is_periodic: false, hp_after: 100, shield_after: 0 },
    ];
    render(<DebugTimelineTable entries={entries} />);

    await user.selectOptions(screen.getByLabelText('Filter by damage type'), 'TOXIC');
    expect(screen.getByText('No matching events.')).toBeInTheDocument();
  });
});

describe('ResultSection (integration)', () => {
  beforeEach(resetResultStore);

  it('renders nothing when no state is set', () => {
    render(<ResultSection />);
    expect(screen.queryByTestId('result-section')).toBeNull();
  });

  it('shows skeleton when loading', () => {
    useResultStore.setState({ isLoading: true });
    render(<ResultSection />);
    expect(screen.getByTestId('result-skeleton')).toBeInTheDocument();
  });

  it('shows error with code badge and retry button', () => {
    useResultStore.setState({ error: MOCK_ERROR });
    render(<ResultSection />);
    expect(screen.getByTestId('result-error')).toBeInTheDocument();
    expect(screen.getByText('MISSING_UNIT_CONFIG')).toBeInTheDocument();
    expect(screen.getByTestId('result-retry')).toBeInTheDocument();
  });

  it('dismiss error clears result store', async () => {
    const user = userEvent.setup();
    useResultStore.setState({ error: MOCK_ERROR });
    render(<ResultSection />);

    await user.click(screen.getByTestId('result-retry'));
    expect(useResultStore.getState().error).toBeNull();
  });

  it('renders summary and chart on success', () => {
    useResultStore.setState({ lastResult: MOCK_SUCCESS });
    render(<ResultSection />);

    expect(screen.getByTestId('summary-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('combat-timeline-chart')).toBeInTheDocument();
  });

  it('shows debug toggle only when debug_timeline exists', () => {
    useResultStore.setState({ lastResult: MOCK_SUCCESS });
    render(<ResultSection />);
    expect(screen.getByTestId('debug-toggle')).toBeInTheDocument();
  });

  it('hides debug table until toggle is checked', async () => {
    const user = userEvent.setup();
    useResultStore.setState({ lastResult: MOCK_SUCCESS });
    render(<ResultSection />);

    expect(screen.queryByTestId('debug-timeline-table')).toBeNull();
    await user.click(screen.getByTestId('debug-toggle'));
    expect(screen.getByTestId('debug-timeline-table')).toBeInTheDocument();
  });

  it('hides debug toggle when debug_timeline is absent', () => {
    const noDebug: SimulateSuccessResponse = {
      ...MOCK_SUCCESS,
      data: { ...MOCK_SUCCESS.data, debug_timeline: undefined },
    };
    useResultStore.setState({ lastResult: noDebug });
    render(<ResultSection />);
    expect(screen.queryByTestId('debug-toggle')).toBeNull();
  });
});

describe('result-store actions', () => {
  beforeEach(resetResultStore);

  it('setLoading clears previous results', () => {
    useResultStore.setState({ lastResult: MOCK_SUCCESS, error: MOCK_ERROR });
    useResultStore.getState().setLoading();
    const s = useResultStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.lastResult).toBeNull();
    expect(s.error).toBeNull();
  });

  it('setResult stores success and clears loading', () => {
    useResultStore.getState().setLoading();
    useResultStore.getState().setResult(MOCK_SUCCESS);
    const s = useResultStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.lastResult).toBe(MOCK_SUCCESS);
  });

  it('setError stores error and clears loading', () => {
    useResultStore.getState().setLoading();
    useResultStore.getState().setError(MOCK_ERROR);
    const s = useResultStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe(MOCK_ERROR);
  });

  it('toggleDebug flips showDebug flag', () => {
    expect(useResultStore.getState().showDebug).toBe(false);
    useResultStore.getState().toggleDebug();
    expect(useResultStore.getState().showDebug).toBe(true);
    useResultStore.getState().toggleDebug();
    expect(useResultStore.getState().showDebug).toBe(false);
  });
});
