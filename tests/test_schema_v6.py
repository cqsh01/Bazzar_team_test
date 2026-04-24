"""Phase 6.1 schema contract tests — BattleContext, EnchantmentType, contextual_effects."""

from __future__ import annotations

import pytest

from minimal_sim_core.api import simulate
from minimal_sim_core.schema import (
    BattleContext,
    ConfigValidationError,
    EnchantmentType,
    EFFECT_SLOT_MAPPING,
    validate_contextual_effects,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_config(**unit_overrides):
    unit = {
        "unit_id": "hero",
        "base_attack_cooldown": 1.0,
        "battle_context": {"self_hp": 1000, "self_shield": 0, "enemy_hp": 1000},
        **unit_overrides,
    }
    return {
        "global_config": {"simulation_duration": 1.0},
        "unit_config": unit,
        "item_configs": [],
        "skill_configs": [],
    }


# ---------------------------------------------------------------------------
# BattleContext required
# ---------------------------------------------------------------------------

class TestBattleContext:
    def test_missing_battle_context_is_rejected(self):
        config = {
            "global_config": {},
            "unit_config": {"unit_id": "hero", "base_attack_cooldown": 1.0},
            "item_configs": [],
            "skill_configs": [],
        }
        result = simulate(config)
        assert result["status"] == "error"
        assert "battle_context" in result["error"]["message"]

    def test_missing_self_hp_is_rejected(self):
        config = _base_config()
        del config["unit_config"]["battle_context"]["self_hp"]
        result = simulate(config)
        assert result["status"] == "error"
        assert "self_hp" in result["error"]["message"]

    def test_zero_self_hp_is_rejected(self):
        config = _base_config()
        config["unit_config"]["battle_context"]["self_hp"] = 0
        result = simulate(config)
        assert result["status"] == "error"
        assert "self_hp" in result["error"]["message"]

    def test_negative_self_shield_is_rejected(self):
        config = _base_config()
        config["unit_config"]["battle_context"]["self_shield"] = -1
        result = simulate(config)
        assert result["status"] == "error"
        assert "self_shield" in result["error"]["message"]

    def test_valid_battle_context_succeeds(self):
        config = _base_config()
        result = simulate(config)
        assert result["status"] == "success"
        echo = result["data"]["input_echo"]["unit_config"]
        assert echo["battle_context"]["self_hp"] == 1000
        assert echo["battle_context"]["self_shield"] == 0
        assert echo["battle_context"]["enemy_hp"] == 1000

    def test_battle_context_dataclass_creation(self):
        bc = BattleContext(self_hp=500, self_shield=100, enemy_hp=800)
        assert bc.self_hp == 500
        assert bc.self_shield == 100
        assert bc.enemy_hp == 800


# ---------------------------------------------------------------------------
# EnchantmentType enum
# ---------------------------------------------------------------------------

class TestEnchantmentType:
    def test_all_13_enchantments_plus_none(self):
        assert len(EnchantmentType) == 14

    def test_enum_values_are_strings(self):
        for et in EnchantmentType:
            assert isinstance(et.value, str)
            assert et.value == et.name

    def test_none_is_valid(self):
        assert EnchantmentType("NONE") == EnchantmentType.NONE

    def test_each_type_has_slot_mapping(self):
        for et in EnchantmentType:
            assert et.value in EFFECT_SLOT_MAPPING


# ---------------------------------------------------------------------------
# validate_contextual_effects
# ---------------------------------------------------------------------------

class TestValidateContextualEffects:
    def test_none_enchantment_rejects_any_key(self):
        with pytest.raises(ConfigValidationError, match="Unauthorized"):
            validate_contextual_effects("NONE", {"slow_value": 0.5})

    def test_none_enchantment_accepts_empty(self):
        validate_contextual_effects("NONE", {})

    def test_slow_accepts_valid_keys(self):
        validate_contextual_effects("SLOW", {"slow_duration": 2.0, "slow_value": 0.3})

    def test_slow_rejects_foreign_key(self):
        with pytest.raises(ConfigValidationError, match="burn_damage"):
            validate_contextual_effects("SLOW", {"slow_value": 0.3, "burn_damage": 10})

    def test_unknown_enchantment_type_rejected(self):
        with pytest.raises(ConfigValidationError, match="Unknown enchantment_type"):
            validate_contextual_effects("NONEXISTENT", {"foo": 1.0})

    def test_burn_partial_keys_accepted(self):
        validate_contextual_effects("BURN", {"burn_damage": 10})

    def test_all_enchantments_accept_their_own_slots(self):
        for etype, slots in EFFECT_SLOT_MAPPING.items():
            effects = {s: 1.0 for s in slots}
            validate_contextual_effects(etype, effects)


# ---------------------------------------------------------------------------
# Item config with enchantment in full simulate flow
# ---------------------------------------------------------------------------

class TestItemEnchantmentIntegration:
    def test_item_with_valid_enchantment_succeeds(self):
        config = _base_config()
        config["item_configs"] = [{
            "buff_id": "frost-blade",
            "enchantment_type": "SLOW",
            "contextual_effects": {"slow_duration": 2.0, "slow_value": 0.3},
        }]
        result = simulate(config)
        assert result["status"] == "success"
        echo_item = result["data"]["input_echo"]["item_configs"][0]
        assert echo_item["enchantment_type"] == "SLOW"
        assert echo_item["contextual_effects"]["slow_value"] == 0.3

    def test_item_with_unauthorized_effects_rejected(self):
        config = _base_config()
        config["item_configs"] = [{
            "buff_id": "bad-item",
            "enchantment_type": "BURN",
            "contextual_effects": {"slow_value": 0.5},
        }]
        result = simulate(config)
        assert result["status"] == "error"
        assert "slow_value" in result["error"]["message"]

    def test_item_defaults_to_none_enchantment(self):
        config = _base_config()
        config["item_configs"] = [{"buff_id": "plain-item"}]
        result = simulate(config)
        assert result["status"] == "success"
        echo_item = result["data"]["input_echo"]["item_configs"][0]
        assert echo_item["enchantment_type"] == "NONE"

    def test_legacy_unit_fields_produce_warnings(self):
        config = _base_config()
        config["unit_config"]["base_damage"] = 100
        config["unit_config"]["crit_chance"] = 0.3
        result = simulate(config)
        assert result["status"] == "success"
        warnings = result["data"].get("warnings", [])
        assert any("base_damage" in w for w in warnings)
        assert any("crit_chance" in w for w in warnings)


# ---------------------------------------------------------------------------
# Hero-omission: removed fields no longer required
# ---------------------------------------------------------------------------

class TestHeroOmission:
    def test_no_base_damage_required(self):
        config = _base_config()
        assert "base_damage" not in config["unit_config"]
        result = simulate(config)
        assert result["status"] == "success"

    def test_no_crit_chance_required(self):
        config = _base_config()
        assert "crit_chance" not in config["unit_config"]
        result = simulate(config)
        assert result["status"] == "success"

    def test_no_max_health_required(self):
        config = _base_config()
        assert "max_health" not in config["unit_config"]
        result = simulate(config)
        assert result["status"] == "success"

    def test_input_echo_uses_new_structure(self):
        config = _base_config()
        result = simulate(config)
        echo_unit = result["data"]["input_echo"]["unit_config"]
        assert "base_damage" not in echo_unit
        assert "crit_chance" not in echo_unit
        assert "max_health" not in echo_unit
        assert "battle_context" in echo_unit
        assert echo_unit["base_attack_cooldown"] == 1.0


# ---------------------------------------------------------------------------
# Fix 1: contextual_effects takes precedence over modifiers
# ---------------------------------------------------------------------------

class TestContextualEffectsPrecedence:
    def test_contextual_effects_overrides_modifiers(self):
        config = _base_config()
        config["item_configs"] = [{
            "buff_id": "dual-item",
            "enchantment_type": "BURN",
            "contextual_effects": {"burn_damage": 20.0, "burn_duration": 5.0},
            "modifiers": {"flat_damage_bonus": 999.0, "global_damage_multiplier": 2.0},
        }]
        result = simulate(config)
        assert result["status"] == "success"
        warnings = result["data"].get("warnings", [])
        assert any("contextual_effects takes precedence" in w for w in warnings)
        echo_item = result["data"]["input_echo"]["item_configs"][0]
        assert echo_item["modifiers"]["flat_damage_bonus"] == 0.0
        assert echo_item["modifiers"]["global_damage_multiplier"] == 1.0

    def test_only_modifiers_still_works(self):
        config = _base_config()
        config["item_configs"] = [{
            "buff_id": "legacy-item",
            "modifiers": {"flat_damage_bonus": 10.0},
        }]
        result = simulate(config)
        assert result["status"] == "success"
        echo_item = result["data"]["input_echo"]["item_configs"][0]
        assert echo_item["modifiers"]["flat_damage_bonus"] == 10.0


# ---------------------------------------------------------------------------
# Fix 2: dummy_target_* deprecation warnings
# ---------------------------------------------------------------------------

class TestDummyTargetDeprecation:
    def test_dummy_target_health_emits_warning(self):
        config = _base_config()
        config["global_config"]["dummy_target_health"] = 500
        result = simulate(config)
        assert result["status"] == "success"
        warnings = result["data"].get("warnings", [])
        assert any("dummy_target_health" in w and "BattleContext.enemy_hp" in w for w in warnings)

    def test_dummy_target_shield_emits_warning(self):
        config = _base_config()
        config["global_config"]["dummy_target_shield"] = 100
        result = simulate(config)
        assert result["status"] == "success"
        warnings = result["data"].get("warnings", [])
        assert any("dummy_target_shield" in w and "BattleContext.self_shield" in w for w in warnings)

    def test_no_dummy_target_no_warning(self):
        config = _base_config()
        result = simulate(config)
        assert result["status"] == "success"
        warnings = result["data"].get("warnings", [])
        assert not any("dummy_target" in w for w in warnings)


# ---------------------------------------------------------------------------
# Fix 3: EFFECT_SLOT_ROUTING coverage
# ---------------------------------------------------------------------------

class TestEffectSlotRouting:
    def test_routing_table_covers_all_slots(self):
        from minimal_sim_core.schema import EFFECT_SLOT_ROUTING, EFFECT_SLOT_MAPPING
        all_slots = set()
        for slots in EFFECT_SLOT_MAPPING.values():
            all_slots.update(slots)
        for slot in all_slots:
            assert slot in EFFECT_SLOT_ROUTING, f"slot '{slot}' missing from EFFECT_SLOT_ROUTING"

    def test_flash_routes_to_flat_damage_and_cooldown(self):
        from minimal_sim_core.schema import EFFECT_SLOT_ROUTING
        assert EFFECT_SLOT_ROUTING["flash_damage"] == "flat_damage"
        assert EFFECT_SLOT_ROUTING["flash_cooldown_reduction"] == "cooldown_delta"

    def test_crit_routes_to_crit_multiplier(self):
        from minimal_sim_core.schema import EFFECT_SLOT_ROUTING
        assert EFFECT_SLOT_ROUTING["crit_bonus"] == "crit_multiplier"

    def test_enchantment_data_created_for_flash_item(self):
        config = _base_config()
        config["item_configs"] = [{
            "buff_id": "flash-blade",
            "enchantment_type": "FLASH",
            "contextual_effects": {"flash_damage": 20.0, "flash_cooldown_reduction": 0.5},
        }]
        result = simulate(config)
        assert result["status"] == "success"

    def test_apply_enchantment_effect_flat_damage(self):
        from minimal_sim_core.world_state import EnchantmentData, apply_enchantment_effect
        ench = EnchantmentData(
            enchantment_type="FLASH",
            routed_effects={"flat_damage": {"flash_damage": 20.0}},
        )
        flat, crit, glob, cd, _cm, _hps, *_ = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert flat == 20.0
        assert crit == 1.0
        assert glob == 1.0
        assert cd == 0.0

    def test_apply_enchantment_effect_cooldown_delta(self):
        from minimal_sim_core.world_state import EnchantmentData, apply_enchantment_effect
        ench = EnchantmentData(
            enchantment_type="ACCELERATE",
            routed_effects={"cooldown_delta": {"accelerate_value": 0.2}},
        )
        flat, crit, glob, cd, _cm, _hps, *_ = apply_enchantment_effect(ench, 2, 0.0, 1.0, 1.0, 0.0)
        assert flat == 0.0
        assert cd == -0.4

    def test_apply_enchantment_effect_crit_bonus(self):
        from minimal_sim_core.world_state import EnchantmentData, apply_enchantment_effect
        ench = EnchantmentData(
            enchantment_type="CRIT",
            routed_effects={"crit_multiplier": {"crit_bonus": 0.5}},
        )
        flat, crit, glob, cd, _cm, _hps, *_ = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert crit == 1.5
