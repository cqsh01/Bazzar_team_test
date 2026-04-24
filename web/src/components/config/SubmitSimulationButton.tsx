import React from 'react';
import type { CSSProperties } from 'react';
import { useFormContext } from 'react-hook-form';
import { apiClient } from '../../lib/api-client';
import { useConfigStore } from '../../store/config-store';
import { useResultStore } from '../../store/result-store';
import { useToastStore } from '../../store/toast-store';
import type { BattleContext, ItemConfig, ItemModifierConfig, SimulateRequest, SkillConfig } from '../../types/sim';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const BTN: CSSProperties = {
  padding: '0.75rem 1.5rem',
  borderRadius: '10px',
  border: 'none',
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  color: '#fff',
  background: '#2563eb',
  transition: 'background 150ms',
};

const BTN_DISABLED: CSSProperties = {
  ...BTN,
  background: '#94a3b8',
  cursor: 'not-allowed',
};

function topLevelItemDiffs(current: ItemConfig[], next: ItemConfig[]): string[] {
  const diffs: string[] = [];
  const max = Math.max(current.length, next.length);
  for (let i = 0; i < max; i += 1) {
    const a = current[i];
    const b = next[i];
    if (!a || !b) {
      diffs.push(`item_configs.${i}`);
      continue;
    }
    const fields: (keyof ItemConfig)[] = ['buff_id', 'owner_id', 'duration', 'loadout_order_index', 'max_stacks', 'stackable', 'enchantment_type'];
    fields.forEach((field) => {
      if (a[field] !== b[field]) {
        diffs.push(`item_configs.${i}.${field}`);
      }
    });
    const modA: ItemModifierConfig = a.modifiers ?? {};
    const modB: ItemModifierConfig = b.modifiers ?? {};
    const modFields: (keyof ItemModifierConfig)[] = [
      'flat_damage_bonus',
      'crit_multiplier',
      'global_damage_multiplier',
      'shield_damage_mapping_multiplier',
      'invulnerable_normal_damage',
      'cooldown_delta',
      'bypass_cooldown_floor',
      'damage_type_override',
    ];
    modFields.forEach((field) => {
      if (modA[field] !== modB[field]) {
        diffs.push(`item_configs.${i}.modifiers.${field}`);
      }
    });
  }
  return diffs;
}

function topLevelSkillDiffs(current: SkillConfig[], next: SkillConfig[]): string[] {
  const diffs: string[] = [];
  const max = Math.max(current.length, next.length);
  for (let i = 0; i < max; i += 1) {
    const a = current[i];
    const b = next[i];
    if (!a || !b) {
      diffs.push(`skill_configs.${i}`);
      continue;
    }
    const fields: (keyof SkillConfig)[] = [
      'skill_id',
      'owner_id',
      'interval',
      'duration',
      'max_ticks',
      'source_base_damage',
      'damage_type',
      'immediate_first_tick',
      'loadout_order_index',
      'damage_owner_id',
    ];
    fields.forEach((field) => {
      if (a[field] !== b[field]) {
        diffs.push(`skill_configs.${i}.${field}`);
      }
    });
  }
  return diffs;
}

function collectEchoDiffPaths(current: SimulateRequest, next: SimulateRequest): string[] {
  const diffs: string[] = [];

  (Object.keys(next.global_config) as (keyof SimulateRequest['global_config'])[]).forEach((key) => {
    if (current.global_config[key] !== next.global_config[key]) {
      diffs.push(`global_config.${key}`);
    }
  });

  if (current.unit_config.unit_id !== next.unit_config.unit_id) {
    diffs.push('unit_config.unit_id');
  }
  if (current.unit_config.base_attack_cooldown !== next.unit_config.base_attack_cooldown) {
    diffs.push('unit_config.base_attack_cooldown');
  }

  const bcA: BattleContext = current.unit_config.battle_context;
  const bcB: BattleContext = next.unit_config.battle_context;
  (Object.keys(bcB) as (keyof BattleContext)[]).forEach((key) => {
    if (bcA[key] !== bcB[key]) {
      diffs.push(`unit_config.battle_context.${key}`);
    }
  });

  diffs.push(...topLevelItemDiffs(current.item_configs, next.item_configs));
  diffs.push(...topLevelSkillDiffs(current.skill_configs, next.skill_configs));
  return Array.from(new Set(diffs));
}

export function SubmitSimulationButton() {
  const { handleSubmit, formState: { errors } } = useFormContext<SimulateRequest>();
  const forceSyncFromEcho = useConfigStore((s) => s.forceSyncFromEcho);
  const pushToast = useToastStore((s) => s.pushToast);

  const resultSetLoading = useResultStore((s) => s.setLoading);
  const resultSetResult = useResultStore((s) => s.setResult);
  const resultSetError = useResultStore((s) => s.setError);

  const [state, setState] = React.useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const hasErrors = Object.keys(errors).length > 0;

  const onValid = React.useCallback(async (formValues: SimulateRequest) => {
    setState('loading');
    setErrorMessage('');
    resultSetLoading();

    try {
      const result = await apiClient.simulate(formValues);

      if (result.status === 'success') {
        setState('success');
        resultSetResult(result);
        const echo = result.data.input_echo;
        const diffPaths = collectEchoDiffPaths(formValues, echo);
        forceSyncFromEcho(echo, diffPaths);
        if (diffPaths.length > 0) {
          pushToast('info', '配置已按引擎规则标准化，当前显示为实际参与计算的值', 3200);
        } else {
          pushToast('success', 'Simulation completed successfully.');
        }
      } else {
        setState('error');
        setErrorMessage(`${result.error.code}: ${result.error.message}`);
        resultSetError(result);
        pushToast('error', `${result.error.code}: ${result.error.message}`, 3600);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState('error');
      setErrorMessage(message);
      pushToast('error', message, 3600);
    }
  }, [forceSyncFromEcho, pushToast, resultSetError, resultSetLoading, resultSetResult]);

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          style={hasErrors || state === 'loading' ? BTN_DISABLED : BTN}
          disabled={hasErrors || state === 'loading'}
          onClick={handleSubmit(onValid)}
          data-testid="submit-simulation"
        >
          {state === 'loading' ? 'Simulating...' : 'Run Simulation'}
        </button>

        {state === 'success' && (
          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.875rem' }}>
            Simulation complete
          </span>
        )}
        {state === 'error' && (
          <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.875rem' }}>
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}
