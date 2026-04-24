from __future__ import annotations

import json

from minimal_sim_core.api import simulate
from minimal_sim_core.contract_examples import (
    EXAMPLE_REQUEST_MINIMAL,
    EXAMPLE_RESPONSE_ERROR,
    EXAMPLE_RESPONSE_SUCCESS,
)
from minimal_sim_core.schema_export import generate_json_schema, generate_openapi_snippet

try:
    from jsonschema import validate as jsonschema_validate
except ImportError:  # pragma: no cover
    jsonschema_validate = None


def _base_config(debug_mode: bool = False) -> dict:
    return {
        "global_config": {
            "simulation_duration": 2.0,
            "time_precision": 0.1,
            "debug_mode": debug_mode,
        },
        "unit_config": {
            "unit_id": "hero",
            "base_attack_cooldown": 1.0,
            "battle_context": {
                "self_hp": 100,
                "self_shield": 0,
                "enemy_hp": 1000,
            },
        },
        "item_configs": [
            {
                "buff_id": "flame-weapon",
                "owner_id": "hero",
                "duration": None,
                "loadout_order_index": 0,
                "enchantment_type": "BURN",
                "contextual_effects": {"burn_damage": 15.0, "burn_duration": 3.0},
            }
        ],
        "skill_configs": [
            {
                "skill_id": "burn",
                "owner_id": "hero",
                "interval": 0.5,
                "duration": 1.0,
                "source_base_damage": 10.0,
                "damage_type": "NORMAL",
                "loadout_order_index": 0,
            }
        ],
    }


def _base_config_with_dummy(debug_mode: bool = False) -> dict:
    """Config that explicitly uses deprecated dummy_target_* fields for backward-compat tests."""
    cfg = _base_config(debug_mode)
    cfg["global_config"]["dummy_target_health"] = 1000
    cfg["global_config"]["dummy_target_shield"] = 50
    return cfg


def test_simulate_returns_layered_success_response() -> None:
    result = simulate(_base_config(debug_mode=False))
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "success"
    assert "data" in result
    data = result["data"]
    assert {"summary", "charts", "input_echo"}.issubset(data.keys())
    assert "debug_timeline" not in data
    assert "warnings" not in data or data["warnings"] == []
    assert {"total_damage", "dps", "per_owner_damage", "periodic_damage_total", "periodic_tick_count"}.issubset(data["summary"].keys())
    assert isinstance(data["charts"], list)
    assert data["charts"]
    first_chart = data["charts"][0]
    assert {"time", "total_dps_window", "shield_value", "hp_value"}.issubset(first_chart.keys())
    assert first_chart["time"] == 0.0
    assert isinstance(data["input_echo"], dict)


def test_simulate_debug_mode_includes_debug_timeline() -> None:
    result = simulate(_base_config(debug_mode=True))
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "success"
    data = result["data"]
    assert "debug_timeline" in data
    assert isinstance(data["debug_timeline"], list)
    assert data["debug_timeline"]
    first = data["debug_timeline"][0]
    assert {"time", "source_id", "damage", "damage_type", "is_periodic", "hp_after", "shield_after"}.issubset(first.keys())
    assert isinstance(first["hp_after"], int)
    assert isinstance(first["shield_after"], int)


def test_simulate_charts_are_monotonic_and_bounded() -> None:
    result = simulate(_base_config_with_dummy(debug_mode=False))
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "success"
    charts = result["data"]["charts"]
    assert len(charts) <= 300
    assert charts[0]["time"] == 0.0
    assert charts == sorted(charts, key=lambda point: point["time"])
    assert all(charts[idx]["time"] < charts[idx + 1]["time"] for idx in range(len(charts) - 1))
    assert all(isinstance(point["hp_value"], int) for point in charts)
    assert all(isinstance(point["shield_value"], int) for point in charts)


def test_simulate_missing_required_field_returns_error() -> None:
    result = simulate(
        {
            "global_config": {"simulation_duration": 1.0},
            "unit_config": {
                "unit_id": "hero",
                "base_attack_cooldown": 1.0,
            },
            "item_configs": [],
            "skill_configs": [],
        }
    )
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "error"
    assert result["error"]["code"] == "MISSING_UNIT_CONFIG"
    assert "battle_context" in result["error"]["message"]


def test_simulate_invalid_numeric_values_are_rejected() -> None:
    result = simulate(
        {
            "global_config": {"simulation_duration": -1.0},
            "unit_config": {
                "unit_id": "hero",
                "base_attack_cooldown": 1.0,
                "battle_context": {
                    "self_hp": 1000,
                    "self_shield": 0,
                    "enemy_hp": 1000,
                },
            },
            "item_configs": [],
            "skill_configs": [],
        }
    )
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "error"
    assert result["error"]["code"] == "INVALID_NUMERIC_VALUE"
    assert "must be" in result["error"]["message"]


def test_legacy_call_shape_still_contains_status_and_data() -> None:
    result = simulate(_base_config())
    assert "status" in result
    assert "data" in result


def test_unknown_top_level_field_emits_warning() -> None:
    config = _base_config()
    config["legacy_field"] = True
    result = simulate(config)
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "success"
    assert "warnings" in result["data"]
    assert result["data"]["warnings"]


def test_dummy_target_fields_emit_deprecation_warning() -> None:
    config = _base_config_with_dummy()
    result = simulate(config)
    assert result["status"] == "success"
    warnings = result["data"].get("warnings", [])
    assert any("dummy_target_health" in w for w in warnings)
    assert any("dummy_target_shield" in w for w in warnings)
    assert any("BattleContext" in w for w in warnings)


def test_example_request_minimal_returns_success() -> None:
    result = simulate(EXAMPLE_REQUEST_MINIMAL)
    assert result["protocol_version"] == "v1.0"
    assert result["status"] == "success"


def test_example_response_shapes_are_json_serializable_and_consistent() -> None:
    result = simulate(EXAMPLE_REQUEST_MINIMAL)
    json.dumps(EXAMPLE_REQUEST_MINIMAL)
    json.dumps(EXAMPLE_RESPONSE_SUCCESS)
    json.dumps(EXAMPLE_RESPONSE_ERROR)
    assert result["status"] == EXAMPLE_RESPONSE_SUCCESS["status"]
    assert result["protocol_version"] == EXAMPLE_RESPONSE_SUCCESS["protocol_version"]
    assert set(result["data"].keys()) == set(EXAMPLE_RESPONSE_SUCCESS["data"].keys())
    assert set(result["data"]["summary"].keys()) == set(EXAMPLE_RESPONSE_SUCCESS["data"]["summary"].keys())
    assert set(result["data"]["charts"][0].keys()) == set(EXAMPLE_RESPONSE_SUCCESS["data"]["charts"][0].keys())
    assert set(EXAMPLE_RESPONSE_ERROR["error"].keys()) == {"code", "message"}


def test_generate_json_schema_contains_required_structure() -> None:
    schema = generate_json_schema()
    assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert "required" in schema
    assert "unit_config" in schema["required"]
    assert "$defs" in schema
    assert "UnitConfig" in schema["$defs"]
    assert "BattleContext" in schema["$defs"]
    if jsonschema_validate is not None:
        jsonschema_validate(instance=EXAMPLE_REQUEST_MINIMAL, schema=schema)


def test_generate_openapi_snippet_contains_simulate_post() -> None:
    snippet = generate_openapi_snippet()
    assert snippet["openapi"] == "3.0.0"
    assert "/simulate" in snippet["paths"]
    assert "post" in snippet["paths"]["/simulate"]
