from __future__ import annotations

from dataclasses import asdict
from typing import Dict, Optional

from .constants import PROTOCOL_VERSION, SimulationErrorCode
from .periodic_effect import PeriodicEffectDefinition
from .schema import (
    GlobalConfig,
    ItemConfig,
    ItemConfigDict,
    ItemModifierConfig,
    SkillConfig,
    SkillConfigDict,
    SimulationConfigDict,
    UnitApiConfig,
)
from .simulation_core import SimulationCore
from .world_state import (
    BuffDefinition,
    BuffModifierDefinition,
    CooldownState,
    DamageType,
    DummyTargetRuntime,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
)


class ConfigValidationError(ValueError):
    pass


_REQUIRED_UNIT_FIELDS = {
    "unit_id",
    "base_damage",
    "base_attack_cooldown",
    "crit_chance",
    "max_health",
    "initial_shield",
    "initial_heal_pool",
}
_DEPRECATED_KEYS: list[tuple[str, str]] = []
_ALLOWED_TOP_LEVEL_KEYS = {"global_config", "unit_config", "item_configs", "skill_configs"}


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
                initial_hp=normalized["global_config"]["dummy_target_health"],
                initial_shield=normalized["global_config"]["dummy_target_shield"],
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

    global_config = GlobalConfig(**global_config_raw)
    unit_config = UnitApiConfig(**unit_config_raw)
    _validate_global(global_config)
    _validate_unit(unit_config)

    warnings: list[str] = []
    warnings.extend(_collect_deprecation_warnings(config))
    if not global_config.ignore_unknown_fields:
        warnings.extend(_collect_unknown_field_warnings(config))

    normalized_items = [
        asdict(ItemConfig(**{**item, "modifiers": ItemModifierConfig(**item.get("modifiers", {}))}))
        for item in item_configs_raw
    ]
    normalized_skills = [asdict(SkillConfig(**skill)) for skill in skill_configs_raw]

    return {
        "global_config": asdict(global_config),
        "unit_config": asdict(unit_config),
        "item_configs": normalized_items,
        "skill_configs": normalized_skills,
    }, warnings


def _collect_deprecation_warnings(config: dict) -> list[str]:
    warnings: list[str] = []
    for deprecated_key, replacement_key in _DEPRECATED_KEYS:
        if deprecated_key in config:
            warnings.append(f"字段 '{deprecated_key}' 将在 v2.0 弃用，请使用 '{replacement_key}' 替代")
    return warnings


def _collect_unknown_field_warnings(config: dict) -> list[str]:
    warnings: list[str] = []
    for unknown_key in sorted(set(config.keys()) - _ALLOWED_TOP_LEVEL_KEYS):
        warnings.append(f"字段 '{unknown_key}' 将在 v2.0 弃用，请使用 'global_config' 或对应配置分组替代")
    return warnings


def _build_scenario(normalized: Dict[str, object]) -> SimulationScenario:
    global_config = GlobalConfig(**normalized["global_config"])
    unit_config = UnitApiConfig(**normalized["unit_config"])
    item_configs_raw = normalized["item_configs"]
    skill_configs_raw = normalized["skill_configs"]

    buffs = tuple(_convert_item_config(item) for item in item_configs_raw)
    periodic_effects = tuple(_convert_skill_config(skill) for skill in skill_configs_raw)
    cooldowns = (CooldownState(owner_id=unit_config.unit_id, base_cooldown=unit_config.base_attack_cooldown),)

    return SimulationScenario(
        config=SimulationConfig(
            simulation_duration=global_config.simulation_duration,
            time_precision=global_config.time_precision,
            min_cooldown_default=global_config.min_cooldown_default,
            min_cooldown_absolute=global_config.min_cooldown_absolute,
            max_events=global_config.max_events,
        ),
        unit=UnitConfig(
            unit_id=unit_config.unit_id,
            base_damage=unit_config.base_damage,
            base_attack_cooldown=unit_config.base_attack_cooldown,
            crit_chance=unit_config.crit_chance,
            max_health=unit_config.max_health,
            initial_shield=unit_config.initial_shield,
            initial_heal_pool=unit_config.initial_heal_pool,
        ),
        dummy_target=DummyTargetRuntime(
            target_id=global_config.dummy_target_id,
            current_health=global_config.dummy_target_health,
            current_shield=global_config.dummy_target_shield,
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
    if cfg.base_damage < 0:
        raise ConfigValidationError("base_damage must be >= 0")
    if cfg.base_attack_cooldown <= 0:
        raise ConfigValidationError("base_attack_cooldown must be > 0")
    if not 0.0 <= cfg.crit_chance <= 1.0:
        raise ConfigValidationError("crit_chance must be between 0 and 1")
    if cfg.max_health <= 0:
        raise ConfigValidationError("max_health must be > 0")
    if cfg.initial_shield < 0 or cfg.initial_heal_pool < 0:
        raise ConfigValidationError("initial_shield and initial_heal_pool must be >= 0")


def _convert_item_config(item_raw: ItemConfigDict) -> BuffDefinition:
    raw_modifiers = item_raw.get("modifiers", {})
    item = ItemConfig(**{**item_raw, "modifiers": ItemModifierConfig(**raw_modifiers)})
    modifiers = item.modifiers
    damage_type_override = None
    if modifiers.damage_type_override is not None:
        damage_type_override = DamageType(modifiers.damage_type_override)
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
