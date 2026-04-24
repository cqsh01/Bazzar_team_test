import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { LoadoutManager, reorderEntriesForTest } from '../src/components/config/LoadoutManager';
import { UnitConfigForm } from '../src/components/config/UnitConfigForm';
import { GlobalConfigForm } from '../src/components/config/GlobalConfigForm';
import { ValidationBanner } from '../src/components/ui/ValidationBanner';
import {
  mapValidationErrorsToSimulationCodes,
  summarizeValidationIssues,
} from '../src/lib/error-mapper';
import { DEFAULT_SIMULATE_REQUEST, useConfigStore } from '../src/store/config-store';
import type { SimulateRequest } from '../src/types/sim';

function resetStore(config?: SimulateRequest): void {
  useConfigStore.setState({
    config: config ?? (JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest),
  });
}

function FormWrapper({ children }: { children: React.ReactNode }) {
  const config = useConfigStore((s) => s.config);
  const methods = useForm<SimulateRequest>({
    defaultValues: config,
    mode: 'onChange',
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('config validation mapping', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it('maps missing required unit fields to MISSING_UNIT_CONFIG', () => {
    const issues = mapValidationErrorsToSimulationCodes({
      unit_config: {
        unit_id: {
          type: 'required',
          message: 'unit_id is required',
        },
      },
    });

    expect(issues).toEqual([
      {
        code: 'MISSING_UNIT_CONFIG',
        message: 'unit_id is required',
        path: 'unit_config.unit_id',
      },
    ]);
    expect(summarizeValidationIssues(issues)?.code).toBe('MISSING_UNIT_CONFIG');
  });

  it('maps invalid numeric values to INVALID_NUMERIC_VALUE', () => {
    const issues = mapValidationErrorsToSimulationCodes({
      unit_config: {
        crit_chance: {
          type: 'max',
          message: 'crit_chance must be between 0 and 1',
        },
      },
      global_config: {
        simulation_duration: {
          type: 'min',
          message: 'simulation_duration must be > 0',
        },
      },
    });

    expect(issues).toEqual([
      {
        code: 'INVALID_NUMERIC_VALUE',
        message: 'crit_chance must be between 0 and 1',
        path: 'unit_config.crit_chance',
      },
      {
        code: 'INVALID_NUMERIC_VALUE',
        message: 'simulation_duration must be > 0',
        path: 'global_config.simulation_duration',
      },
    ]);
    expect(summarizeValidationIssues(issues)?.code).toBe('INVALID_NUMERIC_VALUE');
  });

  it('maps item_configs nested errors to INVALID_NUMERIC_VALUE', () => {
    const issues = mapValidationErrorsToSimulationCodes({
      item_configs: [
        {
          modifiers: {
            crit_multiplier: {
              type: 'min',
              message: 'Must be >= 0',
            },
          },
        },
      ],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_NUMERIC_VALUE');
    expect(issues[0].path).toBe('item_configs.0.modifiers.crit_multiplier');
  });
});

describe('loadout reorder', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore({
      ...(JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest),
      item_configs: [
        { buff_id: 'alpha', loadout_order_index: 0 },
        { buff_id: 'beta', loadout_order_index: 1 },
      ],
      skill_configs: [],
    });
  });

  it('keeps loadout_order_index synchronized in pure reorder helper', () => {
    const reordered = reorderEntriesForTest(
      [
        { buff_id: 'alpha', loadout_order_index: 0 },
        { buff_id: 'beta', loadout_order_index: 1 },
        { buff_id: 'gamma', loadout_order_index: 2 },
      ],
      2,
      0,
    );

    expect(reordered.map((item) => item.buff_id)).toEqual(['gamma', 'alpha', 'beta']);
    expect(reordered.map((item) => item.loadout_order_index)).toEqual([0, 1, 2]);
  });

  it('reorders store-backed item cards and syncs loadout_order_index', async () => {
    const user = userEvent.setup();
    render(
      <FormWrapper>
        <LoadoutManager />
      </FormWrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'move-down-item-0' }));

    const itemConfigs = useConfigStore.getState().config.item_configs;
    expect(itemConfigs.map((item) => item.buff_id)).toEqual(['beta', 'alpha']);
    expect(itemConfigs.map((item) => item.loadout_order_index)).toEqual([0, 1]);
  });
});

describe('store actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it('updateItemAt patches a specific item without affecting others', () => {
    useConfigStore.getState().addItem('item');
    useConfigStore.getState().addItem('item');
    useConfigStore.getState().updateItemAt(0, { buff_id: 'renamed' });

    const items = useConfigStore.getState().config.item_configs;
    expect(items[0].buff_id).toBe('renamed');
    expect(items[1].buff_id).toBe('item-2');
  });

  it('updateItemModifiersAt merges modifier fields', () => {
    useConfigStore.getState().addItem('item');
    useConfigStore.getState().updateItemModifiersAt(0, { flat_damage_bonus: 42 });
    useConfigStore.getState().updateItemModifiersAt(0, { crit_multiplier: 2.0 });

    const mods = useConfigStore.getState().config.item_configs[0].modifiers;
    expect(mods?.flat_damage_bonus).toBe(42);
    expect(mods?.crit_multiplier).toBe(2.0);
  });

  it('updateSkillAt patches a specific skill', () => {
    useConfigStore.getState().addItem('skill');
    useConfigStore.getState().updateSkillAt(0, { skill_id: 'fire-bolt', damage_type: 'FIRE' });

    const skill = useConfigStore.getState().config.skill_configs[0];
    expect(skill.skill_id).toBe('fire-bolt');
    expect(skill.damage_type).toBe('FIRE');
  });

  it('ignores out-of-bounds index for updateItemAt', () => {
    useConfigStore.getState().addItem('item');
    const before = JSON.stringify(useConfigStore.getState().config);
    useConfigStore.getState().updateItemAt(99, { buff_id: 'nope' });
    expect(JSON.stringify(useConfigStore.getState().config)).toBe(before);
  });
});

describe('UnitConfigForm required field validation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore({
      ...JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest,
      unit_config: {
        ...DEFAULT_SIMULATE_REQUEST.unit_config,
        unit_id: 'hero',
      },
    });
  });

  it('shows required error when unit_id is cleared', async () => {
    const user = userEvent.setup();
    render(
      <FormWrapper>
        <UnitConfigForm />
      </FormWrapper>,
    );

    const unitIdInput = screen.getByLabelText(/Unit ID/);
    await user.clear(unitIdInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('unit_id is required')).toBeInTheDocument();
    });
  });
});

describe('ValidationBanner', () => {
  it('renders nothing when no errors exist', () => {
    render(
      <FormWrapper>
        <ValidationBanner errors={{}} />
      </FormWrapper>,
    );
    expect(screen.queryByTestId('validation-banner')).toBeNull();
  });

  it('renders error count and codes when errors present', () => {
    const errors = {
      unit_config: {
        unit_id: { type: 'required' as const, message: 'unit_id is required' },
        base_damage: { type: 'min' as const, message: 'Must be >= 0' },
      },
    };

    render(
      <FormWrapper>
        <ValidationBanner errors={errors} />
      </FormWrapper>,
    );

    expect(screen.getByTestId('validation-banner')).toBeInTheDocument();
    expect(screen.getByText(/2 issues/)).toBeInTheDocument();
    expect(screen.getByText('MISSING_UNIT_CONFIG')).toBeInTheDocument();
    expect(screen.getByText('INVALID_NUMERIC_VALUE')).toBeInTheDocument();
  });
});

describe('GlobalConfigForm validation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore({
      ...JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest,
      global_config: { simulation_duration: 30 },
    });
  });

  it('accepts valid positive duration', () => {
    render(
      <FormWrapper>
        <GlobalConfigForm />
      </FormWrapper>,
    );

    const input = screen.getByLabelText('Simulation Duration');
    expect(input).toBeInTheDocument();
  });
});

describe('loadout add/remove with form integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it('adds item and skill cards via store actions', async () => {
    const user = userEvent.setup();
    render(
      <FormWrapper>
        <LoadoutManager />
      </FormWrapper>,
    );

    await user.click(screen.getByText('Add Item'));
    await user.click(screen.getByText('Add Skill'));

    expect(useConfigStore.getState().config.item_configs).toHaveLength(1);
    expect(useConfigStore.getState().config.skill_configs).toHaveLength(1);
    expect(screen.getByTestId('loadout-card-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('loadout-card-skill-0')).toBeInTheDocument();
  });

  it('removes item card and re-indexes remaining cards', async () => {
    const user = userEvent.setup();
    resetStore({
      ...JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest,
      item_configs: [
        { buff_id: 'a', loadout_order_index: 0 },
        { buff_id: 'b', loadout_order_index: 1 },
        { buff_id: 'c', loadout_order_index: 2 },
      ],
    });

    render(
      <FormWrapper>
        <LoadoutManager />
      </FormWrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'remove-item-1' }));

    const items = useConfigStore.getState().config.item_configs;
    expect(items).toHaveLength(2);
    expect(items.map(i => i.buff_id)).toEqual(['a', 'c']);
    expect(items.map(i => i.loadout_order_index)).toEqual([0, 1]);
  });
});
