---
name: Bazaar Team Composition Simulator Plan
overview: A phased plan and implementation sequence for a web-based Bazaar team composition DPS simulator against a training dummy.
todos:
  - id: scope
    content: Define v1 simulator scope and combat rules
    status: pending
  - id: schema
    content: Design unit, item, skill, and effect data schema
    status: pending
    dependencies:
      - scope
  - id: engine
    content: Implement event-driven simulation engine MVP
    status: pending
    dependencies:
      - schema
  - id: tests
    content: Create test harness and verify baseline DPS cases
    status: pending
    dependencies:
      - engine
  - id: ui
    content: Build minimal web UI for team composition and results
    status: pending
    dependencies:
      - tests
  - id: content
    content: Expand content coverage and supported mechanics
    status: pending
    dependencies:
      - ui
  - id: qol
    content: Add share/save/compare quality-of-life features
    status: pending
    dependencies:
      - content
  - id: accuracy
    content: Refine simulator accuracy against observed game behavior
    status: pending
    dependencies:
      - qol
isProject: false
---

## Goal

Build a web app that lets users assemble a Bazaar team composition and simulate DPS against a training dummy with infinite health, no items, and no skills.

## Product principles

- Start with a useful MVP, not full game parity.
- Build the simulation engine before the UI.
- Keep game data separate from simulation logic.
- Prefer deterministic simulations first; add advanced mechanics later.
- Validate mechanics with test cases continuously.

## Phases

### Phase 0 — Scope and rules definition

Define exactly what the simulator does in v1:

- Training dummy only
- Fixed simulation duration (e.g. 30 seconds)
- Team composition format
- Supported mechanics for MVP
- Unsupported mechanics explicitly documented

Deliverables:

- Short rules/spec document
- First list of supported units/items/skills
- DPS definition and output metrics

### Phase 1 — Data model design

Design the source-of-truth types and data structure for:

- Units/heroes
- Items
- Skills
- Effects
- Buffs/debuffs
- Combat events
- Match/simulation config

Deliverables:

- Type definitions
- Example data entries
- Naming conventions and ID strategy

### Phase 2 — Combat engine MVP

Build a deterministic event-driven simulation core:

- Simulation clock
- Event queue
- Attack scheduling
- Damage resolution
- Dummy target
- Per-unit damage tracking
- Total DPS calculation

Deliverables:

- `simulate()` core function
- Event processing loop
- Simulation result schema

### Phase 3 — Verification and test harness

Create reliable test scenarios to verify calculations:

- Single attacker baseline DPS
- Attack speed scaling
- Flat on-attack bonus damage
- Simple cooldown skills
- Multi-unit total DPS aggregation

Deliverables:

- Unit tests
- Known-good fixtures
- Regression suite

### Phase 4 — Initial web app shell

Build the basic web interface:

- Team builder area
- Unit/item selectors
- Simulation controls
- Results panel
- Damage-over-time chart

Deliverables:

- Working single-page MVP UI
- Simulate button wired to engine
- Readable results output

### Phase 5 — Content expansion

Add more game content gradually:

- More heroes/units
- More items
- More skills/effects
- Upgrade/star/rarity support
- Conditional triggers

Deliverables:

- Expanded game data coverage
- Incremental mechanic support

### Phase 6 — Comparison and quality-of-life features

Add product polish features:

- Save/load builds
- Shareable URLs
- Compare two comps side by side
- Preset builds
- Import/export config JSON

Deliverables:

- Better usability and iteration speed

### Phase 7 — Accuracy refinement

Close the gap with real game behavior:

- Timing order refinements
- Trigger priority rules
- Buff stacking edge cases
- Rounding behavior
- Validation against observed in-game outcomes

Deliverables:

- Accuracy notes
- Documented assumptions and known mismatches

## Recommended build order

1. Define scope and supported mechanics.
2. Define data types and content schema.
3. Build simulation engine MVP.
4. Add tests and verify formulas.
5. Build minimal web UI around the engine.
6. Add more content and mechanics gradually.
7. Add quality-of-life features.
8. Refine parity with the game.

## MVP target

A user can:

- pick a small set of units/items
- run a 30-second simulation vs dummy
- see total DPS, total damage, per-unit contribution, and a timeline chart

## Suggested milestone gates

- Gate 1: one attacker vs dummy produces correct DPS
- Gate 2: multiple attackers aggregate correctly
- Gate 3: simple triggered effects work reliably
- Gate 4: web UI can build a comp and run simulation
- Gate 5: first playable public MVP

## Risks

- Game mechanic ambiguity
- Hidden timing/rounding rules
- Data collection overhead
- Scope creep into full game emulation

## Risk management

- Document assumptions
- Keep unsupported mechanics visible
- Build in small validated increments
- Prefer useful approximation over stalled perfection

