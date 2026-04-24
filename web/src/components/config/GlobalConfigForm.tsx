import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useConfigStore } from '../../store/config-store';
import type { SimulateRequest } from '../../types/sim';

const SECTION: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '1.25rem',
  background: '#f8fafc',
};

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
  gap: '0.75rem',
};

const LABEL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.875rem',
  color: '#334155',
};

const INPUT: React.CSSProperties = {
  padding: '0.5rem 0.625rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.875rem',
  background: '#fff',
  outline: 'none',
};

const INPUT_ERROR: React.CSSProperties = {
  ...INPUT,
  borderColor: '#ef4444',
};

const HINT: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  marginTop: '0.125rem',
};

type GlobalKey = keyof SimulateRequest['global_config'];

interface FieldDef {
  name: GlobalKey;
  label: string;
  type: 'number' | 'text' | 'checkbox';
  validation?: Record<string, unknown>;
  step?: string;
}

const FIELDS: FieldDef[] = [
  {
    name: 'simulation_duration',
    label: 'Simulation Duration',
    type: 'number',
    step: '0.1',
    validation: { min: { value: Number.MIN_VALUE, message: 'Must be > 0' } },
  },
  {
    name: 'time_precision',
    label: 'Time Precision',
    type: 'number',
    step: '0.01',
    validation: { min: { value: Number.MIN_VALUE, message: 'Must be > 0' } },
  },
  {
    name: 'min_cooldown_default',
    label: 'Min Cooldown Default',
    type: 'number',
    step: '0.1',
    validation: { min: { value: 0, message: 'Must be >= 0' } },
  },
  {
    name: 'min_cooldown_absolute',
    label: 'Min Cooldown Absolute',
    type: 'number',
    step: '0.1',
    validation: { min: { value: 0, message: 'Must be >= 0' } },
  },
  {
    name: 'max_events',
    label: 'Max Events',
    type: 'number',
    step: '1',
    validation: { min: { value: 1, message: 'Must be > 0' } },
  },
  {
    name: 'dummy_target_id',
    label: 'Dummy Target ID',
    type: 'text',
  },
  {
    name: 'dummy_target_health',
    label: 'Dummy Target Health',
    type: 'number',
    step: '1',
  },
  {
    name: 'dummy_target_shield',
    label: 'Dummy Target Shield',
    type: 'number',
    step: '1',
    validation: { min: { value: 0, message: 'Must be >= 0' } },
  },
  {
    name: 'debug_mode',
    label: 'Debug Mode',
    type: 'checkbox',
  },
  {
    name: 'ignore_unknown_fields',
    label: 'Ignore Unknown Fields',
    type: 'checkbox',
  },
];

export function GlobalConfigForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<SimulateRequest>();
  const highlightedPaths = useConfigStore((s) => s.highlightedPaths);

  const globalErrors = errors.global_config;

  return (
    <section style={SECTION}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', color: '#0f172a' }}>
        Global Configuration
      </h2>
      <div style={GRID}>
        {FIELDS.map((field) => {
          const fieldError = globalErrors?.[field.name];
          const errorMessage = fieldError && 'message' in fieldError ? String(fieldError.message) : null;
          const path = `global_config.${field.name}`;
          const highlightClass = highlightedPaths.includes(path) ? 'animate-echo-highlight' : '';

          if (field.type === 'checkbox') {
            return (
              <label key={field.name} style={{ ...LABEL, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  className={highlightClass}
                  {...register(`global_config.${field.name}`)}
                />
                <span>{field.label}</span>
              </label>
            );
          }

          return (
            <label key={field.name} style={LABEL}>
              <span>{field.label}</span>
              <input
                type={field.type}
                step={field.step}
                className={highlightClass}
                style={errorMessage ? INPUT_ERROR : INPUT}
                {...register(`global_config.${field.name}`, {
                  ...(field.type === 'number' ? { valueAsNumber: true } : {}),
                  ...field.validation,
                })}
              />
              {errorMessage && <span style={HINT}>{errorMessage}</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
