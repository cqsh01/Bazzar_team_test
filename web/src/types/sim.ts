// ---------------------------------------------------------------------------
// Enchantment type — all 13 game enchantments + NONE
// ---------------------------------------------------------------------------

export const ENCHANTMENT_TYPES = [
  'NONE',
  'SLOW',
  'BURN',
  'POISON',
  'FLASH',
  'OBSIDIAN',
  'HEAL',
  'SHIELD',
  'ACCELERATE',
  'FREEZE',
  'CRIT',
  'GOLD',
  'RADIANCE',
  'EVERGREEN',
] as const;

export type EnchantmentType = (typeof ENCHANTMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// EFFECT_SLOT_MAPPING — mirrors backend schema.EFFECT_SLOT_MAPPING
// ---------------------------------------------------------------------------

export const EFFECT_SLOT_MAPPING: Record<EnchantmentType, readonly string[]> = {
  NONE: [],
  SLOW: ['slow_duration', 'slow_value'],
  BURN: ['burn_damage', 'burn_duration'],
  POISON: ['poison_damage', 'poison_duration'],
  FLASH: ['flash_damage', 'flash_cooldown_reduction'],
  OBSIDIAN: ['obsidian_shield', 'obsidian_duration'],
  HEAL: ['heal_amount', 'heal_interval'],
  SHIELD: ['shield_amount', 'shield_duration'],
  ACCELERATE: ['accelerate_value', 'accelerate_duration'],
  FREEZE: ['freeze_duration', 'freeze_chance'],
  CRIT: ['crit_bonus', 'crit_duration'],
  GOLD: ['gold_bonus', 'gold_chance'],
  RADIANCE: ['radiance_damage', 'radiance_radius'],
  EVERGREEN: ['evergreen_heal', 'evergreen_duration'],
} as const;

// ---------------------------------------------------------------------------
// EFFECT_SLOT_ROUTING — maps each slot to the engine computation stage.
// Mirrors backend schema.EFFECT_SLOT_ROUTING.
// ---------------------------------------------------------------------------

export const EFFECT_SLOT_ROUTING: Record<string, string> = {
  slow_duration: 'slow_debuff',
  slow_value: 'slow_debuff',
  burn_damage: 'damage_over_time',
  burn_duration: 'damage_over_time',
  poison_damage: 'damage_over_time',
  poison_duration: 'damage_over_time',
  flash_damage: 'flat_damage',
  flash_cooldown_reduction: 'cooldown_delta',
  obsidian_shield: 'shield_grant',
  obsidian_duration: 'shield_grant',
  heal_amount: 'heal_over_time',
  heal_interval: 'heal_over_time',
  shield_amount: 'shield_grant',
  shield_duration: 'shield_grant',
  accelerate_value: 'cooldown_delta',
  accelerate_duration: 'cooldown_delta',
  freeze_duration: 'freeze_debuff',
  freeze_chance: 'freeze_debuff',
  crit_bonus: 'crit_multiplier',
  crit_duration: 'crit_multiplier',
  gold_bonus: 'gold_reward',
  gold_chance: 'gold_reward',
  radiance_damage: 'damage_over_time',
  radiance_radius: 'damage_over_time',
  evergreen_heal: 'heal_over_time',
  evergreen_duration: 'heal_over_time',
} as const;

// ---------------------------------------------------------------------------
// Core request types
// ---------------------------------------------------------------------------

export interface GlobalConfig {
  simulation_duration?: number;
  time_precision?: number;
  min_cooldown_default?: number;
  min_cooldown_absolute?: number;
  max_events?: number;
  dummy_target_id?: string;
  /** @deprecated Use BattleContext.enemy_hp instead. */
  dummy_target_health?: number;
  /** @deprecated Use BattleContext.self_shield instead. */
  dummy_target_shield?: number;
  debug_mode?: boolean;
  ignore_unknown_fields?: boolean;
}

export interface BattleContext {
  self_hp: number;
  self_shield: number;
  enemy_hp: number;
}

export interface UnitConfig {
  unit_id: string;
  base_attack_cooldown: number;
  battle_context: BattleContext;
}

export const DAMAGE_TYPES = ['NORMAL', 'FIRE', 'TOXIC'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/**
 * @deprecated Prefer contextual_effects for enchantment-driven values.
 * If both modifiers and contextual_effects are present on the same item,
 * contextual_effects takes precedence and modifiers is ignored with a warning.
 */
export interface ItemModifierConfig {
  flat_damage_bonus?: number;
  crit_multiplier?: number;
  global_damage_multiplier?: number;
  shield_damage_mapping_multiplier?: number | null;
  invulnerable_normal_damage?: boolean;
  cooldown_delta?: number;
  bypass_cooldown_floor?: boolean;
  damage_type_override?: DamageType | null;
}

export interface ItemConfig {
  buff_id: string;
  owner_id?: string;
  duration?: number | null;
  loadout_order_index?: number;
  max_stacks?: number;
  stackable?: boolean;
  enchantment_type?: EnchantmentType;
  contextual_effects?: Record<string, number>;
  /** @deprecated If contextual_effects is present and non-empty, modifiers is ignored. */
  modifiers?: ItemModifierConfig;
}

export interface SkillConfig {
  skill_id: string;
  owner_id?: string;
  interval?: number;
  duration?: number | null;
  max_ticks?: number | null;
  source_base_damage?: number;
  damage_type?: DamageType;
  immediate_first_tick?: boolean;
  loadout_order_index?: number;
  damage_owner_id?: string | null;
}

export interface SimulateRequest {
  global_config: GlobalConfig;
  unit_config: UnitConfig;
  item_configs: ItemConfig[];
  skill_configs: SkillConfig[];
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface SimulationSummary {
  total_damage: number;
  dps: number;
  per_owner_damage: Record<string, number>;
  event_count: number;
  attack_count: number;
  periodic_damage_total: number;
  periodic_tick_count: number;
}

export interface ChartPoint {
  time: number;
  total_dps_window: number;
  shield_value: number;
  hp_value: number;
}

export interface DebugTimelineEntry {
  time: number;
  source_id: string;
  damage: number;
  damage_type: string;
  is_periodic: boolean;
  hp_after: number;
  shield_after: number;
}

export interface SimulateSuccessData {
  summary: SimulationSummary;
  charts: ChartPoint[];
  input_echo: SimulateRequest;
  warnings?: string[];
  debug_timeline?: DebugTimelineEntry[];
}

export interface SimulationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SimulateSuccessResponse {
  protocol_version: string;
  status: 'success';
  data: SimulateSuccessData;
}

export interface SimulateErrorResponse {
  protocol_version: string;
  status: 'error';
  error: SimulationError;
}

export type SimulateResponse = SimulateSuccessResponse | SimulateErrorResponse;

export interface SchemaResponse {
  $schema: string;
  $id: string;
  title: string;
  type: string;
  required: string[];
  properties: Record<string, unknown>;
  additionalProperties?: boolean;
  $defs: Record<string, unknown>;
}
