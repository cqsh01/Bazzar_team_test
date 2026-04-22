# Phase 4 — API Contract & Integration Layer
*(Frontend-Facing Stateless Invocation Contract)*

> ⚠️ **Scope Boundary**  
> 本阶段仅定义并固化 **Simulation Core 与 Web 前端之间的无状态调用契约**。  
> 不涉及：事件调度重构、Damage Pipeline 重定义、WorldState 运行时语义修改、UI 实现细节、网络服务框架接入。

---

## 4.0 概述与边界

### 4.0.0 定位

Phase 4 的职责不是扩展战斗机制，而是将已锁定的 Core 能力包装为：
- 可直接被前端调用的统一入口
- 机器可读、版本可演进的输入/输出协议
- 不泄漏 `WorldState`、`EventQueue`、`DamagePipeline` 内部实现细节的 Integration Layer

其定位是：
- **引擎与前端之间的无状态调用层**
- **协议优先的封装层**
- **零运行时第三方依赖的序列化边界**

### 4.0.1 核心设计原则

| 原则 | 约束说明 |
|:---|:---|
| **Zero runtime dependency** | API 层运行时不引入第三方库，`pyproject.toml` 中 `dependencies = []` 保持不变 |
| **Non-invasive to Phase 0~1.7** | 不允许改写调度、伤害结算、常量映射、WorldState 语义 |
| **Determinism first** | 相同输入必须得到相同 `protocol_version`、相同字段结构、相同错误码、相同示例输出 |
| **Machine-readable contract** | 输入/输出必须为纯原生 Python 类型，可无损转换为 JSON |
| **Contract before transport** | Phase 4 只定义调用契约，不绑定 FastAPI / Flask / WebSocket 等通信技术 |

### 4.0.2 输入边界

Phase 4 的输入统一为一个顶层 `dict`：
- `global_config`
- `unit_config`
- `item_configs`
- `skill_configs`

该层只负责：
- 校验配置结构
- 归一化默认值
- 转换为 Core 内部所需 dataclass

该层**不负责**：
- 新业务规则解释
- 战斗结算逻辑注入
- 运行时状态维护

### 4.0.3 输出边界

Phase 4 的输出统一为协议对象：
- 成功时返回 `status = "success"`
- 失败时返回 `status = "error"`
- 两者均包含 `protocol_version`

输出层只暴露：
- `summary`
- `charts`
- `input_echo`
- `debug_timeline`
- `warnings`
- `error.code / error.message / error.details`

输出层**不直接暴露**：
- `WorldState` 实例
- `EventQueue`
- handler 内部状态
- 任何 Enum / dataclass / runtime object 本体

---

## 4.1 Schema 定义与顶层封装

### 4.1.0 标准输入契约结构

当前标准输入契约位于：
- `src/minimal_sim_core/schema.py`

其顶层结构为：

```text
SimulationConfigDict
├─ global_config: GlobalConfigDict
├─ unit_config: UnitConfigDict
├─ item_configs: ItemConfigDict[]
└─ skill_configs: SkillConfigDict[]
```

### 4.1.1 GlobalConfig / UnitConfig / ItemConfig / SkillConfig 字段映射

| 契约对象 | 关键字段 | 语义 |
|:---|:---|:---|
| `GlobalConfig` | `simulation_duration`, `time_precision`, `min_cooldown_default`, `min_cooldown_absolute`, `max_events`, `dummy_target_*`, `debug_mode`, `ignore_unknown_fields` | 单次模拟的全局边界与协议行为配置 |
| `UnitApiConfig` | `unit_id`, `base_damage`, `base_attack_cooldown`, `crit_chance`, `max_health`, `initial_shield`, `initial_heal_pool` | 单英雄基础输入 |
| `ItemConfig` | `buff_id`, `owner_id`, `duration`, `loadout_order_index`, `max_stacks`, `stackable`, `modifiers` | 前端可声明的 Buff/Item 输入形态 |
| `SkillConfig` | `skill_id`, `owner_id`, `interval`, `duration`, `max_ticks`, `source_base_damage`, `damage_type`, `immediate_first_tick`, `loadout_order_index`, `damage_owner_id` | 前端可声明的周期性技能输入形态 |

### 4.1.2 顶层封装入口

统一入口定义于：
- `src/minimal_sim_core/api.py`

接口签名：

```python
def simulate(config: dict) -> dict:
    ...
```

### 4.1.3 simulate() 封装流程

封装流程固定为：
1. 读取外部 `config: dict`
2. 进行输入结构校验与默认值归一化
3. 将输入转换为内部 dataclass
4. 构建 `SimulationScenario`
5. 调用 `SimulationCore(...).run()`
6. 读取 Metrics 快照并重组为前端友好结构
7. 返回纯 `dict`

其本质是：
- **翻译层**
- **边界清理层**
- **协议封装层**

而不是新的引擎层。

### 4.1.4 异常边界

`simulate()` 的异常边界严格位于 API 层：
- `ConfigValidationError`
- `OverflowError`
- `TypeError`
- `ValueError`
- 其他未预期异常

所有异常均会被包装为结构化错误对象，保证前端不需要解析 Python Traceback。

### 4.1.5 Metrics 导出增强与 JSON 序列化保障

Phase 4 对 Metrics 层的增强仅限**导出面向前端的序列化结构**，不改变其伤害聚合语义。

当前导出字段包括：
- `total_damage`
- `dps`
- `per_owner_damage`
- `damage_timeline`
- `timeline_events`
- `event_count`
- `attack_count`
- `periodic_damage_total`
- `periodic_tick_count`

✅ **契约要求**：返回值中不得包含自定义对象、Enum 实例或不可 JSON 化类型。

---

## 4.2 响应分层协议与图表预处理

### 4.2.0 分层结构定义

成功响应的 `data` 层当前固定为：
- `summary`
- `charts`
- `input_echo`
- `debug_timeline`（仅 `debug_mode=True` 时返回）
- `warnings`（仅存在兼容提示时返回）

结构示意：

```json
{
  "protocol_version": "v1.0",
  "status": "success",
  "data": {
    "summary": { ... },
    "charts": [ ... ],
    "input_echo": { ... },
    "debug_timeline": [ ... ],
    "warnings": [ ... ]
  }
}
```

### 4.2.1 summary

`summary` 是聚合结果层，面向结果面板与统计卡片。

当前字段：
- `total_damage`
- `dps`
- `per_owner_damage`
- `event_count`
- `attack_count`
- `periodic_damage_total`
- `periodic_tick_count`

### 4.2.2 charts

`charts` 是图表绑定层，面向时间轴折线图 / 状态图。

当前每个点包含：
- `time`
- `total_dps_window`
- `shield_value`
- `hp_value`

### 4.2.3 input_echo

`input_echo` 是标准化回显层。

其职责是：
- 将默认值补齐后的配置明确返回给前端
- 使 UI 能区分“用户未填写”与“系统使用默认值”
- 支持结果页直接回放本次调用配置

### 4.2.4 debug_timeline

当 `global_config.debug_mode == True` 时，返回全量 `timeline_events`。

当前每个事件点包含：
- `time`
- `source_id`
- `damage`
- `damage_type`
- `is_periodic`
- `hp_after`
- `shield_after`

该字段用于：
- 调试视图
- 事件回放视图
- 开发期验证 UI

其默认不返回，避免生产调用默认携带高体积明细数据。

### 4.2.5 确定性降采样算法说明

图表预处理由 `SimulationMetrics.generate_chart_points()` 完成。

当前算法固定为：
- **时间等间隔窗口切分**
- **区间末状态值采样**
- **T=0 初始点注入**

算法流程：
1. 先插入 `T=0` 点：
   - `time = 0.0`
   - `total_dps_window = 0.0`
   - `hp_value = initial_hp`
   - `shield_value = initial_shield`
2. 将 `timeline_events` 按 `time` 排序
3. 计算 `bucket_count = min(max_points - 1, len(events))`
4. 以 `last_time / bucket_count` 得到等间隔窗口宽度
5. 每个窗口：
   - 累计窗口伤害
   - 取该窗口最后一个事件的 `hp_after / shield_after`
   - 若窗口无事件，则继承上一窗口状态值
6. 若浮点边界造成时间重复，则对后一点做最小递增修正

### 4.2.6 性能与稳定性约束

| 约束 | 当前实现 |
|:---|:---|
| `max_points` 上限 | `300` |
| 首点注入 | `T=0` 初始状态点固定存在 |
| 时间轴顺序 | 严格单调递增 |
| 状态值采样 | 使用区间末状态值 |
| 抽样方式 | **纯确定性**，无随机抽样 |
| 输出类型 | `time` / `total_dps_window` 为数值；`hp_value` / `shield_value` 为 int |

---

## 4.3 协议版本化与错误码体系

### 4.3.0 PROTOCOL_VERSION 声明位置与作用

协议版本定义于：
- `src/minimal_sim_core/constants.py`

当前值：

```python
PROTOCOL_VERSION = "v1.0"
```

其作用是：
- 让前端能够绑定明确版本的响应结构
- 为未来 `v1.x / v2.x` 字段演化提供分叉点
- 保证成功响应与失败响应都可机器识别版本

### 4.3.1 结构化错误对象设计

失败响应固定为：

```json
{
  "protocol_version": "v1.0",
  "status": "error",
  "error": {
    "code": "...",
    "message": "...",
    "details": { ... }
  }
}
```

其中：
- `code`：机器可读错误码
- `message`：人类可读提示
- `details`：可选扩展上下文

### 4.3.2 错误码映射表

当前错误码定义如下：

| 错误码 | 触发语义 | 说明 |
|:---|:---|:---|
| `CONFIG_VALIDATION_FAILED` | 一般配置校验失败 | 结构不合法但未命中特殊映射 |
| `MISSING_UNIT_CONFIG` | `unit_config` 缺失或缺少必填字段 | 前端面板关键输入不完整 |
| `INVALID_NUMERIC_VALUE` | 数值越界 / 非法 | 负数、区间错误、CD/伤害非法 |
| `SIMULATION_OVERFLOW` | Timeline overflow 等运行时溢出 | 事件数超边界 |
| `INTERNAL_ENGINE_ERROR` | 未预期异常 | 引擎内部错误的兜底编码 |

### 4.3.3 错误码映射契约

当前映射规则是确定性的：
- `missing required field: unit_config`
- `missing required unit_config fields: ...`
  → `MISSING_UNIT_CONFIG`

- 包含以下片段之一：
  - `must be > 0`
  - `must be >= 0`
  - `must be between 0 and 1`
  - `skill interval`
  - `skill source_base_damage`
  - `skill duration`
  - `skill max_ticks`
  → `INVALID_NUMERIC_VALUE`

- 其他 `ConfigValidationError`
  → `CONFIG_VALIDATION_FAILED`

- `OverflowError`
  → `SIMULATION_OVERFLOW`

- 未分类异常
  → `INTERNAL_ENGINE_ERROR`

✅ **铁律**：相同非法输入必须得到相同 `code` 与相同 `message` 语义。

### 4.3.4 轻量兼容警告机制

Phase 4.3 引入了 MVP 级兼容机制，但不影响成功/失败状态。

相关输入字段：
- `ignore_unknown_fields: bool = False`

兼容行为：
1. 预留 `_DEPRECATED_KEYS = []`
2. 若未来顶层键进入弃用名单，则返回 warning 文案
3. 若存在未知顶层字段，且 `ignore_unknown_fields == False`，则注入 `warnings`
4. `warnings` 仅用于前端提示，不改变 `status == "success"`

### 4.3.5 warnings 注入规则

`warnings` 仅出现在成功响应的 `data` 中，且仅在警告非空时返回。

示例文案：
- `字段 'legacy_field' 将在 v2.0 弃用，请使用 'global_config' 或对应配置分组替代`

---

## 4.4 契约示例与最小导出

### 4.4.0 EXAMPLE_REQUEST_MINIMAL / FULL

契约示例位于：
- `src/minimal_sim_core/contract_examples.py`

#### `EXAMPLE_REQUEST_MINIMAL`
使用场景：
- 最小合法调用
- 前端接入 smoke test
- 最小回归样例

其特点：
- 单英雄
- 无物品
- 无技能
- `30s` 模拟时长
- `base_damage = 0`
- 可稳定得到零伤害成功响应

#### `EXAMPLE_REQUEST_FULL`
使用场景：
- 覆盖全部公开字段
- 表单生成对照
- 契约边界回归测试

其特点：
- 覆盖 `global_config / unit_config / item_configs / skill_configs`
- 包含可选字段与边界字段
- 包含 `damage_type_override`、`max_ticks`、`debug_mode`、`ignore_unknown_fields`

### 4.4.1 EXAMPLE_RESPONSE_SUCCESS / ERROR

#### `EXAMPLE_RESPONSE_SUCCESS`
语义：
- 对应 `EXAMPLE_REQUEST_MINIMAL` 的标准成功响应
- 提供前端结果页、mock 数据、类型定义参考

#### `EXAMPLE_RESPONSE_ERROR`
语义：
- 典型结构化错误响应
- 当前使用 `MISSING_UNIT_CONFIG` 作为标准错误示例

### 4.4.2 generate_json_schema() 输出规范

`generate_json_schema()` 当前导出：
- Draft 7 Schema
- 顶层 `required`
- `$defs` 嵌套对象定义
- 数值约束
- 枚举值约束
- 不暴露 `WorldState` / `EventQueue` / handler 等内部实现细节

其覆盖范围聚焦前端校验所需字段，而非引擎内部全部对象。

### 4.4.3 generate_openapi_snippet() 片段用途

`generate_openapi_snippet()` 提供最小 OpenAPI 3.0 片段。

用途：
- Web 服务层快速接入 `/simulate`
- 前端或后端共享最小 request/response 描述
- 在不引入第三方 OpenAPI 框架的前提下，保留契约产物

其特点：
- 独立
- 纯 dict
- 无第三方依赖
- 可直接嵌入未来真实 OpenAPI 文档

---

## 📦 标准契约示例

### 成功响应 JSON 结构

```json
{
  "protocol_version": "v1.0",
  "status": "success",
  "data": {
    "summary": {
      "total_damage": 0,
      "dps": 0.0,
      "per_owner_damage": {},
      "event_count": 62,
      "attack_count": 31,
      "periodic_damage_total": 0,
      "periodic_tick_count": 0
    },
    "charts": [
      {
        "time": 0.0,
        "total_dps_window": 0.0,
        "shield_value": 0,
        "hp_value": 1000
      }
    ],
    "input_echo": {
      "global_config": {
        "simulation_duration": 30.0,
        "time_precision": 0.1,
        "min_cooldown_default": 1.0,
        "min_cooldown_absolute": 0.5,
        "max_events": 10000,
        "dummy_target_id": "dummy",
        "dummy_target_health": 1000,
        "dummy_target_shield": 0,
        "debug_mode": false,
        "ignore_unknown_fields": false
      },
      "unit_config": {
        "unit_id": "hero",
        "base_damage": 0,
        "base_attack_cooldown": 1.0,
        "crit_chance": 0.0,
        "max_health": 100,
        "initial_shield": 0,
        "initial_heal_pool": 0
      },
      "item_configs": [],
      "skill_configs": []
    }
  }
}
```

### 失败响应 JSON 结构

```json
{
  "protocol_version": "v1.0",
  "status": "error",
  "error": {
    "code": "MISSING_UNIT_CONFIG",
    "message": "missing required field: unit_config"
  }
}
```

### 含 warnings 的成功响应结构

```json
{
  "protocol_version": "v1.0",
  "status": "success",
  "data": {
    "summary": { "total_damage": 0, "dps": 0.0 },
    "charts": [
      { "time": 0.0, "total_dps_window": 0.0, "shield_value": 0, "hp_value": 1000 }
    ],
    "input_echo": { "global_config": {}, "unit_config": {}, "item_configs": [], "skill_configs": [] },
    "warnings": [
      "字段 'legacy_field' 将在 v2.0 弃用，请使用 'global_config' 或对应配置分组替代"
    ]
  }
}
```

### 关键字段类型对齐表

| 契约字段 | 类型 | 对齐说明 |
|:---|:---|:---|
| `summary.total_damage` | `int` | 对齐 Phase 1.3 最终伤害整数取整语义 |
| `summary.dps` | `float` | 聚合后平均 DPS |
| `summary.per_owner_damage` | `dict[str, int]` | 每个 owner 的整数总伤害 |
| `charts.time` | `float` | 延续时间轴浮点语义 |
| `charts.total_dps_window` | `float` | 窗口 DPS 属于聚合浮点值 |
| `charts.hp_value` | `int` | Phase 1.3 / 运行态健康值为整数 |
| `charts.shield_value` | `int` | Phase 1.3 / 运行态护盾值为整数 |
| `debug_timeline.damage` | `int` | 对齐最终结算伤害 |
| `debug_timeline.hp_after` | `int` | 对齐目标 HP 整数状态 |
| `debug_timeline.shield_after` | `int` | 对齐目标 Shield 整数状态 |
| `error.code` | `str` | 枚举名字符串 |
| `protocol_version` | `str` | 协议版本标识 |

---

## ✅ 测试验证与对齐检查

### 4.4.4 测试覆盖清单

当前 Phase 4 对齐验证结果为：
- `tests/test_api_entry.py` → `11 passed`
- `tests/test_damage_pipeline.py` → `6 passed`
- `tests/test_periodic_effects.py` → `7 passed`

合计：
- **24 passed**

### 4.4.5 契约层测试覆盖范围

| 测试类别 | 覆盖内容 |
|:---|:---|
| API 成功响应 | `protocol_version`, `summary`, `charts`, `input_echo`, `debug_timeline`, `warnings` |
| API 错误响应 | `error.code`, `error.message`, 缺失字段与非法数值映射 |
| 图表契约 | `T=0` 初始点、严格单调时间轴、`hp/shield` 整数值 |
| 示例资产 | `EXAMPLE_REQUEST_*` / `EXAMPLE_RESPONSE_*` JSON 可序列化 |
| Schema 导出 | Draft 7 结构、`required`、`$defs`、可选 `jsonschema.validate()` |
| OpenAPI 导出 | `/simulate` POST 片段存在性 |
| 历史行为对齐 | Damage / Periodic 历史测试全部通过 |

### 4.4.6 与 Phase 0~1.7 的无侵入性证明

本阶段未修改：
- Timeline 排序契约
- Damage Pipeline 数值结算逻辑
- WorldState 状态推进路径
- 常量映射业务语义
- Metrics 聚合真实来源

本阶段仅增加：
- 输入 Schema
- API 包装层
- 协议版本与错误码
- 图表导出层
- 契约示例与 Schema/OpenAPI 导出

✅ 因此，Phase 4 是 **Integration Layer**，不是新的 Battle Logic Layer。

### 4.4.7 确定性断言原则

Phase 4 继承并强化 Phase 0 的确定性原则：

给定相同代码版本与相同输入：
- `protocol_version` 必须相同
- 成功/失败 `status` 必须相同
- 错误 `code / message` 必须相同
- `summary / charts / input_echo / debug_timeline` 字段结构必须相同
- 契约示例与导出内容必须保持稳定

> ✅ **Phase 4 Outcome**  
> API Contract 已被固化为：
> - 前端可直接消费的无状态调用层
> - 版本明确的机器可读协议
> - 零运行时第三方依赖的契约资产集合
> - 不侵入 Core 调度与结算逻辑的 Integration Boundary
