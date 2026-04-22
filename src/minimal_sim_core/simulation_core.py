from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from .damage_pipeline import DamagePipeline
from .world_state import (
    BuffDefinition,
    BuffModifierDefinition,
    CooldownState,
    DamageType,
    SimulationConfig,
    SimulationScenario,
    UnitConfig,
    WorldState,
)


@dataclass(frozen=True)
class SimulationResult:
    metrics: Dict[str, object]
    world_state: WorldState


class SimulationCore:
    def __init__(self, scenario: SimulationScenario) -> None:
        self._scenario = scenario
        self._damage_pipeline = DamagePipeline()

    def run(self) -> SimulationResult:
        world_state = WorldState.initialize(self._scenario)
        while world_state.has_pending_events():
            next_event = world_state.timeline.peek()
            if next_event is None or next_event.timestamp > world_state.config.simulation_duration:
                break
            world_state.process_next(self._damage_pipeline)
        return SimulationResult(metrics=world_state.metrics_snapshot(), world_state=world_state)


def default_scenario() -> SimulationScenario:
    config = SimulationConfig(simulation_duration=30.0, time_precision=0.1)
    unit = UnitConfig(
        unit_id="hero",
        base_damage=100,
        base_attack_cooldown=1.0,
        crit_chance=0.3,
        max_health=1000,
        initial_shield=0,
    )
    cooldowns = (CooldownState(owner_id="hero", base_cooldown=1.0),)
    buffs = (
        BuffDefinition(
            buff_id="flame-weapon",
            owner_id="hero",
            duration=10.0,
            modifiers=BuffModifierDefinition(
                flat_damage_bonus=15.0,
                global_damage_multiplier=1.1,
                damage_type_override=DamageType.FIRE,
                shield_damage_mapping_multiplier=1.0,
            ),
            loadout_order_index=0,
        ),
        BuffDefinition(
            buff_id="adrenaline",
            owner_id="hero",
            duration=6.0,
            modifiers=BuffModifierDefinition(
                cooldown_delta=-0.2,
                bypass_cooldown_floor=False,
            ),
            loadout_order_index=1,
        ),
    )
    return SimulationScenario(config=config, unit=unit, cooldowns=cooldowns, initial_buffs=buffs)


def run_simulation(scenario: Optional[SimulationScenario] = None) -> Dict[str, object]:
    active_scenario = scenario or default_scenario()
    return SimulationCore(active_scenario).run().metrics
