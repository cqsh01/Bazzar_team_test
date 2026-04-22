from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Tuple

from .constants import DEFAULT_SHIELD_FIRE_MAPPING_MULTIPLIER, EVENT_PRIORITY
from .event import Event
from .event_types import EventType
from .metrics import SimulationMetrics
from .periodic_effect import ActivePeriodicEffectState, PeriodicEffectDefinition
from .timeline import EventQueue


class DamageType(str, Enum):
    NORMAL = "NORMAL"
    FIRE = "FIRE"
    TOXIC = "TOXIC"


@dataclass(frozen=True)
class SimulationConfig:
    simulation_duration: float = 30.0
    time_precision: float = 0.1
    min_cooldown_default: float = 1.0
    min_cooldown_absolute: float = 0.5
    max_events: int = 10_000


@dataclass(frozen=True)
class UnitConfig:
    unit_id: str
    base_damage: int
    base_attack_cooldown: float
    crit_chance: float
    max_health: int
    initial_shield: int = 0
    initial_heal_pool: int = 0


@dataclass
class UnitRuntime:
    current_health: int
    current_shield: int
    is_alive: bool
    next_attack_timestamp: float
    attack_count: int = 0


@dataclass
class DummyTargetRuntime:
    target_id: str = "dummy"
    current_health: float = float("inf")
    current_shield: int = 0
    is_alive: bool = True


@dataclass(frozen=True)
class CooldownState:
    owner_id: str
    base_cooldown: float
    loadout_order_index: int = 0
    minimum_trigger_interval: float = 0.25


@dataclass(frozen=True)
class BuffModifierDefinition:
    flat_damage_bonus: float = 0.0
    crit_multiplier: float = 1.0
    global_damage_multiplier: float = 1.0
    shield_damage_mapping_multiplier: Optional[float] = None
    invulnerable_normal_damage: bool = False
    cooldown_delta: float = 0.0
    bypass_cooldown_floor: bool = False
    damage_type_override: Optional[DamageType] = None


@dataclass(frozen=True)
class BuffDefinition:
    buff_id: str
    owner_id: str
    duration: Optional[float]
    modifiers: BuffModifierDefinition = field(default_factory=BuffModifierDefinition)
    max_stacks: int = 1
    stackable: bool = False
    loadout_order_index: int = 0


@dataclass
class ActiveBuffState:
    definition: BuffDefinition
    stacks: int = 1


@dataclass(frozen=True)
class ActiveModifierView:
    flat_damage_bonus: float = 0.0
    crit_multiplier: float = 1.0
    global_damage_multiplier: float = 1.0
    shield_fire_multiplier: float = DEFAULT_SHIELD_FIRE_MAPPING_MULTIPLIER
    invulnerable_normal_damage: bool = False
    damage_type_override: Optional[DamageType] = None


@dataclass(frozen=True)
class SimulationScenario:
    config: SimulationConfig
    unit: UnitConfig
    dummy_target: DummyTargetRuntime = field(default_factory=DummyTargetRuntime)
    cooldowns: Tuple[CooldownState, ...] = ()
    initial_buffs: Tuple[BuffDefinition, ...] = ()
    initial_periodic_effects: Tuple[PeriodicEffectDefinition, ...] = ()


class WorldState:
    def __init__(self, scenario: SimulationScenario) -> None:
        self.config = scenario.config
        self.unit_config = scenario.unit
        self.unit_runtime = UnitRuntime(scenario.unit.max_health, scenario.unit.initial_shield, True, 0.0)
        self.dummy_target = DummyTargetRuntime(target_id=scenario.dummy_target.target_id, current_health=scenario.dummy_target.current_health, current_shield=scenario.dummy_target.current_shield, is_alive=scenario.dummy_target.is_alive)
        self.current_time = 0.0
        self.timeline = EventQueue()
        self.metrics = SimulationMetrics()
        self.cooldowns = {c.owner_id: {"base": c.base_cooldown, "current": 0.0} for c in scenario.cooldowns}
        self.active_buffs: Dict[str, ActiveBuffState] = {}
        self.active_periodic_effects: Dict[str, ActivePeriodicEffectState] = {}
        self._insertion_index = 0
        self._periodic_instance_index = 0

    @classmethod
    def initialize(cls, scenario: "SimulationScenario") -> "WorldState":
        world = cls(scenario)
        for buff in scenario.initial_buffs:
            world.submit(Event(0.0, EventType.BUFF_APPLY, buff.owner_id, scenario.unit.unit_id, {"buff": buff}, EVENT_PRIORITY[EventType.BUFF_APPLY], buff.loadout_order_index))
        for periodic_effect in scenario.initial_periodic_effects:
            world.submit(Event(0.0, EventType.PERIODIC_APPLY, periodic_effect.owner_id, periodic_effect.target_id, {"periodic_effect": periodic_effect}, EVENT_PRIORITY[EventType.PERIODIC_APPLY], periodic_effect.loadout_order_index))
        world.submit(Event(0.0, EventType.ATTACK, scenario.unit.unit_id, scenario.dummy_target.target_id, contextual_priority=EVENT_PRIORITY[EventType.ATTACK]))
        return world

    def quantize_time(self, value: float) -> float:
        p = self.config.time_precision
        return round(round(value / p) * p, 10)

    def submit(self, event: Event) -> None:
        if event.timestamp < self.current_time:
            raise ValueError("event timestamp cannot be earlier than current time")
        if len(self.timeline) >= self.config.max_events:
            raise OverflowError("event timeline overflow")
        self._insertion_index += 1
        self.timeline.push(Event(self.quantize_time(event.timestamp), event.event_type, event.source_id, event.target_id, event.payload, self._normalized_contextual_priority(event), event.loadout_order_index, self._insertion_index))

    def has_pending_events(self) -> bool:
        return len(self.timeline) > 0

    def process_next(self, damage_pipeline: object) -> None:
        event = self.timeline.pop()
        self.current_time = event.timestamp
        self.metrics.event_count += 1
        getattr(self, f"_handle_{event.event_type.value.lower()}")(event, damage_pipeline)

    def _handle_attack(self, event: Event, damage_pipeline: object) -> None:
        if event.timestamp > self.config.simulation_duration:
            return
        self.metrics.attack_count += 1
        self.unit_runtime.attack_count += 1
        self.submit(Event(event.timestamp, EventType.DAMAGE, self.unit_config.unit_id, self.dummy_target.target_id, {"source_base_damage": self.unit_config.base_damage, "is_crit": self._resolve_deterministic_crit(self.unit_runtime.attack_count), "damage_type": self.current_modifier_view().damage_type_override or DamageType.NORMAL, "damage_owner_id": self.unit_config.unit_id}, EVENT_PRIORITY[EventType.DAMAGE]))
        next_time = self.quantize_time(event.timestamp + self._current_attack_cooldown())
        self.unit_runtime.next_attack_timestamp = next_time
        if next_time <= self.config.simulation_duration:
            self.submit(Event(next_time, EventType.ATTACK, self.unit_config.unit_id, self.dummy_target.target_id, contextual_priority=EVENT_PRIORITY[EventType.ATTACK]))

    def _handle_damage(self, event: Event, damage_pipeline: object) -> None:
        result = damage_pipeline.execute(world_state=self, damage_event=event)
        if result.final_damage > 0:
            self.metrics.record_damage(timestamp=event.timestamp, owner_id=result.damage_owner_id, damage=result.final_damage, damage_type=result.damage_type.value, is_periodic=bool(event.payload.get("is_periodic", False)))
            self.metrics.record_timeline_event(time=event.timestamp, source_id=result.damage_owner_id, damage=result.final_damage, damage_type=result.damage_type.value, is_periodic=bool(event.payload.get("is_periodic", False)), hp_after=int(self.dummy_target.current_health), shield_after=int(self.dummy_target.current_shield))

    def _handle_periodic_apply(self, event: Event, damage_pipeline: object) -> None:
        definition: PeriodicEffectDefinition = event.payload["periodic_effect"]
        instance_id = self._next_periodic_instance_id(definition.effect_id)
        first_tick = event.timestamp if definition.immediate_first_tick else event.timestamp + definition.interval
        duration = definition.duration if definition.duration is not None else definition.interval * (definition.max_ticks or 0)
        active = ActivePeriodicEffectState(instance_id=instance_id, definition=definition, ticks_executed=0, next_tick_timestamp=self.quantize_time(first_tick), expires_at=self.quantize_time(event.timestamp + duration))
        self.active_periodic_effects[instance_id] = active
        if self._can_schedule_tick(active, active.next_tick_timestamp):
            self.submit(Event(active.next_tick_timestamp, EventType.PERIODIC_TICK, definition.owner_id, definition.target_id, {"periodic_instance_id": instance_id}, EVENT_PRIORITY[EventType.PERIODIC_TICK], definition.loadout_order_index))
        self.submit(Event(active.expires_at, EventType.PERIODIC_EXPIRE, definition.owner_id, definition.target_id, {"periodic_instance_id": instance_id}, EVENT_PRIORITY[EventType.PERIODIC_EXPIRE], definition.loadout_order_index))

    def _handle_periodic_tick(self, event: Event, damage_pipeline: object) -> None:
        active = self.active_periodic_effects.get(event.payload["periodic_instance_id"])
        if active is None or not active.is_active:
            return
        if event.timestamp > active.expires_at:
            return
        if active.definition.max_ticks is not None and active.ticks_executed >= active.definition.max_ticks:
            return
        self.submit(Event(event.timestamp, EventType.DAMAGE, active.definition.owner_id, active.definition.target_id, {"source_base_damage": active.definition.source_base_damage, "is_crit": False, "damage_type": active.definition.damage_type, "damage_owner_id": active.definition.resolved_damage_owner_id(), "is_periodic": True}, EVENT_PRIORITY[EventType.DAMAGE], active.definition.loadout_order_index))
        active.ticks_executed += 1
        next_tick = self.quantize_time(event.timestamp + active.definition.interval)
        active.next_tick_timestamp = next_tick
        if self._can_schedule_tick(active, next_tick):
            self.submit(Event(next_tick, EventType.PERIODIC_TICK, active.definition.owner_id, active.definition.target_id, {"periodic_instance_id": active.instance_id}, EVENT_PRIORITY[EventType.PERIODIC_TICK], active.definition.loadout_order_index))

    def _handle_periodic_expire(self, event: Event, damage_pipeline: object) -> None:
        active = self.active_periodic_effects.get(event.payload["periodic_instance_id"])
        if active is None:
            return
        active.is_active = False
        del self.active_periodic_effects[event.payload["periodic_instance_id"]]

    def _handle_buff_apply(self, event: Event, damage_pipeline: object) -> None:
        buff: BuffDefinition = event.payload["buff"]
        active = self.active_buffs.get(buff.buff_id)
        if active is None:
            self.active_buffs[buff.buff_id] = ActiveBuffState(buff)
        elif buff.stackable and active.stacks < buff.max_stacks:
            active.stacks += 1
        else:
            active.stacks = 1
        if buff.modifiers.cooldown_delta:
            self.submit(Event(event.timestamp, EventType.COOLDOWN_MODIFY, buff.owner_id, self.unit_config.unit_id, {"owner_id": self.unit_config.unit_id, "delta": buff.modifiers.cooldown_delta, "rule_override": buff.modifiers.bypass_cooldown_floor}, EVENT_PRIORITY[EventType.COOLDOWN_MODIFY], buff.loadout_order_index))
        if buff.duration is not None:
            self.submit(Event(event.timestamp + buff.duration, EventType.BUFF_EXPIRE, buff.owner_id, self.unit_config.unit_id, {"buff_id": buff.buff_id}, EVENT_PRIORITY[EventType.BUFF_EXPIRE], buff.loadout_order_index))

    def _handle_buff_expire(self, event: Event, damage_pipeline: object) -> None:
        active = self.active_buffs.get(event.payload["buff_id"])
        if active is None:
            return
        if active.definition.stackable and active.stacks > 1:
            active.stacks -= 1
        else:
            del self.active_buffs[event.payload["buff_id"]]

    def _handle_cooldown_reset(self, event: Event, damage_pipeline: object) -> None:
        state = self.cooldowns.get(event.payload["owner_id"])
        if state is not None:
            state["current"] = state["base"]

    def _handle_cooldown_modify(self, event: Event, damage_pipeline: object) -> None:
        state = self.cooldowns.get(event.payload["owner_id"])
        if state is None:
            return
        floor = self.config.min_cooldown_absolute if event.payload.get("rule_override") else self.config.min_cooldown_default
        state["current"] = max(float(state["current"]) + float(event.payload.get("delta", 0.0)), floor)

    def current_modifier_view(self) -> ActiveModifierView:
        flat_bonus, crit_mul, global_mul, fire_mul = 0.0, 1.0, 1.0, DEFAULT_SHIELD_FIRE_MAPPING_MULTIPLIER
        invulnerable = False
        override = None
        for active in self.active_buffs.values():
            m = active.definition.modifiers
            s = active.stacks
            flat_bonus += m.flat_damage_bonus * s
            crit_mul *= m.crit_multiplier ** s
            global_mul *= m.global_damage_multiplier ** s
            if m.shield_damage_mapping_multiplier is not None:
                fire_mul *= m.shield_damage_mapping_multiplier ** s
            invulnerable = invulnerable or m.invulnerable_normal_damage
            if m.damage_type_override is not None:
                override = m.damage_type_override
        return ActiveModifierView(flat_bonus, crit_mul, global_mul, fire_mul, invulnerable, override)

    def metrics_snapshot(self) -> Dict[str, object]:
        return self.metrics.as_dict(self.config.simulation_duration)

    def _resolve_deterministic_crit(self, attack_number: int) -> bool:
        current = self.unit_config.crit_chance * attack_number
        previous = self.unit_config.crit_chance * (attack_number - 1)
        return int(current) > int(previous)

    def _current_attack_cooldown(self) -> float:
        state = self.cooldowns.get(self.unit_config.unit_id)
        if state is None:
            return max(float(self.unit_config.base_attack_cooldown), self.config.min_cooldown_default)
        return max(float(state["current"] or state["base"]), self.config.min_cooldown_default)

    def _normalized_contextual_priority(self, event: Event) -> int:
        if event.event_type == EventType.PERIODIC_APPLY:
            return EVENT_PRIORITY[EventType.PERIODIC_APPLY]
        if event.event_type == EventType.PERIODIC_TICK:
            return EVENT_PRIORITY[EventType.PERIODIC_TICK]
        if event.event_type == EventType.PERIODIC_EXPIRE:
            return EVENT_PRIORITY[EventType.PERIODIC_EXPIRE]
        if event.event_type == EventType.BUFF_APPLY and event.contextual_priority == 0:
            return EVENT_PRIORITY[EventType.BUFF_APPLY]
        return event.contextual_priority

    def _next_periodic_instance_id(self, effect_id: str) -> str:
        self._periodic_instance_index += 1
        return f"{effect_id}#{self._periodic_instance_index}"

    def _can_schedule_tick(self, active: ActivePeriodicEffectState, timestamp: float) -> bool:
        if timestamp > active.expires_at:
            return False
        if active.definition.max_ticks is not None and active.ticks_executed >= active.definition.max_ticks:
            return False
        return True

