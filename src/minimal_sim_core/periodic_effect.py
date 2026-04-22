from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .world_state import DamageType


@dataclass(frozen=True)
class PeriodicEffectDefinition:
    effect_id: str
    owner_id: str
    target_id: str
    interval: float
    source_base_damage: float
    damage_type: "DamageType"
    duration: Optional[float] = None
    max_ticks: Optional[int] = None
    immediate_first_tick: bool = False
    loadout_order_index: int = 0
    damage_owner_id: Optional[str] = None

    def resolved_damage_owner_id(self) -> str:
        return self.damage_owner_id or self.owner_id


@dataclass
class ActivePeriodicEffectState:
    instance_id: str
    definition: PeriodicEffectDefinition
    ticks_executed: int
    next_tick_timestamp: float
    expires_at: float
    is_active: bool = True
