import { useFormContext } from 'react-hook-form';
import { useConfigStore } from '../../store/config-store';
import type { SimulateRequest } from '../../types/sim';
import type { CSSProperties } from 'react';

const SECTION: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1.25rem',
  background: '#f8fafc',
};

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
  gap: '0.75rem',
};

const LABEL: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.875rem',
  color: '#334155',
};

const INPUT: CSSProperties = {
  padding: '0.5rem 0.625rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.875rem',
  background: '#fff',
  outline: 'none',
};

const INPUT_ERROR: CSSProperties = {
  ...INPUT,
  borderColor: '#ef4444',
};

const HINT: CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  marginTop: '0.125rem',
};

const REQUIRED_DOT: CSSProperties = {
  color: '#ef4444',
  marginLeft: '0.125rem',
};

interface FieldDef {
  name: string;
  label: string;
  type: 'number' | 'text';
  step?: string;
  validation: Record<string, unknown>;
}

const UNIT_FIELDS: FieldDef[] = [
  {
    name: 'unit_config.unit_id',
    label: 'Unit ID',
    type: 'text',
    validation: { required: 'unit_id is required' },
  },
  {
    name: 'unit_config.base_attack_cooldown',
    label: 'Base Attack Cooldown',
    type: 'number',
    step: '0.1',
    validation: {
      required: 'base_attack_cooldown is required',
      min: { value: Number.MIN_VALUE, message: 'Must be > 0' },
    },
  },
];

const BATTLE_CONTEXT_FIELDS: FieldDef[] = [
  {
    name: 'unit_config.battle_context.self_hp',
    label: 'Self HP',
    type: 'number',
    step: '1',
    validation: {
      required: 'self_hp is required',
      min: { value: 1, message: 'Must be > 0' },
    },
  },
  {
    name: 'unit_config.battle_context.self_shield',
    label: 'Self Shield',
    type: 'number',
    step: '1',
    validation: { required: 'self_shield is required', min: { value: 0, message: 'Must be >= 0' } },
  },
  {
    name: 'unit_config.battle_context.enemy_hp',
    label: 'Enemy HP',
    type: 'number',
    step: '1',
    validation: {
      required: 'enemy_hp is required',
      min: { value: 1, message: 'Must be > 0' },
    },
  },
];

function getNestedError(errors: Record<string, unknown>, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = errors;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  if (current && typeof current === 'object' && 'message' in (current as Record<string, unknown>)) {
    return String((current as Record<string, unknown>).message);
  }
  return null;
}

export function UnitConfigForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<SimulateRequest>();
  const highlightedPaths = useConfigStore((s) => s.highlightedPaths);

  const allFields = [...UNIT_FIELDS, ...BATTLE_CONTEXT_FIELDS];

  return (
    <section style={SECTION}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', color: '#0f172a' }}>
        Unit & Battle Context
        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>All fields required</span>
      </h2>
      <div style={GRID}>
        {allFields.map((field) => {
          const errorMessage = getNestedError(errors as Record<string, unknown>, field.name);
          const highlightClass = highlightedPaths.includes(field.name) ? 'animate-echo-highlight' : '';

          return (
            <label key={field.name} style={LABEL}>
              <span>
                {field.label}
                <span style={REQUIRED_DOT}>*</span>
              </span>
              <input
                type={field.type}
                step={field.step}
                className={highlightClass}
                style={errorMessage ? INPUT_ERROR : INPUT}
                {...register(field.name as keyof SimulateRequest, {
                  ...(field.type === 'number' ? { valueAsNumber: true } : {}),
                  ...field.validation,
                } as Record<string, unknown>)}
              />
              {errorMessage && <span style={HINT}>{errorMessage}</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
