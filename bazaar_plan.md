# Bazaar Team Composition Simulator Plan
**项目概览**：针对《The Bazaar》设计的基于 Web 的队伍阵容 DPS 模拟器。采用阶段式开发序列，初期侧重于针对训练木桩（Training Dummy）的战斗模拟。

---

## 项目原则 (Product Principles)
* **MVP 优先**：从核心功能出发，不追求开局即完美的战斗还原。
* **引擎先行**：在开发 UI 之前，确保模拟引擎逻辑准确、可靠。
* **数据分离**：游戏数据（Units/Items）与模拟逻辑代码严格解耦。
* **持续验证**：通过自动化测试用例不断校准模拟器的准确性。

---

## Phase 0 — Scope & Rules Definition
**核心任务**：明确 v1 版本模拟器的边界与战斗规则。

* [ ] **Target Specification**: 仅针对无限生命、无装备、无技能的训练木桩。
* [ ] **Time-Boxed Simulation**: 设定固定的模拟时长（如 30 秒）。
* [ ] **Feature Scoping**: 明确列出 MVP 支持的机制，并记录暂不支持的机制。

**交付物**：规则规范文档、首批支持的单位/物品/技能清单。

---

## Phase 1 — Data Model Design
**核心任务**：设计作为“唯一事实来源”的数据结构。

* [ ] **Schema Definition**: 为 Hero、Item、Skill、Effect 定义强类型结构。
* [ ] **Combat State Design**: 规划 Buff/Debuff 系统及战斗事件（Events）的存储结构。
* [ ] **ID Strategy**: 建立统一的命名规范和资源唯一标识符（ID）策略。

**交付物**：TypeScript 类型定义文件、示例数据条目。

---

## Phase 2 — Combat Engine MVP
**核心任务**：构建确定性的事件驱动模拟核心。

* [ ] **Core Simulation Clock**: 实现高精度的模拟时钟与事件队列。
* [ ] **Action Scheduling**: 实现攻击频率调度、技能冷却及伤害结算逻辑。
* [ ] **Metric Tracking**: 实时追踪单体伤害、总 DPS 及战斗日志。

**交付物**：核心 `simulate()` 函数、事件处理循环逻辑。

---

## Phase 3 — Verification & Test Harness
**核心任务**：创建可靠的测试场景，确保计算公式的准确性。

* [ ] **Baseline Tests**: 验证单体攻击者在基础状态下的 DPS。
* [ ] **Scaling Tests**: 验证攻击速度（Attack Speed）与附加伤害的加成逻辑。
* [ ] **Regression Suite**: 建立自动化测试套件，防止功能迭代导致的计算偏差。

**交付物**：单元测试套件、已知正确的测试用例（Fixtures）。

---

## Phase 4 — Initial Web App Shell
**核心任务**：构建基础 Web 界面，实现模拟逻辑的可视化。

* [ ] **Team Builder Area**: 实现简单的单位与物品选择器。
* [ ] **Simulation Controls**: 增加模拟启动按钮与参数调节。
* [ ] **Basic Results**: 渲染伤害曲线图表与简单的汇总数据。

**交付物**：单页面（SPA）MVP 界面、集成了引擎的交互前端。

---
# Phase 5 — Web Prototype & Interaction
**目标**：构建一个功能完备的本地 Web 界面，用于可视化模拟数据并管理配置。

---

## 5.1 — Local Service & Bridge
**核心任务**：建立 Python 模拟核心与 Web 前端之间的通信层。

* [ ] **Local API Host**: 使用 **FastAPI** 封装 `simulate()` 函数，搭建用于本地开发的轻量级服务端。
* [ ] **Protocol Bridge**: 实现一个 **TypeScript** 客户端，将前端 JSON 状态映射为 Phase 4.3 中定义的 `SimulationConfigDict`。
* [ ] **Pyodide Readiness**: 优化前端架构，支持从“远程 API 获取”无缝切换至“基于 WASM (Pyodide) 的本地 Python 执行”。

## 5.2 — Data-Driven Configuration UI
**核心任务**：创建一个响应式的表单界面，用于构建队伍阵容。

* [ ] **Schema-Based Forms**: 根据 `UnitConfig` 和 `ItemConfig` 的规范，动态生成输入表单字段。
* [ ] **Loadout Management**: 实现拖拽（Drag-and-Drop）或基于索引的排序功能，以满足 `loadout_order_index` 逻辑。
* [ ] **Validation Feedback**: 在 UI 中直接反馈 `SimulationErrorCode`（如 `INVALID_NUMERIC_VALUE`），实现实时纠错。

## 5.3 — Result Visualization & Analytics
**核心任务**：将原始模拟指标转化为直观的视觉洞察。

* [ ] **Interactive Timeline**: 使用 **ECharts** 或 **Chart.js** 渲染图表数据，包括：
    * HP / 护盾（Shield）变化曲线。
    * 滑动窗口 DPS（Windowed DPS）。
* [ ] **Summary Dashboard**: 展示高层级指标，如 `Total Damage` 和基于 `summary` 对象计算的 `Average DPS`。
* [ ] **Debug Inspection**: 提供可切换的 **“Audit Log”**（审计日志）视图，展示完整的 `debug_timeline` 以进行逐帧验证。

## 5.4 — Local Persistence & State
**核心任务**：确保本地迭代过程中的用户体验连贯性。

* [ ] **Local Storage Sync**: 自动将当前队伍配置保存至浏览器的 `localStorage`。
* [ ] **Snapshot Export**: 支持用户将配置导出为 **JSON 文件**，用于备份或版本控制。
* [ ] **Input Echoing**: 确保 UI 始终反射 API 返回的 `input_echo`，保证“所见即所模拟”。

---

## 交付物 (Deliverables)

| 交付项 | 描述 |
| :--- | :--- |
| **Running Web App** | 可通过 `localhost` 访问的本地 Web 应用程序。 |
| **Reactive Forms** | 带有集成校验功能的响应式配置表单。 |
| **Interactive Charts** | 用于战斗分析的交互式时间序列图表。 |
| **Frontend Architecture** | 采用“契约优先”设计，具备迁移至 WASM 潜力的前端架构。 |

---
## Phase 6 — Comparison & Quality-of-Life
**核心任务**：通过功能打磨提升用户迭代效率。

* [ ] **Comparison Mode**: 实现两个阵容的侧向对比功能（Side by Side）。
* [ ] **Shareable Links**: 支持将当前配置编码为 URL，方便用户分享。
* [ ] **Preset Library**: 提供预设的常用阵容模板。

**交付物**：具备高可用性的版本，支持导入/导出 JSON 配置。

---

## Phase 7 — Accuracy Refinement
**核心任务**：缩小模拟器与游戏实际表现之间的差距。

* [ ] **Priority Rules**: 精细化触发机制的优先级顺序（Trigger Priority）。
* [ ] **Edge Case Handling**: 处理 Buff 叠加层级、数值舍入（Rounding）等边缘情况。
* [ ] **Real-world Validation**: 根据游戏内实际录制数据进行校准补丁开发。

**交付物**：高精度模拟报告、已知差异/假设文档。

---

## 交付物汇总 (Deliverables Summary)

| 阶段 | 核心交付项 | 关键技术指标 |
| :--- | :--- | :--- |
| **Phase 0-1** | **Data Schema** | 类型覆盖率 100%，支持动态扩展。 |
| **Phase 2-3** | **Core Engine** | 核心计算误差 < 1%，支持回归测试。 |
| **Phase 4-5** | **Functional Web UI** | 本地可运行，支持交互式图表渲染。 |
| **Phase 6-7** | **Advanced Tooling** | 支持持久化存储、配置分享及高精度模拟。 |

---

## 风险管理 (Risks)
* **机制模糊性**：游戏内隐藏机制（如舍入规则）可能导致误差。
* **数据维护成本**：游戏版本更新导致的数值变动需及时同步。
* **应对策略**：在 UI 中显式标注“模拟假设”，保持代码小步快跑，快速迭代。