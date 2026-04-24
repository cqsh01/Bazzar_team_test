# The Bazaar Web Prototype

## Local startup

1. Install Python optional server dependencies:
   - `pip install -e .[server]`
2. Install web dependencies:
   - `cd web && npm install`
3. Start the local API bridge:
   - `python -m minimal_sim_core.server --port 8000`
4. Start the Vite dev server:
   - `cd web && npm run dev`

## Local bridge endpoints

- `POST /api/simulate`
  - Transparent proxy to `minimal_sim_core.api.simulate()`
  - Uses FastAPI async endpoint plus thread offload via `asyncio.to_thread(...)`
- `GET /api/schema`
  - Returns `generate_json_schema()` output
  - Intended for dynamic frontend form validation and contract-aware builders

## Production preparation

- Development mode calls the local FastAPI bridge through the Vite proxy.
- The TypeScript client already reserves a Pyodide/WASM branch behind `window.PYODIDE_READY` for future offline execution.
- Keep Python runtime dependencies in the root optional dependency group so the core package remains zero-runtime-dependency by default.

## Dynamic schema integration

The frontend bridge exposes `ApiClient.fetchSchema()` to load the latest backend request schema at runtime. This allows future forms to:

- fetch `/api/schema`
- map `$defs` and `required` fields into UI controls
- validate payload completeness before calling `simulate()`
- detect contract drift during local development

---

## Phase 5.2 鈥?Configuration Panel

### Component tree

```
<App>
  <ApiStatusBadge />
  <ConfigPanel>                       鈫?FormProvider wrapper (react-hook-form)
    <ValidationBanner />              鈫?aggregated errors mapped to SimulationErrorCode
    <GlobalConfigForm />              鈫?optional global fields
    <UnitConfigForm />                鈫?required unit fields (all 7)
    <LoadoutManager>                  鈫?@dnd-kit drag-drop + add/remove
      <SortableRow>                   鈫?per-card drag handle + move/remove
        <ItemFields /> | <SkillFields />  鈫?inline editing (expandable)
      </SortableRow>
    </LoadoutManager>
    <SubmitSimulationButton />        鈫?validate 鈫?call API 鈫?echo diff 鈫?push to result-store
  </ConfigPanel>
</App>
```

### State management

All configuration state lives in a single **Zustand store** (`useConfigStore`). React Hook Form is layered on top purely for validation and error display. The two systems stay in sync:

| Direction | Mechanism |
|-----------|-----------|
| Form 鈫?Zustand | `watch()` subscription calls `replaceConfig()` on every field change |
| Zustand 鈫?Form | `useEffect` on array-length changes calls `form.reset()` |

Available store actions:

| Action | Description |
|--------|-------------|
| `updateGlobal(patch)` | Merge into `global_config` |
| `updateUnit(patch)` | Merge into `unit_config` |
| `addItem('item' \| 'skill')` | Append default item/skill, auto-index |
| `removeItem(kind, index)` | Remove + re-index `loadout_order_index` |
| `updateItemAt(index, patch)` | Patch a single item |
| `updateItemModifiersAt(index, patch)` | Merge into item's `modifiers` sub-object |
| `updateSkillAt(index, patch)` | Patch a single skill |
| `reorderLoadout(kind, from, to)` | Move item/skill + re-index |
| `replaceConfig(config)` | Wholesale replace (used by form sync & echo sync) |
| `reset()` | Restore factory defaults |

### Validation rules (Phase 4.4 JSON Schema mapping)

| Field | Schema Constraint | Form Rule |
|-------|-------------------|-----------|
| `global_config.simulation_duration` | `exclusiveMinimum: 0` | `min > 0` |
| `global_config.time_precision` | `exclusiveMinimum: 0` | `min > 0` |
| `global_config.min_cooldown_default` | `minimum: 0` | `min >= 0` |
| `global_config.min_cooldown_absolute` | `minimum: 0` | `min >= 0` |
| `global_config.max_events` | `exclusiveMinimum: 0` | `min > 0` |
| `global_config.dummy_target_shield` | `minimum: 0` | `min >= 0` |
| `unit_config.unit_id` | `required` | `required` |
| `unit_config.base_damage` | `required`, `minimum: 0` | `required`, `min >= 0` |
| `unit_config.base_attack_cooldown` | `required`, `exclusiveMinimum: 0` | `required`, `min > 0` |
| `unit_config.crit_chance` | `required`, `minimum: 0`, `maximum: 1` | `required`, `0 <= x <= 1` |
| `unit_config.max_health` | `required`, `exclusiveMinimum: 0` | `required`, `min > 0` |
| `unit_config.initial_shield` | `required`, `minimum: 0` | `required`, `min >= 0` |
| `unit_config.initial_heal_pool` | `required`, `minimum: 0` | `required`, `min >= 0` |
| `item_configs[].buff_id` | `required` | `required` |
| `item_configs[].duration` | `minimum: 0` | `min >= 0` |
| `item_configs[].max_stacks` | `minimum: 1` | `min >= 1` |
| `item_configs[].modifiers.crit_multiplier` | `minimum: 0` | `min >= 0` |
| `item_configs[].modifiers.global_damage_multiplier` | `minimum: 0` | `min >= 0` |
| `skill_configs[].skill_id` | `required` | `required` |
| `skill_configs[].interval` | `exclusiveMinimum: 0` | `min > 0` |
| `skill_configs[].source_base_damage` | `minimum: 0` | `min >= 0` |
| `skill_configs[].damage_type` | `enum` | `<select>`: NORMAL / FIRE / TOXIC |
| `item_configs[].modifiers.damage_type_override` | `enum + null` | `<select>`: None / NORMAL / FIRE / TOXIC |

### Error mapping (`error-mapper.ts`)

Validation errors are mapped to Phase 4.3 `SimulationErrorCode`:

| Error condition | Mapped code |
|-----------------|-------------|
| Required field empty | `MISSING_UNIT_CONFIG` |
| Message contains "required" | `MISSING_UNIT_CONFIG` |
| Numeric range violation | `INVALID_NUMERIC_VALUE` |

Errors appear in `<ValidationBanner>` with code badges and field paths.

### Drag-and-drop interaction

- **Pointer drag**: Click the "Drag" handle on any card and drag to reorder within the same kind (items with items, skills with skills).
- **Keyboard**: Focus the drag handle, use arrow keys to move.
- **Move up/down buttons**: Alternative to drag; each click swaps with adjacent card.
- **Auto-indexing**: After any reorder, all `loadout_order_index` values are recalculated (0-based, contiguous).
- **Cross-kind restriction**: Items cannot be dragged onto skills and vice-versa.

### Input echo verification

After a successful simulation, `SubmitSimulationButton` compares the submitted form values with `response.data.input_echo`. If they differ (e.g., the engine normalized defaults), a non-blocking banner offers a one-click "Sync form to engine echo" action.

---

## Phase 5.3 鈥?Result Visualization

### Component tree

```
<App>
  <ConfigPanel />
  <ResultSection>                     鈫?reads useResultStore
    [Loading]  鈫?<Skeleton />         鈫?shimmer cards + chart placeholder
    [Error]    鈫?error code badge + message + dismiss/retry button
    [Success]  鈫?
      <SummaryDashboard />            鈫?6 metric cards + per_owner breakdown
      <CombatTimelineChart />         鈫?recharts ComposedChart (dual Y-axis)
      <DebugToggle />                 鈫?checkbox, only if debug_timeline exists
      <DebugTimelineTable />          鈫?zebra-stripe table + filters + color badges
  </ResultSection>
</App>
```

### Result state management (`useResultStore`)

Independent Zustand store 鈥?decoupled from config state.

| Action | Description |
|--------|-------------|
| `setLoading()` | Clear previous results, set `isLoading: true` |
| `setResult(response)` | Store `SimulateSuccessResponse`, clear loading |
| `setError(response)` | Store `SimulateErrorResponse`, clear loading |
| `clearResult()` | Reset all fields to defaults |
| `toggleDebug()` | Flip `showDebug` boolean |

Lifecycle: `SubmitSimulationButton` calls `setLoading()` before API call, then `setResult()` or `setError()` on completion.

### Summary Dashboard

Renders 6 metric cards in a responsive grid:

| Card | Field | Formatting |
|------|-------|------------|
| Total Damage | `summary.total_damage` | Thousands separator |
| DPS | `summary.dps` | 2 decimal places |
| Attack Count | `summary.attack_count` | Thousands separator |
| Periodic Damage | `summary.periodic_damage_total` | Thousands separator |
| Periodic Ticks | `summary.periodic_tick_count` | Thousands separator |
| Total Events | `summary.event_count` | Thousands separator |

Plus a per-owner damage breakdown table (only shown when `per_owner_damage` is non-empty).

### Combat Timeline Chart

Built with `recharts` `<ComposedChart>`:

- **Left Y-axis**: `total_dps_window` as a red line (`<Line>`)
- **Right Y-axis**: `hp_value` (green step-area) + `shield_value` (blue step-area)
- **X-axis**: `time` formatted as `0.0s, 1.0s, ...`
- **Tooltip**: Dark overlay showing exact time, DPS, HP, Shield at hover point
- **Brush**: Appears when data has >30 points; enables sliding zoom on time axis
- **Performance**: Animation disabled when >300 data points for 60fps interaction
- **Data integrity**: Chart data consumed directly from `response.data.charts` 鈥?zero frontend recomputation

### Debug Timeline Table

Visible only when `debug_timeline` exists and the user enables the toggle.

| Column | Source field | Notes |
|--------|-------------|-------|
| Time | `time` | 2 decimal places + "s" suffix |
| Source | `source_id` | Bold |
| Damage | `damage` | Thousands separator, monospace |
| Type | `damage_type` | Color badge: NORMAL=blue, FIRE=orange, TOXIC=purple |
| Periodic | `is_periodic` | "Yes" / "No" |
| HP After | `hp_after` | Thousands separator, monospace |
| Shield After | `shield_after` | Thousands separator, monospace |

Features:
- **Fixed header** with sticky positioning
- **Zebra-stripe rows** (alternating white / light gray)
- **Filters**: Dropdown for `damage_type` (ALL / NORMAL / FIRE / TOXIC) and `is_periodic` (ALL / Periodic / Non-Periodic)
- **Large dataset guard**: >1000 rows shows export-to-JSON prompt instead of rendering

### Enabling debug mode

Set `debug_mode: true` in the Global Configuration section before running the simulation. The engine will include `debug_timeline` in the response, enabling the debug table toggle.

### Performance notes

- Chart animation is automatically disabled for datasets exceeding 300 points
- Debug timeline uses direct DOM rendering up to 1000 rows; beyond that threshold a JSON export button replaces the table
- All data comes directly from the backend response 鈥?no frontend resampling or DPS recalculation

## Running tests

```bash
cd web
npm test           # Vitest unit tests
npm run test:e2e   # Playwright E2E tests (requires running dev server + API bridge)
```

---

## Phase 5.4 锟斤拷 Local Persistence & State

### Local persistence

Configuration state is persisted in browser `localStorage` under `bazaar_sim_config_v1`.

- every config mutation schedules a **300ms debounce save**
- page unload triggers an immediate flush via `beforeunload`
- corrupted or schema-invalid local JSON is rejected by strict type guards and replaced with defaults
- fallback recovery surfaces a non-blocking notice in the toolbar

### Snapshot export / import

Implemented in `src/lib/persistence.ts` without third-party parsing libraries.

Export shape:

```json
{
  "__meta_version": "v1",
  "global_config": {},
  "unit_config": { "unit_id": "hero" },
  "item_configs": [],
  "skill_configs": []
}
```

- export uses `Blob` + `URL.createObjectURL`
- filename format: `bazaar_config_YYYYMMDD_HHmmss.json`
- import validates `__meta_version`
- unknown / missing versions route through reserved `migrateConfig()` and currently throw `UNSUPPORTED_SCHEMA_VERSION`
- imported payload must pass strict `isSimulateRequest()` validation before entering state

### Persistence toolbar

`PersistenceToolbar` is mounted at the top-right of the configuration panel and provides:

- `??` auto-save status indicator
- `?? Restore Local`
- `?? Export JSON`
- `?? Import JSON`
- `Save Now`

Import uses a hidden `<input type="file" accept=".json">` and displays schema mismatch / parse errors through the toolbar notice area.

### `input_echo` forced sync

After a successful simulation:
- `response.data.input_echo` is treated as authoritative engine input
- frontend computes differences only across direct fields of `global_config`, `unit_config`, `item_configs`, and `skill_configs`
- store is **force-overwritten** with `input_echo`
- stale client values are never merged back

### Echo highlight feedback

Changed inputs receive `.animate-echo-highlight` for 2 seconds.

- applies to global config controls
- applies to unit config controls
- applies to expanded loadout item / skill controls
- paired info message: `锟斤拷锟斤拷锟窖帮拷锟斤拷锟斤拷锟斤拷锟斤拷准锟斤拷锟斤拷锟斤拷前锟斤拷示为实锟绞诧拷锟斤拷锟斤拷锟斤拷值`

### Upgrade path

Snapshot version is currently `v1`. Future upgrades should normalize legacy snapshots in `migrateConfig()` before writing into the store.

---

## Phase 5.5 鈥?Local UX Polish & Run Script

### One-click local startup

Two scripts are provided in the project root to launch the full stack in one command:

- **Windows**: `start-local.bat`
- **Linux / macOS**: `bash start-local.sh`

Both scripts will:
1. Check that Python and Node.js are available
2. Install Python server dependencies (`pip install -e .[server]`)
3. Install web dependencies (`npm install`) if `node_modules` is missing
4. Start the FastAPI bridge on port 8000
5. Wait for a health check (`/api/schema`)
6. Start the Vite dev server on port 5173
7. Open the browser automatically

### Error boundary

A global `<ErrorBoundary>` wraps the entire app. If a rendering crash or unhandled network error occurs:
- A friendly fallback card is shown with the error message
- If the error looks network-related (fetch / offline), the card shows an **Engine Offline** heading with guidance to start the FastAPI bridge
- A **Retry** button re-mounts the component tree

### Simulation timeout

`apiClient.simulate()` now enforces a **15-second timeout** via `AbortController`. If the engine does not respond in time:
- The fetch is aborted
- A descriptive error is thrown
- The error surfaces through the existing Toast + result-error flow

### Empty-state placeholder

Before any simulation is run, `<ResultSection>` shows a centered guidance panel instead of rendering nothing. It prompts the user to configure a loadout and click Run Simulation.

### FAQ / Troubleshooting

**Port 8000 is already in use**

Kill the process occupying the port, or change the port:

```bash
python -m minimal_sim_core.server --port 9000
```

Then update `vite.config.ts` proxy target to match.

**`python` is not recognized**

Ensure Python 3.9+ is on your system PATH. On Windows you may need to use `py` or the full path to your virtual environment's `python.exe`.

**Stale browser cache**

If the UI looks broken after an upgrade, hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) or clear `localStorage` via DevTools -> Application -> Local Storage -> delete `bazaar_sim_config_v1`.

**Simulation hangs / never completes**

The frontend enforces a 15-second timeout. If you hit this regularly, try a shorter `simulation_duration` or fewer items/skills.
