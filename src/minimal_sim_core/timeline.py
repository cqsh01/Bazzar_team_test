from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .event import Event


@dataclass
class EventQueue:
    _heap: List[Tuple[float, int, int, int, Event]] = field(default_factory=list)

    def push(self, event: Event) -> None:
        heapq.heappush(
            self._heap,
            (
                event.timestamp,
                event.contextual_priority,
                event.loadout_order_index,
                event.insertion_index,
                event,
            ),
        )

    def pop(self) -> Event:
        return heapq.heappop(self._heap)[-1]

    def peek(self) -> Optional[Event]:
        if not self._heap:
            return None
        return self._heap[0][-1]

    def __len__(self) -> int:
        return len(self._heap)
