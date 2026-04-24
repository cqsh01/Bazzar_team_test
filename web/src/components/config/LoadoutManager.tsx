import React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormContext } from 'react-hook-form';
import { useConfigStore } from '../../store/config-store';
import type { EnchantmentType, ItemConfig, SimulateRequest, SkillConfig } from '../../types/sim';
import { ENCHANTMENT_TYPES, DAMAGE_TYPES } from '../../types/sim';
import {
  itemToFormState,
  formStateToItemPatch,
  buildDefaultFormState,
  getSlotDefs,
  type EnchantmentFormState,
} from '../../lib/enchantment-mapper';

export type LoadoutKind = 'item' | 'skill';

type LoadoutEntry =
  | { kind: 'item'; index: number; id: string; label: string; order: number; raw: ItemConfig }
  | { kind: 'skill'; index: number; id: string; label: string; order: number; raw: SkillConfig };

function buildEntryId(kind: LoadoutKind, index: number): string {
  return `${kind}-${index}`;
}

function parseEntryId(id: string): { kind: LoadoutKind; index: number } | null {
  const [kind, rawIndex] = id.split('-');
  if ((kind === 'item' || kind === 'skill') && rawIndex) {
    return { kind, index: Number(rawIndex) };
  }
  return null;
}

function buildEntries(items: ItemConfig[], skills: SkillConfig[]): LoadoutEntry[] {
  const itemEntries: LoadoutEntry[] = items.map((item, index) => ({
    kind: 'item', index, id: buildEntryId('item', index),
    label: item.buff_id || `Item ${index + 1}`,
    order: item.loadout_order_index ?? index, raw: item,
  }));
  const skillEntries: LoadoutEntry[] = skills.map((skill, index) => ({
    kind: 'skill', index, id: buildEntryId('skill', index),
    label: skill.skill_id || `Skill ${index + 1}`,
    order: skill.loadout_order_index ?? index, raw: skill,
  }));
  return [...itemEntries, ...skillEntries].sort((a, b) => a.order - b.order);
}

export function reorderEntriesForTest<T extends { loadout_order_index?: number }>(
  entries: T[], activeIndex: number, overIndex: number,
): T[] {
  return arrayMove(entries, activeIndex, overIndex).map((e, i) => ({ ...e, loadout_order_index: i }));
}

const FI: React.CSSProperties = { padding:'0.375rem 0.5rem', border:'1px solid #cbd5e1', borderRadius:'6px', fontSize:'0.8125rem', background:'#fff', outline:'none', width:'100%', boxSizing:'border-box' };
const FL: React.CSSProperties = { display:'flex', flexDirection:'column', gap:'0.125rem', fontSize:'0.75rem', color:'#475569' };
const FG: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'0.5rem' };
const HI: React.CSSProperties = { fontSize:'0.6875rem', color:'#ef4444' };
const ENCH_SELECT: React.CSSProperties = { ...FI, fontWeight: 600, color: '#1e40af' };
const DEBOUNCE_MS = 150;

function ItemFields({ index }: { index: number }) {
  const { register, formState: { errors } } = useFormContext<SimulateRequest>();
  const highlightedPaths = useConfigStore((s) => s.highlightedPaths);
  const itemConfig = useConfigStore((s) => s.config.item_configs[index]);
  const updateItemAt = useConfigStore((s) => s.updateItemAt);
  const [formState, setFormState] = React.useState<EnchantmentFormState>(() => itemToFormState(itemConfig));
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushToStore = React.useCallback((state: EnchantmentFormState) => {
    updateItemAt(index, formStateToItemPatch(state));
  }, [index, updateItemAt]);

  const handleEnchantmentChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = buildDefaultFormState(e.target.value as EnchantmentType);
    setFormState(next);
    flushToStore(next);
  }, [flushToStore]);

  const handleSlotChange = React.useCallback((slotName: string, value: number) => {
    setFormState((prev) => {
      const next: EnchantmentFormState = { ...prev, slotValues: { ...prev.slotValues, [slotName]: value } };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => flushToStore(next), DEBOUNCE_MS);
      return next;
    });
  }, [flushToStore]);

  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const p = `item_configs.${index}` as const;
  const ie = errors.item_configs?.[index];
  const hc = (path: string): string => (highlightedPaths.includes(path) ? 'animate-echo-highlight' : '');
  const slotDefs = getSlotDefs(formState.enchantmentType);

  return (
    <div style={{ display:'grid', gap:'0.75rem' }}>
      <div style={FG}>
        <label style={FL}><span>buff_id *</span>
          <input className={hc(`${p}.buff_id`)} type="text" style={FI} {...register(`${p}.buff_id`, { required:'buff_id is required' })} />
          {ie?.buff_id && <span style={HI}>{String(ie.buff_id.message)}</span>}
        </label>
        <label style={FL}><span>owner_id</span>
          <input className={hc(`${p}.owner_id`)} type="text" style={FI} {...register(`${p}.owner_id`)} />
        </label>
        <label style={FL}><span>duration</span>
          <input className={hc(`${p}.duration`)} type="number" step="0.1" style={FI} {...register(`${p}.duration`, { valueAsNumber:true, min:{value:0, message:'>= 0'} })} />
        </label>
        <label style={FL}><span>max_stacks</span>
          <input className={hc(`${p}.max_stacks`)} type="number" step="1" style={FI} {...register(`${p}.max_stacks`, { valueAsNumber:true, min:{value:1, message:'>= 1'} })} />
        </label>
        <label style={{...FL, flexDirection:'row', alignItems:'center', gap:'0.375rem'}}>
          <input className={hc(`${p}.stackable`)} type="checkbox" {...register(`${p}.stackable`)} /><span>stackable</span>
        </label>
      </div>
      <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:'0.75rem' }}>
        <label style={{ ...FL, marginBottom:'0.5rem' }}>
          <span style={{ fontWeight:600, color:'#1e40af' }}>Enchantment Type</span>
          <select style={ENCH_SELECT} value={formState.enchantmentType} onChange={handleEnchantmentChange} data-testid={`enchantment-select-${index}`}>
            {ENCHANTMENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
          </select>
        </label>
        {slotDefs.length > 0 && (
          <div style={FG} data-testid={`enchantment-slots-${index}`}>
            {slotDefs.map((def) => (
              <label key={def.slotName} style={FL}>
                <span>{def.label}</span>
                <input type="number" step={def.step} min={def.min} max={def.max} style={FI}
                  value={formState.slotValues[def.slotName] ?? def.defaultValue}
                  onChange={(e) => handleSlotChange(def.slotName, Number(e.target.value))}
                  data-testid={`slot-${def.slotName}-${index}`} />
              </label>
            ))}
          </div>
        )}
        {formState.enchantmentType === 'NONE' && (
          <div style={{ color:'#94a3b8', fontSize:'0.8125rem', padding:'0.5rem 0' }}>
            No enchantment selected. Choose an enchantment type above to configure effects.
          </div>
        )}
      </div>
    </div>
  );
}

function SkillFields({ index }: { index: number }) {
  const { register, formState: { errors } } = useFormContext<SimulateRequest>();
  const highlightedPaths = useConfigStore((s) => s.highlightedPaths);
  const p = `skill_configs.${index}` as const;
  const se = errors.skill_configs?.[index];
  const hc = (path: string): string => (highlightedPaths.includes(path) ? 'animate-echo-highlight' : '');
  return (
    <div style={FG}>
      <label style={FL}><span>skill_id *</span>
        <input className={hc(`${p}.skill_id`)} type="text" style={FI} {...register(`${p}.skill_id`, { required:'skill_id is required' })} />
        {se?.skill_id && <span style={HI}>{String(se.skill_id.message)}</span>}
      </label>
      <label style={FL}><span>owner_id</span>
        <input className={hc(`${p}.owner_id`)} type="text" style={FI} {...register(`${p}.owner_id`)} />
      </label>
      <label style={FL}><span>interval</span>
        <input className={hc(`${p}.interval`)} type="number" step="0.1" style={FI} {...register(`${p}.interval`, { valueAsNumber:true, min:{value:Number.MIN_VALUE, message:'> 0'} })} />
      </label>
      <label style={FL}><span>duration</span>
        <input className={hc(`${p}.duration`)} type="number" step="0.1" style={FI} {...register(`${p}.duration`, { valueAsNumber:true, min:{value:0, message:'>= 0'} })} />
      </label>
      <label style={FL}><span>max_ticks</span>
        <input className={hc(`${p}.max_ticks`)} type="number" step="1" style={FI} {...register(`${p}.max_ticks`, { valueAsNumber:true, min:{value:0, message:'>= 0'} })} />
      </label>
      <label style={FL}><span>source_base_damage</span>
        <input className={hc(`${p}.source_base_damage`)} type="number" step="0.1" style={FI} {...register(`${p}.source_base_damage`, { valueAsNumber:true, min:{value:0, message:'>= 0'} })} />
      </label>
      <label style={FL}><span>damage_type</span>
        <select className={hc(`${p}.damage_type`)} style={FI} {...register(`${p}.damage_type`)}>
          {DAMAGE_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
        </select>
      </label>
      <label style={{...FL, flexDirection:'row', alignItems:'center', gap:'0.375rem'}}>
        <input className={hc(`${p}.immediate_first_tick`)} type="checkbox" {...register(`${p}.immediate_first_tick`)} /><span>immediate_first_tick</span>
      </label>
      <label style={FL}><span>damage_owner_id</span>
        <input className={hc(`${p}.damage_owner_id`)} type="text" style={FI} {...register(`${p}.damage_owner_id`)} />
      </label>
    </div>
  );
}


interface SortableRowProps {
  entry: LoadoutEntry;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function SortableRow({ entry, onMove, onRemove }: SortableRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entry.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    border: '1px solid #cbd5e1', borderRadius: '14px', padding: '1rem',
    background: '#ffffff', boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    display: 'grid', gap: '0.75rem',
  };
  const badge: React.CSSProperties = {
    display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
    color: entry.kind === 'item' ? '#1e40af' : '#7e22ce',
    background: entry.kind === 'item' ? '#dbeafe' : '#f3e8ff',
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`loadout-card-${entry.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span style={badge}>{entry.kind.toUpperCase()}</span>
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</strong>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', flexShrink: 0 }}>#{entry.order}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          <button type="button" onClick={() => setExpanded(v => !v)} aria-label={`toggle-${entry.id}`}>
            {expanded ? 'Collapse' : 'Edit'}
          </button>
          <button type="button" {...attributes} {...listeners} aria-label={`drag-${entry.id}`}>Drag</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onMove(-1)} aria-label={`move-up-${entry.id}`}>Move up</button>
        <button type="button" onClick={() => onMove(1)} aria-label={`move-down-${entry.id}`}>Move down</button>
        <button type="button" onClick={onRemove} aria-label={`remove-${entry.id}`}>Remove</button>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
          {entry.kind === 'item' ? <ItemFields index={entry.index} /> : <SkillFields index={entry.index} />}
        </div>
      )}
    </div>
  );
}

export function LoadoutManager() {
  const itemConfigs = useConfigStore((s) => s.config.item_configs);
  const skillConfigs = useConfigStore((s) => s.config.skill_configs);
  const addItem = useConfigStore((s) => s.addItem);
  const removeItem = useConfigStore((s) => s.removeItem);
  const reorderLoadout = useConfigStore((s) => s.reorderLoadout);

  const entries = React.useMemo(() => buildEntries(itemConfigs, skillConfigs), [itemConfigs, skillConfigs]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const a = parseEntryId(activeId);
    const o = parseEntryId(overId);
    if (!a || !o || a.kind !== o.kind) return;
    reorderLoadout(a.kind, a.index, o.index);
  }, [reorderLoadout]);

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Loadout</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={() => addItem('item')}>Add Item</button>
          <button type="button" onClick={() => addItem('skill')}>Add Skill</button>
        </div>
      </div>
      {entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
          No items or skills. Click Add Item or Add Skill to begin.
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {entries.map(entry => (
              <SortableRow key={entry.id} entry={entry}
                onMove={(dir) => {
                  const next = entry.index + dir;
                  if (next < 0) return;
                  if (entry.kind === 'item' && next >= itemConfigs.length) return;
                  if (entry.kind === 'skill' && next >= skillConfigs.length) return;
                  reorderLoadout(entry.kind, entry.index, next);
                }}
                onRemove={() => removeItem(entry.kind, entry.index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
