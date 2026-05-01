# 候选题移除 v1 实施计划

> 执行方式：使用 `superpowers:subagent-driven-development`。按后端、前端、验收文档拆分给子代理实现；每个任务完成后先审查，再进入下一步。

## 目标

在「解析结果」页面为未导入候选题提供「移除」能力。用户可以把解析错误、无意义或不想导入的候选题从审核列表移除；移除后的题不会进入题库，也不会影响原 PDF 或已经导入的题目。

## 范围

- 支持移除状态为 `ready`、`need_review`、`invalid` 的候选题。
- 不允许移除 `importing`、`imported` 的候选题。
- 使用软删除：在 `parse_candidates` 记录上写入 `deletedAt`，不物理删除数据。
- `candidateList`、`importConfirm` 默认只处理未删除候选题。
- 移除后刷新资料候选题统计，避免首页数量不一致。
- 前端移除前必须二次确认，确认后从当前列表移除该卡片。

## 不做

- 不做批量删除。
- 不删除原 PDF 文件。
- 不删除已经导入题库的题目。
- 不做恢复已移除候选题功能。

## 任务 1：后端候选题软删除

负责文件：

- `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/candidateService.js`
- `uniCloud-alipay/cloudfunctions/candidateDelete/index.js`
- `uniCloud-alipay/cloudfunctions/candidateDelete/package.json`
- `uniCloud-alipay/database/parse_candidates.schema.json`
- `tests/cloud/candidateService.spec.js`
- `tests/cloud/unicloudFunctionWrappers.spec.js`
- `tests/cloud/unicloudDatabaseSchema.spec.js`

步骤：

- [x] 在候选题服务里新增 `deleteCandidate()`。
- [x] `deleteCandidate()` 写入 `deletedAt` 和 `updatedAt`。
- [x] 已删除候选题再次删除时保持幂等，并刷新资料统计。
- [x] 阻止删除他人候选题。
- [x] 阻止删除 `importing`、`imported` 候选题。
- [x] `listCandidateRecords()` 过滤 `deletedAt`。
- [x] `getCandidateRecord()` 默认把已删除记录视为不存在，并提供内部 `includeDeleted` 选项。
- [x] 新增 `candidateDelete` 云函数入口。
- [x] 数据库 schema 增加 `deletedAt` 字段。
- [x] 覆盖后端单测和云函数包装检查。

验证命令：

```powershell
node scripts/run-bun.mjs test tests/cloud/candidateService.spec.js tests/cloud/unicloudFunctionWrappers.spec.js tests/cloud/unicloudDatabaseSchema.spec.js
```

## 任务 2：前端移除按钮与交互

负责文件：

- `common/types.ts`
- `common/api/cloud.ts`
- `components/CandidateCard.vue`
- `pages/import/review.vue`
- `tests/frontend/cloudApi.spec.ts`
- `tests/frontend/pages.spec.ts`

步骤：

- [x] `Candidate` 类型增加 `deletedAt?: string`。
- [x] `api` 增加 `candidateDelete(candidateId)`。
- [x] `CandidateCard` 增加 `remove` 事件。
- [x] 非 `importing`、非 `imported` 的候选题显示「移除」按钮。
- [x] `importing` 状态只显示「导入中」，不显示编辑或移除。
- [x] `imported` 状态只显示「已导入」。
- [x] 审核页点击移除时弹出二次确认。
- [x] 确认后调用 `api.candidateDelete()` 并从本地列表移除。
- [x] 删除确认中、删除中禁止确认导入，避免删除和导入并发。
- [x] 卡片标题、状态和按钮布局在窄屏不互相挤压。
- [x] 覆盖前端 API 和页面结构测试。

验证命令：

```powershell
node scripts/run-bun.mjs test tests/frontend/cloudApi.spec.ts tests/frontend/pages.spec.ts
```

## 任务 3：中文手工验收文档

负责文件：

- `docs/manual-qa/candidate-remove-v1.md`

步骤：

- [x] 写清楚 HBuilderX 需要上传的云函数和公共模块。
- [x] 写清楚测试准备条件。
- [x] 写清楚移除不可导入题、可导入题、取消移除、确认导入后的验收步骤。
- [x] 写清楚通过标准和失败时检查点。

## 总体验证

完成所有任务后运行：

```powershell
node scripts/run-bun.mjs test
npm.cmd run build:mp-weixin
```

通过标准：

- 所有测试通过。
- 微信小程序构建成功。
- 解析结果页可以移除未导入候选题。
- 被移除候选题不会出现在后续导入结果中。
- 已导入和导入中的候选题不能被移除。
