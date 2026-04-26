# AI Development Workflow

这份文档说明如何把 Superpowers 和 gstack 用到日常开发里，目标是把一个需求从想法推进到可落地代码。

## 0. 使用前准备

安装后需要重启 Codex，让新 skills 被加载。

已安装位置：

- Superpowers: `F:\.codex\superpowers`
- gstack: `F:\.codex\gstack`
- Bun: `F:\.bun`
- gstack 状态: `F:\.gstack`

gstack 使用前缀模式，所以相关能力名都是 `gstack-*`，例如：

- `gstack-office-hours`
- `gstack-plan-ceo-review`
- `gstack-plan-eng-review`
- `gstack-review`
- `gstack-qa`
- `gstack-cso`
- `gstack-ship`

## 1. 总体原则

推荐分工：

- Superpowers 负责默认工程流程：澄清需求、写计划、TDD、执行、代码评审、完成前验证。
- gstack 负责关键关卡：产品方向审查、架构审查、设计审查、浏览器 QA、安全审计、发布前检查。

不要一上来就让 AI 直接写代码。复杂需求先拆清楚，否则后面改得更慢。

## 2. 从需求到落地的完整流程

### 阶段 A：需求澄清

适用场景：

- 你只有一个想法，还没想清楚范围。
- 需求比较大，可能涉及产品、交互、数据、权限、支付、审核、发布等。
- 你担心 AI 直接实现会跑偏。

推荐对 Codex 说：

```text
我有一个需求，先不要写代码。请用 Superpowers 的 brainstorming 工作流帮我澄清需求。

需求是：
【在这里写你的需求】

请重点问清楚：
- 用户是谁
- 目标结果是什么
- 必须做什么
- 什么可以先不做
- 有哪些边界条件
- 最小可上线版本是什么
```

如果需求有明显产品方向不确定，先用 gstack：

```text
请使用 gstack-office-hours 帮我做产品澄清。先不要写代码。

需求是：
【需求描述】
```

如果你已经有需求，但想判断“是不是值得这样做”：

```text
请使用 gstack-plan-ceo-review 审查这个需求的产品方向和范围。先不要写代码。

需求是：
【需求描述】
```

输出目标：

- 明确用户场景
- 明确 MVP 范围
- 明确非目标
- 明确关键风险
- 形成可执行的需求说明

## 3. 阶段 B：工程方案和实施计划

当需求已经清楚后，让 AI 先写计划，不要直接改代码。

推荐提示词：

```text
基于上面的需求，请用 Superpowers 的 writing-plans 工作流写一份实施计划。

要求：
- 先阅读当前项目结构
- 明确要改哪些文件
- 每一步都要小到可以独立验证
- 标出测试方案
- 标出风险点
- 先输出计划，不要写代码
```

如果涉及架构、状态流、数据库、权限、云函数、支付、审核等复杂逻辑，加一次 gstack 架构审查：

```text
请使用 gstack-plan-eng-review 审查这份技术方案。

重点检查：
- 数据流是否完整
- 状态机是否清楚
- 失败重试怎么处理
- 权限和安全边界
- 是否有测试矩阵
- 是否有遗漏的异常路径
```

输出目标：

- 文件级改动清单
- 分步骤任务
- 测试清单
- 风险和回滚方案

## 4. 阶段 C：开始编码

计划确认后再让 AI 执行。

推荐提示词：

```text
计划确认。请开始实现。

要求：
- 遵循 Superpowers 的 test-driven-development 工作流
- 每次只做计划中的一个小步骤
- 能写测试的地方先写测试
- 每完成一个步骤就运行对应验证
- 不要做计划外重构
```

如果你的项目当前没有测试体系，可以这样说：

```text
如果项目没有现成测试体系，请先说明能做哪些轻量验证。
不要为了这个需求大规模引入测试框架，除非确实必要。
```

对 uni-app / HBuilderX 项目，可以要求：

```text
这是 uni-app 项目。实现时请注意：
- 不要破坏 pages.json、manifest.json、uni.scss 的现有结构
- 页面逻辑优先遵循现有写法
- 云函数或接口改动要说明入参、出参、权限边界
- H5 能验证的交互用浏览器验证
- 小程序专属能力需要说明如何在开发者工具里验证
```

## 5. 阶段 D：代码评审

实现完成后，不要马上认为完成。先让 AI 做代码评审。

推荐先用 Superpowers：

```text
请使用 Superpowers 的 requesting-code-review 工作流审查刚才的改动。

重点检查：
- 是否符合需求
- 是否有遗漏的边界条件
- 是否有明显 bug
- 是否有不必要的复杂度
- 是否缺少验证
```

关键功能再加 gstack：

```text
请使用 gstack-review 审查当前 diff。

重点找：
- CI 不一定能发现的生产 bug
- 状态不一致
- 并发或重复提交问题
- 权限绕过
- 错误处理缺口
```

安全相关功能再加：

```text
请使用 gstack-cso 做一次安全审计。

重点检查：
- 鉴权
- 越权
- 输入校验
- 敏感数据
- 业务风控
- 日志是否泄露隐私
```

## 6. 阶段 E：运行和验证

基础验证：

```text
请运行项目现有的类型检查、lint、测试或构建命令。
如果没有对应命令，请先检查 package.json 或项目配置，再给出可执行验证方案。
```

Web/H5 页面验证：

```text
请启动本地开发服务，然后使用 gstack-qa 检查这个功能。

重点验证：
- 页面是否能打开
- 核心流程是否可点击完成
- 控制台是否有错误
- 移动端布局是否正常
- 错误态、空态、加载态是否正常
```

如果只是想让 AI 报告问题、不自动修：

```text
请使用 gstack-qa-only 检查页面，只输出问题报告，不要改代码。
```

uni-app 注意：

- H5 页面可以用 gstack browser/QA 验证。
- 微信/支付宝小程序原生能力，需要在对应开发者工具或真机里验证。
- 如果某个能力只能在小程序端验证，让 AI 输出手工验证步骤。

## 7. 阶段 F：完成前收尾

最后让 AI 做完成前验证。

```text
请使用 Superpowers 的 verification-before-completion 工作流做完成前检查。

确认：
- 需求是否全部完成
- 测试或替代验证是否跑过
- 是否有未提交的临时代码
- 是否有 console.log、调试开关、假数据
- 文档或配置是否需要更新
```

如果要准备发布或 PR：

```text
请使用 gstack-ship 做发布前检查。

先不要自动推送或合并，先给我报告：
- 当前 diff 摘要
- 验证结果
- 风险点
- 是否建议发布
```

## 8. 常用组合

### 小需求

```text
请实现这个小改动：
【需求】

要求：
- 先快速读相关文件
- 小范围修改
- 完成后运行最相关的验证
- 最后说明改了什么和怎么验证
```

### 中等功能

```text
先不要写代码。请用 Superpowers 帮我澄清需求并写实施计划。

需求：
【需求】

计划确认后再开始实现。
```

确认计划后：

```text
计划确认，开始实现。按计划逐步做，每步完成后验证。
```

### 大功能

```text
这是一个较大的需求。请按下面流程推进：

1. 用 gstack-office-hours 澄清产品目标
2. 用 Superpowers brainstorming 固化需求
3. 用 Superpowers writing-plans 写实施计划
4. 用 gstack-plan-eng-review 审查架构
5. 等我确认后再写代码

需求：
【需求】
```

### 修 bug

```text
请用 Superpowers 的 systematic-debugging 工作流调查这个 bug。

现象：
【bug 描述】

要求：
- 先复现或定位证据
- 不要猜测式修复
- 找到根因后再改代码
- 修完后补验证步骤
```

如果是线上/复杂问题：

```text
请使用 gstack-investigate 系统排查这个问题。
先定位根因，不要直接改。

问题：
【问题描述】
```

### UI/视觉问题

```text
请使用 gstack-design-review 检查这个页面的视觉和交互问题。

重点：
- 信息层级
- 移动端适配
- 空态/加载态/错误态
- 是否像模板化 AI UI
- 文字是否溢出或遮挡
```

## 9. 建议加入项目的 AGENTS.md

在真实项目根目录可以创建 `AGENTS.md`：

```md
# Agent Instructions

## Workflow

- For non-trivial features, clarify requirements before coding.
- Use Superpowers for brainstorming, writing plans, TDD, code review, and verification.
- Use gstack for product review, architecture review, browser QA, security audit, and shipping checks.
- Do not make broad refactors unless the task requires them.
- Prefer small, verifiable steps.

## Validation

- Run existing tests/build/lint when available.
- If no automated tests exist, provide concrete manual verification steps.
- For web/H5 pages, use browser QA where possible.
- For mini-program-only behavior, provide simulator/device verification steps.

## Safety

- Do not commit, push, deploy, or merge unless explicitly asked.
- Do not store secrets in code.
- Do not import real browser cookies unless explicitly asked.
```

## 10. 最推荐的日常说法

需求不清楚时：

```text
先不要写代码，帮我把这个需求澄清成可实现的规格，并给出最小可上线版本。
```

准备实现时：

```text
先写实施计划，列出要改的文件、步骤、测试和风险，等我确认后再写代码。
```

开始写代码时：

```text
计划确认，开始实现。小步修改，小步验证，不做计划外重构。
```

完成后：

```text
请做完成前验证，检查 diff、运行测试/构建，并说明剩余风险。
```

上线前：

```text
请用 gstack-review 和 gstack-qa 做发布前检查。先报告，不要自动发布。
```

