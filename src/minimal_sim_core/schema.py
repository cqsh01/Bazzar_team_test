from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, TypedDict


class GlobalConfigDict(TypedDict, total=False):
    simulation_duration: float
    time_precision: float
    min_cooldown_default: float
    min_cooldown_absolute: float
    max_events: int
    dummy_target_id: str
    dummy_target_health: float
    dummy_target_shield: int
    debug_mode: bool
    ignore_unknown_fields: bool


class UnitConfigDict(TypedDict):
    unit_id: str
    base_damage: int
    base_attack_cooldown: float
    crit_chance: float
    max_health: int
    initial_shield: int
    initial_heal_pool: int


class ItemModifierDict(TypedDict, total=False):
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


@dataclass(frozen=True)
class GlobalConfig:
    simulation_duration: float = 30.0
    time_precision: float = 0.1
    min_cooldown_default: float = 1.0
    min_cooldown_absolute: float = 0.5
    max_events: int = 10_000
    dummy_target_id: str = "dummy"
    dummy_target_health: float = float("inf")
    dummy_target_shield: int = 0
    debug_mode: bool = False
    ignore_unknown_fields: bool = False


@dataclass(frozen=True)
class UnitApiConfig:
    unit_id: str
    base_damage: int
    base_attack_cooldown: float
    crit_chance: float
    max_health: int
    initial_shield: int = 0
    initial_heal_pool: int = 0


@dataclass(frozen=True)
class ItemModifierConfig:
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
