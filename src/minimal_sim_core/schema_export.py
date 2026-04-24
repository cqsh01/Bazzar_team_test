from __future__ import annotations

from .constants import PROTOCOL_VERSION


def generate_json_schema() -> dict:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$id": "https://minimal-sim-core.local/schemas/simulate-request.json",
        "title": "MinimalSimCoreSimulateRequest",
        "type": "object",
        "required": ["global_config", "unit_config", "item_configs", "skill_configs"],
        "properties": {
            "global_config": {"$ref": "#/$defs/GlobalConfig"},
            "unit_config": {"$ref": "#/$defs/UnitConfig"},
            "item_configs": {
                "type": "array",
                "items": {"$ref": "#/$defs/ItemConfig"},
            },
            "skill_configs": {
                "type": "array",
                "items": {"$ref": "#/$defs/SkillConfig"},
            },
        },
        "additionalProperties": True,
        "$defs": {
            "GlobalConfig": {
                "type": "object",
                "properties": {
                    "simulation_duration": {"type": "number", "exclusiveMinimum": 0},
                    "time_precision": {"type": "number", "exclusiveMinimum": 0},
                    "min_cooldown_default": {"type": "number", "minimum": 0},
                    "min_cooldown_absolute": {"type": "number", "minimum": 0},
                    "max_events": {"type": "integer", "exclusiveMinimum": 0},
                    "dummy_target_id": {"type": "string"},
                    "dummy_target_health": {"type": "number"},
                    "dummy_target_shield": {"type": "integer", "minimum": 0},
                    "debug_mode": {"type": "boolean"},
                    "ignore_unknown_fields": {"type": "boolean"},
                },
                "additionalProperties": True,
            },
            "UnitConfig": {
                "type": "object",
                "required": [
                    "unit_id",
                    "base_attack_cooldown",
                    "battle_context",
                ],
                "properties": {
                    "unit_id": {"type": "string"},
                    "base_attack_cooldown": {"type": "number", "exclusiveMinimum": 0},
                    "battle_context": {"$ref": "#/$defs/BattleContext"},
                },
                "additionalProperties": True,
            },
            "BattleContext": {
                "type": "object",
                "required": ["self_hp", "self_shield", "enemy_hp"],
                "properties": {
                    "self_hp": {"type": "integer", "exclusiveMinimum": 0},
                    "self_shield": {"type": "integer", "minimum": 0},
                    "enemy_hp": {"type": "integer", "exclusiveMinimum": 0},
                },
                "additionalProperties": False,
            },
            "ItemModifier": {
                "type": "object",
                "properties": {
                    "flat_damage_bonus": {"type": "number"},
                    "crit_multiplier": {"type": "number", "minimum": 0},
                    "global_damage_multiplier": {"type": "number", "minimum": 0},
                    "shield_damage_mapping_multiplier": {"type": ["number", "null"], "minimum": 0},
                    "invulnerable_normal_damage": {"type": "boolean"},
                    "cooldown_delta": {"type": "number"},
                    "bypass_cooldown_floor": {"type": "boolean"},
                    "damage_type_override": {
                        "type": ["string", "null"],
                        "enum": ["NORMAL", "FIRE", "TOXIC", None],
                    },
                },
                "additionalProperties": False,
            },
            "ItemConfig": {
                "type": "object",
                "required": ["buff_id"],
                "properties": {
                    "buff_id": {"type": "string"},
                    "owner_id": {"type": "string"},
                    "duration": {"type": ["number", "null"], "minimum": 0},
                    "loadout_order_index": {"type": "integer", "minimum": 0},
                    "max_stacks": {"type": "integer", "minimum": 1},
                    "stackable": {"type": "boolean"},
                    "enchantment_type": {
                        "type": "string",
                        "enum": [
                            "NONE", "SLOW", "BURN", "POISON", "FLASH", "OBSIDIAN",
                            "HEAL", "SHIELD", "ACCELERATE", "FREEZE", "CRIT",
                            "GOLD", "RADIANCE", "EVERGREEN",
                        ],
                    },
                    "contextual_effects": {
                        "type": "object",
                        "additionalProperties": {"type": "number"},
                    },
                    "modifiers": {"$ref": "#/$defs/ItemModifier"},
                },
                "additionalProperties": False,
            },
            "SkillConfig": {
                "type": "object",
                "required": ["skill_id"],
                "properties": {
                    "skill_id": {"type": "string"},
                    "owner_id": {"type": "string"},
                    "interval": {"type": "number", "exclusiveMinimum": 0},
                    "duration": {"type": ["number", "null"], "minimum": 0},
                    "max_ticks": {"type": ["integer", "null"], "minimum": 0},
                    "source_base_damage": {"type": "number", "minimum": 0},
                    "damage_type": {"type": "string", "enum": ["NORMAL", "FIRE", "TOXIC"]},
                    "immediate_first_tick": {"type": "boolean"},
                    "loadout_order_index": {"type": "integer", "minimum": 0},
                    "damage_owner_id": {"type": ["string", "null"]},
                },
                "additionalProperties": False,
            },
            "EventType": {
                "type": "string",
                "enum": [
                    "ATTACK",
                    "DAMAGE",
                    "PERIODIC_APPLY",
                    "PERIODIC_TICK",
                    "PERIODIC_EXPIRE",
                    "BUFF_APPLY",
                    "BUFF_EXPIRE",
                    "COOLDOWN_RESET",
                    "COOLDOWN_MODIFY",
                ],
            },
        },
    }


def generate_openapi_snippet() -> dict:
    request_schema = generate_json_schema()
    return {
        "openapi": "3.0.0",
        "info": {
            "title": "Minimal Sim Core API",
            "version": PROTOCOL_VERSION,
        },
        "paths": {
            "/simulate": {
                "post": {
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": request_schema,
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Simulation response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "protocol_version": {"type": "string"},
                                            "status": {"type": "string", "enum": ["success", "error"]},
                                            "data": {"type": "object"},
                                            "error": {"type": "object"},
                                        },
                                        "required": ["protocol_version", "status"],
                                    }
                                }
                            },
                        }
                    },
                }
            }
        },
    }
