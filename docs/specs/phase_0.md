# Bazaar Team Composition Simulator Spec
> 📌 **Note for Phase 0**: Sections 6 & 7 define MVP binding constraints for development alignment. 
> Detailed implementation (data structures, event loop, grid UI) will be finalized in Phase 1.

## 0 – Design Boundary & Philosophy
## 0.1 Simulator Positioning
This project is a team composition & combat logic simulator for *The Bazaar*.  
It is **not** a full game reimplementation, nor a balance-accurate replica.

**Core purpose:**
- Allow players to experiment with item / buff / skill logic
- Validate interaction correctness
- Compare relative build performance under controlled conditions

> ⚠️ **Design Principle (Critical):**
> 
> The simulator is **value-agnostic**.  
> No numerical values are hardcoded by the system.
> 
> All numbers are:
> - Defined by the player
> - Editable before simulation
> - Treated as input data, not game rules

## 0.2 What the Simulator Simulates
The simulator only concerns itself with:
- Event timing
- Trigger ordering
- Damage & buff calculation pipelines
- Health / Shield / Buff state transitions

It does **not** simulate:
- Real PvP behavior
- AI decision-making
- Economy, drops, progression, or randomness

## 0.3 Player-Defined Numeric Inputs
The player is responsible for entering all numeric parameters, including but not limited to:

**Combat Stats**
- Base attack damage
- Attack cooldown
- Critical multiplier
- Damage multipliers (resistance / vulnerability)

**Defensive & Survival Stats**
- Maximum health
- Initial shield before combat
- Initial Restoration of Life before combat

**Item & Buff Values**
- Buff magnitude (e.g. `+X` damage, `+Y` shield, `-Z` cooldown)
- Buff duration or stack count
- Skill cooldowns and effect strength
- Recharge or cooldown-reset values

The simulator assumes:
- Players have time and intent to tune numbers
- Incorrect numbers are a user responsibility, not a system error

## 0.4 Determinism Guarantee
Given identical:
- Items
- Buffs
- Skills
- Numeric inputs
- Simulation duration

The simulator must always:
- Produce the same timeline
- Produce the same damage output
- Resolve events in a fully deterministic manner

`No randomness exists in MVP.`

## 0.5 Boundaries of Responsibility
**Simulator Responsibilities**
- Correct execution order
- Accurate timing
- Correct application of formulas
- Proper stacking and expiration of buffs
- State transitions (health, shield, invulnerability)

**Player Responsibilities**
- Define numeric values
- Ensure values make sense
- Interpret results meaningfully

## 0.6 Training Dummy Scope
- Single dummy target
- Infinite health
- No items
- No skills
- No buffs

**Purpose:**
- Provide a stable reference for DPS & interaction testing
- Remove combat variance

## 0.7 Phase 0 Outcome
At the end of Phase 0, the team agrees on:

- ✅ What is simulated
- ✅ What is ignored
- ✅ Who provides numbers
- ✅ That logic > balance
- ✅ That future mechanics must be explicitly added

> 🛑 **No implementation starts before Phase 0 is locked.**

## 1. Goal
Web-based team composition simulator for The Bazaar
tests DPS against a training dummy
dummy has infinite health, no items, no skills
simulator is for build testing, not full match emulation

## 2. MVP Scope
State clearly what is included in v1.:

training dummy only
fixed simulation time: 30 seconds
supports selected skills/items/items's properties include buff only
shows total DPS, total damage, per-unit contribution
And also what is not included:

hero choose
items' skins
enemy AI
PvP
movement/pathing
every edge-case interaction


## 3. Data Model Overview
List what game objects exist in the simulator.

health
Item & items's properties
Skill
buff
DummyTarget
SimulationConfig
This helps you prepare the data model in Phase 1.

Additional internal models such as Event, Modifier, or Timeline
may be introduced in Phase 1 as needed to support simulation logic.



## 4. Combat Rules Overview

**Included in MVP**
- Basic attacks
- Attack speed
- Flat damage bonuses
- Cooldown-based skills
- Simple buffs

**Explicitly NOT included in MVP (Future Mechanics)**
- DoT (Damage over Time)
- Summon / Minion control
- Chain reactions
- Conditional triggers (e.g. "if target HP < X%")


## 5. Supported Mechanics
Define what results the simulator returns.

Simulation always completes full duration
total damage for each items owned 

bonus:
average DPS
per-unit damage
skill trigger count
damage timeline



## 6. MVP Combat Rules:
- Each unit performs a basic attack every Cooldown timer seconds.
- Attack events are scheduled deterministically at exact timestamps.
- Player are thougt to set their wanted health
- Player can set how many shiled before combat begining
- Player can set Restoration of Life before combat begining
- Player in combat may see just such things will effect their health: 
    -Normal: Attack, shiled before combat begining, self Restoration of Life before combat begining
    -Buff: Shield, Toxic, Fire, invulnerable buff, Maximum health reduced(just one item can do it), Restoration of Life, Treatment

### 6.1 Cooldown Rules
- Cooldowns reset immediately after trigger.
- Cooldowns may be modified by items, skills, or buffs.
- Cooldown floor behavior follows §7.3.

### 6.2 Triggers Rules:
Triggers:
- On-attack effects trigger at the same timestamp as the attack damage.
- Multiple triggers at the same timestamp are resolved in item order.
-The minimum interval of Triggers per item: 0.25s 

### 6.4 Rounding Rules:
Rounding:
- All time values: float(Round to one decimal place)
- Damage values:
int(rounded at final application with rule X)

### 6.5 Buff Rules:
- Total 13 Enchantments in the game
- Buffs may modify cooldown(stop,speed up or down), damage multipliers,  protect/treat player, Cause the hero to be poisoned, invulnerable or on fire 
- Buffs are applied immediately when triggered.
- Buff stacking rule:
  - Identical buffs can stack values.

### 6.6 Item Rules:
- item have its own name
- item have its value
- Item can only have one Enchantment
- Item have types(types in item can be added)
- Item have its quality Eg. some items may not have low quality 
- Item have its function behaviour(this can be changed by add Enchantment) 
- Item can be destoryed and be repaired by other items or self(destory means it will Enter standby mode, keep
own numeric but cooldown will not change, if be repaired cooldown timer start from 0s.)
- Items have its own size


## 7. Placement Rules
- Player have 10-cell grid
- Small size item need 1-cell grid, Medium size item need 2-cell grid, Large-cell grid need 3-cell grid
## 8. Output Metrics & Assumptions

This section defines what the simulator outputs and clarifies assumptions made
to resolve unclear or unsupported Bazaar mechanics.  
These rules are binding for the MVP simulation engine.

---

### 7.1 Output Metrics

The simulator returns the following metrics after each simulation run:

#### Core Metrics (Required)
- **Total Damage**  
  Sum of all damage dealt to the training dummy during the simulation.
- **Average DPS**  
  `Total Damage / Simulation Duration (30s)`
- **Per-Unit Damage**  
  Total damage contributed by each unit.
- **Per-Item Damage**  
  Total damage attributed to each item owned by a unit.

#### Diagnostic / Debug Metrics (Optional but Recommended)
- **Skill / Item Trigger Count**  
  Number of times each skill or item effect was triggered.
- **Damage Timeline**  
  Time-series data showing damage applied over the simulation duration.
  (Used for charts and debugging timing issues.)

The training dummy has infinite health, therefore:
- No win/lose condition exists.
- All simulations always complete their full duration.

---

### 7.2 Trigger Order Assumptions

- Multiple events may occur at the same timestamp.
- Events at the same timestamp are processed in the following order:
  1. Base attack damage
  2. On-attack item effects
  3. On-attack skill effects
- If multiple items or skills trigger simultaneously:
  - They are resolved in the order defined in the unit's item list.
- No trigger conflicts or priority overrides exist in MVP.

---

### 7.3 Cooldown and Timing Assumptions

- All cooldown timers begin immediately after the trigger occurs.
- Cooldowns can be modified by buffs or item effects.
- **Minimum cooldown floor:**
  - Default minimum cooldown is **1.0 seconds**.
  - If a unit has a "high-speed" buff,
    cooldowns may be reduced below 1.0 seconds, but:
    - Absolute minimum cooldown is **0.5 seconds**.
- Items that support multiple triggers enforce:
  - **Minimum interval between triggers: 0.25 seconds**.
- Extra cooldown reduction applied beyond the remaining cooldown
  does **not** carry over to the next cooldown cycle.

---

### 7.4 Time Representation

- All time values are represented as floating-point numbers.
- Time precision is rounded to **one decimal place**.
- Event scheduling is deterministic:
  - Given the same input, the same event timeline is produced.

---

### 7.5 Damage Calculation Rules

#### Core Formula
`Final Damage = a × b × baseDamage`

- **`a` (Critical Multiplier Chain)**:
  - No crit: `a = 1`
  - Base crit: `a = 2.0` (fixed for all units)
  - Extended crit: Skills/Items may apply multiplicative bonuses to crit damage (e.g., `×1.5`, `×2.0`, `+50%`)
  - Final `a` calculation when crit occurs: `a = 2.0 × (∏ item/skill_crit_multipliers)`

- **`b` (Resistance / Vulnerability Modifier)**:
  - Default: `b = 1.0`
  - Modified by buffs (e.g., Vulnerable ×1.3, Resistant ×0.8)
  - Stacks multiplicatively with other `b` modifiers

#### Crit Chance Resolution (Deterministic)
- Player inputs crit chance as a percentage (0% ~ 100%).
- To comply with §0.4 Determinism Guarantee, **no RNG or random seeds are used**.
- Crits are resolved via a **fixed, evenly-distributed algorithm**:
  - e.g., 30% chance → exactly 3 out of every 10 attacks will crit, spaced at regular intervals.
  - Fractional remainders are carried forward deterministically.
- This ensures identical inputs always produce identical damage timelines.

#### Included in MVP:
- Flat damage bonuses
- Multiplicative modifiers
- basic element modifiers

#### Excluded from MVP:
- Damage mitigation
- Armor / resistance systems

#### Shield Interaction Rules (MVP Scope)
- Shield is treated as a health buffer applied before HP damage.
- Toxic damage ignores shield and directly applies to HP.
- Fire damage applies to shield first, but shield effectiveness against fire
  is multiplied by a player-defined modifier (e.g. ×2.0).
- If shield is exhausted, remaining damage is applied to HP.

---

### 7.6 Rounding Rules

- Time values: rounded to **one decimal place**.
- Damage values:
  - Final damage is converted to integer at the moment of application.
  - Rounding rule assumption:
    - Values `>= 0.5` round up
    - Values `< 0.5` round down

---

### 7.7 Unsupported or Ignored Interactions

The following mechanics are explicitly unsupported in MVP and ignored by the engine:

- Critical chance variance beyond deterministic rules
- Chain reactions
- Conditional triggers (e.g., "if enemy health < X")
- Random procs
- Skill priority overrides
- Edge-case interactions not specified in this document

Any unsupported mechanic must be explicitly added to this document
before being implemented.