from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, TypedDict


# ---------------------------------------------------------------------------
# Enchantment type enumeration — covers all 13 game enchantments + NONE
# ---------------------------------------------------------------------------

class EnchantmentType(str, Enum):
    NONE = "NONE"
    SLOW = "SLOW"
    BURN = "BURN"
    POISON = "POISON"
    FLASH = "FLASH"
    OBSIDIAN = "OBSIDIAN"
    HEAL = "HEAL"
    SHIELD = "SHIELD"
    ACCELERATE = "ACCELERATE"
    FREEZE = "FREEZE"
    CRIT = "CRIT"
    GOLD = "GOLD"
    RADIANCE = "RADIANCE"
    EVERGREEN = "EVERGREEN"


# ---------------------------------------------------------------------------
# EFFECT_SLOT_MAPPING — defines which contextual_effects keys are legal
# for each enchantment type. Keys not listed here are rejected at validation.
# ---------------------------------------------------------------------------

EFFECT_SLOT_MAPPING: Dict[str, List[str]] = {
    EnchantmentType.NONE.value: [],
    EnchantmentType.SLOW.value: ["slow_duration", "slow_value"],
    EnchantmentType.BURN.value: ["burn_damage", "burn_duration"],
    EnchantmentType.POISON.value: ["poison_damage", "poison_duration"],
    EnchantmentType.FLASH.value: ["flash_damage", "flash_cooldown_reduction"],
    EnchantmentType.OBSIDIAN.value: ["obsidian_shield", "obsidian_duration"],
    EnchantmentType.HEAL.value: ["heal_amount", "heal_interval"],
    EnchantmentType.SHIELD.value: ["shield_amount", "shield_duration"],
    EnchantmentType.ACCELERATE.value: ["accelerate_value", "accelerate_duration"],
    EnchantmentType.FREEZE.value: ["freeze_duration", "freeze_chance"],
    EnchantmentType.CRIT.value: ["crit_bonus", "crit_duration"],
    EnchantmentType.GOLD.value: ["gold_bonus", "gold_chance"],
    EnchantmentType.RADIANCE.value: ["radiance_damage", "radiance_radius"],
    EnchantmentType.EVERGREEN.value: ["evergreen_heal", "evergreen_duration"],
}


# ---------------------------------------------------------------------------
# EFFECT_SLOT_ROUTING — maps each contextual_effects key to the engine
# computation stage where the value is injected.
#
# Stages:
#   "flat_damage"        → additive bonus applied at Stage 1 (base + flat)
#   "cooldown_delta"     → subtracted from attack cooldown
#   "damage_multiplier"  → multiplicative modifier at Stage 3
#   "crit_multiplier"    → multiplicative crit bonus at Stage 2
#   "shield_grant"       → applied as shield HP at buff-apply time
#   "heal_over_time"     → periodic heal injection
#   "damage_over_time"   → periodic damage injection
#   "slow_debuff"        → enemy cooldown increase (future)
#   "freeze_debuff"      → enemy stun (future)
#   "gold_reward"        → gold on hit (future, non-combat)
#
# Routing entries that target a "future" stage are accepted by the schema
# but have no engine handler yet — they are forward-compatible placeholders.
# ---------------------------------------------------------------------------

EFFECT_SLOT_ROUTING: Dict[str, str] = {
    # SLOW
    "slow_duration": "slow_debuff",
    "slow_value": "slow_debuff",
    # BURN
    "burn_damage": "damage_over_time",
    "burn_duration": "damage_over_time",
    # POISON
    "poison_damage": "damage_over_time",
    "poison_duration": "damage_over_time",
    # FLASH
    "flash_damage": "flat_damage",
    "flash_cooldown_reduction": "cooldown_delta",
    # OBSIDIAN
    "obsidian_shield": "shield_grant",
    "obsidian_duration": "shield_grant",
    # HEAL
    "heal_amount": "heal_over_time",
    "heal_interval": "heal_over_time",
    # SHIELD
    "shield_amount": "shield_grant",
    "shield_duration": "shield_grant",
    # ACCELERATE
    "accelerate_value": "cooldown_delta",
    "accelerate_duration": "cooldown_delta",
    # FREEZE
    "freeze_duration": "freeze_debuff",
    "freeze_chance": "freeze_debuff",
    # CRIT
    "crit_bonus": "crit_multiplier",
    "crit_duration": "crit_multiplier",
    # GOLD
    "gold_bonus": "gold_reward",
    "gold_chance": "gold_reward",
    # RADIANCE
    "radiance_damage": "damage_over_time",
    "radiance_radius": "damage_over_time",
    # EVERGREEN
    "evergreen_heal": "heal_over_time",
    "evergreen_duration": "heal_over_time",
}


# ---------------------------------------------------------------------------
# Validation error
# ---------------------------------------------------------------------------

class ConfigValidationError(ValueError):
    pass


def validate_contextual_effects(
    enchantment_type: str,
    effects: Dict[str, float],
) -> None:
    """Validate that contextual_effects only contains keys authorized by EFFECT_SLOT_MAPPING."""
    if enchantment_type not in EFFECT_SLOT_MAPPING:
        raise ConfigValidationError(
            f"Unknown enchantment_type: '{enchantment_type}'. "
            f"Must be one of: {', '.join(sorted(EFFECT_SLOT_MAPPING.keys()))}"
        )

    allowed: Set[str] = set(EFFECT_SLOT_MAPPING[enchantment_type])
    provided: Set[str] = set(effects.keys())
    unauthorized = provided - allowed

    if unauthorized:
        raise ConfigValidationError(
            f"Unauthorized contextual_effects keys for {enchantment_type}: "
            f"{', '.join(sorted(unauthorized))}. "
            f"Allowed: {', '.join(sorted(allowed)) or '(none)'}"
        )


# ---------------------------------------------------------------------------
# TypedDicts — API-level JSON shapes
# ---------------------------------------------------------------------------

class GlobalConfigDict(TypedDict, total=False):
    simulation_duration: float
    time_precision: float
    min_cooldown_default: float
    min_cooldown_absolute: float
    max_events: int
    dummy_target_id: str
    # DEPRECATED: Use BattleContext.enemy_hp instead.
    # Retained for backward compatibility; will be removed in v2.0.
    dummy_target_health: float
    # DEPRECATED: Use BattleContext.self_shield instead.
    dummy_target_shield: int
    debug_mode: bool
    ignore_unknown_fields: bool


class BattleContextDict(TypedDict):
    self_hp: int
    self_shield: int
    enemy_hp: int


class UnitConfigDict(TypedDict):
    unit_id: str
    base_attack_cooldown: float
    battle_context: BattleContextDict


class ItemModifierDict(TypedDict, total=False):
    """DEPRECATED: Prefer contextual_effects for enchantment-driven values.
    If both modifiers and contextual_effects are present on the same item,
    contextual_effects takes precedence and modifiers is ignored with a warning.
    """
    flat_damage_bonus: float
    crit_multiplier: float
    global_damage_multiplier: float
    shield_damage_mapping_multiplier: Optional[float]
    invulnerable_normal_damage: bool
    cooldown_delta: float
    bypass_cooldown_floor: bool
    damage_type_override: Optional[str]


class ItemConfigDict(TypedDict, total=False):
    buff_id: str
    owner_id: str
    duration: Optional[float]
    loadout_order_index: int
    max_stacks: int
    stackable: bool
    enchantment_type: str
    contextual_effects: Dict[str, float]
    # DEPRECATED: If contextual_effects is present and non-empty, modifiers is ignored.
    modifiers: ItemModifierDict


class SkillConfigDict(TypedDict, total=False):
    skill_id: str
    owner_id: str
    interval: float
    duration: Optional[float]
    max_ticks: Optional[int]
    source_base_damage: float
    damage_type: str
    immediate_first_tick: bool
    loadout_order_index: int
    damage_owner_id: Optional[str]


class SimulationConfigDict(TypedDict):
    global_config: GlobalConfigDict
    unit_config: UnitConfigDict
    item_configs: List[ItemConfigDict]
    skill_configs: List[SkillConfigDict]


# ---------------------------------------------------------------------------
# Frozen dataclasses — internal parsed representations
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class GlobalConfig:
    simulation_duration: float = 30.0
    time_precision: float = 0.1
    min_cooldown_default: float = 1.0
    min_cooldown_absolute: float = 0.5
    max_events: int = 10_000
    dummy_target_id: str = "dummy"
    # DEPRECATED: Use BattleContext.enemy_hp instead.
    dummy_target_health: float = float("inf")
    # DEPRECATED: Use BattleContext.self_shield instead.
    dummy_target_shield: int = 0
    debug_mode: bool = False
    ignore_unknown_fields: bool = False


@dataclass(frozen=True)
class BattleContext:
    self_hp: int
    self_shield: int
    enemy_hp: int


@dataclass(frozen=True)
class UnitApiConfig:
    unit_id: str
    base_attack_cooldown: float
    battle_context: BattleContext = field(default_factory=lambda: BattleContext(self_hp=1000, self_shield=0, enemy_hp=1000))


@dataclass(frozen=True)
class ItemModifierConfig:
    """DEPRECATED: Prefer contextual_effects.
    If both present, contextual_effects takes precedence. modifiers is ignored.
    """
    flat_damage_bonus: float = 0.0
    crit_multiplier: float = 1.0
    global_damage_multiplier: float = 1.0
    shield_damage_mapping_multiplier: Optional[float] = None
    invulnerable_normal_damage: bool = False
    cooldown_delta: float = 0.0
    bypass_cooldown_floor: bool = False
    damage_type_override: Optional[str] = None


@dataclass(frozen=True)
class ItemConfig:
    buff_id: str
    owner_id: str = "hero"
    duration: Optional[float] = None
    loadout_order_index: int = 0
    max_stacks: int = 1
    stackable: bool = False
    enchantment_type: str = EnchantmentType.NONE.value
    contextual_effects: Dict[str, float] = field(default_factory=dict)
    # DEPRECATED: If contextual_effects is present and non-empty, modifiers is ignored.
    modifiers: ItemModifierConfig = field(default_factory=ItemModifierConfig)


@dataclass(frozen=True)
class SkillConfig:
    skill_id: str
    owner_id: str = "hero"
    interval: float = 1.0
    duration: Optional[float] = None
    max_ticks: Optional[int] = None
    source_base_damage: float = 0.0
    damage_type: str = "NORMAL"
    immediate_first_tick: bool = False
    loadout_order_index: int = 0
    damage_owner_id: Optional[str] = None
