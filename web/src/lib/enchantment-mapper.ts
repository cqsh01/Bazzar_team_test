import type { EnchantmentType, ItemConfig, ItemModifierConfig } from '../types/sim';
import { ENCHANTMENT_SLOT_DEFS, type EffectSlotDef } from '../data/item_catalog';

// ---------------------------------------------------------------------------
// EnchantmentFormState — the UI-facing state for one item's enchantment
// ---------------------------------------------------------------------------

export interface EnchantmentFormState {
  enchantmentType: EnchantmentType;
  slotValues: Record<string, number>;
}

// ---------------------------------------------------------------------------
// itemToFormState — read an ItemConfig and produce the UI form state.
// Extracts enchantment_type + contextual_effects; modifiers is ignored.
// ---------------------------------------------------------------------------

export function itemToFormState(item: ItemConfig): EnchantmentFormState {
  const enchantmentType: EnchantmentType = item.enchantment_type ?? 'NONE';
  const contextual = item.contextual_effects ?? {};
  const slotDefs = ENCHANTMENT_SLOT_DEFS[enchantmentType] ?? [];

  const slotValues: Record<string, number> = {};
  for (const def of slotDefs) {
    slotValues[def.slotName] = contextual[def.slotName] ?? def.defaultValue;
  }

  return { enchantmentType, slotValues };
}

// ---------------------------------------------------------------------------
// formStateToItemPatch — convert UI form state back into an ItemConfig patch.
// Produces enchantment_type + contextual_effects and clears modifiers to {}.
// ---------------------------------------------------------------------------

export interface ItemEnchantmentPatch {
  enchantment_type: EnchantmentType;
  contextual_effects: Record<string, number>;
  modifiers: ItemModifierConfig;
}

export function formStateToItemPatch(state: EnchantmentFormState): ItemEnchantmentPatch {
  const contextual_effects: Record<string, number> = {};

  if (state.enchantmentType !== 'NONE') {
    const slotDefs = ENCHANTMENT_SLOT_DEFS[state.enchantmentType] ?? [];
    for (const def of slotDefs) {
      const value = state.slotValues[def.slotName];
      if (value !== undefined) {
        contextual_effects[def.slotName] = value;
      }
    }
  }

  return {
    enchantment_type: state.enchantmentType,
    contextual_effects,
    modifiers: {},
  };
}

// ---------------------------------------------------------------------------
// Round-trip guarantee: formStateToItemPatch(itemToFormState(item))
// produces the same contextual_effects as the original item (for keys
// that belong to the item's enchantment_type).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// buildDefaultFormState — for a given enchantment type, produce a form state
// pre-filled with default slot values from ENCHANTMENT_SLOT_DEFS.
// ---------------------------------------------------------------------------

export function buildDefaultFormState(enchantmentType: EnchantmentType): EnchantmentFormState {
  const slotDefs: readonly EffectSlotDef[] = ENCHANTMENT_SLOT_DEFS[enchantmentType] ?? [];
  const slotValues: Record<string, number> = {};
  for (const def of slotDefs) {
    slotValues[def.slotName] = def.defaultValue;
  }
  return { enchantmentType, slotValues };
}

// ---------------------------------------------------------------------------
// getSlotDefs — convenience accessor for the current enchantment's slots.
// ---------------------------------------------------------------------------

export function getSlotDefs(enchantmentType: EnchantmentType): readonly EffectSlotDef[] {
  return ENCHANTMENT_SLOT_DEFS[enchantmentType] ?? [];
}
