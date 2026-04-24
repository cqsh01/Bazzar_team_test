"""Phase 6.5 integration tests — remaining 7 enchantments."""
from __future__ import annotations

import pytest

from minimal_sim_core.api import simulate
from minimal_sim_core.world_state import (
    ActiveModifierView,
    BuffDefinition,
    BuffModifierDefinition,
    CooldownState,
    DamageType,
    DummyTargetRuntime,
    EnchantmentData,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
    WorldState,
    apply_enchantment_effect,
)
from minimal_sim_core.damage_pipeline import DamagePipeline


def _api_config(duration: float = 5.0, items: list | None = None) -> dict:
    return {
        "global_config": {"simulation_duration": duration},
        "unit_config": {
            "unit_id": "hero",
            "base_attack_cooldown": 1.0,
            "battle_context": {"self_hp": 1000, "self_shield": 0, "enemy_hp": 5000},
        },
        "item_configs": items or [],
        "skill_configs": [],
    }


def _run_scenario(buffs, duration=5.0, max_health=1000, initial_shield=0):
    unit = UnitConfig(
        unit_id="hero", base_damage=10, base_attack_cooldown=1.0,
        crit_chance=0.0, max_health=max_health, initial_shield=initial_shield,
    )
    scenario = SimulationScenario(
        config=SimulationConfig(simulation_duration=duration),
        unit=unit,
        dummy_target=DummyTargetRuntime(current_health=9999),
        cooldowns=(CooldownState(owner_id="hero", base_cooldown=1.0),),
        initial_buffs=tuple(buffs),
    )
    world = WorldState.initialize(scenario)
    pipeline = DamagePipeline()
    while world.has_pending_events():
        world.process_next(pipeline)
    return world


# -----------------------------------------------------------------------
# BURN — damage_over_time with FIRE type
# -----------------------------------------------------------------------

class TestBurnEnchantment:
    def test_burn_produces_dot_dps(self):
        ench = EnchantmentData(
            enchantment_type="BURN",
            routed_effects={"damage_over_time": {"burn_damage": 20.0, "burn_duration": 4.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        dot_dps = result[6]
        dot_type = result[7]
        assert dot_dps == pytest.approx(5.0)
        assert dot_type == DamageType.FIRE

    def test_burn_api_accepted(self):
        result = simulate(_api_config(items=[{
            "buff_id": "burn-sword",
            "enchantment_type": "BURN",
            "contextual_effects": {"burn_damage": 10.0, "burn_duration": 2.0},
        }]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["total_damage"] > 0


# -----------------------------------------------------------------------
# POISON — damage_over_time with TOXIC type
# -----------------------------------------------------------------------

class TestPoisonEnchantment:
    def test_poison_produces_toxic_dot(self):
        ench = EnchantmentData(
            enchantment_type="POISON",
            routed_effects={"damage_over_time": {"poison_damage": 12.0, "poison_duration": 3.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert result[6] == pytest.approx(4.0)
        assert result[7] == DamageType.TOXIC

    def test_poison_api_accepted(self):
        result = simulate(_api_config(items=[{
            "buff_id": "venom-dagger",
            "enchantment_type": "POISON",
            "contextual_effects": {"poison_damage": 8.0, "poison_duration": 4.0},
        }]))
        assert result["status"] == "success"


# -----------------------------------------------------------------------
# OBSIDIAN — shield_grant (adds shield value)
# -----------------------------------------------------------------------

class TestObsidianEnchantment:
    def test_obsidian_grants_shield(self):
        ench = EnchantmentData(
            enchantment_type="OBSIDIAN",
            routed_effects={"shield_grant": {"obsidian_shield": 50.0, "obsidian_duration": 5.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        shield = result[8]
        assert shield == 50

    def test_obsidian_applied_at_buff_time(self):
        buff = BuffDefinition(
            buff_id="obsidian-plate", owner_id="hero", duration=None,
            enchantment=EnchantmentData(
                enchantment_type="OBSIDIAN",
                routed_effects={"shield_grant": {"obsidian_shield": 75.0, "obsidian_duration": 10.0}},
            ),
        )
        world = _run_scenario([buff], duration=1.0, initial_shield=0)
        assert world.unit_runtime.current_shield >= 75

    def test_obsidian_api_accepted(self):
        result = simulate(_api_config(items=[{
            "buff_id": "obsidian-plate",
            "enchantment_type": "OBSIDIAN",
            "contextual_effects": {"obsidian_shield": 50.0, "obsidian_duration": 5.0},
        }]))
        assert result["status"] == "success"


# -----------------------------------------------------------------------
# SHIELD — shield_grant (same mechanism as OBSIDIAN)
# -----------------------------------------------------------------------

class TestShieldEnchantment:
    def test_shield_grants_value(self):
        ench = EnchantmentData(
            enchantment_type="SHIELD",
            routed_effects={"shield_grant": {"shield_amount": 30.0, "shield_duration": 5.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert result[8] == 30

    def test_shield_applied_at_buff_time(self):
        buff = BuffDefinition(
            buff_id="barrier", owner_id="hero", duration=None,
            enchantment=EnchantmentData(
                enchantment_type="SHIELD",
                routed_effects={"shield_grant": {"shield_amount": 40.0, "shield_duration": 5.0}},
            ),
        )
        world = _run_scenario([buff], duration=1.0, initial_shield=10)
        assert world.unit_runtime.current_shield >= 50

    def test_shield_api_accepted(self):
        result = simulate(_api_config(items=[{
            "buff_id": "barrier",
            "enchantment_type": "SHIELD",
            "contextual_effects": {"shield_amount": 30.0, "shield_duration": 5.0},
        }]))
        assert result["status"] == "success"


# -----------------------------------------------------------------------
# FREEZE — freeze_debuff (massive cooldown multiplier)
# -----------------------------------------------------------------------

class TestFreezeEnchantment:
    def test_freeze_massively_increases_cooldown(self):
        ench = EnchantmentData(
            enchantment_type="FREEZE",
            routed_effects={"freeze_debuff": {"freeze_duration": 2.0, "freeze_chance": 0.5}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        cd_mul = result[4]
        assert cd_mul >= 999.0

    def test_freeze_reduces_attacks_to_minimum(self):
        result = simulate(_api_config(duration=5.0, items=[{
            "buff_id": "freeze-ring",
            "enchantment_type": "FREEZE",
            "contextual_effects": {"freeze_duration": 2.0, "freeze_chance": 0.25},
        }]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["attack_count"] <= 2

    def test_freeze_zero_chance_no_effect(self):
        ench = EnchantmentData(
            enchantment_type="FREEZE",
            routed_effects={"freeze_debuff": {"freeze_duration": 2.0, "freeze_chance": 0.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert result[4] == pytest.approx(1.0)


# -----------------------------------------------------------------------
# GOLD — gold_reward (non-combat, writes to modifier view)
# -----------------------------------------------------------------------

class TestGoldEnchantment:
    def test_gold_produces_bonus(self):
        ench = EnchantmentData(
            enchantment_type="GOLD",
            routed_effects={"gold_reward": {"gold_bonus": 5.0, "gold_chance": 0.1}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        gold = result[9]
        assert gold == pytest.approx(5.0)

    def test_gold_does_not_affect_damage(self):
        baseline = simulate(_api_config(items=[]))
        gold = simulate(_api_config(items=[{
            "buff_id": "gold-ring",
            "enchantment_type": "GOLD",
            "contextual_effects": {"gold_bonus": 100.0, "gold_chance": 1.0},
        }]))
        assert baseline["status"] == "success"
        assert gold["status"] == "success"
        assert gold["data"]["summary"]["attack_count"] == baseline["data"]["summary"]["attack_count"]

    def test_gold_stacks(self):
        ench = EnchantmentData(
            enchantment_type="GOLD",
            routed_effects={"gold_reward": {"gold_bonus": 5.0, "gold_chance": 0.1}},
        )
        result = apply_enchantment_effect(ench, 3, 0.0, 1.0, 1.0, 0.0)
        assert result[9] == pytest.approx(15.0)


# -----------------------------------------------------------------------
# RADIANCE — damage_over_time with NORMAL type
# -----------------------------------------------------------------------

class TestRadianceEnchantment:
    def test_radiance_produces_dot(self):
        ench = EnchantmentData(
            enchantment_type="RADIANCE",
            routed_effects={"damage_over_time": {"radiance_damage": 25.0, "radiance_radius": 2.0}},
        )
        result = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        dot_dps = result[6]
        dot_type = result[7]
        assert dot_dps == pytest.approx(12.5)
        assert dot_type == DamageType.NORMAL

    def test_radiance_api_accepted(self):
        result = simulate(_api_config(items=[{
            "buff_id": "radiance-gem",
            "enchantment_type": "RADIANCE",
            "contextual_effects": {"radiance_damage": 25.0, "radiance_radius": 2.0},
        }]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["total_damage"] > 0


# -----------------------------------------------------------------------
# Cross-cutting: no side effects on existing pipeline
# -----------------------------------------------------------------------

class TestNoPipelineRegression:
    def test_empty_items_baseline_unchanged(self):
        result = simulate(_api_config(items=[]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["attack_count"] == 6

    def test_flash_still_works(self):
        result = simulate(_api_config(items=[{
            "buff_id": "flash-blade",
            "enchantment_type": "FLASH",
            "contextual_effects": {"flash_damage": 50.0, "flash_cooldown_reduction": 0.2},
        }]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["total_damage"] > 0
