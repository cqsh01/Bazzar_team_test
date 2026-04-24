import { EFFECT_SLOT_MAPPING, type EnchantmentType, ENCHANTMENT_TYPES } from '../types/sim';

// ---------------------------------------------------------------------------
// Slot definition — describes a single numeric input for an enchantment
// ---------------------------------------------------------------------------

export interface EffectSlotDef {
  slotName: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

// ---------------------------------------------------------------------------
// Per-enchantment slot definitions
// ---------------------------------------------------------------------------

export const ENCHANTMENT_SLOT_DEFS: Record<EnchantmentType, readonly EffectSlotDef[]> = {
  NONE: [],
  SLOW: [
    { slotName: 'slow_duration', label: '减速持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 2.0 },
    { slotName: 'slow_value', label: '减速比例', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
  ],
  BURN: [
    { slotName: 'burn_damage', label: '灼烧伤害', min: 0, max: 9999, step: 1, defaultValue: 10 },
    { slotName: 'burn_duration', label: '灼烧持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 3.0 },
  ],
  POISON: [
    { slotName: 'poison_damage', label: '中毒伤害', min: 0, max: 9999, step: 1, defaultValue: 8 },
    { slotName: 'poison_duration', label: '中毒持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 4.0 },
  ],
  FLASH: [
    { slotName: 'flash_damage', label: '闪光伤害', min: 0, max: 9999, step: 1, defaultValue: 20 },
    { slotName: 'flash_cooldown_reduction', label: '冷却缩减 (s)', min: 0, max: 10, step: 0.1, defaultValue: 0.5 },
  ],
  OBSIDIAN: [
    { slotName: 'obsidian_shield', label: '黑曜石护盾值', min: 0, max: 9999, step: 1, defaultValue: 50 },
    { slotName: 'obsidian_duration', label: '持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 5.0 },
  ],
  HEAL: [
    { slotName: 'heal_amount', label: '治疗量', min: 0, max: 9999, step: 1, defaultValue: 15 },
    { slotName: 'heal_interval', label: '治疗间隔 (s)', min: 0.1, max: 10, step: 0.1, defaultValue: 1.0 },
  ],
  SHIELD: [
    { slotName: 'shield_amount', label: '护盾值', min: 0, max: 9999, step: 1, defaultValue: 30 },
    { slotName: 'shield_duration', label: '持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 5.0 },
  ],
  ACCELERATE: [
    { slotName: 'accelerate_value', label: '加速比例', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { slotName: 'accelerate_duration', label: '加速持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 3.0 },
  ],
  FREEZE: [
    { slotName: 'freeze_duration', label: '冻结持续时间 (s)', min: 0, max: 10, step: 0.1, defaultValue: 1.5 },
    { slotName: 'freeze_chance', label: '冻结概率', min: 0, max: 1, step: 0.01, defaultValue: 0.25 },
  ],
  CRIT: [
    { slotName: 'crit_bonus', label: '暴击加成', min: 0, max: 10, step: 0.01, defaultValue: 0.5 },
    { slotName: 'crit_duration', label: '持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 5.0 },
  ],
  GOLD: [
    { slotName: 'gold_bonus', label: '金币加成', min: 0, max: 9999, step: 1, defaultValue: 5 },
    { slotName: 'gold_chance', label: '触发概率', min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
  ],
  RADIANCE: [
    { slotName: 'radiance_damage', label: '光辉伤害', min: 0, max: 9999, step: 1, defaultValue: 25 },
    { slotName: 'radiance_radius', label: '光辉范围', min: 0, max: 10, step: 0.1, defaultValue: 2.0 },
  ],
  EVERGREEN: [
    { slotName: 'evergreen_heal', label: '常青治疗量', min: 0, max: 9999, step: 1, defaultValue: 10 },
    { slotName: 'evergreen_duration', label: '持续时间 (s)', min: 0, max: 30, step: 0.1, defaultValue: 6.0 },
  ],
} as const;

// ---------------------------------------------------------------------------
// Item catalog entry — template for UI-driven item creation
// ---------------------------------------------------------------------------

export interface ItemCatalogEntry {
  id: string;
  name: string;
  allowedEnchantments: readonly EnchantmentType[];
  defaultEnchantment: EnchantmentType;
}

export const ITEM_CATALOG: readonly ItemCatalogEntry[] = [
  {
    id: 'template_slow',
    name: 'Frost Blade',
    allowedEnchantments: ['NONE', 'SLOW', 'FREEZE'],
    defaultEnchantment: 'SLOW',
  },
  {
    id: 'template_burn',
    name: 'Inferno Scepter',
    allowedEnchantments: ['NONE', 'BURN', 'RADIANCE'],
    defaultEnchantment: 'BURN',
  },
  {
    id: 'template_heal',
    name: 'Verdant Amulet',
    allowedEnchantments: ['NONE', 'HEAL', 'SHIELD', 'EVERGREEN'],
    defaultEnchantment: 'HEAL',
  },
] as const;

// ---------------------------------------------------------------------------
// Frontend validation — mirrors backend validate_contextual_effects
// ---------------------------------------------------------------------------

export function validateContextualEffects(
  enchantmentType: EnchantmentType,
  effects: Record<string, number>,
): string | null {
  const allowed = EFFECT_SLOT_MAPPING[enchantmentType];
  if (!allowed) {
    return `Unknown enchantment_type: '${enchantmentType}'. Must be one of: ${ENCHANTMENT_TYPES.join(', ')}`;
  }

  const allowedSet = new Set(allowed);
  const unauthorized = Object.keys(effects).filter((key) => !allowedSet.has(key));

  if (unauthorized.length > 0) {
    return (
      `Unauthorized contextual_effects keys for ${enchantmentType}: ` +
      `${unauthorized.sort().join(', ')}. ` +
      `Allowed: ${allowed.length > 0 ? [...allowed].sort().join(', ') : '(none)'}`
    );
  }

  return null;
}
