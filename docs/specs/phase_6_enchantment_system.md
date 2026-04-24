# Phase 6 — Enchantment-Driven System Transformation

## 6.0 目标与背景

Phase 6 的目标是将模拟器从「英雄差异化配置」迁移为「附魔驱动逻辑模拟器」。本阶段不重写 Phase 0~1.7 已建立的事件队列、伤害管线和指标统计主干，而是在输入契约、前端交互和 `world_state.py` 状态计算层增加可验证的桥接逻辑。

核心目标包括：

- 移除英雄差异化属性（`base_damage`、`crit_chance`、`max_health` 等 API 输入字段），转向中性的 `BattleContext` 战场容器。
- 建立 13 种附魔 + `NONE` 的严格上下文契约，通过 `enchantment_type` 与 `contextual_effects` 限制合法键名。
- 禁止用户在 UI 中自由查看或编辑 raw `modifiers` 字典，改为 `EnchantmentType` 下拉框 + 动态 `Enchantment Slots`。
- 实现「前端动态表单 → 双向映射层 → 后端契约校验 → 引擎路由钩子」的闭环。
- 保持核心伤害管线 `damage_pipeline.py` 零侵入，确定性事件顺序与 Phase 1.3 伤害结算逻辑不被破坏。

## 6.1~6.5 核心交付摘要

### Phase 6.1 — Schema Contract

- 在 `src/minimal_sim_core/schema.py` 中引入 `BattleContext`：`self_hp`、`self_shield`、`enemy_hp`。
- 将 API 侧 `UnitConfigDict` 收敛为 `unit_id`、`base_attack_cooldown`、`battle_context`。
- 定义 `EnchantmentType` 枚举：13 种附魔 + `NONE`，共 14 个合法值。
- 定义 `EFFECT_SLOT_MAPPING`，明确每种附魔允许出现的 `contextual_effects` 键名。
- 定义 `validate_contextual_effects()`，对未知附魔类型和非法 slot 组合进行拒绝。
- 将 `ItemModifierDict` 标记为弃用路径：当同一物品同时存在 `contextual_effects` 与 `modifiers` 时，`contextual_effects` 优先。

### Phase 6.2 — Enchantment-Driven UI

- 新增 `web/src/lib/enchantment-mapper.ts`，提供 UI 表单状态与 `ItemConfig` 的双向转换：
  - `itemToFormState(item)`：从 `enchantment_type` + `contextual_effects` 初始化 UI 状态。
  - `formStateToItemPatch(state)`：生成 `enchantment_type` + `contextual_effects`，并将 `modifiers` 清空为 `{}`。
  - `buildDefaultFormState(enchantmentType)`：根据附魔类型生成默认 slot 值。
  - `getSlotDefs(enchantmentType)`：读取动态输入框定义。
- 在 `web/src/data/item_catalog.ts` 中为 13 种附魔定义 slot 名称、标签、上下限、步进值与默认值。
- 重构 `LoadoutManager.tsx` 的物品编辑区：移除 `Modifiers` 折叠面板，替换为 `EnchantmentType` 下拉框与动态 NumberInput。
- 用户切换附魔类型时，旧 slot 值会被清空并重置为该附魔的默认值，避免非法组合提交。

### Phase 6.3 — Minimal Engine Bridge

- 扩展 `world_state.py` 的 `ActiveModifierView`，加入 `cooldown_multiplier` 与 `heal_per_second`。
- 扩展 `apply_enchantment_effect()`，将已路由的附魔值注入现有修饰视图：
  - `slow_debuff`：通过 `slow_value` 乘法放大攻击间隔。
  - `heal_over_time`：通过 `heal_amount/heal_interval` 或 `evergreen_heal/evergreen_duration` 计算每秒治疗。
- 在 `_current_attack_cooldown()` 中应用 `cooldown_multiplier`。
- 在 `_handle_attack()` 中按两次攻击之间的时间差结算治疗，并限制不超过 `max_health`。
- 通过 E2E 测试验证 SLOW 攻击次数从基线 11 次下降至 8 次，并验证 EVERGREEN/HEAL 回复生命值。

### Phase 6.4 — README Contract Alignment

- 更新用户手册术语：`Dummy Target` → `Battle Context / Enemy`，`Modifiers` → `Enchantment Slots`，`英雄属性` → `战斗上下文`。
- 移除全局配置中的 Dummy Target 说明，改为提示敌方生命值已迁移至战斗上下文区域。
- 更新界面总览、战斗上下文配置、物品附魔速查表与导出配置说明。
- 移除 Pyodide Fallback 预留说明，仅保留后端 API 可用/不可用状态。

### Phase 6.5 — Remaining Enchantments Engine Routing

- 在 `world_state.py` 中继续扩展 `ActiveModifierView`：
  - `dot_damage_per_second`
  - `dot_damage_type`
  - `shield_grant_total`
  - `gold_bonus_total`
- 在 `apply_enchantment_effect()` 中接入剩余阶段：
  - `damage_over_time`：BURN / POISON / RADIANCE。
  - `shield_grant`：OBSIDIAN / SHIELD。
  - `freeze_debuff`：FREEZE。
  - `gold_reward`：GOLD。
- 在 `_handle_attack()` 中复用攻击 tick 的时间差结算 DoT，不新增独立 tick 循环。
- 在 `_handle_buff_apply()` 中将 `shield_grant` 写入 `unit_runtime.current_shield`。
- 新增 `tests/test_remaining_enchantments.py`，覆盖 7 项剩余附魔与回归验证，实现 13/13 附魔路由全覆盖。

## 架构变更对照表

| 维度 | Phase 5 状态 | Phase 6 状态 | 影响范围 |
|:---|:---|:---|:---|
| 战斗上下文 | `UnitConfig` 混合英雄属性与 Dummy 目标配置 | `BattleContext` 定义 `self_hp` / `self_shield` / `enemy_hp` | 全局配置层、Unit 输入层 |
| 物品效果定义 | 开放 `modifiers` 字典，自由填写乘区 | `enchantment_type` + `contextual_effects` 严格键值 | 输入契约层 |
| 前端渲染流 | 静态折叠面板暴露全部修饰器 | 动态槽位映射，仅显示合法输入框 | UI 交互层 |
| 引擎消费流 | 直接读取 `modifiers` 注入管线 | `apply_enchantment_effect()` 路由钩子按阶段分发 | 状态计算层 |
| 状态同步 | 表单直写 Store | `itemToFormState` / `formStateToItemPatch` 双向幂等转换 | 数据流层 |
| 契约校验 | 主要依赖字段存在性与数值范围 | `validate_contextual_effects()` 拦截非法附魔 slot 组合 | API 边界层 |
| 文档术语 | 英雄属性、Dummy Target、Modifiers | 战斗上下文、Enemy、Enchantment Slots | 用户文档层 |

## 附魔路由矩阵 (13/13)

| 附魔类型 | 暴露槽位 | 作用目标 | 引擎注入阶段 | 生效状态 |
|:---|:---|:---|:---|:---|
| SLOW | `slow_value`, `slow_duration` | 攻击节奏 | `slow_debuff` → `cooldown_multiplier` | ✅ |
| BURN | `burn_damage`, `burn_duration` | 敌方 | `damage_over_time` (`FIRE`) | ✅ |
| POISON | `poison_damage`, `poison_duration` | 敌方 | `damage_over_time` (`TOXIC`) | ✅ |
| FLASH | `flash_damage`, `flash_cooldown_reduction` | 己方攻击 | `flat_damage` / `cooldown_delta` | ✅ |
| OBSIDIAN | `obsidian_shield`, `obsidian_duration` | 己方 | `shield_grant` | ✅ |
| HEAL | `heal_amount`, `heal_interval` | 己方 | `heal_over_time` | ✅ |
| SHIELD | `shield_amount`, `shield_duration` | 己方 | `shield_grant` | ✅ |
| ACCELERATE | `accelerate_value`, `accelerate_duration` | 己方攻击 | `cooldown_delta` | ✅ |
| FREEZE | `freeze_duration`, `freeze_chance` | 攻击节奏 | `freeze_debuff` → `cooldown_multiplier × 999.0` | ✅ |
| CRIT | `crit_bonus`, `crit_duration` | 己方攻击 | `crit_multiplier` | ✅ |
| GOLD | `gold_bonus`, `gold_chance` | 非战斗数据 | `gold_reward` → `gold_bonus_total` | ✅ |
| RADIANCE | `radiance_damage`, `radiance_radius` | 敌方 | `damage_over_time` (`NORMAL`) | ✅ |
| EVERGREEN | `evergreen_heal`, `evergreen_duration` | 己方 | `heal_over_time` | ✅ |

> 说明：上表严格使用当前代码中的 slot name。`damage_over_time` 与 `heal_over_time` 目前复用攻击事件之间的时间差进行确定性结算，不新增独立 tick 循环。GOLD 当前为非战斗数值路由，写入修饰视图但不影响伤害或攻击次数。

## 关键文件清单

### 后端

- `src/minimal_sim_core/schema.py`
  - 定义 `BattleContext`、`EnchantmentType`、`EFFECT_SLOT_MAPPING`、`EFFECT_SLOT_ROUTING` 与 `validate_contextual_effects()`。
  - 标记 `dummy_target_health`、`dummy_target_shield` 与 `ItemModifierDict` 为兼容保留路径。
- `src/minimal_sim_core/world_state.py`
  - 定义 `EnchantmentData`、扩展 `ActiveModifierView`。
  - 通过 `apply_enchantment_effect()` 将附魔路由到伤害、冷却、治疗、护盾、DoT 与非战斗数值字段。
  - 在 `_handle_attack()` 中结算攻击、治疗与 DoT；在 `_handle_buff_apply()` 中结算护盾授予。
- `src/minimal_sim_core/constants.py`
  - 保留协议版本、错误码、默认时间/事件配置与事件优先级。
  - Phase 6 未将附魔契约放入该文件，附魔 slot 与路由定义位于 `schema.py`。

### 前端

- `web/src/lib/enchantment-mapper.ts`
  - `itemToFormState()` / `formStateToItemPatch()` 双向转换。
  - `buildDefaultFormState()` / `getSlotDefs()` 支撑动态表单渲染。
- `web/src/data/item_catalog.ts`
  - 定义 `ENCHANTMENT_SLOT_DEFS`，为每种附魔提供 slot、标签、范围、步进与默认值。
  - 定义 `ITEM_CATALOG` 示例模板与 `validateContextualEffects()` 前端校验。
- `web/src/components/config/LoadoutManager.tsx`
  - 物品编辑区从 raw modifiers 面板改为 `EnchantmentType` 下拉 + 动态数值槽。
  - 用户输入经过 150ms 防抖后写入 Store。
- `web/src/types/sim.ts`
  - 定义 `EnchantmentType`、`EFFECT_SLOT_MAPPING`、`EFFECT_SLOT_ROUTING`、`BattleContext` 与请求/响应类型。

### 测试

- `tests/test_schema_v6.py`
  - 覆盖 `BattleContext` 必填字段、`EnchantmentType` 枚举、`validate_contextual_effects()`、兼容警告与路由覆盖。
- `tests/test_enchantment_e2e.py`
  - 覆盖 SLOW 降低攻击频率、EVERGREEN/HEAL 按时间回血与既有附魔回归。
- `tests/test_remaining_enchantments.py`
  - 覆盖 BURN、POISON、OBSIDIAN、SHIELD、FREEZE、GOLD、RADIANCE 7 项附魔路由。
- `web/tests/enchantment-mapper.test.ts`
  - 覆盖 `itemToFormState` ↔ `formStateToItemPatch` 在 14 种附魔上的默认值与幂等性。

### 文档

- `docs/specs/readme.md`
  - 全量术语替换、战斗上下文操作说明、附魔速查表、输入/回显工作流说明。
- `docs/specs/phase_6_enchantment_system.md`
  - 本阶段架构总结与验证记录。

## 测试与验证报告

Phase 6 当前验证结果：

| 测试范围 | 数量 | 结果 |
|:---|---:|:---|
| Python tests | 93 | passed |
| Frontend Vitest | 64 | passed |
| 合计 | 157 | 0 failures |

核心验证点：

- `contextual_effects` 键名校验可拦截非法附魔组合。
- `EnchantmentType` 覆盖 13 种附魔 + `NONE`，共 14 个合法值。
- `itemToFormState` ↔ `formStateToItemPatch` 在全 14 种附魔上保持默认值与 slot 映射稳定。
- SLOW 附魔实际延长攻击间隔：10 秒模拟中基线攻击次数为 11，`slow_value=0.5` 后攻击次数约为 8。
- EVERGREEN 与 HEAL 按时间差回复生命值，并且不会超过 `UnitConfig.max_health`。
- BURN / POISON / RADIANCE 可路由为 DoT，并分别携带 `FIRE`、`TOXIC`、`NORMAL` 伤害类型。
- OBSIDIAN / SHIELD 在 Buff 应用时增加己方护盾。
- FREEZE 通过 `cooldown_multiplier × 999.0` 等效暂停攻击节奏。
- GOLD 写入 `gold_bonus_total`，不影响伤害、攻击次数或 Phase 1.3 伤害管线。
- `damage_pipeline.py` 未被 Phase 6 路由逻辑改写，核心伤害结算顺序保持稳定。

## 用户界面与工作流影响

- 配置面板移除英雄差异化字段，用户不再填写 `base_damage`、`crit_chance`、`max_health` 等英雄属性。
- 战斗上下文区域只承载己方生命、己方护盾、敌方生命与基础攻击间隔等中性容器参数。
- 物品编辑区不再展示 raw `modifiers` 字典，改为：
  - `EnchantmentType` 受控下拉框。
  - 根据附魔类型动态渲染的 NumberInput 槽位。
- 切换附魔类型时，旧 slot 值会被清空，表单重置为该附魔默认值，防止跨附魔字段污染。
- 表单写入 Store 前经过 `formStateToItemPatch()`，确保 Store 中仍是后端可消费的 `ItemConfig` 结构。
- 模拟成功后，`input_echo` 会回写引擎标准化后的配置，并高亮被引擎补齐或规范化的字段。
- 持久化快照继续使用 `__meta_version: "v1"`，用于本地恢复、导入与导出。

## 后续扩展指南

### 新增附魔

新增附魔时建议按以下顺序扩展：

1. 在 `schema.py` 中扩展 `EnchantmentType`。
2. 在 `EFFECT_SLOT_MAPPING` 中声明该附魔允许的 `contextual_effects` 键。
3. 在 `EFFECT_SLOT_ROUTING` 中将 slot 映射到已有或新增的引擎阶段。
4. 在 `world_state.py` 的 `apply_enchantment_effect()` 中补充阶段处理器。
5. 在 `item_catalog.ts` 中为 UI 定义 slot 标签、范围、步进和默认值。
6. 新增后端集成测试与前端 mapper 测试。

### 新增物品模板

新增物品模板只需在 `web/src/data/item_catalog.ts` 的 `ITEM_CATALOG` 中追加 `ItemCatalogEntry`：

- `id`
- `name`
- `allowedEnchantments`
- `defaultEnchantment`

当前 `LoadoutManager.tsx` 的动态表单不依赖具体物品模板结构，因此通常无需改动 UI 或引擎逻辑。

### 已知限制

- GOLD 当前仅作为非战斗数值路由到 `gold_bonus_total`，没有接入经济系统或结果面板展示。
- RADIANCE 当前实现为 `damage_over_time` (`NORMAL`) 路由；未实现免疫 SLOW/FREEZE 的 `immune_effects` 拦截集合。
- OBSIDIAN 与 SHIELD 当前在 Buff 应用时增加护盾值，未实现持续时间结束后的护盾回收。
- FREEZE 当前以 `cooldown_multiplier × 999.0` 等效暂停攻击节奏，未实现概率抽样或独立冻结事件队列。
- BURN / POISON / RADIANCE 当前复用攻击 tick 间隔结算 DoT，未新增独立周期事件循环。

### 架构优势

- 输入契约与计算管线严格解耦：UI 只负责合法 slot 输入，引擎只消费已校验的 `contextual_effects`。
- 新机制以「定义槽位 → 配置路由 → 扩展阶段处理器 → 补充测试」方式接入，不破坏主干确定性。
- `modifiers` 作为兼容字段保留，但用户界面不再暴露，降低非法配置风险。
- Phase 1.3 伤害管线保持稳定，附魔通过 `world_state.py` 的状态钩子注入，便于回归测试与后续扩展。
