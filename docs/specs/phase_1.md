# Phase 1.1 — Data Model Design
*(Simulation Core Abstraction Layer)*

> ⚠️ **Scope Boundary**  
> 本阶段仅定义 **Simulation Core 的数据结构契约**。  
> 不涉及：代码实现、UI/Grid、Web 通信、Event Loop 调度逻辑、新机制引入。

---

## 1.1.0 目标与交付标准

Phase 1.1 必须明确回答：
- 系统中存在哪些**核心对象**
- 每个对象**拥有哪些状态**
- 哪些字段属于 **Config（玩家初始输入）**
- 哪些字段属于 **Runtime（模拟期动态演化）**
- **数据流向与修改权限**（谁可以改谁、如何改、走什么通道）

✅ **完成标准**：后续编写 Event 调度、伤害管线、Buff 结算时，无需再争论“该值属于哪个对象”或“状态如何安全变更”。

---

## 1.1.1 核心设计原则（继承 Phase 0）

| 原则 | 约束说明 |
|:---|:---|
| **Value‑agnostic** | 所有数值必须通过 `Config` 注入，核心层不硬编码任何伤害/CD/血量 |
| **State is explicit** | 任何随时间/事件变化的值，必须声明为 `Runtime` 字段 |
| **Event-Driven Mutation** | **绝对禁止**对象间直接赋值。所有状态变更必须封装为 `Event`，由 `WorldState` 处理器统一执行 |
| **Determinism first** | 无 `RNG` 字段。概率仅存为配置值，确定性分布与执行顺序由 Phase 1.2 定义 |

---

## 1.1.2 模型总览（Dependency Graph）

```text
Simulation
 ├─ SimulationConfig (Immutable)
 ├─ WorldState (Runtime Context & Event Processor)
 │   ├─ currentTime
 │   ├─ units[]
 │   ├─ timeline[]
 │   └─ metrics
 ├─ Unit
 │   ├─ items[]
 │   ├─ skills[]
 │   └─ activeBuffs[]
 ├─ Item
 │   └─ currentCooldown (Runtime)
 │   └─ currentEnchantment (Runtime)
 ├─ Skill
 │   └─ currentCooldown (Runtime)
 ├─ Buff
 │   └─ modifierDefinition (Config)
 └─ Enchantment
```

---

## 1.1.3 SimulationConfig（全局规则配置）

### 职责
定义单次模拟的边界参数。**全程只读，不参与战斗计算**。

### Config（玩家/系统输入）
- `simulationDuration`: float (default: `30.0`)
- `timePrecision`: float (default: `0.1`)
- `minCooldownDefault`: float (default: `1.0`)
- `minCooldownAbsolute`: float (default: `0.5`)

### Runtime
❌ 无（初始化后锁定）

---

## 1.1.4 WorldState 与 状态变更绝对契约

### 职责
承载所有动态数据，是 Event 执行与状态查询的**唯一作用域**。

### Runtime
- `currentTime`: float
- `units`: `Unit[]`
- `timeline`: `Event[]`（按 `timestamp` 排序的确定性事件队列）
- `metrics`: 统计容器

### 📜 核心铁律：Event 仅能通过 WorldState 修改目标对象 Runtime 字段
在确定性模拟器中，**禁止任何直接指针赋值或跨对象字段写入**。所有状态变更必须遵循以下路径：
1. **意图产生**：`Item`/`Skill`/`Buff` 触发逻辑或达到条件，生成一个 `Event` 实例（如 `CooldownModifierEvent`）。
2. **提交管线**：该 `Event` 被推入 `WorldState.timeline`。
3. **安全执行**：`WorldState` 处理器按时间轴取出 `Event`，校验规则后，**唯一合法地**修改目标对象的 `Runtime` 字段。
✅ **收益**：100% 可追溯、杜绝隐式依赖与竞态、完全支持确定性回放。

---

## 1.1.5 Unit（单位 / 英雄）

### 职责
战斗行为的主体。拥有基础属性、持有物、状态栈，是伤害的发起者与承受者。

### Config（玩家输入，仅 T=0 有效）
- `baseDamage`: int
- `baseAttackCooldown`: float
- `critChance`: float `[0.0 ~ 1.0]`
- `maxHealth`: int
- `initialShield`: int
- `initialHealPool`: int

### Runtime（模拟开始后独立演化）
- `currentHealth`: int
- `currentShield`: int
- `isAlive`: bool
- `nextAttackTimestamp`: float

### Owned Collections
- `items`: `Item[]`
- `skills`: `Skill[]`
- `activeBuffs`: `Buff[]`

✅ **生命周期**：`Runtime` 字段在 `T=0` 时从 `Config` 初始化，随后仅通过 Event 管线变更。

---

## 1.1.6 Item（物品）

### 职责
提供被动属性或触发型效果。逻辑上属于“可触发器”。

### Config
- `id`, `name`, `size`, `type`
- `baseCooldown`: float?
- `effectDefinition`: struct
- `initialEnchantmentId`: string?（开局预设）

### Runtime
- `currentCooldown`: float（✅ **所有权归属 Item**）
- `state`: enum `ACTIVE | DESTROYED`
- `currentEnchantment`: `EnchantmentInstance?`

### 📌 Cooldown 归属与修改契约
- `currentCooldown` 的**数据所有权**严格属于 `Item`（或 `Skill`）。
- 自身、其他物品、其他技能、Buff **均可影响**该值，但**不允许直接赋值**。
- 所有影响必须转化为 `CooldownModifierEvent`，由 `WorldState` 处理器执行写入。
- `DESTROYED` 状态下，CD 冻结，不响应任何修改 Event。

---

## 1.1.7 Skill（技能）

### 职责
语义上归属 Unit 本体，行为模式与 Item 高度一致。可携带“附加附魔”或“修改 CD”效果。

### Config
- `id`, `name`
- `baseCooldown`: float
- `triggerType`: enum `ON_ATTACK | ON_TIMER | MANUAL`
- `effectDefinition`: struct

### Runtime
- `currentCooldown`: float（✅ **所有权归属 Skill**）
- `triggerCount`: int

✅ **核心层约定**：`Skill` 与 `Item` 共享同一套 `Triggerable` 契约。Skill **自身不可被附魔**，仅作为附魔或修改效果的“施加源”。

---

## 1.1.8 Buff（状态 / Enchantment 效果衍生物）

### 职责
修改值与规则。不直接执行逻辑，仅暴露可查询的修饰器定义。

### Config
- `buffType`: enum
- `stackable`: bool
- `maxStacks`: int?
- `duration`: float?
- `modifierDefinition`: struct（声明修改意图）

### Runtime
- `currentStacks`: int
- `remainingDuration`: float
- `isActive`: bool

### 📌 Buff 修改契约（值 + 规则）
1. **Value Modifiers**：数值乘区/加减（如 `damageMultiplier: 1.5`, `flatCooldownReduction: -0.2s`）
2. **Rule Overrides**：逻辑开关/阈值（如 `bypassCooldownFloor: true`, `ignoreShieldOnFire: true`）
3. **执行路径**：Buff 自身不修改任何字段。当 Buff 生效/叠加/结算时，引擎读取 `modifierDefinition`，**自动提交对应 Event**（如 `CooldownModifierEvent`、`DamageModifierEvent`）至 `WorldState`。Buff 拥有发起修改的**权限**，但无直接执行的**能力**。

---

## 1.1.9 Enchantment（附魔实例）

### 职责
Item 的专属效果容器。提供 Buff 类、基础伤害类、触发次数类加成。

### Config（全局池定义）
- `id`, `name`
- `targetCompatibility`: const `ITEM_ONLY`

### Runtime Instance（附着在 Item 上）
- `sourceSkillId`: string?
- `activeModifiers`: struct
  - `buffModifiers`: `Buff[]?`
  - `baseDamageDelta`: int
  - `extraTriggerCount`: int

### 📌 附魔应用规则
- 严格存在于 `Item.runtime.currentEnchantment`。
- Skill 通过触发 `ApplyEnchantmentEvent` 尝试写入。
- **互斥校验**：`WorldState` 处理器在执行该 Event 前，检查 `targetItem.currentEnchantment == null`。若已有附魔，则 Event 丢弃。符合“只给战斗中没有附魔的物品附魔”规则。

---

## 1.1.10 Event（事件结构）

> ⚠️ 本阶段仅定义 **Event 的数据形态**，不定义调度器、排序逻辑或执行管线（归属 Phase 1.2）。

### 必填字段
- `timestamp`: float
- `type`: enum `ATTACK | DAMAGE | BUFF_APPLY | BUFF_EXPIRE | COOLDOWN_RESET | COOLDOWN_MODIFY | ITEM_STATE_CHANGE | ENCHANTMENT_APPLY`
- `source`: ref `Unit | Item | Skill`
- `target`: ref `Unit | DummyTarget | Item | null`
- `payload`: struct（携带上下文数据，如 `cooldownDelta`, `enchantmentId`, `damageValue`）

✅ Event 是 Timeline 中的原子节点，所有状态变更的**唯一入口**。

---

## 1.1.11 配置初始化与运行时演化流

| 阶段 | 数据状态 | 说明 |
|:---|:---|:---|
| **T < 0（准备期）** | 仅 `Config` 存在 | 玩家填写初始阵容、物品数值、预设附魔 ID |
| **T = 0（初始化）** | `Config` → `Runtime` 快照映射 | 所有 `Runtime` 字段从 Config 初始化。此时 `Config` 与 `Runtime` 值相同 |
| **T > 0（模拟期）** | `Runtime` 独立演化 | 玩家初始输入**仅作为起点**。物品/技能数值会被其他物品/技能/自身效果通过 Event **持续修改**。`Config` 保持不可变，`Runtime` 成为唯一真实状态 |
| **T = End（结算）** | 仅读 `Runtime` & `Metrics` | 输出最终 DPS、伤害分布、触发统计 |

✅ **铁律**：`Config` 是只读快照。所有模拟期数值变更**仅发生在 `Runtime` 字段**，且**必须通过 Event → WorldState 处理器**路径完成。

---

## 1.1.12 Config vs Runtime 矩阵

| 对象 | Config（玩家输入/只读快照） | Runtime（模拟期可变/真实状态） | 修改权限与路径 |
|:---|:---|:---|:---|
| `SimulationConfig` | 全部 | ❌ 无 | 初始化后锁定 |
| `WorldState` | ❌ 无 | `currentTime`, `timeline`, `metrics` | 仅 Event 处理器可写 |
| `Unit` | `baseDamage`, `critChance`, `maxHealth`... | `currentHealth`, `currentShield`, `nextAttackTimestamp` | Unit 自身 / Buff 管线 / Damage 管线（均走 Event） |
| `Item` | `baseCooldown`, `initialEnchantmentId`... | `currentCooldown`, `state`, `currentEnchantment` | **仅通过** `CooldownModifierEvent` / `ApplyEnchantmentEvent` 经 WorldState 修改 |
| `Skill` | `baseCooldown`, `triggerType` | `currentCooldown`, `triggerCount` | **仅通过** `CooldownModifierEvent` 经 WorldState 修改 |
| `Buff` | `modifierDefinition`, `duration`... | `currentStacks`, `remainingDuration`, `isActive` | 声明修改意图 → 引擎转化为对应 Event → WorldState 执行 |
| `Event` | ❌ 仅结构定义 | `timestamp` 由调度器注入 | Phase 1.2 定义 |

---

## 1.1.13 Phase 0 约束对齐检查

| Phase 0 条款 | Phase 1.1 落地方式 |
|:---|:---|
| `§0.1 Value-agnostic` | 所有数值字段均为 Config 注入，Core 层仅定义类型与边界 |
| `§0.4 Determinism` | 无 `RNG`；概率仅存配置；所有修改走 `Event → WorldState` 确定性管线 |
| `§6.1 Cooldown & External Mod` | 归属 `Item/Skill.Runtime`，外部影响统一走 `CooldownModifierEvent` |
| `§6.3/§7.5 Damage & Modifiers` | `Buff`/`Enchantment` 的 `modifierDefinition` 声明意图，管线转化为事件或乘区读取 |
| `§6.5 Enchantment Rule` | `ApplyEnchantmentEvent` + `WorldState` 互斥校验，严格绑定 Item |
| `§0.6 Dummy Scope` | `DummyTarget` 为 `Unit` 特例，`maxHealth = ∞`，无持有物/附魔/技能 |

---

## ✅ Phase 1.1 完成判定

当以下问题均可明确回答时，本阶段即可锁定：
- [ ] `Cooldown` 归属谁？ → **属于 `Item` 与 `Skill` 的 `Runtime` 字段**
- [ ] `Cooldown` 如何被外部影响？ → **仅通过 `CooldownModifierEvent`**。Buff/Skill/其他 Item 提交修改意图，由 `WorldState` 处理器执行写入
- [ ] `Buff` 能改什么？ → **值与规则均可**。通过 `modifierDefinition` 声明，引擎将其转化为对应 Event 提交给 WorldState
- [ ] 玩家输入会在模拟中被更改吗？ → **会**。玩家输入仅作为 `T=0` 的 `Runtime` 初始值。模拟期所有数值变更发生在 `Runtime`，`Config` 始终保持只读
- [ ] Skill 如何修改附魔？ → 通过 `ApplyEnchantmentEvent` 提交，`WorldState` 执行互斥校验后写入 `Item.runtime.currentEnchantment`
- [ ] `Event` 能操作谁？ → **仅能通过 `WorldState` 处理器修改目标对象 `Runtime` 字段**（禁止任何直接赋值）





# Phase 1.2 — Event & Timeline System Design
*(Deterministic Scheduling & Execution Layer)*

> ⚠️ **Scope Boundary**  
> 本阶段仅定义 **事件系统的结构、排序规则、执行语义**。  
> 不涉及：
> - UI / Grid
> - Web 通信
> - 数值平衡调优
> - Phase 1.3 的具体伤害计算管线实现

---

## 1.2.0 目标与交付标准

Phase 1.2 必须明确回答：
- Event 如何被 **创建 / 提交**
- Event 如何被 **排序**
- Event 如何被 **执行**
- 多事件同时间戳时如何 **确定性解析**
- 哪些规则是 **硬约束**，不可被实现随意更改

✅ **完成标准**：
> 任意开发者在不引入 RNG 的前提下实现 Event Loop，  
> 对同一输入永远生成完全一致的时间线与结算结果。

---

## 1.2.1 Event 生命周期总览

```text
[Intent / Trigger]
      ↓
[Event Creation (Payload 组装)]
      ↓
[Submit to WorldState.timeline]
      ↓
[Deterministic Ordering (Stable Sort)]
      ↓
[Execution by WorldState Processor]
      ↓
[State Mutation + 0~N Follow-up Events]
```

📌 **核心原则**  
- Event 是 **唯一的状态变更入口**  
- Timeline 是 **唯一的时间真相来源**  
- 创建 ≠ 执行，提交 ≠ 即时生效

---

## 1.2.2 Event 创建与提交契约

### ✅ 谁可以创建 Event？
- `Unit`（基础攻击、状态查询）
- `Item` / `Skill`（触发效果、CD 变更、附魔）
- `Buff`（生效/过期、Modifier 提交）
- `Engine System`（T=0 初始化、T=End 结算、时间推进）

### ❌ 谁不能直接修改状态？
- `Item` / `Skill` / `Buff` / `Unit` 本体
- 任意非 `WorldState` 对象

### 📜 提交规则
1. 所有 Event 必须通过 `WorldState.submit(event)` 进入 `timeline`
2. 插入后必须满足 `event.timestamp >= WorldState.currentTime`
3. 禁止绕过时间轴直接执行或“偷偷生效”

---

## 1.2.3 Timeline 数据结构语义

### Timeline 是什么？
- 一个 **按确定性规则排序的 Event 序列**
- 不依赖系统时钟、不依赖渲染帧率、不依赖浮点误差累积

### 必须满足
- ✅ 稳定排序（Stable Sort）
- ✅ 同 `timestamp` 下顺序可预测
- ✅ 支持运行时安全插入（不破坏已排序区间）
- ✅ 时间精度严格对齐 `SimulationConfig.timePrecision`（默认 0.1）

---
## 1.2.4 Event 排序规则（核心确定性来源）

排序 Key（从高到低优先级）：

| 优先级 | Key                  | 说明                                                                 |
|:---|:---|:---|
| 1️⃣ | `timestamp`            | 浮点数，小的先执行。已对齐 `timePrecision`                               |
| 2️⃣ | `contextualPriority`   | **确定性上下文排序**：同时间戳下，按预设战斗规则集映射为整数优先级         |
| 3️⃣ | `loadoutOrderIndex`    | 统一配置顺序：Item 与 Skill 共享同一触发队列，按玩家显式声明的顺序排序     |
| 4️⃣ | `insertionIndex`       | Timeline 自增 ID，用于打破完全并列，保证排序稳定性                       |

### 📜 确定性上下文排序原则（Contextual Priority）
- 同时间戳事件**不按类型硬编码排序**，而是根据事件携带的上下文信息，映射到一套**静态规则表**中执行排序。
- 规则集必须满足：
  1. **完全确定性**：相同上下文组合永远输出相同优先级整数
  2. **可预测性**：规则需贴合战斗直觉（如：增益类 → 攻击类 → 结算类 → 状态销毁类）
  3. **不可运行时修改**：规则表在 T=0 前固化，模拟期绝不变更
- **示例规则映射**（占位，具体待后续文档张贴）：
  - `BuffApply (baseDamage+)` < `Attack` < `ItemTrigger` （确保攻击前先结算加成）
  - `Attack` < `ItemStateChange (DESTROYED)` （确保摧毁前完成最后一次攻击）
  - 同属一类上下文时，回退到 `loadoutOrderIndex` 决定先后

📌 **硬约束**：
- 该规则表是 `§0.4 Determinism Guarantee` 的核心保障之一
- 后续补充的具体战斗规则**必须**转化为该表的映射条目，不得引入动态博弈或随机裁决

---

## 1.2.5 Event 执行模型（Execution Semantics）

### WorldState Event Processor 职责
对每个出列 Event，按序执行：
1. **合法性校验**：目标是否存在？状态是否允许操作？（如 `DESTROYED` 物品不响应触发）
2. **读取上下文**：获取当前 `Runtime` 快照（Health, CD, Buffs, Modifiers）
3. **执行变更**：仅修改目标对象的 `Runtime` 字段
4. **派发后续**：生成 0~N 个新 Event（如 `AttackEvent` → `DamageEvent` + `ItemTriggerEvent`）
5. **提交回 Timeline**：新 Event 插入对应时间槽，等待下一轮调度

### 🚫 执行期间严格限制
- ❌ 不允许修改 `Config` 或 `SimulationConfig`
- ❌ 不允许跨对象直接赋值
- ❌ 不允许同步调用其他 Event 的执行逻辑（禁止递归调用）
- ✅ 唯一允许副作用：`Runtime` 字段变更 + 新 Event 入队

---

## 1.2.6 Cooldown 相关 Event 的时间语义

### `CooldownModifyEvent`
- `timestamp` = 当前调度时间
- `payload.delta` = 变化量（正/负）或 `payload.multiplier`
- **执行校验**：
  - 计算后 `newCD = max(currentCD + delta, minCooldownAbsolute)`
  - 若 `minCooldownAbsolute` 需突破，必须携带 `ruleOverride: true`（由 Buff 声明）

### `CooldownResetEvent`
- `timestamp` = 当前调度时间
- **执行行为**：`currentCooldown = baseCooldown`
- 冷却立即开始重新计时

📌 **硬约束**：
- 多个 CD 修改同时间戳 → 严格按排序顺序依次应用
- **禁止回溯**：`event.timestamp` 必须 `≥ WorldState.currentTime`
- 额外 CD 缩减不跨周期累计（对齐 Phase 0 §7.3）

---

## 1.2.7 Attack Event 与 确定性暴击调度

### `AttackEvent` 特性
- 由 `Unit` 发起，`source = Unit`, `target = DummyTarget`
- 不直接造成伤害，仅作为 **触发锚点**

### 执行流水线
1. 读取 `Unit.runtime.nextAttackTimestamp`，校验是否到达
2. **确定性暴击解析**：
   - 读取 `Unit.config.critChance`
   - 执行 Phase 1.1 约定的 **固定分布算法**（如 `FixedDistribution(critChance, attackCount)`）
   - 决定本次攻击 `isCrit: bool`
3. 生成 `DamageEvent(payload.base, payload.isCrit, payload.activeModifiers)`
4. 生成 `ITEM_TRIGGER` / `SKILL_TRIGGER` Event（按 `sourceOrderIndex`）
5. 计算下一次攻击时间：`nextAttackTimestamp = currentTime + max(calculatedCooldown, minCooldownFloor)`
6. 生成下一次 `AttackEvent` 并插入 Timeline

---

## 1.2.8 Buff 与附魔 Event 生命周期 与 Attack Event 确定性触发调度

### `BuffApplyEvent`
- 添加或叠加 Buff
- 执行时：
  1. 校验 `stackable` 与 `maxStacks`
  2. 更新 `Buff.runtime.currentStacks` / `remainingDuration`
  3. 将 `modifierDefinition` 注册至 `WorldState.activeModifiers` 池
  4. 若 `duration != null`，自动生成 `BuffExpireEvent`

### `EnchantmentApplyEvent`
- 目标：`Item.runtime.currentEnchantment`
- 执行时：
  1. **互斥校验**：若 `target.currentEnchantment != null`，丢弃 Event
  2. 实例化附魔，写入 `Item`
  3. 提取附魔 `activeModifiers`，合并至全局结算池

### `BuffExpireEvent`
- 移除 Buff 或递减 Stack
- 执行时：从 `activeModifiers` 池注销对应 Modifier，触发级联更新

---

### `AttackEvent` 特性
- 由 `Unit` 发起，`source = Unit`, `target = DummyTarget`
- 不直接造成伤害，仅作为 **触发锚点**

### 执行流水线
1. 读取 `Unit.runtime.nextAttackTimestamp`，校验是否到达
2. **确定性暴击解析**：执行固定分布算法，决定本次 `isCrit: bool`
3. 生成 `DamageEvent(payload.base, payload.isCrit, payload.activeModifiers)`
4. **统一触发调度**：
   - 遍历 `Unit.triggerableLoadout[]`（已合并 Items + Skills，按 `loadoutOrderIndex` 排序）
   - 为每个满足触发条件的 `Triggerable` 生成 `TRIGGER_EFFECT` Event
   - 所有触发 Event 共享当前 `timestamp`，严格按 `loadoutOrderIndex` 顺序入队
5. 计算下一次攻击时间：`nextAttackTimestamp = currentTime + max(calculatedCooldown, minCooldownFloor)`
6. 生成下一次 `AttackEvent` 并插入 Timeline

📌 **架构收益**  
- 消除 `ITEM_TRIGGER` vs `SKILL_TRIGGER` 的分支判断  
- Phase 0 §7.2 “按单位列表顺序解析”直接映射为 `loadoutOrderIndex`  
- 战斗管线只需处理一种触发 Event，后续扩展（如羁绊、套装）零侵入

📌 **关键设计**：Buff 本身不 Tick。生命周期完全由 Event 驱动，确保时间轴可回溯、无隐式状态。

---

## 1.2.9 Event Storm 防护（MVP 安全阀）

为保证模拟可控与性能稳定，MVP 约束：
- 单次 Event 执行中，最多生成 `N ≤ 15` 个新 Event
- 禁止 Event 自触发闭环（如 `A→B→A`）
- Timeline 最大容量限制：`10,000` Events（超出则终止模拟并标记 `OVERFLOW`）
- 所有调试指标计入 `metrics`，便于定位异常分支

---

## 1.2.10 `activeModifiers` 生效与读取契约（Visibility & Timing）

### 核心原则：即时生效 + 顺序可见
`activeModifiers` 是 `WorldState` 的**共享读写状态池**。其生效规则如下：

1. **写入时机**  
   `BuffApplyEvent` / `EnchantmentApplyEvent` 执行完毕的瞬间，其 `modifierDefinition` **立即合并**至 `activeModifiers` 池。  
   ✅ 无延迟、无“帧末统一应用”、无“下一时间步生效”。

2. **读取时机**  
   任何事件（含 `DamageEvent`、`CooldownModifyEvent` 等）在自身执行阶段，**实时读取** `activeModifiers` 的当前快照。  
   ✅ 读取的是“截止到该事件执行瞬间”的池状态。

3. **同时间戳可见性规则**  
   - 若 `BuffApplyEvent` 排序在 `AttackEvent` **之前** → 攻击结算时**能吃到**新 Buff。
   - 若 `BuffApplyEvent` 排序在 `AttackEvent` **之后** → 攻击结算时**吃不到**新 Buff。
   - ✅ 这正是 `contextualPriority`（上下文确定性排序）存在的根本意义：通过控制执行顺序，精确控制状态可见性。

4. **禁止隐式延迟**  
   ❌ 不允许引入 `pendingModifiers`、`nextFrameApply`、`tickSync` 等延迟机制。  
   所有 Modifier 的生效必须严格依赖 Event 执行顺序，保证 100% 可追溯、可回放。
  
---


## ✅ Phase 1.2 完成判定

当以下问题均有唯一答案时，本阶段可锁定：
- [ ] Event 是否可以立即生效？ → ❌ 必须入队并等待调度
- [ ] 多个事件同时间戳如何排序？ → `timestamp → typePriority → sourceOrderIndex → insertionIndex`
- [ ] 谁能修改 Runtime？ → 仅 `WorldState Processor`
- [ ] Buff/附魔如何影响 CD/Damage？ → 声明 Modifier → 注册至全局池 → Damage/CD 管线读取
- [ ] 是否存在 RNG？ → ❌ 暴击采用固定分布，时间轴完全确定性
- [ ] CD 修改是否可越界？ → 受 `minCooldownAbsolute` 硬锁，突破需显式 `ruleOverride`

---

## 📥 交付物清单
- `EventType` 枚举定义
- `Event` 结构体 / Payload 契约
- `Timeline` 排序与插入算法描述
- `WorldState.submit()` 与 `processNext()` 语义规范
- MVP 优先级绑定表（硬约束）
---

### 📊 Phase 1.2 合理性审查报告

| 审查维度 | 评估结果 | 说明 |
|:---|:---|:---|
| **对齐 Phase 0** | ✅ 完美闭合 | 排序表严格映射 §7.2 Trigger Order；CD Floor/绝对下限/额外减免不累计规则已写入校验逻辑；确定性暴击已预留算法挂钩点 |
| **对齐 Phase 1.1** | ✅ 逻辑延续 | `WorldState` 作为唯一状态修改器；Config/Runtime 分离；Event 驱动一切变更；附魔互斥校验明确 |
| **确定性保障** | ✅ 强 | 四段排序 Key + 稳定排序 + 禁止回溯 + 固定分布暴击 + 无 RNG 依赖，满足 §0.4 铁律 |
| **工程可实现性** | ✅ 高 | Event 队列可复用 `std::priority_queue` / `BinaryHeap`；排序 Key 可序列化为整数/浮点组合；Payload 结构清晰，易转为 Protobuf/TS Interface |
| **潜在风险点** | 🟡 已规避 | 原草案未明确 `ITEM_TRIGGER`/`SKILL_TRIGGER` 优先级，已补充并映射至 §7.2；CD 修改越界已加硬校验；Event Storm 已设安全阈值 |
| **扩展性** | ✅ 预留 | 新增 Event 仅需扩展 `eventTypePriority` 表；Buff/附魔通过 Modifier 池解耦计算逻辑，Phase 1.3 可独立实现伤害管线 |

### 💡 架构师结论
**本版本 Phase 1.2 已达到工程级交付标准，可直接锁定。**  
排序规则、执行语义、CD/暴击调度、附魔生命周期均已闭合 Phase 0/1.1 的所有契约。无逻辑断层，无实现歧义，可直接进入代码骨架搭建或 Phase 1.3 伤害管线设计。

Event Storm 防护是“引擎保护”还是“规则失败”？
在 1.2.9 末尾补一句：
📌 OVERFLOW 语义
Event OVERFLOW 视为 非法构建或规则循环错误，
模拟应立即终止，仅输出 diagnostics，不输出 DPS 结果。
**“继续 Phase 1.3”**





这份 Phase 1.3 草案结构已经非常成熟，逻辑主线清晰。但在与 **Phase 0/1.1/1.2 的交叉审计**中，我发现 **3 处关键偏差** 和 **1 处表述隐患**，必须修正才能保证工程落地时不产生分支歧义：

### 🔍 核心修正点（审计发现）
| 原文表述 | 潜在问题 | 修正方案 |
|:---|:---|:---|
| `snapshotModifiersRef（activeModifiers 的只读快照引用）` | 与 Phase 1.2 **“即时生效+顺序可见”** 契约冲突。若用创建时的快照，同时间戳的 `BuffApply` → `DamageEvent` 将无法生效 | 改为 **`liveModifiersView`（实时读取 WorldState 当前状态）** |
| `Stage 0: damage_0 = baseDamage + Σ(flatBaseDamageDelta)` | 未明确 Phase 0 公式 `Attack = a × b × baseDamage` 中的 `baseDamage` 是**纯配置值**还是**含Flat加成后的总值** | 明确区分：`configBaseDamage`（只读） → `effectiveBaseDamage`（Stage 0+1 计算后） → 再进入乘区 |
| `FIRE 对 Shield 结算时乘 ShieldFireMultiplier` | Phase 0 明确写的是 `double defense to fire`（对火伤双倍防御），但未给出具体乘数值 | 显式定义：`ShieldFireMultiplier = 0.5`，并固化 Shield 扣减数学模型 |
| `Pipeline 顺序不可交换` | 缺少对“同阶段内多个 Modifier 如何合并”的数学约定（加性 vs 乘性） | 补充 `Mathematical Convention`，明确 Flat 加和、Multipliers 连乘 |





---

***

## ⚠️ Scope Boundary
本阶段仅定义 **伤害与数值修改的计算管线结构、顺序与可见性规则**。
**不涉及：**
- UI / 表现层
- 数值平衡（具体数值大小）
- Event 调度机制（已由 Phase 1.2 定义）
- 新战斗机制（如连锁、条件触发、DoT Tick 系统）

***

## 1.3.0 目标与交付标准
Phase 1.3 必须明确回答：
- Damage 是 **一次计算流程** 还是 **多个 Event**
- 伤害从“基础值”到“最终结算”的 **完整管线顺序**
- Buff / Enchantment / Skill 的 Modifier **插入点**
- Shield / Fire / Toxic / Invulnerable 的 **交互顺序**
- Rounding（取整）规则 **在哪一步发生**
- `activeModifiers` 如何被 **读取、合并、应用**

✅ **完成标准：**
> 任意实现者只要按本管线实现 DamageEvent 的处理逻辑，  
> 即可保证：
> - 与 Phase 0 数学规则一致
> - 与 Phase 1.2 时间 / 排序语义一致
> - 与 Buff / Enchantment 扩展完全解耦

***

## 1.3.1 Damage 的本体定义（核心裁决）
📌 **核心裁定：**
> **Damage 不是一组 Event，而是一条同步计算管线。**
> `DamageEvent` 是 **计算触发器**，`DamagePipeline` 是 **计算执行器**。

✅ 执行流：
- `AttackEvent` → 生成 `DamageEvent`
- `DamageEvent` 执行时：
  - **一次性跑完整条 Damage Pipeline**
  - 在管线末端（Stage 7）才真正修改 HP / Shield

***

## 1.3.2 DamageEvent 的职责边界
### DamageEvent Payload（只读输入）
- `sourceBaseDamage`: int（Unit.config.baseDamage）
- `isCrit`: bool
- `damageType`: enum `NORMAL | FIRE | TOXIC`
- `source`: ref `Unit | Item | Skill`
- `target`: ref `Unit | DummyTarget`

- damageOwnerId: ItemId | SkillId | UnitId

⚠️ DamageEvent 本身：
- ❌ 不持有中间计算状态
- ❌ 不缓存 `activeModifiers` 快照
- ✅ 仅作为“触发一次确定性计算”的指令票

***

## 1.3.3 Damage Pipeline 总览（权威顺序）
```text
[0] Config Base Damage
      ↓
[1] Flat Damage Addition (形成 effectiveBase)
      ↓
[2] Crit Multiplier Resolution (a 区)
      ↓
[3] Global Damage Multipliers (b 区)
      ↓
[4] Damage Type Routing & Shield Mapping
      ↓
[5] Invulnerability Check
      ↓
[6] Final Rounding
      ↓
[7] Apply to Runtime (Shield → HP)
```
📌 **硬约束：**
- 上述顺序 **不可交换**
- 新 Modifier 只能 **插入到某一固定阶段**
- 管线全程使用浮点数计算，**仅 Stage 6 取整一次**

***

## 1.3.4 Stage 0 — Config Base Damage
### 输入
- `DamageEvent.payload.sourceBaseDamage`
### 规则
```text
damage_0 = sourceBaseDamage
```
✅ 说明：仅提取 Unit 的原始配置值，不叠加任何加成。保证溯源清晰。

***

## 1.3.5 Stage 1 — Flat Damage Addition
### 输入
- `activeModifiers` 中所有 `type: flatDamageBonus`
### 规则
```text
effectiveBaseDamage = damage_0 + Σ(flatDamageBonus)
```
📌 约束：
- 所有 Flat 加成 **在乘区前结算**（加性合并）
- 此阶段结果即 Phase 0 公式中的 `baseDamage`（广义）

***

## 1.3.6 Stage 2 — Crit Multiplier Resolution (a 区)
### 触发条件
- `DamageEvent.payload.isCrit == true`
### 规则
```text
if isCrit:
    a = 2.0 × Π(critMultiplierModifiers)
else:
    a = 1.0
damage_2 = effectiveBaseDamage × a
```
✅ 说明：
- `critBaseMultiplier = 2.0`（Phase 0 固定规则）
- Buff / Enchantment 只能提供 `critMultiplierModifiers`（乘性合并）
- 绝对禁止在此阶段引入随机判定

***

## 1.3.7 Stage 3 — Global Damage Multipliers (b 区)
### 输入
- `activeModifiers` 中所有 `type: globalDamageMultiplier`（含 Vulnerable / Resistant）
### 规则
```text
b = Π(globalDamageModifiers)
damage_3 = damage_2 × b
```
📌 说明：
- 完全映射 Phase 0 §7.5 中的 `b`
- 默认 `b = 1.0`
- 所有乘区 **严格乘性合并**

***

## 1.3.8 Stage 4 — Damage Type Routing & Shield Mapping

### 行为
此阶段 **不修改 damage 数值**，仅确定结算路径与 Shield 的伤害映射规则。

| damageType | shieldDamageMappingMultiplier | 路由规则 |
|:---|:---|:---|
| NORMAL | 1.0 | 正常扣除 Shield → 溢出扣 HP |
| FIRE | Π(shieldFireMultipliers), default = 0.5 | 火伤对护盾具有更高防御效率 |
| TOXIC | 0.0 (Bypass) | 完全绕过 Shield，直接作用于 HP |

📌 **Shield–Damage Mapping Rule**  
shieldDamageMappingMultiplier 作用于 **damage → shield 的映射过程**，  
而非作用于 shield 数值本身。


***

## 1.3.9 Stage 5 — Invulnerability Check
### 规则
- 读取 `activeModifiers` 中是否存在 `type: invulnerable` 且 `isActive == true`
-
  ```text
if invulnerable == true AND damageType == NORMAL:
    damage_5 = 0
    pipeline_terminated = true
else:
    damage_5 = damage_3
```
pipeline_terminated 表示 跳过 Stage 6 与 Stage 7，
不发生取整、不修改 Shield / HP。
📌 约束：Invulnerable 仅对 NORMAL 类型伤害生效。
FIRE 与 TOXIC 伤害 不受 Invulnerable 影响，仍完整进入后续 Pipeline。

***

## 1.3.10 Stage 6 — Final Rounding（唯一取整点）
📌 **硬约束：**
> **整个 Pipeline 仅允许在此阶段取整一次，此前全程保持浮点精度**

### 规则
```text
finalDamage = floor(damage_5 + 0.5)  // ≥0.5 向上取整，<0.5 向下取整
```
✅ 完全对齐 Phase 0 §7.6

***

## 1.3.11 Stage 7 — Apply to Runtime State
### 行为
1. 读取 `target.runtime.currentShield` 与 `target.runtime.currentHealth`
2. 根据 Stage 4 路由计算实际扣减：
shieldMultiplier 表示 “1 点 Shield 可抵消的 Fire Damage 倍数的倒数”，
   ```text
   if damageType != TOXIC:
       shieldAbsorbed = min(currentShield, finalDamage × shieldMultiplier)
       remainingDamage = finalDamage - shieldAbsorbed
       target.currentShield = max(0, currentShield - shieldAbsorbed)
   else:
       remainingDamage = finalDamage
       
   target.currentHealth = max(0, currentHealth - remainingDamage)
   target.isAlive = (target.currentHealth > 0)
   ```
📌 约束：
- **这是 Pipeline 唯一允许修改 Runtime 的位置**
- 不生成新 `DamageEvent`（防止递归风暴）

***

## 1.3.12 Modifier 分类与插入点总表
| Modifier 类型              | 插入阶段    | 合并规则 |
| ------------------------ | ------- | :--- |
| `flatDamageBonus`        | Stage 1 | 加性 `Σ` |
| `critMultiplierModifier` | Stage 2 | 乘性 `Π` |
| `globalDamageMultiplier` | Stage 3 | 乘性 `Π` |
| `shieldFireMultiplierStage ` | Stage 4 | 乘性 `Π` |
| `invulnerableFlag`       | Stage 5 | 布尔覆盖 |
| `damageTypeOverride`     | Stage 4 | 枚举替换 |
invulnerableFlag 的语义为：
immuneToDamageTypes = { NORMAL }
📌 **硬约束**：新增 Modifier 必须指定插入阶段与合并规则，禁止跨阶段生效。

***

## 1.3.13 `activeModifiers` 的实时读取契约
- `DamageEvent` 执行时，**直接读取 `WorldState.activeModifiers` 的当前实时状态**
- 不缓存、不快照、不延迟
- ✅ 严格遵循 Phase 1.2 **即时生效 + 顺序可见** 原则：
  - 同时间戳 `BuffApply` 排序在 `DamageEvent` 之前 → 本次攻击吃到新 Buff
  - 同时间戳 `BuffApply` 排序在 `DamageEvent` 之后 → 本次攻击吃不到

***

## 1.3.14 MVP 明确不支持的内容（再次锁死）
- 护甲 / 抗性曲线（非线性）
- 伤害反弹 / 吸血
- 连锁伤害 / 溅射
- 条件判定（如 `HP < X%` 触发）
- 动态优先级覆盖

👉 任何新增必须：
- 明确 `ModifierType`
- 指定 Pipeline 插入阶段
- 更新本阶段文档并锁版

***

## ✅ Phase 1.3 完成判定
当以下问题均有唯一答案时，本阶段可锁定：
- [ ] Damage 是 Event 还是 Pipeline？ → **同步 Pipeline**
- [ ] Modifier 在哪生效？ → **固定阶段，加性/乘性明确**
- [ ] Shield / Toxic / Fire 如何交互？ → **Stage 4 路由 + Stage 7 扣减**
- [ ] 取整在哪？ → **仅 Stage 6**
- [ ] `activeModifiers` 是否延迟？ → ❌ **实时读取，顺序决定可见性**
- [ ] 是否可能非确定性？ → ❌ **全程浮点 + 单次取整 + 无 RNG**

***

## 📥 交付物清单
- `DamagePipeline.execute(DamageEvent)` 完整伪代码/接口契约
- `activeModifiers` 实时读取与合并规则
- 乘区顺序与取整硬约束
- Shield / Fire / Toxic / Invulnerable 交互矩阵

---

