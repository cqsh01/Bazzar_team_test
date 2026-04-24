from __future__ import annotations

import math

from dataclasses import asdict
from typing import Dict, Optional

from .constants import PROTOCOL_VERSION, SimulationErrorCode
from .periodic_effect import PeriodicEffectDefinition
from .schema import (
    BattleContext,
    EFFECT_SLOT_ROUTING,
    GlobalConfig,
    ItemConfig,
    ItemConfigDict,
    ItemModifierConfig,
    SkillConfig,
    SkillConfigDict,
    SimulationConfigDict,
    UnitApiConfig,
    validate_contextual_effects,
    ConfigValidationError,
)
from .simulation_core import SimulationCore
from .world_state import (
    BuffDefinition,
    BuffModifierDefinition,
    CooldownState,
    DamageType,
    DummyTargetRuntime,
    EnchantmentData,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
)


_REQUIRED_UNIT_FIELDS = {
    "unit_id",
    "base_attack_cooldown",
    "battle_context",
}
_REQUIRED_BATTLE_CONTEXT_FIELDS = {"self_hp", "self_shield", "enemy_hp"}
_DEPRECATED_KEYS: list[tuple[str, str]] = []
_ALLOWED_TOP_LEVEL_KEYS = {"global_config", "unit_config", "item_configs", "skill_configs"}

# Legacy fields that are silently accepted for migration but no longer required
_LEGACY_UNIT_FIELDS = {"base_damage", "crit_chance", "max_health", "initial_shield", "initial_heal_pool"}

# Global config fields that are deprecated in favor of BattleContext
_DEPRECATED_GLOBAL_FIELDS = {
    "dummy_target_health": "BattleContext.enemy_hp",
    "dummy_target_shield": "BattleContext.self_shield",
}


def simulate(config: dict) -> dict:
    try:
        normalized, warnings = _normalize_config(config)
        scenario = _build_scenario(normalized)
        result = SimulationCore(scenario).run()
        metrics = result.metrics
        summary = {
            key: metrics[key]
            for key in (
                "total_damage",
                "dps",
                "per_owner_damage",
                "event_count",
                "attack_count",
                "periodic_damage_total",
                "periodic_tick_count",
            )
        }
        response_data = {
            "summary": summary,
            "charts": result.world_state.metrics.generate_chart_points(
                initial_hp=normalized["unit_config"]["battle_context"]["enemy_hp"],
                initial_shield=normalized["unit_config"]["battle_context"]["self_shield"],
                max_points=300,
            ),
            "input_echo": normalized,
        }
        if warnings:
            response_data["warnings"] = warnings
        if normalized["global_config"].get("debug_mode", False):
            response_data["debug_timeline"] = metrics["timeline_events"]
        return {
            "protocol_version": PROTOCOL_VERSION,
            "status": "success",
            "data": response_data,
        }
    except ConfigValidationError as exc:
        code = _map_config_error(str(exc))
        return _format_error(code, str(exc))
    except OverflowError as exc:
        return _format_error(SimulationErrorCode.SIMULATION_OVERFLOW, str(exc))
    except (TypeError, ValueError) as exc:
        return _format_error(SimulationErrorCode.CONFIG_VALIDATION_FAILED, str(exc))
    except Exception as exc:
        return _format_error(SimulationErrorCode.INTERNAL_ENGINE_ERROR, str(exc))


def _format_error(
    code: SimulationErrorCode,
    message: str,
    details: Optional[Dict[str, object]] = None,
) -> dict:
    error = {
        "code": code.value,
        "message": message,
    }
    if details:
        error["details"] = details
    return {
        "protocol_version": PROTOCOL_VERSION,
        "status": "error",
        "error": error,
    }


def _map_config_error(message: str) -> SimulationErrorCode:
    if message == "missing required field: unit_config" or message.startswith("missing required unit_config fields"):
        return SimulationErrorCode.MISSING_UNIT_CONFIG
    if "battle_context" in message:
        return SimulationErrorCode.MISSING_UNIT_CONFIG
    invalid_markers = (
        "must be > 0",
        "must be >= 0",
        "must be between 0 and 1",
        "skill interval",
        "skill source_base_damage",
        "skill duration",
        "skill max_ticks",
    )
    if any(marker in message for marker in invalid_markers):
        return SimulationErrorCode.INVALID_NUMERIC_VALUE
    if "enchantment_type" in message or "contextual_effects" in message:
        return SimulationErrorCode.CONFIG_VALIDATION_FAILED
    return SimulationErrorCode.CONFIG_VALIDATION_FAILED


def _normalize_config(config: SimulationConfigDict) -> tuple[Dict[str, object], list[str]]:
    if not isinstance(config, dict):
        raise ConfigValidationError("config must be a dict")

    global_config_raw = config.get("global_config", {})
    unit_config_raw = config.get("unit_config")
    item_configs_raw = config.get("item_configs", [])
    skill_configs_raw = config.get("skill_configs", [])

    if unit_config_raw is None:
        raise ConfigValidationError("missing required field: unit_config")

    missing = sorted(_REQUIRED_UNIT_FIELDS.difference(unit_config_raw.keys()))
    if missing:
        raise ConfigValidationError(f"missing required unit_config fields: {', '.join(missing)}")

    battle_ctx_raw = unit_config_raw.get("battle_context")
    if not isinstance(battle_ctx_raw, dict):
        raise ConfigValidationError("unit_config.battle_context must be a dict")
    missing_bc = sorted(_REQUIRED_BATTLE_CONTEXT_FIELDS.difference(battle_ctx_raw.keys()))
    if missing_bc:
        raise ConfigValidationError(f"missing required battle_context fields: {', '.join(missing_bc)}")

    global_config = GlobalConfig(**global_config_raw)

    battle_context = BattleContext(**battle_ctx_raw)
    unit_filtered = {k: v for k, v in unit_config_raw.items() if k not in _LEGACY_UNIT_FIELDS and k != "battle_context"}
    unit_config = UnitApiConfig(**unit_filtered, battle_context=battle_context)

    _validate_global(global_config)
    _validate_unit(unit_config)

    warnings: list[str] = []
    warnings.extend(_collect_deprecation_warnings(config))
    if not global_config.ignore_unknown_fields:
        warnings.extend(_collect_unknown_field_warnings(config))

    # Validate items and their contextual_effects
    # If both modifiers and contextual_effects present, contextual_effects wins (Fix 1)
    normalized_items = []
    for item_raw in item_configs_raw:
        enchantment_type = item_raw.get("enchantment_type", "NONE")
        contextual_effects = item_raw.get("contextual_effects", {})
        validate_contextual_effects(enchantment_type, contextual_effects)

        modifiers_raw = item_raw.get("modifiers", {})
        has_contextual = bool(contextual_effects)
        has_modifiers = any(v not in (0, 0.0, 1, 1.0, None, False, "") for v in modifiers_raw.values()) if modifiers_raw else False
        if has_contextual and has_modifiers:
            warnings.append(
                f"item '{item_raw.get('buff_id', '?')}': both contextual_effects and modifiers present. "
                f"contextual_effects takes precedence; modifiers is ignored."
            )
            modifiers_raw = {}

        item_fields = {k: v for k, v in item_raw.items() if k not in ("modifiers",)}
        item = ItemConfig(**item_fields, modifiers=ItemModifierConfig(**modifiers_raw))
        normalized_items.append(asdict(item))

    normalized_skills = [asdict(SkillConfig(**skill)) for skill in skill_configs_raw]

    return {
        "global_config": asdict(global_config),
        "unit_config": {
            "unit_id": unit_config.unit_id,
            "base_attack_cooldown": unit_config.base_attack_cooldown,
            "battle_context": asdict(unit_config.battle_context),
        },
        "item_configs": normalized_items,
        "skill_configs": normalized_skills,
    }, warnings


def _collect_deprecation_warnings(config: dict) -> list[str]:
    warnings: list[str] = []
    for deprecated_key, replacement_key in _DEPRECATED_KEYS:
        if deprecated_key in config:
            warnings.append(f"\u5b57\u6bb5 '{deprecated_key}' \u5c06\u5728 v2.0 \u5f03\u7528\uff0c\u8bf7\u4f7f\u7528 '{replacement_key}' \u66ff\u4ee3")
    unit_raw = config.get("unit_config", {})
    for legacy_field in sorted(_LEGACY_UNIT_FIELDS.intersection(unit_raw.keys())):
        warnings.append(f"unit_config.{legacy_field} is deprecated in v6.1 contract and will be ignored")
    global_raw = config.get("global_config", {})
    for dep_field, replacement in sorted(_DEPRECATED_GLOBAL_FIELDS.items()):
        if dep_field in global_raw:
            warnings.append(f"global_config.{dep_field} is deprecated. Use {replacement} instead")
    return warnings

def _collect_unknown_field_warnings(config: dict) -> list[str]:
    warnings: list[str] = []
    for unknown_key in sorted(set(config.keys()) - _ALLOWED_TOP_LEVEL_KEYS):
        warnings.append(f"字段 '{unknown_key}' 将在 v2.0 弃用，请使用 'global_config' 或对应配置分组替代")
    return warnings


def _build_scenario(normalized: Dict[str, object]) -> SimulationScenario:
    global_config = GlobalConfig(**normalized["global_config"])
    unit_raw = normalized["unit_config"]
    battle_ctx = BattleContext(**unit_raw["battle_context"])
    item_configs_raw = normalized["item_configs"]
    skill_configs_raw = normalized["skill_configs"]

    buffs = tuple(_convert_item_config(item) for item in item_configs_raw)
    periodic_effects = tuple(_convert_skill_config(skill) for skill in skill_configs_raw)
    cooldowns = (CooldownState(owner_id=unit_raw["unit_id"], base_cooldown=unit_raw["base_attack_cooldown"]),)

    dummy_health = global_config.dummy_target_health if math.isfinite(global_config.dummy_target_health) else float(battle_ctx.enemy_hp)
    dummy_shield = global_config.dummy_target_shield if global_config.dummy_target_shield > 0 else battle_ctx.self_shield

    return SimulationScenario(
        config=SimulationConfig(
            simulation_duration=global_config.simulation_duration,
            time_precision=global_config.time_precision,
            min_cooldown_default=global_config.min_cooldown_default,
            min_cooldown_absolute=global_config.min_cooldown_absolute,
            max_events=global_config.max_events,
        ),
        unit=UnitConfig(
            unit_id=unit_raw["unit_id"],
            base_damage=0,
            base_attack_cooldown=unit_raw["base_attack_cooldown"],
            crit_chance=0.0,
            max_health=battle_ctx.self_hp,
            initial_shield=battle_ctx.self_shield,
            initial_heal_pool=0,
        ),
        dummy_target=DummyTargetRuntime(
            target_id=global_config.dummy_target_id,
            current_health=dummy_health,
            current_shield=dummy_shield,
        ),
        cooldowns=cooldowns,
        initial_buffs=buffs,
        initial_periodic_effects=periodic_effects,
    )


def _validate_global(cfg: GlobalConfig) -> None:
    if cfg.simulation_duration <= 0:
        raise ConfigValidationError("simulation_duration must be > 0")
    if cfg.time_precision <= 0:
        raise ConfigValidationError("time_precision must be > 0")
    if cfg.min_cooldown_default < 0 or cfg.min_cooldown_absolute < 0:
        raise ConfigValidationError("cooldown floors must be >= 0")
    if cfg.max_events <= 0:
        raise ConfigValidationError("max_events must be > 0")
    if cfg.dummy_target_shield < 0:
        raise ConfigValidationError("dummy_target_shield must be >= 0")


def _validate_unit(cfg: UnitApiConfig) -> None:
    if cfg.base_attack_cooldown <= 0:
        raise ConfigValidationError("base_attack_cooldown must be > 0")
    bc = cfg.battle_context
    if bc.self_hp <= 0:
        raise ConfigValidationError("battle_context.self_hp must be > 0")
    if bc.self_shield < 0:
        raise ConfigValidationError("battle_context.self_shield must be >= 0")
    if bc.enemy_hp <= 0:
        raise ConfigValidationError("battle_context.enemy_hp must be > 0")


def _build_enchantment_data(enchantment_type: str, contextual_effects: Dict[str, float]) -> EnchantmentData:
    """Build routed EnchantmentData from contextual_effects using EFFECT_SLOT_ROUTING."""
    if enchantment_type == "NONE" or not contextual_effects:
        return EnchantmentData()
    routed: Dict[str, Dict[str, float]] = {}
    for slot_name, value in contextual_effects.items():
        stage = EFFECT_SLOT_ROUTING.get(slot_name)
        if stage is not None:
            routed.setdefault(stage, {})[slot_name] = value
    return EnchantmentData(enchantment_type=enchantment_type, routed_effects=routed)


def _convert_item_config(item_raw: ItemConfigDict, warnings: list[str] | None = None) -> BuffDefinition:
    enchantment_type = item_raw.get("enchantment_type", "NONE")
    contextual_effects = item_raw.get("contextual_effects", {})
    raw_modifiers = item_raw.get("modifiers", {})

    # If both contextual_effects and modifiers are present, contextual_effects takes precedence.
    # modifiers is deprecated when contextual_effects is non-empty.
    has_contextual = bool(contextual_effects)
    has_modifiers = any(v not in (0, 0.0, 1, 1.0, None, False, "") for v in raw_modifiers.values()) if raw_modifiers else False

    if has_contextual and has_modifiers and warnings is not None:
        warnings.append(
            f"item '{item_raw.get('buff_id', '?')}': both contextual_effects and modifiers present. "
            f"contextual_effects takes precedence; modifiers is ignored."
        )

    if has_contextual:
        raw_modifiers = {}

    item_fields = {k: v for k, v in item_raw.items() if k not in ("modifiers",)}
    item = ItemConfig(**item_fields, modifiers=ItemModifierConfig(**raw_modifiers))
    modifiers = item.modifiers
    damage_type_override = None
    if modifiers.damage_type_override is not None:
        damage_type_override = DamageType(modifiers.damage_type_override)

    enchantment_data = _build_enchantment_data(enchantment_type, contextual_effects)

    return BuffDefinition(
        buff_id=item.buff_id,
        owner_id=item.owner_id,
        duration=item.duration,
        modifiers=BuffModifierDefinition(
            flat_damage_bonus=modifiers.flat_damage_bonus,
            crit_multiplier=modifiers.crit_multiplier,
            global_damage_multiplier=modifiers.global_damage_multiplier,
            shield_damage_mapping_multiplier=modifiers.shield_damage_mapping_multiplier,
            invulnerable_normal_damage=modifiers.invulnerable_normal_damage,
            cooldown_delta=modifiers.cooldown_delta,
            bypass_cooldown_floor=modifiers.bypass_cooldown_floor,
            damage_type_override=damage_type_override,
        ),
        max_stacks=item.max_stacks,
        stackable=item.stackable,
        loadout_order_index=item.loadout_order_index,
        enchantment=enchantment_data,
    )

def _convert_skill_config(skill_raw: SkillConfigDict) -> PeriodicEffectDefinition:
    skill = SkillConfig(**skill_raw)
    if skill.interval <= 0:
        raise ConfigValidationError("skill interval must be > 0")
    if skill.source_base_damage < 0:
        raise ConfigValidationError("skill source_base_damage must be >= 0")
    if skill.duration is not None and skill.duration < 0:
        raise ConfigValidationError("skill duration must be >= 0")
    if skill.max_ticks is not None and skill.max_ticks < 0:
        raise ConfigValidationError("skill max_ticks must be >= 0")
    return PeriodicEffectDefinition(
        effect_id=skill.skill_id,
        owner_id=skill.owner_id,
        target_id="dummy",
        interval=skill.interval,
        source_base_damage=skill.source_base_damage,
        damage_type=DamageType(skill.damage_type),
        duration=skill.duration,
        max_ticks=skill.max_ticks,
        immediate_first_tick=skill.immediate_first_tick,
        loadout_order_index=skill.loadout_order_index,
        damage_owner_id=skill.damage_owner_id,
    )
