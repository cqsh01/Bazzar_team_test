# Phase 5 鈥?Web UI, Result Visualization, and Persistence Summary
> 馃搶 **Note for Phase 5**: This document summarizes the frontend implementation delivered across Phase 5.2, Phase 5.3, and Phase 5.4.
> It acts as a technical consolidation document for the web prototype layer, not as a replacement for the lower-level API contract or simulation-core specs.

## 0 鈥?Phase 5 Positioning
Phase 5 establishes the **user-facing web prototype** for the Bazaar simulator.

It translates the previously defined simulation contract into a practical local workflow:
- configure a simulation payload in the browser
- validate user input against agreed schema rules
- submit requests to the local API bridge
- visualize result metrics and timelines
- persist and restore local configuration safely

Phase 5 does **not** redefine combat logic.
It is the **presentation, interaction, and state orchestration layer** sitting on top of the engine and API contract.

---

## 0.1 Phase 5 Scope Boundary
Phase 5 includes:
- Web-based configuration editing UI
- Validation and user-facing error mapping
- API submission workflow
- Result dashboard and timeline visualization
- Local persistence, import/export, and state recovery
- UX feedback systems such as highlight sync and global toast notifications

Phase 5 does **not** include:
- New combat mechanics
- Core simulation scheduling redesign
- Engine-side formula changes
- PvP, matchmaking, or online deployment concerns
- Non-local multi-user persistence

---

## 0.2 Core Design Philosophy
The frontend must preserve the simulator鈥檚 deterministic philosophy.

That means:
- The browser is a **configuration and observation surface**, not the source of truth for combat logic.
- The engine remains authoritative for normalized input (`input_echo`) and final results.
- UI behavior should maximize clarity, reproducibility, and recoverability.

**Critical principle:**
- What the player sees after a successful run should match what the engine actually used.
- Therefore, Phase 5.4 introduces forced sync from `input_echo` back into local state.

---

## 1. Goal
Build a local web prototype that allows a player to:
- edit a simulation payload without touching raw JSON
- run the simulation through a local bridge
- inspect summary metrics and timeline output
- persist and restore configuration safely between sessions

The intended usage model is:
- local machine
- local FastAPI bridge
- local Vite frontend
- deterministic single-user experimentation

---

## 2. Phase 5 Deliverables Overview
Phase 5 is effectively composed of three sub-phases:

### 2.1 Phase 5.2 鈥?Configuration Panel
Delivered:
- `react-hook-form` based config editor
- Zustand-backed config state (`useConfigStore`)
- Global config section
- Unit config section
- Item / skill loadout editing
- Drag-and-drop and move-up/down ordering
- Validation banner with mapped engine-style error codes

### 2.2 Phase 5.3 鈥?Result Visualization
Delivered:
- dedicated result store (`useResultStore`)
- loading / success / error states
- summary dashboard cards
- combat timeline chart
- optional debug timeline table with filtering
- large dataset safety guard

### 2.3 Phase 5.4 鈥?Local Persistence & State Synchronization
Delivered:
- `localStorage` persistence with debounce save
- route-leave flush behavior
- JSON snapshot export/import with versioning
- strict schema guard for imported and restored config
- `input_echo` forced sync into current form/store
- changed-field highlight for synchronized values
- unified global Toast notification system

---

## 3. Web Architecture Overview
The frontend is organized around three primary state domains:

### 3.1 Config State
Owned by `useConfigStore`.

Responsibilities:
- hold current editable simulation request
- support patch and reorder operations
- persist to local storage
- replace state from imported snapshot or engine echo
- track last saved timestamp
- track temporary highlighted paths after echo sync

### 3.2 Result State
Owned by `useResultStore`.

Responsibilities:
- loading state during submission
- success response storage
- error response storage
- debug toggle state

### 3.3 Toast State
Owned by `useToastStore`.

Responsibilities:
- global success / info / error notifications
- auto-dismiss timing
- unified feedback path for toolbar actions and simulation feedback

---

## 4. Configuration Editing Model
Phase 5.2 defines the editable request surface.

### 4.1 Main Component Composition
The UI flow is:

```text
<App>
  <ApiStatusBadge />
  <ConfigPanel>
    <PersistenceToolbar />
    <ValidationBanner />
    <GlobalConfigForm />
    <UnitConfigForm />
    <LoadoutManager />
    <SubmitSimulationButton />
  </ConfigPanel>
  <ResultSection />
  <ToastViewport />
</App>
```

### 4.2 Synchronization Strategy
Two layers cooperate:
- `react-hook-form` handles field registration and validation display
- Zustand stores durable app state

Synchronization rules:
- form changes propagate into Zustand via `watch()`
- structural changes such as item/skill list length changes trigger `form.reset(config)`
- successful engine execution may replace config wholesale through `input_echo`

### 4.3 Loadout Editing
Supported interactions:
- add item
- add skill
- remove item/skill
- drag reorder within same type
- keyboard reorder via accessible drag handles
- manual move up/down controls
- automatic contiguous `loadout_order_index` recomputation

---

## 5. Validation and Error Presentation
Validation is derived from the agreed API schema constraints.

### 5.1 Validation Categories
The frontend checks:
- required fields
- minimum / exclusive minimum numeric constraints
- bounded ranges such as `crit_chance 鈭?[0, 1]`
- enum-backed select values

### 5.2 Error Mapping
Validation failures are mapped to simulation-style error codes such as:
- `MISSING_UNIT_CONFIG`
- `INVALID_NUMERIC_VALUE`

This keeps frontend feedback aligned with backend contract language.

---

## 6. Simulation Submission Workflow
The submit flow is designed to keep backend results authoritative.

### 6.1 Request Path
1. user clicks `Run Simulation`
2. form validation runs
3. `useResultStore.setLoading()` is called
4. `apiClient.simulate(formValues)` sends the payload
5. success or error is stored in `useResultStore`
6. if success, `input_echo` is compared with submitted values
7. if differences exist, config store is forcibly synchronized

### 6.2 Authoritative Echo Principle
The engine may normalize or adjust request values.
To avoid UI drift:
- frontend computes direct field differences
- frontend replaces current config with `input_echo`
- affected fields receive temporary highlight
- a Toast explains that the visible config has been standardized to the engine-applied values

This ensures the browser reflects the actual simulation inputs.

---

## 7. Result Visualization
Phase 5.3 turns backend response objects into interpretable UI.

### 7.1 Summary Dashboard
Core metrics rendered:
- Total Damage
- DPS
- Attack Count
- Periodic Damage
- Periodic Tick Count
- Total Events

Additional breakdown:
- per-owner damage contribution table

### 7.2 Combat Timeline Chart
Rendered from backend chart data directly.

Displayed series include:
- DPS window line
- HP area/step visualization
- Shield area/step visualization

Rules:
- no frontend recomputation of combat math
- animation disabled for larger datasets
- brush enabled for long timelines

### 7.3 Debug Timeline Table
When debug data exists and debug mode is enabled:
- rows can be filtered by damage type
- periodic vs non-periodic events can be filtered
- sticky headers and zebra striping improve readability
- overly large datasets fall back to export-oriented handling instead of heavy DOM rendering

---

## 8. Local Persistence Model
Phase 5.4 adds recoverable local state behavior.

### 8.1 Persistence Key
Browser storage key:
- `bazaar_sim_config_v1`

### 8.2 Save Rules
- every config mutation schedules a **300ms debounce save**
- `beforeunload` triggers immediate flush
- manual `Save Now` is available in the toolbar

### 8.3 Restore Rules
`loadFromLocalStorage()`:
- reads raw JSON
- validates the shape against `SimulateRequest`
- restores config if valid
- resets to defaults if corrupted or schema-invalid

### 8.4 Failure Handling
Corrupted local configuration must not crash the app.
Fallback behavior:
- restore defaults
- overwrite broken local snapshot with safe defaults
- notify the user through Toast feedback

---

## 9. Snapshot Export / Import
Snapshot portability is supported without introducing third-party parsing dependencies.

### 9.1 Export Format
Exported JSON shape:

```json
{
  "__meta_version": "v1",
  "global_config": {},
  "unit_config": {},
  "item_configs": [],
  "skill_configs": []
}
```

### 9.2 Import Rules
On import:
- file text is read
- JSON parsing is attempted
- `__meta_version` is validated
- migration hook is reserved for future schema changes
- final object must pass `isSimulateRequest()`

### 9.3 Import Failure Modes
Explicitly handled:
- invalid JSON
- unsupported schema version
- structurally invalid payload

---

## 10. Unified Feedback System
A major Phase 5.4 refinement is the move from local toolbar text feedback to global Toast notifications.

### 10.1 Why Toasts
Toolbar-local notices were too limited for growing interaction complexity.
A global Toast system supports:
- persistence feedback
- import/export feedback
- engine echo sync explanation
- request error feedback
- future network / bridge / offline runtime states

### 10.2 Current Toast Coverage
Implemented notification classes:
- `success`
- `info`
- `error`

Current trigger points include:
- restore local config
- export snapshot
- import snapshot success/failure
- manual save
- simulation success
- simulation error
- input echo standardization notice

---

## 11. UX Guarantees Introduced in Phase 5
Phase 5 provides the following user-facing guarantees:

- **Deterministic editing surface**: the form always represents one concrete request object
- **Recoverability**: accidental refreshes do not lose config immediately
- **Portability**: configs can be exported and re-imported
- **Authority alignment**: post-run config can be synchronized to engine `input_echo`
- **Visibility of change**: echoed field differences are highlighted briefly
- **Unified feedback**: user actions and failures surface through Toasts consistently

---

## 12. Out-of-Scope / Future Directions
Phase 5 intentionally leaves room for later improvements.

Potential future work:
- schema-driven dynamic form generation from `/api/schema`
- deeper import interaction tests in RTL
- production-ready toast stacking policies and categories
- offline Pyodide execution branch
- richer analytics export and session history
- mobile-responsive form refinements

---

## 13. Phase 5 Outcome
At the end of Phase 5, the project has:

- ✅ A usable local web interface for editing simulation requests
- ✅ Validation aligned with the API contract
- ✅ Deterministic submission and result presentation flow
- ✅ Visual dashboard and chart-based result interpretation
- ✅ Local configuration persistence and recovery
- ✅ Snapshot export/import with versioning discipline
- ✅ Engine-authoritative `input_echo` synchronization
- ✅ Unified global Toast notifications for user feedback

Phase 5 therefore completes the transition from a backend-capable simulator prototype to a **practical local experimentation tool**.

> 馃洃 Phase 5 should be considered the baseline frontend usability milestone.
> Future phases may extend mechanics, offline runtime modes, or dynamic schema generation, but should not regress the guarantees established here.

---

## 14. Phase 5.5 鈥?Local UX Polish & Run Script

Phase 5.5 is a non-functional polish pass. It introduces no new business logic and adds no new dependencies.

### 14.1 Scope
- Global error boundary
- One-click local startup scripts
- Simulation request timeout
- Empty-state result placeholder
- README FAQ / troubleshooting section

### 14.2 Error Boundary

A class-based React `ErrorBoundary` wraps the entire `<App>` component tree.

Behavior:
- catches rendering errors and unhandled exceptions
- displays a friendly fallback card with error details
- detects network-related errors (fetch failures, offline engine) and shows an "Engine Offline" heading with remediation guidance
- provides a **Retry** button that clears error state and re-mounts the tree

Location: `web/src/components/ErrorBoundary.tsx`

### 14.3 One-Click Local Startup

Two scripts are provided in the project root:

| Script | Platform |
|--------|----------|
| `start-local.sh` | Linux / macOS |
| `start-local.bat` | Windows |

Both scripts execute the same workflow:
1. Verify Python and Node.js are available on PATH
2. Install Python server dependencies via `pip install -e .[server]`
3. Install web dependencies via `npm install` if `node_modules` is absent
4. Start the FastAPI bridge (`uvicorn`) on port 8000
5. Perform a health check against `/api/schema`; abort with error if bridge fails to start within 10 seconds
6. Start the Vite dev server on port 5173
7. Open the default browser to `http://localhost:5173`

On `Ctrl+C` or window close, both servers are terminated.

### 14.4 Simulation Timeout

`ApiClient.simulate()` now wraps the fetch call with an `AbortController` and a 15-second deadline.

Rules:
- if the engine does not respond within 15 seconds, the request is aborted
- a descriptive `Error` is thrown with a user-friendly message
- the error surfaces through the standard Toast notification and result-error flow
- no new dependencies are introduced; `AbortController` is a browser built-in

Constant: `SIMULATE_TIMEOUT_MS = 15000`

### 14.5 Empty-State Placeholder

Before any simulation has been run, `<ResultSection>` previously rendered nothing.

Phase 5.5 adds a centered guidance panel:
- a target icon
- heading: "No simulation results yet"
- body text guiding the user to configure their loadout and click Run Simulation
- `data-testid="result-empty"` for test targeting

### 14.6 README Additions

The web README now includes:
- a "One-click local startup" section documenting both scripts
- a "FAQ / Troubleshooting" section covering:
  - port 8000 already in use
  - `python` not recognized on PATH
  - stale browser cache after upgrade
  - simulation hangs / timeout behavior

### 14.7 Phase 5.5 Outcome

At the end of Phase 5.5:

- ✅ Rendering crashes are caught and shown as recoverable fallback UI
- ✅ Network/offline errors are detected and surfaced with actionable guidance
- ✅ Local startup is a single command for both Windows and Unix
- ✅ Long-running simulations are cancelled with user feedback
- ✅ Empty result area provides onboarding guidance instead of blank space
- ✅ README documents common setup issues

Phase 5.5 closes the gap between "code that works" and "code that is usable by a first-time local user."
