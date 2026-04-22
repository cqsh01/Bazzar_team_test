from __future__ import annotations

import math
from dataclasses import dataclass

from .event import Event
from .world_state import DamageType, WorldState


@dataclass(frozen=True)
class DamagePipelineResult:
    damage_owner_id: str
    damage_type: DamageType
    final_damage: int
    shield_damage_applied: int
    health_damage_applied: int


class DamagePipeline:
    def execute(self, *, world_state: WorldState, damage_event: Event) -> DamagePipelineResult:
        modifiers = world_state.current_modifier_view()

        source_base_damage = float(damage_event.payload["source_base_damage"])
        is_crit = bool(damage_event.payload["is_crit"])
        damage_type: DamageType = damage_event.payload["damage_type"]
        damage_owner_id = str(damage_event.payload["damage_owner_id"])

        damage_0 = source_base_damage
        effective_base_damage = damage_0 + modifiers.flat_damage_bonus

        crit_multiplier = 1.0
        if is_crit:
            crit_multiplier = 2.0 * modifiers.crit_multiplier
        damage_2 = effective_base_damage * crit_multiplier

        damage_3 = damage_2 * modifiers.global_damage_multiplier

        shield_mapping_multiplier = 1.0
        if damage_type == DamageType.FIRE:
            shield_mapping_multiplier = modifiers.shield_fire_multiplier
        elif damage_type == DamageType.TOXIC:
            shield_mapping_multiplier = 0.0

        if modifiers.invulnerable_normal_damage and damage_type == DamageType.NORMAL:
            return DamagePipelineResult(damage_owner_id, damage_type, 0, 0, 0)

        final_damage = max(math.floor(damage_3 + 0.5), 0)

        target = world_state.dummy_target
        current_shield = int(target.current_shield)
        shield_damage_applied = 0

        if damage_type != DamageType.TOXIC:
            shield_damage_applied = int(
                min(current_shield, final_damage * shield_mapping_multiplier)
            )
            target.current_shield = max(0, current_shield - shield_damage_applied)
            health_damage_applied = final_damage - shield_damage_applied
        else:
            health_damage_applied = final_damage

        if math.isfinite(target.current_health):
            current_health = int(target.current_health)
            target.current_health = max(0, current_health - health_damage_applied)
            target.is_alive = target.current_health > 0

        return DamagePipelineResult(
            damage_owner_id=damage_owner_id,
            damage_type=damage_type,
            final_damage=final_damage,
            shield_damage_applied=shield_damage_applied,
            health_damage_applied=health_damage_applied,
        )
