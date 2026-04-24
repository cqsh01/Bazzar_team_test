import type { FieldErrors, FieldValues } from 'react-hook-form';

export type SimulationErrorCode = 'CONFIG_VALIDATION_FAILED' | 'MISSING_UNIT_CONFIG' | 'INVALID_NUMERIC_VALUE';

export interface ValidationIssue {
  code: SimulationErrorCode;
  message: string;
  path: string;
}

const REQUIRED_UNIT_FIELDS = new Set([
  'unit_config.unit_id',
  'unit_config.base_damage',
  'unit_config.base_attack_cooldown',
  'unit_config.crit_chance',
  'unit_config.max_health',
  'unit_config.initial_shield',
  'unit_config.initial_heal_pool',
]);

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function isNestedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractMessage(value: unknown): string | null {
  if (!isNestedRecord(value)) {
    return null;
  }
  const message = value.message;
  return typeof message === 'string' ? message : null;
}

function extractType(value: unknown): string {
  if (!isNestedRecord(value)) return '';
  return typeof value.type === 'string' ? value.type : '';
}

function collectIssues(record: Record<string, unknown>, basePath = ''): ValidationIssue[] {
  return Object.entries(record).flatMap(([key, value]) => {
    const path = joinPath(basePath, key);
    const directMessage = extractMessage(value);
    if (directMessage) {
      const errorType = extractType(value);
      const isRequiredError = errorType === 'required' || directMessage.includes('required');
      const code: SimulationErrorCode = isRequiredError
        ? 'MISSING_UNIT_CONFIG'
        : 'INVALID_NUMERIC_VALUE';
      return [{ code, message: directMessage, path }];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry, index) => (isNestedRecord(entry) ? collectIssues(entry, `${path}.${index}`) : []));
    }

    return isNestedRecord(value) ? collectIssues(value, path) : [];
  });
}

export function mapValidationErrorsToSimulationCodes<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
): ValidationIssue[] {
  return collectIssues(errors as Record<string, unknown>);
}

export function summarizeValidationIssues(issues: ValidationIssue[]): ValidationIssue | null {
  if (issues.length === 0) {
    return null;
  }
  if (issues.some((issue) => issue.code === 'MISSING_UNIT_CONFIG')) {
    return issues.find((issue) => issue.code === 'MISSING_UNIT_CONFIG') ?? issues[0];
  }
  return issues[0];
}
