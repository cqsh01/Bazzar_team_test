from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class DamageTimelinePoint:
    timestamp: float
    owner_id: str
    damage: int
    damage_type: str


@dataclass
class TimelineEventPoint:
    time: float
    source_id: str
    damage: int
    damage_type: str
    is_periodic: bool
    hp_after: int
    shield_after: int


@dataclass
class SimulationMetrics:
    total_damage: int = 0
    per_owner_damage: Dict[str, int] = field(default_factory=dict)
    damage_timeline: List[DamageTimelinePoint] = field(default_factory=list)
    timeline_events: List[TimelineEventPoint] = field(default_factory=list)
    event_count: int = 0
    attack_count: int = 0
    periodic_damage_total: int = 0
    periodic_tick_count: int = 0

    def record_damage(
        self,
        timestamp: float,
        owner_id: str,
        damage: int,
        damage_type: str,
        *,
        is_periodic: bool = False,
    ) -> None:
        self.total_damage += damage
        self.per_owner_damage[owner_id] = self.per_owner_damage.get(owner_id, 0) + damage
        self.damage_timeline.append(
            DamageTimelinePoint(
                timestamp=timestamp,
                owner_id=owner_id,
                damage=damage,
                damage_type=damage_type,
            )
        )
        if is_periodic:
            self.periodic_damage_total += damage
            self.periodic_tick_count += 1

    def record_timeline_event(
        self,
        *,
        time: float,
        source_id: str,
        damage: int,
        damage_type: str,
        is_periodic: bool,
        hp_after: int,
        shield_after: int,
    ) -> None:
        self.timeline_events.append(
            TimelineEventPoint(
                time=time,
                source_id=source_id,
                damage=damage,
                damage_type=damage_type,
                is_periodic=is_periodic,
                hp_after=hp_after,
                shield_after=shield_after,
            )
        )

    def generate_chart_points(
        self,
        *,
        initial_hp: int,
        initial_shield: int,
        max_points: int = 300,
    ) -> List[Dict[str, float | int]]:
        if max_points <= 0:
            raise ValueError("max_points must be > 0")

        chart_points: List[Dict[str, float | int]] = [
            {
                "time": 0.0,
                "total_dps_window": 0.0,
                "shield_value": initial_shield,
                "hp_value": initial_hp,
            }
        ]

        if not self.timeline_events:
            return chart_points

        sorted_events = sorted(self.timeline_events, key=lambda point: point.time)
        last_time = sorted_events[-1].time
        bucket_count = min(max_points - 1, len(sorted_events))
        if bucket_count <= 0:
            return chart_points
        bucket_width = max(last_time / bucket_count, 1e-9)

        event_idx = 0
        last_hp = initial_hp
        last_shield = initial_shield

        for bucket_idx in range(bucket_count):
            boundary = last_time if bucket_idx == bucket_count - 1 else bucket_width * (bucket_idx + 1)
            bucket_damage = 0
            last_event = None
            while event_idx < len(sorted_events) and sorted_events[event_idx].time <= boundary:
                last_event = sorted_events[event_idx]
                bucket_damage += last_event.damage
                event_idx += 1

            if last_event is not None:
                last_hp = last_event.hp_after
                last_shield = last_event.shield_after

            time_value = round(boundary, 10)
            if time_value <= chart_points[-1]["time"]:
                time_value = round(chart_points[-1]["time"] + 1e-9, 10)

            chart_points.append(
                {
                    "time": time_value,
                    "total_dps_window": bucket_damage / bucket_width,
                    "shield_value": last_shield,
                    "hp_value": last_hp,
                }
            )

        return chart_points

    def as_dict(self, simulation_duration: float) -> Dict[str, object]:
        dps = self.total_damage / simulation_duration if simulation_duration > 0 else 0.0
        return {
            "total_damage": self.total_damage,
            "dps": dps,
            "per_owner_damage": dict(sorted(self.per_owner_damage.items())),
            "damage_timeline": [
                {
                    "timestamp": point.timestamp,
                    "owner_id": point.owner_id,
                    "damage": point.damage,
                    "damage_type": point.damage_type,
                }
                for point in self.damage_timeline
            ],
            "timeline_events": [
                {
                    "time": point.time,
                    "source_id": point.source_id,
                    "damage": point.damage,
                    "damage_type": point.damage_type,
                    "is_periodic": point.is_periodic,
                    "hp_after": point.hp_after,
                    "shield_after": point.shield_after,
                }
                for point in self.timeline_events
            ],
            "event_count": self.event_count,
            "attack_count": self.attack_count,
            "periodic_damage_total": self.periodic_damage_total,
            "periodic_tick_count": self.periodic_tick_count,
        }
