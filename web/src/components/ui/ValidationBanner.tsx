import type { CSSProperties } from 'react';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { mapValidationErrorsToSimulationCodes, type ValidationIssue } from '../../lib/error-mapper';

interface ValidationBannerProps<T extends FieldValues> {
  errors: FieldErrors<T>;
}

const BANNER: CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '12px',
  padding: '0.75rem 1rem',
};

const TITLE: CSSProperties = {
  color: '#991b1b',
  fontWeight: 700,
  fontSize: '0.875rem',
  margin: '0 0 0.375rem',
};

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.25rem',
};

const ITEM: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#7f1d1d',
  display: 'flex',
  gap: '0.375rem',
  alignItems: 'baseline',
};

const CODE_BADGE: CSSProperties = {
  background: '#fee2e2',
  color: '#991b1b',
  padding: '0.0625rem 0.375rem',
  borderRadius: '4px',
  fontSize: '0.6875rem',
  fontFamily: 'monospace',
  fontWeight: 600,
  flexShrink: 0,
};

export function ValidationBanner<T extends FieldValues>({ errors }: ValidationBannerProps<T>) {
  const issues: ValidationIssue[] = mapValidationErrorsToSimulationCodes(errors);

  if (issues.length === 0) return null;

  return (
    <div style={BANNER} role="alert" data-testid="validation-banner">
      <p style={TITLE}>Validation failed ({issues.length} issue{issues.length > 1 ? 's' : ''})</p>
      <ul style={LIST}>
        {issues.map((issue, i) => (
          <li key={`${issue.path}-${i}`} style={ITEM}>
            <span style={CODE_BADGE}>{issue.code}</span>
            <span><strong>{issue.path}</strong>: {issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
