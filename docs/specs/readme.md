# The Bazaar 模拟器 — 用户操作手册

> 本手册面向首次使用本地 Web 模拟器的用户。
> 假设你已经在本机完成了项目安装，可以通过浏览器访问模拟器界面。

---

## 目录

1. [启动模拟器](#1-启动模拟器)
2. [界面总览](#2-界面总览)
3. [配置全局参数](#3-配置全局参数)
4. [配置战斗上下文](#4-配置战斗上下文)
5. [管理装备栏（物品与技能）](#5-管理装备栏物品与技能)
6. [运行模拟](#6-运行模拟)
7. [查看结果](#7-查看结果)
8. [配置持久化与快照](#8-配置持久化与快照)
9. [调试模式](#9-调试模式)
10. [常见问题](#10-常见问题)

---

## 1. 启动模拟器

### 一键启动（推荐）

在项目根目录执行：

- **Windows**：双击 `start-local.bat`，或在终端运行：

```
start-local.bat
```

- **Linux / macOS**：

```bash
bash start-local.sh
```

脚本会自动完成以下步骤：
1. 检查 Python 和 Node.js 是否可用
2. 安装后端依赖
3. 安装前端依赖
4. 启动后端 API 服务（端口 8000）
5. 启动前端开发服务（端口 5173）
6. 自动打开浏览器

### 手动启动

如果一键脚本不适用，可以手动分两步启动：

**终端 1 — 启动后端：**

```
cd E:\github_project\Bazzar_team_test
pip install -e .[server]
python -m minimal_sim_core.server --port 8000
```

**终端 2 — 启动前端：**

```
cd E:\github_project\Bazzar_team_test\web
npm install
npm run dev
```

然后打开浏览器访问：`http://localhost:5173`

---

## 2. 界面总览

打开页面后，你会看到以下区域（从上到下）：

| 区域 | 说明 |
|------|------|
| **顶部标题栏** | 项目名称 + 引擎连接状态指示灯 |
| **持久化工具栏** | 自动保存状态、本地恢复、导出/导入 JSON、手动保存 |
| **全局配置** | 模拟时长、时间精度、冷却下限、调试开关等 |
| **战斗上下文** | 配置己方生命/护盾与敌方生命值，无英雄差异化属性 |
| **装备栏** | 物品和技能列表，支持添加/删除/拖拽排序/展开编辑 |
| **运行按钮** | 点击后提交模拟请求 |
| **结果区域** | 数据面板、时间线图表、调试表格 |

### 连接状态指示灯

| 状态 | 图标 | 含义 |
|------|------|------|
| 🟢 Connected | 绿色 | 后端 API 正常连接 |
| 🔴 Unavailable | 红色 | 后端未启动，无法模拟 |

> 如果显示红色，请确认后端服务是否已启动（参见第 1 节）。

---

## 3. 配置全局参数

在 **Global Configuration** 区域，你可以设置以下参数：

| 参数 | 说明 | 默认行为 |
|------|------|----------|
| Simulation Duration | 模拟总时长（秒） | 引擎默认 30 秒 |
| Time Precision | 时间精度（秒） | 引擎默认 0.1 秒 |
| Min Cooldown Default | 默认冷却下限 | 引擎默认值 |
| Min Cooldown Absolute | 绝对冷却下限 | 引擎默认值 |
| Max Events | 最大事件数上限 | 防止无限循环 |
| Debug Mode | 调试模式开关 | 关闭 |
| Ignore Unknown Fields | 忽略未知字段 | 关闭 |

> 所有全局参数都是可选的。留空时引擎会使用内部默认值。
>
> 敌方生命值与己方护盾等数值已迁移至「战斗上下文」区域（第 4 节），全局配置中不再显示。

---

## 4. 配置战斗上下文（Battle Context）

本模拟器已移除英雄差异化属性（基础伤害、暴击率等不再由英雄提供，改由物品/技能承载）。此处仅定义战场基础血量与护盾容器。

| 字段 | 说明 | 约束 |
|------|------|------|
| Unit ID * | 英雄唯一标识 | 必填 |
| Base Attack Cooldown * | 基础攻击间隔（秒） | 必填，> 0 |
| Self HP * | 己方初始生命值 | 必填，> 0 |
| Self Shield * | 己方初始护盾值 | 必填，>= 0 |
| Enemy HP * | 敌方初始生命值（训练目标） | 必填，> 0 |

> 💡 提示：标有 `*` 为必填项。引擎将根据此容器结算伤害、治疗与护盾消耗。

---

## 5. 管理装备栏（物品与技能）

> 💡 **附魔驱动模式**：本模拟器采用「物品 + 附魔」双层配置。玩家**不可手动添加效果**，仅能通过选择附魔类型，填写该附魔允许的数值槽。

### 添加物品/技能
在 Loadout 区域的右上角：
- 点击 **Add Item** 添加一个物品卡片
- 点击 **Add Skill** 添加一个技能卡片

### 编辑物品/技能
每张卡片右侧提供：
- **Edit / Collapse**：展开或收起编辑表单
- **Drag**：拖拽排序手柄
- **Move up / Move down**：上下移动
- **Remove**：删除该卡片

### 物品字段（附魔驱动）
| 字段 | 说明 | 约束 |
| --- | --- | --- |
| buff_id * | 物品唯一标识 | 必填 |
| owner_id | 归属英雄 ID | 可选 |
| duration | 持续时间（秒） | >= 0 |
| **Enchantment Type** | **附魔类型下拉框（14 种选项）** | 默认 `NONE` |
| **动态数值槽** | **根据选中附魔自动显示 0~2 个输入框** | 见下方附魔速查表 |

#### 附魔速查表（13 种效果）
| 附魔 | 数值槽 (slot name) | 引擎阶段 | 效果说明 |
| --- | --- | --- | --- |
| **SLOW** | `slow_value` (0~1), `slow_duration` (s) | slow_debuff | 延长攻击间隔 ×(1+slow_value)，已在引擎中生效 |
| **BURN** | `burn_damage`, `burn_duration` (s) | damage_over_time | 持续火焰伤害（DoT），已在引擎中生效 |
| **POISON** | `poison_damage`, `poison_duration` (s) | damage_over_time | 持续毒素伤害（DoT），完全穿透护盾，已在引擎中生效 |
| **FLASH** | `flash_damage`, `flash_cooldown_reduction` (s) | flat_damage / cooldown_delta | 额外固定伤害 + 缩短冷却，已在引擎中生效 |
| **OBSIDIAN** | `obsidian_shield`, `obsidian_duration` (s) | shield_grant | 授予护盾值（Buff 应用时生效），已在引擎中生效 |
| **HEAL** | `heal_amount`, `heal_interval` (s) | heal_over_time | 周期性回复生命值，已在引擎中生效 |
| **SHIELD** | `shield_amount`, `shield_duration` (s) | shield_grant | 添加护盾值（Buff 应用时生效），已在引擎中生效 |
| **ACCELERATE** | `accelerate_value`, `accelerate_duration` (s) | cooldown_delta | 缩短攻击冷却，已在引擎中生效 |
| **FREEZE** | `freeze_duration` (s), `freeze_chance` (0~1) | freeze_debuff | 冻结效果（大幅延长攻击间隔），已在引擎中生效 |
| **CRIT** | `crit_bonus` (0~10), `crit_duration` (s) | crit_multiplier | 暴击伤害 ×(1+crit_bonus)，已在引擎中生效 |
| **GOLD** | `gold_bonus`, `gold_chance` (0~1) | gold_reward | 金币奖励（非战斗，写入修饰视图），已在引擎中生效 |
| **RADIANCE** | `radiance_damage`, `radiance_radius` | damage_over_time | 范围持续伤害（DoT），已在引擎中生效 |
| **EVERGREEN** | `evergreen_heal`, `evergreen_duration` (s) | heal_over_time | 战斗期间每秒回复生命值，已在引擎中生效 |

> ⚠️ 规则说明：
> - 选择附魔后，**仅可填写该附魔允许的数值槽**，非法字段将被拦截
> - 切换附魔类型时，旧数值自动清空，重置为该附魔的默认值
> - 选择 `NONE` 时，物品无附魔效果，数值槽区域隐藏
> - 部分附魔（如 SLOW）对「已有基础效果的物品」有倍率调整逻辑，由引擎自动处理，前端无需干预

### 技能字段
| 字段 | 说明 | 约束 |
| --- | --- | --- |
| skill_id * | 技能唯一标识 | 必填 |
| owner_id | 归属英雄 ID | 可选 |
| interval | 触发间隔（秒） | > 0 |
| duration | 持续时间 | >= 0 |
| max_ticks | 最大触发次数 | >= 1 |
| source_base_damage | 技能基础伤害 | >= 0 |
| damage_type | 伤害类型 | `NORMAL` / `FIRE` / `TOXIC` |
| immediate_first_tick | 是否立即触发第一次 | 布尔 |
| damage_owner_id | 伤害归属 ID | 可选 |

### 拖拽排序
你可以通过以下方式调整物品和技能的顺序：
- 鼠标拖拽 **Drag** 按钮
- 键盘方向键（先聚焦 Drag 按钮）
- 点击 **Move up / Move down**

> 📌 排序规则：
> - 同类型（物品对物品、技能对技能）之间可以拖拽排序，跨类型不可
> - 排序后，所有 `loadout_order_index` 会自动重新计算，确保触发顺序确定性
---

## 6. 运行模拟

填写完配置后，点击页面中的 **Run Simulation** 按钮。

### 可能的结果

| 状态 | 表现 |
|------|------|
| 加载中 | 按钮变为 "Simulating..."，结果区域显示骨架屏动画 |
| 成功 | 按钮旁显示绿色 "Simulation complete"，结果区域显示数据 |
| 失败 | 按钮旁显示红色错误信息，右下角弹出错误 Toast |
| 超时 | 15 秒未响应时自动取消，弹出超时提示 |

### 输入回显机制

模拟成功后，引擎会返回它实际使用的输入参数（`input_echo`）。如果你的输入和引擎实际使用的值不同（比如引擎自动补充了默认值），系统会：

1. 自动把表单更新为引擎实际使用的值
2. 被修改的字段会短暂高亮（蓝色闪烁 2 秒）
3. 右下角弹出提示："配置已按引擎规则标准化"

> 这确保你在屏幕上看到的数值就是引擎实际计算时使用的数值。

---

## 7. 查看结果

模拟成功后，页面下方会自动滚动到结果区域。

### 7.1 数据面板

显示 6 张指标卡片：

| 指标 | 说明 |
|------|------|
| Total Damage | 模拟期间的总伤害 |
| DPS | 每秒伤害（总伤害 / 模拟时长） |
| Attack Count | 攻击次数 |
| Periodic Damage | 持续伤害总量 |
| Periodic Ticks | 持续伤害触发次数 |
| Total Events | 总事件数 |

如果存在多个伤害来源，还会显示 **Damage by Owner** 表格，列出每个来源的伤害贡献。

### 7.2 战斗时间线图表

图表以时间为 X 轴，同时展示：

| 数据线 | 颜色 | Y 轴 |
|--------|------|------|
| DPS（每秒伤害） | 红色实线 | 左 Y 轴 |
| HP（生命值） | 绿色面积 | 右 Y 轴 |
| Shield（护盾值） | 蓝色面积 | 右 Y 轴 |

交互功能：
- **悬停查看**：鼠标悬停在图表上可查看精确数值
- **缩放浏览**：当数据点超过 30 个时，底部出现可拖动的时间范围选择器

### 7.3 空状态

如果你还没有运行过模拟，结果区域会显示引导文案，提示你配置装备并点击 Run Simulation。

---

## 8. 配置持久化与快照

### 8.1 自动保存

你的配置会自动保存到浏览器本地存储中。

- 每次修改后 300 毫秒自动保存
- 关闭页面时立即保存
- 下次打开页面时自动恢复上次的配置

### 8.2 工具栏操作

页面顶部的持久化工具栏提供以下功能：

| 按钮 | 功能 |
|------|------|
| 💾 Auto-saved ... | 显示上次自动保存的时间 |
| 📂 Restore Local | 从本地存储恢复配置 |
| 📤 Export JSON | 将当前配置导出为 JSON 文件 |
| 📥 Import JSON | 从 JSON 文件导入配置 |
| Save Now | 立即手动保存 |

### 8.3 导出配置

点击 **📤 Export JSON**，浏览器会下载一个 JSON 文件，文件名格式为：

```
bazaar_config_20260423_153000.json
```

文件内容包含完整的模拟配置（全局参数 + 战斗上下文 + 所有物品和技能），以及版本标记 `__meta_version: "v1"`。

### 8.4 导入配置

点击 **📥 Import JSON**，选择之前导出的 JSON 文件。系统会：

1. 解析 JSON 内容
2. 检查版本兼容性
3. 验证数据结构完整性
4. 如果通过，替换当前配置

如果文件损坏、格式错误或版本不兼容，右下角会弹出错误 Toast 提示。

> 你可以利用导出/导入功能在不同电脑之间共享配置，或保存多个实验方案。

---

## 9. 调试模式

### 开启方式

在 **Global Configuration** 区域，勾选 **Debug Mode** 复选框，然后运行模拟。

### 调试时间线表格

开启调试模式后，模拟结果区域会多出一个 **Show Debug Timeline** 复选框。勾选后显示详细的事件表格：

| 列 | 说明 |
|----|------|
| Time | 事件发生时间 |
| Source | 伤害来源 ID |
| Damage | 伤害数值 |
| Type | 伤害类型标签（NORMAL=蓝色 / FIRE=橙色 / TOXIC=紫色） |
| Periodic | 是否为持续伤害 |
| HP After | 事件后的生命值 |
| Shield After | 事件后的护盾值 |

### 筛选功能

表格上方提供两个筛选下拉框：
- **伤害类型**：All Types / NORMAL / FIRE / TOXIC
- **伤害来源**：All Sources / Periodic Only / Non-Periodic Only

### 大数据量处理

如果事件数超过 1000 条，表格不会直接渲染（防止浏览器卡顿），而是显示一个 **Export JSON** 按钮，可以将调试数据导出为 JSON 文件进行离线分析。

---

## 10. 常见问题

### Q: 页面显示红色 "Unavailable"，无法模拟

**原因**：后端 API 服务未启动。

**解决**：确认后端正在运行：

```
python -m minimal_sim_core.server --port 8000
```

或直接双击 `start-local.bat`。

### Q: 运行 `python` 命令时提示"不是内部或外部命令"

**原因**：Python 未添加到系统 PATH。

**解决**：
- 使用完整路径运行，例如：`.venv\Scripts\python.exe -m minimal_sim_core.server --port 8000`
- 或将 Python 安装目录添加到系统环境变量 PATH 中

### Q: 端口 8000 已被占用

**解决**：关闭占用该端口的进程，或使用其他端口：

```
python -m minimal_sim_core.server --port 9000
```

然后修改 `web/vite.config.ts` 中的代理目标端口：

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:9000',  // 改为对应端口
  },
},
```

### Q: 模拟一直显示 "Simulating..." 不结束

**原因**：可能是引擎计算时间过长。

**解决**：系统内置了 15 秒超时机制。如果超时频繁发生，尝试：
- 缩短 Simulation Duration
- 减少物品和技能数量
- 检查是否有异常的冷却配置导致事件爆炸

### Q: 表单数据丢失了

**解决**：
- 点击工具栏的 **📂 Restore Local** 从本地存储恢复
- 如果之前导出过 JSON，点击 **📥 Import JSON** 导入

### Q: 页面看起来异常（样式错乱）

**解决**：
- 硬刷新页面：`Ctrl + Shift + R`（Windows）或 `Cmd + Shift + R`（Mac）
- 清除本地存储：打开浏览器开发者工具 → Application → Local Storage → 删除 `bazaar_sim_config_v1`

### Q: 页面白屏，显示错误信息

**原因**：应用发生了渲染错误，已被全局错误边界捕获。

**解决**：点击页面上的 **Retry** 按钮重试。如果问题持续，请刷新页面。

---

## 功能速查表

| 操作 | 方法 |
|------|------|
| 启动模拟器 | 双击 `start-local.bat` 或 `bash start-local.sh` |
| 添加物品 | 点击 Loadout 区域的 "Add Item" |
| 添加技能 | 点击 Loadout 区域的 "Add Skill" |
| 编辑物品/技能 | 点击卡片上的 "Edit" |
| 调整顺序 | 拖拽 "Drag" 按钮，或点击 "Move up" / "Move down" |
| 删除物品/技能 | 点击卡片上的 "Remove" |
| 运行模拟 | 点击 "Run Simulation" |
| 导出配置 | 点击工具栏 "📤 Export JSON" |
| 导入配置 | 点击工具栏 "📥 Import JSON" |
| 手动保存 | 点击工具栏 "Save Now" |
| 恢复本地配置 | 点击工具栏 "📂 Restore Local" |
| 开启调试 | 勾选 Global Configuration 中的 "Debug Mode" |
| 查看调试表格 | 模拟成功后勾选 "Show Debug Timeline" |
