from __future__ import annotations

from .constants import PROTOCOL_VERSION, SimulationErrorCode

EXAMPLE_REQUEST_MINIMAL = {
    "global_config": {
        "simulation_duration": 30.0,
        "time_precision": 0.1,
        "dummy_target_health": 1000,
        "dummy_target_shield": 0,
        "debug_mode": False,
        "ignore_unknown_fields": False,
    },
    "unit_config": {
        "unit_id": "hero",
        "base_damage": 0,
        "base_attack_cooldown": 1.0,
        "crit_chance": 0.0,
        "max_health": 100,
        "initial_shield": 0,
        "initial_heal_pool": 0,
    },
    "item_configs": [],
    "skill_configs": [],
}

EXAMPLE_REQUEST_FULL = {
    "global_config": {
        "simulation_duration": 30.0,
        "time_precision": 0.1,
        "min_cooldown_default": 1.0,
        "min_cooldown_absolute": 0.5,
        "max_events": 10000,
        "dummy_target_id": "dummy",
        "dummy_target_health": 1000,
        "dummy_target_shield": 50,
        "debug_mode": True,
        "ignore_unknown_fields": False,
    },
    "unit_config": {
        "unit_id": "hero",
        "base_damage": 100,
        "base_attack_cooldown": 1.0,
        "crit_chance": 1.0,
        "max_health": 100,
        "initial_shield": 0,
        "initial_heal_pool": 0,
    },
    "item_configs": [
        {
            "buff_id": "flame-weapon",
            "owner_id": "hero",
            "duration": 30.0,
            "loadout_order_index": 0,
            "max_stacks": 1,
            "stackable": False,
            "modifiers": {
                "flat_damage_bonus": 15.0,
                "crit_multiplier": 1.5,
                "global_damage_multiplier": 1.1,
                "shield_damage_mapping_multiplier": 1.0,
                "invulnerable_normal_damage": False,
                "cooldown_delta": 0.0,
                "bypass_cooldown_floor": False,
                "damage_type_override": "FIRE",
            },
        }
    ],
    "skill_configs": [
        {
            "skill_id": "burn",
            "owner_id": "hero",
            "interval": 0.5,
            "duration": 1.5,
            "max_ticks": 3,
            "source_base_damage": 10.0,
            "damage_type": "NORMAL",
            "immediate_first_tick": False,
            "loadout_order_index": 0,
            "damage_owner_id": "hero",
        }
    ],
}

EXAMPLE_RESPONSE_SUCCESS = {
    "protocol_version": PROTOCOL_VERSION,
    "status": "success",
    "data": {
        "summary": {
            "total_damage": 0,
            "dps": 0.0,
            "per_owner_damage": {},
            "event_count": 62,
            "attack_count": 31,
            "periodic_damage_total": 0,
            "periodic_tick_count": 0,
        },
        "charts": [
            {
                "time": 0.0,
                "total_dps_window": 0.0,
                "shield_value": 0,
                "hp_value": 1000,
            }
        ],
        "input_echo": {
            "global_config": {
                "simulation_duration": 30.0,
                "time_precision": 0.1,
                "min_cooldown_default": 1.0,
                "min_cooldown_absolute": 0.5,
                "max_events": 10000,
                "dummy_target_id": "dummy",
                "dummy_target_health": 1000,
                "dummy_target_shield": 0,
                "debug_mode": False,
                "ignore_unknown_fields": False,
            },
            "unit_config": {
                "unit_id": "hero",
                "base_damage": 0,
                "base_attack_cooldown": 1.0,
                "crit_chance": 0.0,
                "max_health": 100,
                "initial_shield": 0,
                "initial_heal_pool": 0,
            },
            "item_configs": [],
            "skill_configs": [],
        },
    },
}

EXAMPLE_RESPONSE_ERROR = {
    "protocol_version": PROTOCOL_VERSION,
    "status": "error",
    "error": {
        "code": SimulationErrorCode.MISSING_UNIT_CONFIG.value,
        "message": "missing required field: unit_config",
    },
}
