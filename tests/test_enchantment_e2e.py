"""Phase 6.3 end-to-end integration tests — verify enchantment effects actually fire."""
from __future__ import annotations

import pytest

from minimal_sim_core.api import simulate
from minimal_sim_core.world_state import (
    ActiveModifierView,
    BuffDefinition,
    BuffModifierDefinition,
    CooldownState,
    DummyTargetRuntime,
    EnchantmentData,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
    WorldState,
    apply_enchantment_effect,
)
from minimal_sim_core.damage_pipeline import DamagePipeline


def _api_config(
    duration: float = 10.0,
    cooldown: float = 1.0,
    items: list | None = None,
    skills: list | None = None,
) -> dict:
    return {
        "global_config": {"simulation_duration": duration},
        "unit_config": {
            "unit_id": "hero",
            "base_attack_cooldown": cooldown,
            "battle_context": {"self_hp": 1000, "self_shield": 0, "enemy_hp": 1000},
        },
        "item_configs": items or [],
        "skill_configs": skills or [],
    }


# -----------------------------------------------------------------------
# SLOW enchantment — reduces attack frequency
# -----------------------------------------------------------------------

class TestSlowEnchantmentReducesAttackFrequency:
    def test_slow_0_5_reduces_attack_count(self):
        baseline = simulate(_api_config(items=[]))
        slowed = simulate(_api_config(items=[{
            "buff_id": "slow-blade",
            "enchantment_type": "SLOW",
            "contextual_effects": {"slow_value": 0.5},
        }]))

        assert baseline["status"] == "success"
        assert slowed["status"] == "success"

        baseline_attacks = baseline["data"]["summary"]["attack_count"]
        slowed_attacks = slowed["data"]["summary"]["attack_count"]

        assert baseline_attacks == 11
        assert slowed_attacks < baseline_attacks
        assert slowed_attacks == pytest.approx(8, abs=1)

    def test_slow_1_0_halves_attack_rate(self):
        result = simulate(_api_config(duration=10.0, items=[{
            "buff_id": "heavy-slow",
            "enchantment_type": "SLOW",
            "contextual_effects": {"slow_value": 1.0},
        }]))
        assert result["status"] == "success"
        attacks = result["data"]["summary"]["attack_count"]
        assert attacks == pytest.approx(6, abs=1)

    def test_slow_modifier_view_has_cooldown_multiplier(self):
        ench = EnchantmentData(
            enchantment_type="SLOW",
            routed_effects={"slow_debuff": {"slow_value": 0.5}},
        )
        flat, crit, glob, cd, cm, hps, *_ = apply_enchantment_effect(
            ench, 1, 0.0, 1.0, 1.0, 0.0,
        )
        assert cm == pytest.approx(1.5)
        assert hps == 0.0

    def test_slow_stacks_multiply(self):
        ench = EnchantmentData(
            enchantment_type="SLOW",
            routed_effects={"slow_debuff": {"slow_value": 0.5}},
        )
        _, _, _, _, cm, _, *_ = apply_enchantment_effect(ench, 2, 0.0, 1.0, 1.0, 0.0)
        assert cm == pytest.approx(1.5 ** 2)


# -----------------------------------------------------------------------
# EVERGREEN enchantment — heals self over time
# -----------------------------------------------------------------------

class TestEvergreenHealsSelfOverTime:
    def _run_scenario(
        self, max_health: int, initial_health: int, heal_amount: float, heal_interval: float, duration: float,
    ) -> WorldState:
        unit = UnitConfig(
            unit_id="hero", base_damage=10, base_attack_cooldown=1.0,
            crit_chance=0.0, max_health=max_health, initial_shield=0,
        )
        buff = BuffDefinition(
            buff_id="evergreen-amulet", owner_id="hero", duration=None,
            enchantment=EnchantmentData(
                enchantment_type="EVERGREEN",
                routed_effects={"heal_over_time": {
                    "evergreen_heal": heal_amount,
                    "evergreen_duration": heal_interval,
                }},
            ),
        )
        scenario = SimulationScenario(
            config=SimulationConfig(simulation_duration=duration),
            unit=unit,
            dummy_target=DummyTargetRuntime(current_health=9999),
            cooldowns=(CooldownState(owner_id="hero", base_cooldown=1.0),),
            initial_buffs=(buff,),
        )
        world = WorldState.initialize(scenario)
        world.unit_runtime.current_health = initial_health
        pipeline = DamagePipeline()
        while world.has_pending_events():
            world.process_next(pipeline)
        return world

    def test_evergreen_heals_over_5_seconds(self):
        world = self._run_scenario(
            max_health=200, initial_health=100,
            heal_amount=20.0, heal_interval=5.0,
            duration=5.0,
        )
        assert world.unit_runtime.current_health > 100
        assert world.unit_runtime.current_health <= 200

    def test_evergreen_does_not_exceed_max_health(self):
        world = self._run_scenario(
            max_health=100, initial_health=95,
            heal_amount=50.0, heal_interval=1.0,
            duration=5.0,
        )
        assert world.unit_runtime.current_health == 100

    def test_heal_per_second_in_modifier_view(self):
        ench = EnchantmentData(
            enchantment_type="EVERGREEN",
            routed_effects={"heal_over_time": {
                "evergreen_heal": 10.0,
                "evergreen_duration": 2.0,
            }},
        )
        _, _, _, _, _, hps, *_ = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert hps == pytest.approx(5.0)

    def test_heal_per_second_stacks(self):
        ench = EnchantmentData(
            enchantment_type="EVERGREEN",
            routed_effects={"heal_over_time": {
                "evergreen_heal": 10.0,
                "evergreen_duration": 2.0,
            }},
        )
        _, _, _, _, _, hps, *_ = apply_enchantment_effect(ench, 3, 0.0, 1.0, 1.0, 0.0)
        assert hps == pytest.approx(15.0)


# -----------------------------------------------------------------------
# HEAL enchantment — also routes through heal_over_time stage
# -----------------------------------------------------------------------

class TestHealEnchantmentRoutesToHealOverTime:
    def test_heal_enchantment_produces_hps(self):
        ench = EnchantmentData(
            enchantment_type="HEAL",
            routed_effects={"heal_over_time": {
                "heal_amount": 20.0,
                "heal_interval": 2.0,
            }},
        )
        _, _, _, _, _, hps, *_ = apply_enchantment_effect(ench, 1, 0.0, 1.0, 1.0, 0.0)
        assert hps == pytest.approx(10.0)


# -----------------------------------------------------------------------
# Mixed enchantments — FLASH + SLOW simultaneously
# -----------------------------------------------------------------------

class TestMixedEnchantments:
    def test_flash_adds_flat_damage(self):
        result = simulate(_api_config(items=[{
            "buff_id": "flash-sword",
            "enchantment_type": "FLASH",
            "contextual_effects": {"flash_damage": 50.0, "flash_cooldown_reduction": 0.2},
        }]))
        assert result["status"] == "success"
        assert result["data"]["summary"]["total_damage"] > 0

    def test_api_accepts_evergreen_item(self):
        result = simulate(_api_config(items=[{
            "buff_id": "evergreen-ring",
            "enchantment_type": "EVERGREEN",
            "contextual_effects": {"evergreen_heal": 5.0, "evergreen_duration": 3.0},
        }]))
        assert result["status"] == "success"
