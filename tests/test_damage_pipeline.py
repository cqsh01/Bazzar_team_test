from __future__ import annotations

from minimal_sim_core.damage_pipeline import DamagePipeline
from minimal_sim_core.event import Event
from minimal_sim_core.event_types import EventType
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


def _make_world(*, shield: int = 0, buffs=()):
    scenario = SimulationScenario(
        config=SimulationConfig(simulation_duration=1.0),
        unit=UnitConfig(
            unit_id="hero",
            base_damage=0,
            base_attack_cooldown=1.0,
            crit_chance=0.0,
            max_health=100,
            initial_shield=0,
        ),
        dummy_target=DummyTargetRuntime(target_id="dummy", current_health=1000, current_shield=shield),
        initial_buffs=buffs,
    )
    world = WorldState.initialize(scenario)
    while world.has_pending_events():
        next_event = world.timeline.peek()
        if next_event is None or next_event.event_type != EventType.BUFF_APPLY:
            break
        world.process_next(DamagePipeline())
    return world


def _damage_event(amount: float, damage_type: DamageType) -> Event:
    return Event(
        timestamp=0.0,
        event_type=EventType.DAMAGE,
        source_id="hero",
        target_id="dummy",
        payload={
            "source_base_damage": amount,
            "is_crit": False,
            "damage_type": damage_type,
            "damage_owner_id": "hero",
        },
    )


def test_rounding_boundary_below_half() -> None:
    world = _make_world()
    result = DamagePipeline().execute(world_state=world, damage_event=_damage_event(0.49, DamageType.NORMAL))
    assert result.final_damage == 0
    assert result.health_damage_applied == 0


def test_rounding_boundary_at_half() -> None:
    world = _make_world()
    result = DamagePipeline().execute(world_state=world, damage_event=_damage_event(0.5, DamageType.NORMAL))
    assert result.final_damage == 1
    assert result.health_damage_applied == 1


def test_fire_half_mapping_absorbs_fifty_of_one_hundred_one() -> None:
    world = _make_world(shield=100)
    result = DamagePipeline().execute(world_state=world, damage_event=_damage_event(101, DamageType.FIRE))
    assert result.final_damage == 101
    assert result.shield_damage_applied == 50
    assert result.health_damage_applied == 51
    assert world.dummy_target.current_shield == 50


def test_toxic_bypasses_shield() -> None:
    world = _make_world(shield=100)
    result = DamagePipeline().execute(world_state=world, damage_event=_damage_event(25, DamageType.TOXIC))
    assert result.shield_damage_applied == 0
    assert result.health_damage_applied == 25
    assert world.dummy_target.current_shield == 100


def test_shield_overflow_absorbs_all_damage() -> None:
    world = _make_world(shield=50)
    result = DamagePipeline().execute(world_state=world, damage_event=_damage_event(10, DamageType.NORMAL))
    assert result.shield_damage_applied == 10
    assert result.health_damage_applied == 0
    assert world.dummy_target.current_shield == 40


def test_identical_inputs_are_deterministic() -> None:
    buffs = (
        BuffDefinition(
            buff_id="fire-buff",
            owner_id="hero",
            duration=None,
            modifiers=BuffModifierDefinition(
                flat_damage_bonus=3.0,
                global_damage_multiplier=1.5,
                damage_type_override=DamageType.FIRE,
            ),
        ),
    )
    world_a = _make_world(shield=80, buffs=buffs)
    world_b = _make_world(shield=80, buffs=buffs)

    event_a = _damage_event(101, world_a.current_modifier_view().damage_type_override or DamageType.NORMAL)
    event_b = _damage_event(101, world_b.current_modifier_view().damage_type_override or DamageType.NORMAL)

    result_a = DamagePipeline().execute(world_state=world_a, damage_event=event_a)
    result_b = DamagePipeline().execute(world_state=world_b, damage_event=event_b)

    assert result_a == result_b
    assert world_a.dummy_target.current_shield == world_b.dummy_target.current_shield
    assert world_a.dummy_target.current_health == world_b.dummy_target.current_health
