import { describe, expect, it } from 'vitest';
import {
  itemToFormState,
  formStateToItemPatch,
  buildDefaultFormState,
  getSlotDefs,
} from '../src/lib/enchantment-mapper';
import type { ItemConfig, EnchantmentType } from '../src/types/sim';
import { ENCHANTMENT_TYPES } from '../src/types/sim';
import { ENCHANTMENT_SLOT_DEFS } from '../src/data/item_catalog';

function makeItem(overrides: Partial<ItemConfig> = {}): ItemConfig {
  return {
    buff_id: 'test-item',
    owner_id: 'hero',
    loadout_order_index: 0,
    enchantment_type: 'NONE',
    contextual_effects: {},
    modifiers: {},
    ...overrides,
  };
}

describe('enchantment-mapper', () => {
  describe('itemToFormState', () => {
    it('returns NONE with empty slots for plain item', () => {
      const state = itemToFormState(makeItem());
      expect(state.enchantmentType).toBe('NONE');
      expect(Object.keys(state.slotValues)).toHaveLength(0);
    });

    it('reads contextual_effects for SLOW item', () => {
      const state = itemToFormState(makeItem({
        enchantment_type: 'SLOW',
        contextual_effects: { slow_duration: 3.0, slow_value: 0.5 },
      }));
      expect(state.enchantmentType).toBe('SLOW');
      expect(state.slotValues.slow_duration).toBe(3.0);
      expect(state.slotValues.slow_value).toBe(0.5);
    });

    it('fills missing slots with defaults', () => {
      const state = itemToFormState(makeItem({
        enchantment_type: 'BURN',
        contextual_effects: { burn_damage: 25 },
      }));
      expect(state.slotValues.burn_damage).toBe(25);
      expect(state.slotValues.burn_duration).toBe(3.0);
    });

    it('ignores modifiers entirely', () => {
      const state = itemToFormState(makeItem({
        enchantment_type: 'NONE',
        modifiers: { flat_damage_bonus: 999 },
      }));
      expect(state.enchantmentType).toBe('NONE');
      expect(Object.keys(state.slotValues)).toHaveLength(0);
    });
  });

  describe('formStateToItemPatch', () => {
    it('produces empty contextual_effects for NONE', () => {
      const patch = formStateToItemPatch({ enchantmentType: 'NONE', slotValues: {} });
      expect(patch.enchantment_type).toBe('NONE');
      expect(patch.contextual_effects).toEqual({});
      expect(patch.modifiers).toEqual({});
    });

    it('produces correct contextual_effects for BURN', () => {
      const patch = formStateToItemPatch({
        enchantmentType: 'BURN',
        slotValues: { burn_damage: 15, burn_duration: 4.0 },
      });
      expect(patch.enchantment_type).toBe('BURN');
      expect(patch.contextual_effects).toEqual({ burn_damage: 15, burn_duration: 4.0 });
      expect(patch.modifiers).toEqual({});
    });

    it('clears modifiers to empty object', () => {
      const patch = formStateToItemPatch({
        enchantmentType: 'FLASH',
        slotValues: { flash_damage: 20, flash_cooldown_reduction: 0.5 },
      });
      expect(patch.modifiers).toEqual({});
    });
  });

  describe('round-trip idempotency', () => {
    it('round-trips NONE item', () => {
      const item = makeItem();
      const state = itemToFormState(item);
      const patch = formStateToItemPatch(state);
      expect(patch.enchantment_type).toBe('NONE');
      expect(patch.contextual_effects).toEqual({});
    });

    it('round-trips SLOW item with custom values', () => {
      const item = makeItem({
        enchantment_type: 'SLOW',
        contextual_effects: { slow_duration: 5.0, slow_value: 0.7 },
      });
      const state = itemToFormState(item);
      const patch = formStateToItemPatch(state);
      expect(patch.contextual_effects).toEqual({ slow_duration: 5.0, slow_value: 0.7 });
    });

    it('round-trips every enchantment type with default values', () => {
      for (const et of ENCHANTMENT_TYPES) {
        const defaults = buildDefaultFormState(et);
        const patch = formStateToItemPatch(defaults);
        const restored = itemToFormState(makeItem({
          enchantment_type: et,
          contextual_effects: patch.contextual_effects,
        }));
        expect(restored.enchantmentType).toBe(et);
        expect(restored.slotValues).toEqual(defaults.slotValues);
      }
    });
  });

  describe('buildDefaultFormState', () => {
    it('returns empty slots for NONE', () => {
      const state = buildDefaultFormState('NONE');
      expect(state.enchantmentType).toBe('NONE');
      expect(Object.keys(state.slotValues)).toHaveLength(0);
    });

    it('populates defaults for EVERGREEN', () => {
      const state = buildDefaultFormState('EVERGREEN');
      expect(state.enchantmentType).toBe('EVERGREEN');
      expect(state.slotValues.evergreen_heal).toBe(10);
      expect(state.slotValues.evergreen_duration).toBe(6.0);
    });

    it('populates defaults for CRIT', () => {
      const state = buildDefaultFormState('CRIT');
      expect(state.slotValues.crit_bonus).toBe(0.5);
      expect(state.slotValues.crit_duration).toBe(5.0);
    });
  });

  describe('getSlotDefs', () => {
    it('returns empty array for NONE', () => {
      expect(getSlotDefs('NONE')).toHaveLength(0);
    });

    it('returns 2 slots for SLOW', () => {
      const defs = getSlotDefs('SLOW');
      expect(defs).toHaveLength(2);
      expect(defs[0].slotName).toBe('slow_duration');
      expect(defs[1].slotName).toBe('slow_value');
    });

    it('every enchantment has consistent slot count', () => {
      for (const et of ENCHANTMENT_TYPES) {
        const defs = getSlotDefs(et);
        const expected = ENCHANTMENT_SLOT_DEFS[et];
        expect(defs).toHaveLength(expected.length);
      }
    });
  });

  describe('switching enchantment type', () => {
    it('switching from BURN to NONE produces empty effects', () => {
      const burnState = buildDefaultFormState('BURN');
      expect(Object.keys(burnState.slotValues).length).toBeGreaterThan(0);

      const noneState = buildDefaultFormState('NONE');
      const patch = formStateToItemPatch(noneState);
      expect(patch.contextual_effects).toEqual({});
      expect(patch.modifiers).toEqual({});
    });

    it('switching from SLOW to FLASH resets slots', () => {
      const slowState = buildDefaultFormState('SLOW');
      expect(slowState.slotValues).toHaveProperty('slow_value');

      const flashState = buildDefaultFormState('FLASH');
      expect(flashState.slotValues).not.toHaveProperty('slow_value');
      expect(flashState.slotValues).toHaveProperty('flash_damage');
    });
  });

  describe('boundary values', () => {
    it('respects min/max from slot defs', () => {
      const defs = getSlotDefs('FREEZE');
      const chanceDef = defs.find(d => d.slotName === 'freeze_chance');
      expect(chanceDef).toBeDefined();
      expect(chanceDef!.min).toBe(0);
      expect(chanceDef!.max).toBe(1);
    });

    it('EVERGREEN slot defs have correct ranges', () => {
      const defs = getSlotDefs('EVERGREEN');
      const healDef = defs.find(d => d.slotName === 'evergreen_heal');
      expect(healDef).toBeDefined();
      expect(healDef!.min).toBe(0);
      expect(healDef!.max).toBe(9999);
      expect(healDef!.step).toBe(1);
    });
  });
});
