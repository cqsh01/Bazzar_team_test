from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .event_types import EventType


@dataclass(frozen=True)
class Event:
    timestamp: float
    event_type: EventType
    source_id: str
    target_id: Optional[str]
    payload: Dict[str, Any] = field(default_factory=dict)
    contextual_priority: int = 0
    loadout_order_index: int = 0
    insertion_index: int = 0
