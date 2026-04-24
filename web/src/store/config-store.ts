import { create } from 'zustand';
import type { ItemConfig, ItemModifierConfig, SimulateRequest, SkillConfig } from '../types/sim';
import { INVALID_CONFIG_JSON, PersistenceError, isSimulateRequest } from '../lib/persistence';

const STORAGE_KEY = 'bazaar_sim_config_v1';
const SAVE_DEBOUNCE_MS = 300;
const ECHO_HIGHLIGHT_MS = 2000;

export const DEFAULT_SIMULATE_REQUEST: SimulateRequest = {
  global_config: {},
  unit_config: {
    unit_id: '',
    base_attack_cooldown: 1,
    battle_context: {
      self_hp: 1000,
      self_shield: 0,
      enemy_hp: 1000,
    },
  },
  item_configs: [],
  skill_configs: [],
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

export interface ConfigStoreState {
  config: SimulateRequest;
  lastSavedAt: number | null;
  highlightedPaths: string[];
  updateGlobal: (patch: Partial<SimulateRequest['global_config']>) => void;
  updateUnit: (patch: Partial<SimulateRequest['unit_config']>) => void;
  addItem: (kind?: 'item' | 'skill') => void;
  removeItem: (kind: 'item' | 'skill', index: number) => void;
  updateItemAt: (index: number, patch: Partial<ItemConfig>) => void;
  updateItemModifiersAt: (index: number, patch: Partial<ItemModifierConfig>) => void;
  updateSkillAt: (index: number, patch: Partial<SkillConfig>) => void;
  reorderLoadout: (kind: 'item' | 'skill', activeIndex: number, overIndex: number) => void;
  replaceConfig: (config: SimulateRequest) => void;
  forceSyncFromEcho: (config: SimulateRequest, highlightedPaths: string[]) => void;
  syncToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  clearEchoHighlight: () => void;
  reset: () => void;
}

function cloneDefaultConfig(): SimulateRequest {
  return JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest;
}

function writeStoredConfig(config: SimulateRequest): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function readStoredConfigUnsafe(): unknown {
  if (typeof window === 'undefined') {
    return cloneDefaultConfig();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneDefaultConfig();
  }

  return JSON.parse(raw) as unknown;
}

function readStoredConfig(): SimulateRequest {
  try {
    const parsed = readStoredConfigUnsafe();
    if (isSimulateRequest(parsed)) {
      return parsed;
    }
    return cloneDefaultConfig();
  } catch {
    return cloneDefaultConfig();
  }
}

function schedulePersist(config: SimulateRequest): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    writeStoredConfig(config);
  }, SAVE_DEBOUNCE_MS);
}

function createDefaultItem(index: number): ItemConfig {
  return {
    buff_id: `item-${index + 1}`,
    owner_id: 'hero',
    duration: null,
    loadout_order_index: index,
    max_stacks: 1,
    stackable: false,
    enchantment_type: 'NONE',
    contextual_effects: {},
    modifiers: {},
  };
}

function createDefaultSkill(index: number): SkillConfig {
  return {
    skill_id: `skill-${index + 1}`,
    owner_id: 'hero',
    interval: 1,
    duration: null,
    max_ticks: null,
    source_base_damage: 0,
    damage_type: 'NORMAL',
    immediate_first_tick: false,
    loadout_order_index: index,
    damage_owner_id: null,
  };
}

function syncLoadoutOrder<T extends ItemConfig | SkillConfig>(entries: T[]): T[] {
  return entries.map((entry, index) => ({
    ...entry,
    loadout_order_index: index,
  }));
}

function reorderArray<T>(entries: T[], activeIndex: number, overIndex: number): T[] {
  const next = [...entries];
  const [moved] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, moved);
  return next;
}

function replaceAt<T>(arr: T[], index: number, value: T): T[] {
  const next = [...arr];
  next[index] = value;
  return next;
}

function commitConfig(config: SimulateRequest): Pick<ConfigStoreState, 'config' | 'lastSavedAt'> {
  schedulePersist(config);
  return { config, lastSavedAt: Date.now() };
}

const initialStored = readStoredConfig();

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: initialStored,
  lastSavedAt: null,
  highlightedPaths: [],
  updateGlobal: (patch) => {
    set((state) => {
      const config = {
        ...state.config,
        global_config: {
          ...state.config.global_config,
          ...patch,
        },
      };
      return commitConfig(config);
    });
  },
  updateUnit: (patch) => {
    set((state) => {
      const config = {
        ...state.config,
        unit_config: {
          ...state.config.unit_config,
          ...patch,
        },
      };
      return commitConfig(config);
    });
  },
  addItem: (kind = 'item') => {
    set((state) => {
      const config =
        kind === 'item'
          ? {
              ...state.config,
              item_configs: [...state.config.item_configs, createDefaultItem(state.config.item_configs.length)],
            }
          : {
              ...state.config,
              skill_configs: [...state.config.skill_configs, createDefaultSkill(state.config.skill_configs.length)],
            };
      return commitConfig(config);
    });
  },
  removeItem: (kind, index) => {
    set((state) => {
      const config =
        kind === 'item'
          ? {
              ...state.config,
              item_configs: syncLoadoutOrder(state.config.item_configs.filter((_, itemIndex) => itemIndex !== index)),
            }
          : {
              ...state.config,
              skill_configs: syncLoadoutOrder(state.config.skill_configs.filter((_, skillIndex) => skillIndex !== index)),
            };
      return commitConfig(config);
    });
  },
  updateItemAt: (index, patch) => {
    set((state) => {
      const items = state.config.item_configs;
      if (index < 0 || index >= items.length) return state;
      const config = {
        ...state.config,
        item_configs: replaceAt(items, index, { ...items[index], ...patch }),
      };
      return commitConfig(config);
    });
  },
  updateItemModifiersAt: (index, patch) => {
    set((state) => {
      const items = state.config.item_configs;
      if (index < 0 || index >= items.length) return state;
      const config = {
        ...state.config,
        item_configs: replaceAt(items, index, {
          ...items[index],
          modifiers: { ...items[index].modifiers, ...patch },
        }),
      };
      return commitConfig(config);
    });
  },
  updateSkillAt: (index, patch) => {
    set((state) => {
      const skills = state.config.skill_configs;
      if (index < 0 || index >= skills.length) return state;
      const config = {
        ...state.config,
        skill_configs: replaceAt(skills, index, { ...skills[index], ...patch }),
      };
      return commitConfig(config);
    });
  },
  reorderLoadout: (kind, activeIndex, overIndex) => {
    set((state) => {
      if (activeIndex === overIndex || activeIndex < 0 || overIndex < 0) {
        return state;
      }
      const config =
        kind === 'item'
          ? {
              ...state.config,
              item_configs: syncLoadoutOrder(reorderArray(state.config.item_configs, activeIndex, overIndex)),
            }
          : {
              ...state.config,
              skill_configs: syncLoadoutOrder(reorderArray(state.config.skill_configs, activeIndex, overIndex)),
            };
      return commitConfig(config);
    });
  },
  replaceConfig: (config) => {
    set(commitConfig(config));
  },
  forceSyncFromEcho: (config, highlightedPaths) => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
    }
    set({ ...commitConfig(config), highlightedPaths });
    highlightTimer = setTimeout(() => {
      get().clearEchoHighlight();
    }, ECHO_HIGHLIGHT_MS);
  },
  syncToLocalStorage: () => {
    const config = get().config;
    writeStoredConfig(config);
    set({ lastSavedAt: Date.now() });
  },
  loadFromLocalStorage: () => {
    try {
      const parsed = readStoredConfigUnsafe();
      if (!isSimulateRequest(parsed)) {
        throw new PersistenceError(INVALID_CONFIG_JSON, 'Stored config does not match SimulateRequest shape.');
      }
      set({ config: parsed });
    } catch {
      const fallback = cloneDefaultConfig();
      writeStoredConfig(fallback);
      set({
        config: fallback,
        lastSavedAt: Date.now(),
      });
    }
  },
  clearEchoHighlight: () => {
    set({ highlightedPaths: [] });
  },
  reset: () => {
    const config = cloneDefaultConfig();
    writeStoredConfig(config);
    set({ config, highlightedPaths: [], lastSavedAt: Date.now() });
  },
}));

export const configStoreStorageKey = STORAGE_KEY;
export { ECHO_HIGHLIGHT_MS, SAVE_DEBOUNCE_MS, readStoredConfig, syncLoadoutOrder };
