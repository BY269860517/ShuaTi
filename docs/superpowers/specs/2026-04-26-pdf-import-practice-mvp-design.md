# PDF 原题导入刷题小程序 MVP 规格

日期：2026-04-26  
来源需求：`doc/需求文档.md`  
阶段：Superpowers brainstorming 规格文档，等待用户确认后再写实施计划  

## 1. 产品目标

本 MVP 的目标是验证一条最小但完整的用户价值链：

用户上传结构化文本 PDF 后，系统按规则解析出客观题，用户在导入前完成预览与必要修正，确认导入题库后可以立即刷题、提交答案并查看结果。

产品成功标准不是一次性覆盖所有题型和学习系统，而是先把“PDF 原题进入可刷题库”的闭环做稳定。v1 必须让用户能判断：自己的 PDF 是否能被解析、解析结果哪里需要修正、导入后能不能真实完成练习。

## 2. v1 范围决策

### 进入 v1

- 微信小程序端，基于 uni-app + Vue 3。
- 云端基于微信云开发 / CloudBase：云函数、数据库、云存储。
- 用户上传文本型 PDF。
- 后端解析 PDF 文本，不做 OCR，不做 AI。
- 只支持客观题：单选、多选、判断。
- 只支持两种稳定解析模式：
  - `inline_answer`：题干或题块内包含答案/解析。
  - `answer_at_end`：题目与选项在前，答案区集中在文末。
- 用户可查看解析候选题状态，编辑单个候选题，再确认导入。
- 用户可从已导入题目创建练习、答题、提交、查看结果。
- 后端记录练习会话与答题记录。

### 不进入 v1

- OCR 扫描件识别。
- AI 解析、AI 纠错、AI 出题。
- 主观题、填空题、材料题、图片题。
- 错题本、掌握度、复习计划、学习统计大盘。
- `wrong_questions` 集合和相关云函数。
- `auto` 和 `question_only` 的完整解析实现。
- 复杂候选题批量操作、复杂筛选、忽略工作流。
- 完整删除级联、回收站、多人共享题库。
- Web 管理后台。

## 3. 核心用户流程

### 3.1 首次进入

1. 小程序启动后调用 `userLogin`。
2. 云函数通过 `cloud.getWXContext().OPENID` 获取用户身份。
3. 用户进入首页，看到自己的资料列表、空状态或解析中的材料。

### 3.2 上传 PDF

1. 用户在上传页选择 PDF。
2. 前端使用 `wx.cloud.uploadFile` 上传到云存储。
3. 前端调用 `materialCreate`，只提交文件元信息和 `fileID`。
4. 后端创建 `materials` 记录，`status = uploaded`。
5. 前端调用 `parseStart` 创建解析任务。

### 3.3 解析

1. `parseStart` 创建或复用当前材料的 `parse_jobs`。
2. `parseRunner` 执行实际解析。
3. 后端读取云存储 PDF，提取文本。
4. 规则解析器生成 `parse_candidates`。
5. 后端根据候选题质量标记状态：
   - `ready`：题干、选项、题型、答案满足导入条件。
   - `need_review`：可识别题目但答案、题型或解析信息需要用户确认。
   - `invalid`：题块无法形成可导入客观题。
6. 材料进入 `reviewing` 或 `ready` 状态。

### 3.4 预览、编辑、确认导入

1. 用户进入材料详情页查看解析摘要。
2. 用户进入候选题审核页。
3. 用户可以打开单个候选题编辑页，修正题干、选项、答案、解析和题型。
4. 编辑通过后，候选题状态可变为 `ready`。
5. 用户确认导入时，`importConfirm` 只导入 `ready` 且尚未导入的候选题。
6. 每个候选题导入成功后写入 `importedQuestionId`，避免重复导入。

### 3.5 刷题

1. 用户选择材料或题库范围创建练习。
2. `practiceCreate` 创建 `practice_sessions`。
3. `practiceDetail` 返回题目、选项、题型，但不能返回 `answerKeys`。
4. 用户提交答案到 `answerSubmit`。
5. 后端读取题目答案并判题，写入 `attempts`。
6. 前端展示本次答题结果、正确答案和解析。

## 4. 信息架构

### 页面

- `pages/index/index`：资料列表、解析状态、进入上传和练习入口。
- `pages/upload/index`：选择 PDF、上传、创建材料、启动解析。
- `pages/material/detail`：材料摘要、解析进度、进入候选题审核、进入练习。
- `pages/import/review`：候选题列表，显示 `ready / need_review / invalid / imported`。
- `pages/import/edit`：单题候选编辑。
- `pages/practice/setup`：选择练习范围和题量。
- `pages/practice/do`：答题页。
- `pages/practice/result`：本次练习结果。

### 组件

- `MaterialCard`：材料名称、状态、题量摘要、最近更新时间。
- `StatusBadge`：解析和候选题状态。
- `CandidateCard`：候选题摘要、题型、状态、编辑入口。
- `QuestionCard`：题干、选项、答题状态。
- `OptionList`：单选、多选、判断题选项。
- `EmptyState`：无材料、无候选、无题目。
- `LoadingState`：上传、解析、提交中的等待状态。
- `ErrorState`：可恢复错误说明和重试入口。

## 5. 云函数边界

### 用户与材料

- `userLogin`
  - 创建或更新当前用户。
  - 只信任服务端 `OPENID`。
- `materialCreate`
  - 创建材料记录。
  - 写入 `ownerOpenid`、`fileID`、文件名、大小、初始状态。
- `materialList`
  - 只返回当前用户自己的材料。
- `materialDetail`
  - 返回当前用户自己的材料摘要、解析状态和导入统计。

### 解析

- `parseStart`
  - 为材料创建解析任务。
  - 如果已有 `pending / running / done` 任务，返回已有任务状态。
- `parseRunner`
  - 后端解析执行器。
  - 使用 `job.status + lockUntil` 保证同一任务不会并发执行。
  - 解析完成后写入候选题和统计信息。
- `parseStatus`
  - 返回材料和解析任务当前状态。

### 候选题审核

- `candidateList`
  - 按材料返回候选题列表。
  - 默认返回必要摘要，避免列表页过重。
- `candidateDetail`
  - 返回单个候选题完整内容。
- `candidateUpdate`
  - 保存用户修正后的候选题。
  - 后端重新校验题型、选项和答案，决定是否为 `ready`。
- `importConfirm`
  - 只导入 `ready` 且 `importedQuestionId` 为空的候选题。
  - 每题独立幂等，允许部分成功后重试。

### 题库与练习

- `questionList`
  - 返回当前用户已导入题目摘要。
- `practiceCreate`
  - 根据材料或题库范围创建练习会话。
- `practiceDetail`
  - 返回练习题目但不返回正确答案字段。
- `answerSubmit`
  - 后端判题。
  - 写入 `attempts`，更新本次 `practice_sessions` 摘要。
  - 返回是否正确、正确答案和解析。

## 6. 数据模型

### `users`

- `_id`
- `openid`
- `createdAt`
- `updatedAt`

### `materials`

- `_id`
- `ownerOpenid`
- `fileID`
- `fileName`
- `fileSize`
- `status`: `uploaded | parsing | reviewing | ready | failed`
- `parseMode`: `inline_answer | answer_at_end`
- `questionCount`
- `readyCandidateCount`
- `needReviewCandidateCount`
- `invalidCandidateCount`
- `errorMessage`
- `createdAt`
- `updatedAt`

### `parse_jobs`

- `_id`
- `materialId`
- `ownerOpenid`
- `status`: `pending | running | done | failed`
- `lockUntil`
- `startedAt`
- `finishedAt`
- `errorMessage`
- `stats`
- `createdAt`
- `updatedAt`

### `material_pages`

- `_id`
- `materialId`
- `ownerOpenid`
- `pageNo`
- `text`
- `createdAt`

### `parse_candidates`

- `_id`
- `materialId`
- `ownerOpenid`
- `sourcePageNo`
- `sourceText`
- `questionNo`
- `type`: `single | multiple | judge`
- `stem`
- `options`: `{ key, text }[]`
- `answerKeys`: `string[]`
- `explanation`
- `status`: `ready | need_review | invalid | imported`
- `validationErrors`
- `importedQuestionId`
- `createdAt`
- `updatedAt`

### `questions`

- `_id`
- `ownerOpenid`
- `materialId`
- `candidateId`
- `type`: `single | multiple | judge`
- `stem`
- `options`: `{ key, text }[]`
- `answerKeys`: `string[]`
- `explanation`
- `sourcePageNo`
- `createdAt`
- `updatedAt`

### `practice_sessions`

- `_id`
- `ownerOpenid`
- `materialId`
- `questionIds`
- `status`: `active | submitted`
- `totalCount`
- `correctCount`
- `startedAt`
- `submittedAt`
- `createdAt`
- `updatedAt`

### `attempts`

- `_id`
- `ownerOpenid`
- `sessionId`
- `questionId`
- `selectedKeys`
- `isCorrect`
- `createdAt`

## 7. 架构与数据流

```text
Mini Program
  |
  | wx.cloud.uploadFile
  v
Cloud Storage: PDF
  |
  | materialCreate / parseStart / parseRunner
  v
Cloud Functions
  |
  | pdf text extraction + rule parser
  v
parse_candidates
  |
  | review / edit / importConfirm
  v
questions
  |
  | practiceCreate / practiceDetail / answerSubmit
  v
practice_sessions + attempts
```

解析任务状态：

```text
pending -> running -> done
pending -> running -> failed
```

材料状态：

```text
uploaded -> parsing -> reviewing -> ready
uploaded -> parsing -> failed
```

候选题状态：

```text
ready -> imported
need_review -> ready -> imported
invalid -> ready -> imported
```

## 8. 解析器规则

解析器必须是可单元测试的纯函数模块，和 CloudBase API 解耦。

### 输入

- PDF 提取后的纯文本。
- 解析模式：`inline_answer` 或 `answer_at_end`。

### 输出

- 标准化候选题数组。
- 每个候选题包含题干、选项、题型、答案、解析、来源文本、校验状态和校验错误。

### `inline_answer`

适用于每道题附近有答案或解析的 PDF，例如：

```text
1. 下列说法正确的是（ ）
A. ...
B. ...
答案：A
解析：...
```

### `answer_at_end`

适用于题目集中在前、答案集中在文末的 PDF，例如：

```text
1. ...
A. ...
B. ...

参考答案
1.A
2.BC
```

### 校验规则

- 单选题必须只有一个答案。
- 多选题可以有多个答案。
- 判断题答案归一化为两个选项之一，例如 `正确/错误` 或 `A/B`。
- 答案必须能匹配选项 key。
- 没有答案的候选题不能直接导入，状态为 `need_review`。
- 题干或选项缺失的候选题为 `invalid`。

## 9. 安全与权限

- 所有云函数必须通过 `cloud.getWXContext().OPENID` 获取当前用户。
- 前端传入的 `ownerOpenid` 一律不能作为权限依据。
- 所有集合查询必须带 `ownerOpenid` 过滤。
- 云存储路径可以包含 openid 作为组织方式，但访问控制仍以云函数校验为准。
- `practiceDetail` 不返回 `answerKeys`。
- `answerSubmit` 必须由后端判题，不能信任前端提交的正确答案。
- 候选题和题目编辑只能操作当前用户自己的数据。

## 10. 幂等与失败处理

### 解析幂等

- `parseStart` 对同一材料只创建一个有效任务。
- `parseRunner` 只有在任务未完成且锁未过期时才获取执行权。
- 如果任务已经 `done`，再次调用返回已有统计信息。
- v1 不实现“重新解析覆盖旧候选题”；需要重新解析时用户重新上传 PDF。

### 导入幂等

- `importConfirm` 按候选题逐条导入。
- 候选题必须满足：
  - 属于当前用户。
  - `status = ready`。
  - `importedQuestionId` 为空。
- 创建题目成功后立即回写候选题 `importedQuestionId` 和 `status = imported`。
- 如果部分导入成功后请求失败，用户再次确认时只补导未导入题目。

### 用户可见错误

- 上传失败：提示重新上传。
- PDF 无文本：提示当前文件可能是扫描件，v1 不支持 OCR。
- 解析失败：显示失败原因和重新上传入口。
- 无可导入题：提示需要编辑候选题或更换 PDF。
- 提交失败：保留当前选择，允许重试。

## 11. 测试与验收

### 单元测试优先级

- `inline_answer` 单选题解析。
- `inline_answer` 多选题解析。
- `inline_answer` 判断题解析。
- `answer_at_end` 集中答案匹配。
- 无答案题进入 `need_review`。
- 缺少题干或选项进入 `invalid`。
- 答案 key 归一化。

### 云函数测试重点

- `materialCreate` 使用服务端 openid 写入 owner。
- `materialList` 不返回其他用户材料。
- `parseRunner` 并发调用只执行一次。
- `importConfirm` 重复调用不重复创建题目。
- `practiceDetail` 不泄漏 `answerKeys`。
- `answerSubmit` 后端判题并写入 `attempts`。

### 手工验收

1. 上传一份文本 PDF。
2. 能看到材料进入解析中。
3. 解析完成后能看到候选题列表。
4. 能编辑一题 `need_review` 候选题并变为 `ready`。
5. 能确认导入 `ready` 题目。
6. 能创建一次练习。
7. 答题页看不到正确答案。
8. 提交后能看到对错、正确答案和解析。
9. 再次确认导入不会重复创建已导入题。

## 12. 实施约束

- 先建立解析器纯函数和测试，再接入云函数。
- 云函数 API 入参保持小而明确，避免把整份候选题列表从前端一次性提交给后端。
- 前端页面先实现基础可用，不做复杂动效和统计大盘。
- v1 不依赖任何需要额外付费或外部密钥的 AI/OCR 服务。
- 云环境 ID、集合权限、上传大小限制在实施计划中落到具体配置。

## 13. 规格自检

- 无未决占位符：本文没有未完成章节、占位说明或模糊留白。
- 范围一致：v1 只覆盖 PDF 文本解析、候选审核、导入、练习、提交结果。
- 安全一致：所有用户身份均由云函数服务端 openid 决定。
- 实现边界清晰：错题本、OCR、AI、复杂统计和重新解析均明确延期。
- 可测试性明确：解析器必须独立成纯函数，先用 fixtures 做单元测试。
