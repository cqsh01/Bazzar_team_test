import type { GlobalConfig, ItemConfig, ItemModifierConfig, SimulateRequest, SkillConfig, UnitConfig, BattleContext } from '../types/sim';

export const CONFIG_META_VERSION = 'v1' as const;
export const UNSUPPORTED_SCHEMA_VERSION = 'UNSUPPORTED_SCHEMA_VERSION' as const;
export const INVALID_CONFIG_JSON = 'INVALID_CONFIG_JSON' as const;

export type PersistenceErrorCode = typeof UNSUPPORTED_SCHEMA_VERSION | typeof INVALID_CONFIG_JSON;

export class PersistenceError extends Error {
  code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}

export interface VersionedConfigSnapshot extends SimulateRequest {
  __meta_version: typeof CONFIG_META_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || isBoolean(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumber(value);
}

function isNullableNumber(value: unknown): boolean {
  return value === undefined || value === null || isNumber(value);
}

function isNullableString(value: unknown): boolean {
  return value === undefined || value === null || isString(value);
}

function isDamageType(value: unknown): value is 'NORMAL' | 'FIRE' | 'TOXIC' {
  return value === 'NORMAL' || value === 'FIRE' || value === 'TOXIC';
}

function isDamageTypeOverride(value: unknown): boolean {
  return value === undefined || value === null || isDamageType(value);
}

function isGlobalConfig(value: unknown): value is GlobalConfig {
  if (!isRecord(value)) return false;
  return (
    isOptionalNumber(value.simulation_duration) &&
    isOptionalNumber(value.time_precision) &&
    isOptionalNumber(value.min_cooldown_default) &&
    isOptionalNumber(value.min_cooldown_absolute) &&
    isOptionalNumber(value.max_events) &&
    isOptionalString(value.dummy_target_id) &&
    isOptionalNumber(value.dummy_target_health) &&
    isOptionalNumber(value.dummy_target_shield) &&
    isOptionalBoolean(value.debug_mode) &&
    isOptionalBoolean(value.ignore_unknown_fields)
  );
}

function isBattleContext(value: unknown): value is BattleContext {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.self_hp) &&
    isNumber(value.self_shield) &&
    isNumber(value.enemy_hp)
  );
}

function isUnitConfig(value: unknown): value is UnitConfig {
  if (!isRecord(value)) return false;
  return (
    isString(value.unit_id) &&
    isNumber(value.base_attack_cooldown) &&
    isBattleContext(value.battle_context)
  );
}

function isItemModifierConfig(value: unknown): value is ItemModifierConfig {
  if (!isRecord(value)) return false;
  return (
    isOptionalNumber(value.flat_damage_bonus) &&
    isOptionalNumber(value.crit_multiplier) &&
    isOptionalNumber(value.global_damage_multiplier) &&
    isNullableNumber(value.shield_damage_mapping_multiplier) &&
    isOptionalBoolean(value.invulnerable_normal_damage) &&
    isOptionalNumber(value.cooldown_delta) &&
    isOptionalBoolean(value.bypass_cooldown_floor) &&
    isDamageTypeOverride(value.damage_type_override)
  );
}

function isItemConfig(value: unknown): value is ItemConfig {
  if (!isRecord(value)) return false;
  return (
    isString(value.buff_id) &&
    isOptionalString(value.owner_id) &&
    isNullableNumber(value.duration) &&
    isOptionalNumber(value.loadout_order_index) &&
    isOptionalNumber(value.max_stacks) &&
    isOptionalBoolean(value.stackable) &&
    (value.modifiers === undefined || isItemModifierConfig(value.modifiers))
  );
}

function isSkillConfig(value: unknown): value is SkillConfig {
  if (!isRecord(value)) return false;
  return (
    isString(value.skill_id) &&
    isOptionalString(value.owner_id) &&
    isOptionalNumber(value.interval) &&
    isNullableNumber(value.duration) &&
    isNullableNumber(value.max_ticks) &&
    isOptionalNumber(value.source_base_damage) &&
    (value.damage_type === undefined || isDamageType(value.damage_type)) &&
    isOptionalBoolean(value.immediate_first_tick) &&
    isOptionalNumber(value.loadout_order_index) &&
    isNullableString(value.damage_owner_id)
  );
}

export function isSimulateRequest(value: unknown): value is SimulateRequest {
  if (!isRecord(value)) return false;
  return (
    isGlobalConfig(value.global_config) &&
    isUnitConfig(value.unit_config) &&
    Array.isArray(value.item_configs) &&
    value.item_configs.every((entry) => isItemConfig(entry)) &&
    Array.isArray(value.skill_configs) &&
    value.skill_configs.every((entry) => isSkillConfig(entry))
  );
}

function buildTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function exportConfigAsJson(config: SimulateRequest): void {
  const snapshot: VersionedConfigSnapshot = {
    __meta_version: CONFIG_META_VERSION,
    ...config,
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bazaar_config_${buildTimestamp(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function migrateConfig(raw: unknown): SimulateRequest {
  if (!isRecord(raw) || !('__meta_version' in raw)) {
    throw new PersistenceError(UNSUPPORTED_SCHEMA_VERSION, 'Missing config snapshot version.');
  }
  throw new PersistenceError(UNSUPPORTED_SCHEMA_VERSION, `Unsupported config snapshot version: ${String(raw.__meta_version)}`);
}

export async function importConfigFromJson(file: File): Promise<SimulateRequest> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new PersistenceError(INVALID_CONFIG_JSON, 'Invalid JSON file.');
  }

  if (!isRecord(parsed)) {
    throw new PersistenceError(INVALID_CONFIG_JSON, 'Imported snapshot must be an object.');
  }

  if (parsed.__meta_version !== CONFIG_META_VERSION) {
    return migrateConfig(parsed);
  }

  const candidate: unknown = {
    global_config: parsed.global_config,
    unit_config: parsed.unit_config,
    item_configs: parsed.item_configs,
    skill_configs: parsed.skill_configs,
  };

  if (!isSimulateRequest(candidate)) {
    throw new PersistenceError(INVALID_CONFIG_JSON, 'Snapshot does not match SimulateRequest shape.');
  }

  return candidate;
}
