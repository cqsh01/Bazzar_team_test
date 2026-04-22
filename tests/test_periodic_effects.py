from __future__ import annotations

from minimal_sim_core.damage_pipeline import DamagePipeline
from minimal_sim_core.event import Event
from minimal_sim_core.event_types import EventType
from minimal_sim_core.periodic_effect import PeriodicEffectDefinition
from minimal_sim_core.simulation_core import SimulationCore
from minimal_sim_core.world_state import (
    BuffDefinition,
    BuffModifierDefinition,
    DamageType,
    DummyTargetRuntime,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
    WorldState,
)


def _scenario(*, periodic_effects=(), buffs=(), shield: int = 0, duration: float = 3.0) -> SimulationScenario:
    return SimulationScenario(
        config=SimulationConfig(simulation_duration=duration, time_precision=0.1),
        unit=UnitConfig(
            unit_id="hero",
            base_damage=0,
            base_attack_cooldown=10.0,
            crit_chance=0.0,
            max_health=100,
            initial_shield=0,
        ),
        dummy_target=DummyTargetRuntime(target_id="dummy", current_health=1000, current_shield=shield),
        initial_buffs=buffs,
        initial_periodic_effects=periodic_effects,
    )


def _periodic(
    effect_id: str = "burn",
    *,
    amount: float = 10.0,
    damage_type: DamageType = DamageType.NORMAL,
    interval: float = 0.5,
    duration: float | None = 1.5,
    max_ticks: int | None = None,
    loadout_order_index: int = 0,
) -> PeriodicEffectDefinition:
    return PeriodicEffectDefinition(
        effect_id=effect_id,
        owner_id="hero",
        target_id="dummy",
        interval=interval,
        duration=duration,
        max_ticks=max_ticks,
        source_base_damage=amount,
        damage_type=damage_type,
        loadout_order_index=loadout_order_index,
    )


def test_periodic_damage_ticks_and_expires_after_three_ticks() -> None:
    result = SimulationCore(_scenario(periodic_effects=(_periodic(amount=10, interval=0.5, duration=1.5),), duration=2.0)).run()
    periodic_points = [p for p in result.metrics["damage_timeline"] if p["damage"] == 10]
    assert [p["timestamp"] for p in periodic_points] == [0.5, 1.0, 1.5]
    assert result.metrics["periodic_damage_total"] == 30
    assert result.metrics["periodic_tick_count"] == 3
    assert len(result.metrics["timeline_events"]) == 3
    assert result.world_state.dummy_target.current_health == 970
    assert result.world_state.active_periodic_effects == {}


def test_periodic_effects_are_deterministic_for_identical_inputs() -> None:
    scenario = _scenario(periodic_effects=(_periodic(amount=7, interval=0.5, duration=1.5),), duration=2.0)
    result_a = SimulationCore(scenario).run()
    result_b = SimulationCore(scenario).run()
    assert result_a.metrics == result_b.metrics
    assert result_a.world_state.dummy_target.current_health == result_b.world_state.dummy_target.current_health
    assert result_a.world_state.dummy_target.current_shield == result_b.world_state.dummy_target.current_shield


def test_periodic_damage_uses_stage_six_rounding() -> None:
    result = SimulationCore(_scenario(periodic_effects=(_periodic(amount=0.5, interval=0.5, duration=0.5),), duration=1.0)).run()
    periodic_points = [p for p in result.metrics["damage_timeline"] if p["timestamp"] == 0.5]
    assert len(periodic_points) == 1
    assert periodic_points[0]["damage"] == 1
    assert result.metrics["periodic_damage_total"] == 1
    assert result.metrics["periodic_tick_count"] == 1


def test_fire_periodic_damage_uses_shield_mapping() -> None:
    result = SimulationCore(_scenario(periodic_effects=(_periodic(amount=101, damage_type=DamageType.FIRE, interval=0.5, duration=0.5),), shield=100, duration=1.0)).run()
    assert result.world_state.dummy_target.current_shield == 50
    assert result.world_state.dummy_target.current_health == 949


def test_toxic_periodic_damage_bypasses_shield() -> None:
    result = SimulationCore(_scenario(periodic_effects=(_periodic(amount=25, damage_type=DamageType.TOXIC, interval=0.5, duration=0.5),), shield=100, duration=1.0)).run()
    assert result.world_state.dummy_target.current_shield == 100
    assert result.world_state.dummy_target.current_health == 975


def test_periodic_tick_reads_current_modifiers_dynamically() -> None:
    buff = BuffDefinition(
        buff_id="fire-buff",
        owner_id="hero",
        duration=None,
        modifiers=BuffModifierDefinition(flat_damage_bonus=3.0, global_damage_multiplier=1.5),
        loadout_order_index=0,
    )
    result = SimulationCore(_scenario(periodic_effects=(_periodic(amount=10, interval=0.5, duration=0.5),), buffs=(buff,), duration=1.0)).run()
    periodic_points = [p for p in result.metrics["damage_timeline"] if p["timestamp"] == 0.5]
    assert len(periodic_points) == 1
    assert periodic_points[0]["damage"] == 20
    assert result.metrics["periodic_damage_total"] == 20
    assert result.metrics["periodic_tick_count"] == 1


def test_same_timestamp_tick_precedes_expire_and_tick_precedes_buff_apply() -> None:
    world = WorldState.initialize(_scenario(duration=1.0))
    effect = _periodic(amount=11, interval=0.5, duration=0.5)
    world.submit(Event(0.0, EventType.PERIODIC_APPLY, effect.owner_id, effect.target_id, {"periodic_effect": effect}, 0, effect.loadout_order_index))
    world.submit(Event(0.5, EventType.BUFF_APPLY, "hero", "hero", {"buff": BuffDefinition(buff_id="later", owner_id="hero", duration=None, modifiers=BuffModifierDefinition(flat_damage_bonus=9.0), loadout_order_index=0)}, 0, 0))

    seen = []
    pipeline = DamagePipeline()
    while world.has_pending_events():
        next_event = world.timeline.peek()
        if next_event is None or next_event.timestamp > 0.5:
            break
        seen.append((next_event.timestamp, next_event.event_type.value, next_event.contextual_priority))
        world.process_next(pipeline)

    at_half = [item for item in seen if item[0] == 0.5]
    assert [item[1] for item in at_half[:3]] == ["PERIODIC_TICK", "DAMAGE", "PERIODIC_EXPIRE"]
    assert any(item[1] == "BUFF_APPLY" for item in at_half[3:])
