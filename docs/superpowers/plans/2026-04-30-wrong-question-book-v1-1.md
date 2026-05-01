# ShuaTi v1.1 错题本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 PDF 导入刷题 MVP 上新增轻量“我的”页面和错题本闭环：答错自动入错题、可查看错题、可像普通题库一样创建错题练习。

**Architecture:** 复用当前 `practice_sessions.questionIds`、`practiceDetail`、`pages/practice/do` 和 `pages/practice/result`，只新增 `wrong_questions` 作为错题索引层。`answerSubmit` 在后端判题后同步维护错题状态，`wrongPracticeCreate` 从 active 错题生成普通练习会话，前端错题练习继续走现有答题页。

**Tech Stack:** uni-app + Vue 3 + TypeScript 前端，DCloud `uniCloud-alipay` 普通云函数，`shuati-shared` CommonJS 服务模块，Vitest 云服务和前端静态测试。

---

## Scope

### In Scope

- 新增 `pages/profile/index` 作为“我的”页面。
- 新增 `pages/wrong/index` 作为错题列表页。
- 答错自动创建或更新 `wrong_questions`。
- 同一道题多次答错不重复创建错题，只增加 `wrongCount`。
- 复刷错题答对后增加 `correctStreak`。
- `correctStreak >= 3` 后自动标记为 `mastered`。
- 支持按全部错题或单个资料错题创建练习。
- 错题练习复用 `pages/practice/do` 和 `pages/practice/result`。
- 增加必要云函数、类型、API 封装、测试、手动 QA 文档。

### Out of Scope

- 不做复杂学习统计大盘。
- 不做复习计划、每日提醒、间隔重复算法。
- 不做排行榜、分享、会员、社交。
- 不做手动收藏题、标签体系、难度体系。
- 不改变 PDF 解析、候选题审核、题库导入主流程。
- 不改变 uniCloud 支付宝云迁移架构。

## Current State

- `pages/practice/do.vue` 已经通过 `api.answerSubmit()` 提交答案。
- `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js` 已经后端判题并写入 `attempts`。
- `practice_sessions` 保存 `questionIds`，所以错题练习可以创建一条新的 session，不需要复制题目。
- 当前 `PracticeSession` 类型没有 `mode` 字段，结果页只能通过 `materialId` 判断“重练同一材料”。
- 当前没有 `wrong_questions` schema、服务、云函数和页面。
- `docs/superpowers/specs/2026-04-29-unicloud-alipay-migration-design.md` 明确迁移阶段不做错题本。本计划是迁移稳定后的 v1.1 功能计划。

## File Structure

Create:

```text
pages/profile/index.vue
pages/wrong/index.vue
uniCloud-alipay/database/wrong_questions.schema.json
uniCloud-alipay/cloudfunctions/wrongList/index.js
uniCloud-alipay/cloudfunctions/wrongList/package.json
uniCloud-alipay/cloudfunctions/wrongPracticeCreate/index.js
uniCloud-alipay/cloudfunctions/wrongPracticeCreate/package.json
uniCloud-alipay/cloudfunctions/wrongMarkMastered/index.js
uniCloud-alipay/cloudfunctions/wrongMarkMastered/package.json
uniCloud-alipay/cloudfunctions/common/shuati-shared/services/wrongService.js
tests/cloud/wrongService.spec.js
docs/manual-qa/wrong-question-book-v1-1.md
```

Modify:

```text
pages.json
common/types.ts
common/api/cloud.ts
pages/index/index.vue
pages/material/detail.vue
pages/practice/result.vue
uniCloud-alipay/database/practice_sessions.schema.json
uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js
tests/cloud/practiceService.spec.js
tests/cloud/unicloudDatabaseSchema.spec.js
tests/cloud/unicloudFunctionWrappers.spec.js
tests/frontend/cloudApi.spec.ts
tests/frontend/pages.spec.ts
tests/frontend/types.spec.ts
```

## Data Model Decisions

### `wrong_questions`

Use one active/mastered/ignored record per user and question.

```js
{
  _id: `wrong_${questionId}`,
  ownerOpenid: 'uid_a',
  questionId: 'questions_1',
  materialId: 'material_1',
  status: 'active',
  wrongCount: 1,
  correctStreak: 0,
  lastWrongAt: '2026-04-30T00:00:00.000Z',
  masteredAt: '',
  ignoredAt: '',
  createdAt: '2026-04-30T00:00:00.000Z',
  updatedAt: '2026-04-30T00:00:00.000Z'
}
```

Status values:

- `active`: 当前错题本内。
- `mastered`: 连续答对 3 次后自动掌握，默认不进入错题练习。
- `ignored`: 保留给后续“移出错题本”，v1.1 不做 UI 入口。

### `practice_sessions.mode`

Add optional mode:

- `material`: 普通题库练习。
- `wrong`: 错题练习。

Existing sessions without `mode` are treated as `material`.

For all-material wrong practice:

```js
{
  mode: 'wrong',
  materialId: '',
  questionIds: ['questions_1', 'questions_2']
}
```

For one material's wrong practice:

```js
{
  mode: 'wrong',
  materialId: 'material_1',
  questionIds: ['questions_1']
}
```

## Task 1: Shared Types, Routes, And Frontend API Contract

**Files:**
- Modify: `common/types.ts`
- Modify: `common/api/cloud.ts`
- Modify: `pages.json`
- Modify: `tests/frontend/types.spec.ts`
- Modify: `tests/frontend/cloudApi.spec.ts`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Write failing frontend type tests**

Add to `tests/frontend/types.spec.ts`:

```ts
import type { PracticeSession, WrongQuestionItem } from '../../common/types'

test('wrong question item exposes minimal review and practice metadata', () => {
  const item: WrongQuestionItem = {
    _id: 'wrong_questions_1',
    questionId: 'questions_1',
    materialId: 'material_1',
    status: 'active',
    wrongCount: 2,
    correctStreak: 1,
    lastWrongAt: '2026-04-30T00:00:00.000Z',
    masteredAt: '',
    question: {
      _id: 'questions_1',
      materialId: 'material_1',
      type: 'single',
      stem: '题干',
      options: [{ key: 'A', text: '选项 A' }],
    },
  }

  expect(item.status).toBe('active')
  expect(item.question.answerKeys).toBeUndefined()
})

test('practice session can identify wrong-practice mode', () => {
  const session: Pick<PracticeSession, 'mode' | 'materialId'> = {
    mode: 'wrong',
    materialId: '',
  }

  expect(session.mode).toBe('wrong')
})
```

- [ ] **Step 2: Run the failing type tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/types.spec.ts
```

Expected: fails because `WrongQuestionItem` and `PracticeSession.mode` are not defined.

- [ ] **Step 3: Extend `common/types.ts`**

Add these types:

```ts
export type WrongQuestionStatus = 'active' | 'mastered' | 'ignored'

export type PracticeSessionMode = 'material' | 'wrong'

export interface WrongQuestion {
  _id: string
  ownerOpenid?: string
  questionId: string
  materialId: string
  status: WrongQuestionStatus
  wrongCount: number
  correctStreak: number
  lastWrongAt: string
  masteredAt: string
  ignoredAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface WrongQuestionItem extends Omit<WrongQuestion, 'ownerOpenid'> {
  question: SafeQuestion
}
```

Modify `PracticeSession`:

```ts
export interface PracticeSession {
  _id: string
  materialId: string
  questionIds: string[]
  status: PracticeSessionStatus
  totalCount: number
  correctCount: number
  startedAt: string
  submittedAt: string
  createdAt: string
  updatedAt: string
  ownerOpenid?: string
  mode?: PracticeSessionMode
}
```

- [ ] **Step 4: Write failing cloud API tests**

Add to `tests/frontend/cloudApi.spec.ts`:

```ts
test('wrongList calls cloud function with optional filters', async () => {
  const callFunctionMock = vi.fn().mockResolvedValue({
    result: {
      ok: true,
      data: {
        wrongQuestions: [
          {
            _id: 'wrong_1',
            questionId: 'questions_1',
            materialId: 'material_1',
            status: 'active',
            wrongCount: 1,
            correctStreak: 0,
            lastWrongAt: '2026-04-30T00:00:00.000Z',
            masteredAt: '',
            question: {
              _id: 'questions_1',
              materialId: 'material_1',
              type: 'single',
              stem: '题干',
              options: [],
            },
          },
        ],
      },
    },
  })
  globalThis.uniCloud = { callFunction: callFunctionMock }
  globalThis.uni = {
    login: vi.fn(),
    getStorageSync: vi.fn().mockReturnValue('token_a'),
    setStorageSync: vi.fn(),
  }

  await expect(api.wrongList({ status: 'active', materialId: 'material_1' })).resolves.toMatchObject({
    wrongQuestions: [{ questionId: 'questions_1', status: 'active' }],
  })
  expect(callFunctionMock).toHaveBeenCalledWith({
    name: 'wrongList',
    data: {
      status: 'active',
      materialId: 'material_1',
      _uniToken: 'token_a',
      uniToken: 'token_a',
    },
  })
})

test('wrongPracticeCreate creates a normal practice session from wrong questions', async () => {
  const callFunctionMock = vi.fn().mockResolvedValue({
    result: {
      ok: true,
      data: {
        session: {
          _id: 'practice_sessions_1',
          materialId: '',
          mode: 'wrong',
          questionIds: ['questions_1'],
          status: 'active',
          totalCount: 1,
          correctCount: 0,
          startedAt: '2026-04-30T00:00:00.000Z',
          submittedAt: '',
          createdAt: '2026-04-30T00:00:00.000Z',
          updatedAt: '2026-04-30T00:00:00.000Z',
        },
      },
    },
  })
  globalThis.uniCloud = { callFunction: callFunctionMock }
  globalThis.uni = {
    login: vi.fn(),
    getStorageSync: vi.fn().mockReturnValue('token_a'),
    setStorageSync: vi.fn(),
  }

  await expect(api.wrongPracticeCreate({ count: 10 })).resolves.toMatchObject({
    session: { _id: 'practice_sessions_1', mode: 'wrong' },
  })
  expect(callFunctionMock).toHaveBeenCalledWith({
    name: 'wrongPracticeCreate',
    data: { count: 10, _uniToken: 'token_a', uniToken: 'token_a' },
  })
})
```

- [ ] **Step 5: Run the failing API tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/cloudApi.spec.ts
```

Expected: fails because `api.wrongList` and `api.wrongPracticeCreate` do not exist.

- [ ] **Step 6: Extend `common/api/cloud.ts`**

Add imports:

```ts
import type { WrongQuestionItem, WrongQuestionStatus } from '../types'
```

Add interfaces:

```ts
export interface WrongListInput {
  status?: WrongQuestionStatus
  materialId?: string
}

export interface WrongPracticeCreateInput {
  materialId?: string
  count: number
}
```

Add API methods:

```ts
wrongList: (data: WrongListInput = {}) =>
  callFunction<{ wrongQuestions: WrongQuestionItem[] }>('wrongList', data),
wrongPracticeCreate: (data: WrongPracticeCreateInput) =>
  callFunction<{ session: PracticeSession }>('wrongPracticeCreate', data),
wrongMarkMastered: (wrongQuestionId: string) =>
  callFunction<{ wrongQuestion: WrongQuestionItem }>('wrongMarkMastered', { wrongQuestionId }),
```

- [ ] **Step 7: Write failing route tests**

Modify `tests/frontend/pages.spec.ts` route test to include:

```ts
expect(paths).toContain('pages/profile/index')
expect(paths).toContain('pages/wrong/index')
```

Add page existence test:

```ts
test('profile and wrong-question pages exist', () => {
  expect(existsSync('pages/profile/index.vue')).toBe(true)
  expect(existsSync('pages/wrong/index.vue')).toBe(true)
})
```

- [ ] **Step 8: Run the failing route tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: fails because the routes and files do not exist.

- [ ] **Step 9: Register pages in `pages.json`**

Add after `pages/index/index`:

```json
{
  "path": "pages/profile/index",
  "style": { "navigationBarTitleText": "我的" }
},
{
  "path": "pages/wrong/index",
  "style": { "navigationBarTitleText": "错题本" }
}
```

- [ ] **Step 10: Run frontend contract tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/types.spec.ts tests/frontend/cloudApi.spec.ts tests/frontend/pages.spec.ts
```

Expected: type/API tests pass except page source tests that depend on later page implementation.

## Task 2: Database Schema And Cloud Function Wrapper Contracts

**Files:**
- Create: `uniCloud-alipay/database/wrong_questions.schema.json`
- Modify: `uniCloud-alipay/database/practice_sessions.schema.json`
- Create: `uniCloud-alipay/cloudfunctions/wrongList/index.js`
- Create: `uniCloud-alipay/cloudfunctions/wrongList/package.json`
- Create: `uniCloud-alipay/cloudfunctions/wrongPracticeCreate/index.js`
- Create: `uniCloud-alipay/cloudfunctions/wrongPracticeCreate/package.json`
- Create: `uniCloud-alipay/cloudfunctions/wrongMarkMastered/index.js`
- Create: `uniCloud-alipay/cloudfunctions/wrongMarkMastered/package.json`
- Modify: `tests/cloud/unicloudDatabaseSchema.spec.js`
- Modify: `tests/cloud/unicloudFunctionWrappers.spec.js`

- [ ] **Step 1: Write failing database schema tests**

Add to `tests/cloud/unicloudDatabaseSchema.spec.js`:

```js
it('declares wrong questions schema for server-only access', () => {
  const schema = JSON.parse(readFileSync('uniCloud-alipay/database/wrong_questions.schema.json', 'utf8'))

  expect(schema.required).toEqual(expect.arrayContaining([
    'ownerOpenid',
    'questionId',
    'materialId',
    'status',
    'wrongCount',
    'correctStreak',
    'lastWrongAt',
    'createdAt',
    'updatedAt',
  ]))
  expect(schema.permission).toMatchObject({
    read: false,
    create: false,
    update: false,
    delete: false,
    count: false,
  })
  expect(schema.properties.status).toMatchObject({ bsonType: 'string' })
})

it('allows practice sessions to record wrong-practice mode', () => {
  const schema = JSON.parse(readFileSync('uniCloud-alipay/database/practice_sessions.schema.json', 'utf8'))

  expect(schema.properties.mode).toMatchObject({ bsonType: 'string' })
})
```

- [ ] **Step 2: Run the failing schema tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: fails because `wrong_questions.schema.json` and `practice_sessions.properties.mode` do not exist.

- [ ] **Step 3: Create `wrong_questions.schema.json`**

Write:

```json
{
  "bsonType": "object",
  "required": ["ownerOpenid", "questionId", "materialId", "status", "wrongCount", "correctStreak", "lastWrongAt", "createdAt", "updatedAt"],
  "permission": {
    "read": false,
    "create": false,
    "update": false,
    "delete": false,
    "count": false
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "ownerOpenid": { "bsonType": "string" },
    "questionId": { "bsonType": "string" },
    "materialId": { "bsonType": "string" },
    "status": { "bsonType": "string" },
    "wrongCount": { "bsonType": "number" },
    "correctStreak": { "bsonType": "number" },
    "lastWrongAt": { "bsonType": "string" },
    "masteredAt": { "bsonType": "string" },
    "ignoredAt": { "bsonType": "string" },
    "createdAt": { "bsonType": "string" },
    "updatedAt": { "bsonType": "string" }
  }
}
```

- [ ] **Step 4: Add `mode` to `practice_sessions.schema.json`**

Add:

```json
"mode": { "bsonType": "string" }
```

Keep `mode` out of `required` so existing sessions remain valid.

- [ ] **Step 5: Write failing wrapper tests**

Modify `tests/cloud/unicloudFunctionWrappers.spec.js`:

```js
const functions = [
  'materialCreate',
  'materialList',
  'materialDetail',
  'parseStart',
  'parseRunner',
  'parseStatus',
  'candidateList',
  'candidateDetail',
  'candidateUpdate',
  'importConfirm',
  'questionList',
  'practiceCreate',
  'practiceDetail',
  'answerSubmit',
  'wrongList',
  'wrongPracticeCreate',
  'wrongMarkMastered',
]
```

- [ ] **Step 6: Run the failing wrapper tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/unicloudFunctionWrappers.spec.js
```

Expected: fails because new cloud function directories do not exist.

- [ ] **Step 7: Create cloud function wrappers**

`uniCloud-alipay/cloudfunctions/wrongList/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listWrongQuestions } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const wrongQuestions = await listWrongQuestions({
      db,
      openid: uid,
      materialId: event.materialId,
      status: event.status,
    })
    return ok({ wrongQuestions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

`uniCloud-alipay/cloudfunctions/wrongPracticeCreate/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { createWrongPractice } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const session = await createWrongPractice({
      db,
      openid: uid,
      materialId: event.materialId,
      count: event.count,
      now,
    })
    return ok({ session })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

`uniCloud-alipay/cloudfunctions/wrongMarkMastered/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { markWrongQuestionMastered } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const wrongQuestion = await markWrongQuestionMastered({
      db,
      openid: uid,
      wrongQuestionId: event.wrongQuestionId,
      now,
    })
    return ok({ wrongQuestion })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Each new `package.json`:

```json
{
  "name": "wrong-list",
  "version": "1.0.0",
  "dependencies": {
    "shuati-shared": "file:../common/shuati-shared"
  }
}
```

Use names `wrong-practice-create` and `wrong-mark-mastered` for the other two function packages.

- [ ] **Step 8: Run schema and wrapper tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/unicloudDatabaseSchema.spec.js tests/cloud/unicloudFunctionWrappers.spec.js
```

Expected: passes once `wrongService.js` exists in a later task or wrapper tests only inspect source/package files.

## Task 3: Wrong Question Service

**Files:**
- Create: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/wrongService.js`
- Test: `tests/cloud/wrongService.spec.js`
- May modify: `tests/cloud/fakeDb.js` only if a test needs query/update behavior not already supported.

- [ ] **Step 1: Write failing service tests**

Create `tests/cloud/wrongService.spec.js`:

```js
const { createFakeDb } = require('./fakeDb')
const { sharedModule } = require('./sharedModules')
const {
  createWrongPractice,
  listWrongQuestions,
  markWrongQuestionMastered,
  recordWrongQuestionResult,
} = sharedModule('services/wrongService')

async function seedQuestion(db, overrides = {}) {
  const result = await db.collection('questions').add({
    data: {
      ownerOpenid: 'user_a',
      materialId: 'material_1',
      candidateId: 'candidate_1',
      type: 'single',
      stem: '题目',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answerKeys: ['A'],
      explanation: '解析',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

describe('wrong question service', () => {
  it('creates an active wrong question when a submitted answer is incorrect', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)

    const wrong = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    expect(wrong).toMatchObject({
      ownerOpenid: 'user_a',
      questionId,
      materialId: 'material_1',
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastWrongAt: '2026-04-30T00:00:01.000Z',
    })
  })

  it('updates the same wrong question instead of creating duplicates', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)

    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:02.000Z',
    })

    const rows = await db.collection('wrong_questions').where({ ownerOpenid: 'user_a', questionId }).get()
    expect(rows.data).toHaveLength(1)
    expect(rows.data[0]).toMatchObject({
      wrongCount: 2,
      correctStreak: 0,
      lastWrongAt: '2026-04-30T00:00:02.000Z',
    })
  })

  it('increments correct streak and marks mastered after three correct wrong-practice answers', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)

    await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: false, now: '2026-04-30T00:00:01.000Z' })
    await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: true, now: '2026-04-30T00:00:02.000Z' })
    await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: true, now: '2026-04-30T00:00:03.000Z' })
    const wrong = await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: true, now: '2026-04-30T00:00:04.000Z' })

    expect(wrong).toMatchObject({
      status: 'mastered',
      correctStreak: 3,
      masteredAt: '2026-04-30T00:00:04.000Z',
    })
  })

  it('lists only the current user active wrong questions with safe question fields', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await seedQuestion(db, { ownerOpenid: 'user_b', materialId: 'material_2' })
    await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: false, now: '2026-04-30T00:00:01.000Z' })

    const wrongQuestions = await listWrongQuestions({ db, openid: 'user_a', status: 'active' })

    expect(wrongQuestions).toHaveLength(1)
    expect(wrongQuestions[0].question.answerKeys).toBeUndefined()
    expect(wrongQuestions[0].question.explanation).toBeUndefined()
  })

  it('creates a wrong-practice session from active wrong questions', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: false, now: '2026-04-30T00:00:01.000Z' })

    const session = await createWrongPractice({
      db,
      openid: 'user_a',
      count: 10,
      now: '2026-04-30T00:00:02.000Z',
    })

    expect(session).toMatchObject({
      ownerOpenid: 'user_a',
      mode: 'wrong',
      materialId: '',
      questionIds: [questionId],
      totalCount: 1,
      correctCount: 0,
      status: 'active',
    })
  })

  it('throws a localized error when there are no active wrong questions', async () => {
    const db = createFakeDb()

    await expect(createWrongPractice({
      db,
      openid: 'user_a',
      count: 10,
      now: '2026-04-30T00:00:02.000Z',
    })).rejects.toMatchObject({
      code: 'wrong_no_questions',
      message: '暂无可练习错题',
    })
  })

  it('marks an owned wrong question as mastered manually', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    const wrong = await recordWrongQuestionResult({ db, openid: 'user_a', questionId, isCorrect: false, now: '2026-04-30T00:00:01.000Z' })

    const mastered = await markWrongQuestionMastered({
      db,
      openid: 'user_a',
      wrongQuestionId: wrong._id,
      now: '2026-04-30T00:00:02.000Z',
    })

    expect(mastered).toMatchObject({
      status: 'mastered',
      masteredAt: '2026-04-30T00:00:02.000Z',
    })
  })
})
```

- [ ] **Step 2: Run the failing service tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/wrongService.spec.js
```

Expected: fails because `services/wrongService.js` does not exist.

- [ ] **Step 3: Create `wrongService.js`**

Implement these exported functions:

```js
function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function hideAnswer(question) {
  const { answerKeys, explanation, ...safeQuestion } = question
  return safeQuestion
}

function createWrongQuestionId(questionId) {
  return `wrong_${questionId}`
}

async function getQuestionForOwner({ db, openid, questionId }) {
  const result = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
  const question = result.data[0]
  if (!question) throw createError('question_not_found', '题目不存在')
  return question
}

async function getWrongQuestion({ db, openid, questionId }) {
  const result = await db.collection('wrong_questions').where({
    _id: createWrongQuestionId(questionId),
    ownerOpenid: openid,
  }).get()
  return result.data[0] || null
}

async function recordWrongQuestionResult({ db, openid, questionId, isCorrect, now }) {
  const question = await getQuestionForOwner({ db, openid, questionId })
  const existing = await getWrongQuestion({ db, openid, questionId })

  if (!existing && isCorrect) return null

  if (!existing) {
    const data = {
      _id: createWrongQuestionId(questionId),
      ownerOpenid: openid,
      questionId,
      materialId: question.materialId || '',
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastWrongAt: now,
      masteredAt: '',
      ignoredAt: '',
      createdAt: now,
      updatedAt: now,
    }
    const created = await db.collection('wrong_questions').add({ data })
    return { ...data, _id: created._id || data._id }
  }

  const next = isCorrect
    ? {
        correctStreak: Number(existing.correctStreak || 0) + 1,
        updatedAt: now,
      }
    : {
        status: 'active',
        wrongCount: Number(existing.wrongCount || 0) + 1,
        correctStreak: 0,
        lastWrongAt: now,
        updatedAt: now,
      }

  if (isCorrect && next.correctStreak >= 3) {
    next.status = 'mastered'
    next.masteredAt = existing.masteredAt || now
  }

  await db.collection('wrong_questions').doc(existing._id).update({ data: next })
  return { ...existing, ...next }
}

async function listWrongQuestions({ db, openid, materialId, status = 'active' }) {
  const query = { ownerOpenid: openid, status }
  if (materialId) query.materialId = materialId

  const result = await db.collection('wrong_questions').where(query).orderBy('lastWrongAt', 'desc').get()
  const items = []
  for (const wrongQuestion of result.data) {
    const questionResult = await db.collection('questions').where({
      _id: wrongQuestion.questionId,
      ownerOpenid: openid,
    }).get()
    const question = questionResult.data[0]
    if (question) items.push({ ...wrongQuestion, question: hideAnswer(question) })
  }
  return items
}

async function createWrongPractice({ db, openid, materialId, count, now }) {
  const wrongQuestions = await listWrongQuestions({ db, openid, materialId, status: 'active' })
  const limit = Math.max(1, Number(count || 10))
  const selected = wrongQuestions.slice(0, limit)
  if (selected.length === 0) throw createError('wrong_no_questions', '暂无可练习错题')

  const data = {
    ownerOpenid: openid,
    materialId: materialId || '',
    mode: 'wrong',
    questionIds: selected.map((item) => item.questionId),
    status: 'active',
    totalCount: selected.length,
    correctCount: 0,
    startedAt: now,
    submittedAt: '',
    createdAt: now,
    updatedAt: now,
  }
  const created = await db.collection('practice_sessions').add({ data })
  return { _id: created._id, ...data }
}

async function markWrongQuestionMastered({ db, openid, wrongQuestionId, now }) {
  const result = await db.collection('wrong_questions').where({ _id: wrongQuestionId, ownerOpenid: openid }).get()
  const wrongQuestion = result.data[0]
  if (!wrongQuestion) throw createError('wrong_not_found', '错题不存在')

  const next = {
    status: 'mastered',
    masteredAt: wrongQuestion.masteredAt || now,
    updatedAt: now,
  }
  await db.collection('wrong_questions').doc(wrongQuestion._id).update({ data: next })
  return { ...wrongQuestion, ...next }
}

module.exports = {
  createWrongPractice,
  listWrongQuestions,
  markWrongQuestionMastered,
  recordWrongQuestionResult,
}
```

- [ ] **Step 4: Run wrong service tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/wrongService.spec.js
```

Expected: all wrong service tests pass.

## Task 4: Integrate Wrong Recording Into Answer Submission

**Files:**
- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js`
- Modify: `tests/cloud/practiceService.spec.js`

- [ ] **Step 1: Add failing practice integration tests**

Add to `tests/cloud/practiceService.spec.js`:

```js
it('creates a wrong question when an answer is incorrect', async () => {
  const db = createFakeDb()
  await seedMaterial(db)
  await seedQuestion(db)
  const session = await createPractice({
    db,
    openid: 'user_a',
    materialId: 'material_1',
    count: 5,
    now: '2026-04-30T00:00:01.000Z',
  })

  await answerSubmit({
    db,
    openid: 'user_a',
    sessionId: session._id,
    questionId: session.questionIds[0],
    selectedKeys: ['B'],
    now: '2026-04-30T00:00:02.000Z',
  })

  const wrongRows = await db.collection('wrong_questions').where({
    ownerOpenid: 'user_a',
    questionId: session.questionIds[0],
  }).get()
  expect(wrongRows.data).toHaveLength(1)
  expect(wrongRows.data[0]).toMatchObject({
    status: 'active',
    wrongCount: 1,
    correctStreak: 0,
  })
})

it('does not increment wrong count when the same session answer is resubmitted', async () => {
  const db = createFakeDb()
  await seedMaterial(db)
  await seedQuestion(db)
  const session = await createPractice({
    db,
    openid: 'user_a',
    materialId: 'material_1',
    count: 5,
    now: '2026-04-30T00:00:01.000Z',
  })

  await answerSubmit({
    db,
    openid: 'user_a',
    sessionId: session._id,
    questionId: session.questionIds[0],
    selectedKeys: ['B'],
    now: '2026-04-30T00:00:02.000Z',
  })
  await answerSubmit({
    db,
    openid: 'user_a',
    sessionId: session._id,
    questionId: session.questionIds[0],
    selectedKeys: ['B'],
    now: '2026-04-30T00:00:03.000Z',
  })

  const wrongRows = await db.collection('wrong_questions').where({
    ownerOpenid: 'user_a',
    questionId: session.questionIds[0],
  }).get()
  expect(wrongRows.data).toHaveLength(1)
  expect(wrongRows.data[0].wrongCount).toBe(1)
})

it('marks an existing wrong question mastered after three later correct submissions', async () => {
  const db = createFakeDb()
  await seedMaterial(db)
  await seedQuestion(db)

  for (const [index, selectedKeys] of [['B'], ['A'], ['A'], ['A']].entries()) {
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: `2026-04-30T00:00:0${index + 1}.000Z`,
    })
    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys,
      now: `2026-04-30T00:00:1${index + 1}.000Z`,
    })
  }

  const wrongRows = await db.collection('wrong_questions').where({ ownerOpenid: 'user_a' }).get()
  expect(wrongRows.data[0]).toMatchObject({
    status: 'mastered',
    correctStreak: 3,
  })
})
```

- [ ] **Step 2: Run the failing practice integration tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/practiceService.spec.js
```

Expected: fails because `answerSubmit` does not maintain `wrong_questions`.

- [ ] **Step 3: Make `upsertAttempt` return whether it created a new attempt**

In `practiceService.js`, change existing-return path:

```js
if (existing.data[0]) {
  return { attempt: existing.data[0], created: false }
}
```

Change create path:

```js
const created = await attempts.add({ data })
return { attempt: { ...data, _id: created._id }, created: true }
```

Change duplicate race path:

```js
const raced = await attempts.where({ _id: attemptId, ownerOpenid: openid }).get()
return { attempt: raced.data[0] || data, created: false }
```

- [ ] **Step 4: Call wrong service only for newly created attempts**

Add import at the top of `practiceService.js`:

```js
const { recordWrongQuestionResult } = require('./wrongService')
```

Update `answerSubmit`:

```js
const { attempt, created } = await upsertAttempt({
  db,
  openid,
  sessionId,
  questionId,
  selectedKeys: normalizedSelected,
  isCorrect,
  now,
})

if (created) {
  await recordWrongQuestionResult({
    db,
    openid,
    questionId,
    isCorrect,
    now,
  })
}
```

Keep the response shape unchanged:

```js
return {
  questionId,
  selectedKeys: attempt.selectedKeys,
  isCorrect: attempt.isCorrect,
  answerKeys: question.answerKeys,
  explanation: question.explanation || '',
}
```

- [ ] **Step 5: Set practice session mode for normal practice**

In `createPractice`, add:

```js
mode: 'material',
```

This keeps result-page retry behavior explicit without breaking old sessions.

- [ ] **Step 6: Run cloud service tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/practiceService.spec.js tests/cloud/wrongService.spec.js
```

Expected: all tests pass.

## Task 5: Profile Page And Wrong Question Page

**Files:**
- Create: `pages/profile/index.vue`
- Create: `pages/wrong/index.vue`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Add failing page source tests**

Add to `tests/frontend/pages.spec.ts`:

```ts
test('profile page loads user, materials, wrong questions, and links to wrong book', () => {
  const source = read('pages/profile/index.vue')

  expect(source).toContain('api.userLogin()')
  expect(source).toContain('api.materialList()')
  expect(source).toContain("api.wrongList({ status: 'active' })")
  expect(source).toContain('/pages/wrong/index')
  expect(source).toContain('我的')
  expect(source).toContain('当前错题')
})

test('wrong page lists active wrong questions and starts wrong practice', () => {
  const source = read('pages/wrong/index.vue')

  expect(source).toContain("api.wrongList({ status: 'active'")
  expect(source).toContain('api.wrongPracticeCreate')
  expect(source).toContain('/pages/practice/do?sessionId=')
  expect(source).toContain('api.wrongMarkMastered')
  expect(source).toContain('暂无错题')
  expect(source).toContain('LoadingState')
  expect(source).toContain('ErrorState')
  expect(source).toContain('EmptyState')
})
```

- [ ] **Step 2: Run the failing page source tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: fails because new pages are empty or missing.

- [ ] **Step 3: Create `pages/profile/index.vue`**

Implement a lightweight profile page with:

- `onLoad(loadProfile)`
- `api.userLogin()`
- `api.materialList()`
- `api.wrongList({ status: 'active' })`
- summary values:
  - materials count
  - active wrong count
- actions:
  - "我的资料" -> `/pages/index/index` via `uni.reLaunch`
  - "查看错题" -> `/pages/wrong/index` via `uni.navigateTo`

Required template texts:

```text
我的
资料
当前错题
查看错题
返回资料
```

Use existing `LoadingState` / `ErrorState` components and keep card radius at `8rpx`.

- [ ] **Step 4: Create `pages/wrong/index.vue`**

Implement wrong list page behavior:

- Read optional `materialId` from `onLoad`.
- Load active wrong questions with `api.wrongList({ status: 'active', materialId: materialId.value || undefined })`.
- Show empty state:

```text
暂无错题
答错的题会自动进入这里。
```

- Show each wrong item:
  - stem
  - type
  - wrongCount
  - correctStreak
  - lastWrongAt
- Bottom primary button:

```text
练习错题
```

- `startWrongPractice()` calls:

```ts
const result = await api.wrongPracticeCreate({
  materialId: materialId.value || undefined,
  count: Math.min(10, wrongQuestions.value.length),
})
uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })
```

- Optional secondary action per item:

```text
标记已掌握
```

calls:

```ts
await api.wrongMarkMastered(wrongQuestionId)
await loadWrongQuestions()
```

- [ ] **Step 5: Run frontend page tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: new page tests pass.

## Task 6: Add Entry Points From Existing User Flow

**Files:**
- Modify: `pages/index/index.vue`
- Modify: `pages/material/detail.vue`
- Modify: `pages/practice/result.vue`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Add failing entry-point tests**

Add to `tests/frontend/pages.spec.ts`:

```ts
test('home page links to profile page', () => {
  const source = read('pages/index/index.vue')

  expect(source).toContain('/pages/profile/index')
  expect(source).toContain('我的')
})

test('material detail links to material wrong questions', () => {
  const source = read('pages/material/detail.vue')

  expect(source).toContain('/pages/wrong/index?materialId=')
  expect(source).toContain('错题')
})

test('practice result links to wrong questions and handles wrong-practice retry', () => {
  const source = read('pages/practice/result.vue')

  expect(source).toContain("session.value?.mode === 'wrong'")
  expect(source).toContain('/pages/wrong/index')
  expect(source).toContain('查看错题')
})
```

- [ ] **Step 2: Run failing entry-point tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: fails because entry points are not present.

- [ ] **Step 3: Add profile entry to home page**

In `pages/index/index.vue`, add:

```ts
function goProfile() {
  uni.navigateTo({ url: '/pages/profile/index' })
}
```

Add a secondary toolbar button:

```vue
<button class="toolbar__secondary-button" type="default" @click="goProfile">我的</button>
```

Keep "上传 PDF" as the primary action.

- [ ] **Step 4: Add material wrong entry**

In `pages/material/detail.vue`, add:

```ts
function goMaterialWrong() {
  if (!material.value) return
  uni.navigateTo({ url: `/pages/wrong/index?materialId=${material.value._id}` })
}
```

Add an action visible when `canPractice` is true:

```vue
<button
  v-if="canPractice"
  class="actions__button"
  type="default"
  @click="goMaterialWrong"
>
  练习本资料错题
</button>
```

- [ ] **Step 5: Update result page wrong entry and retry behavior**

In `pages/practice/result.vue`, update `retryUrl`:

```ts
const retryUrl = computed(() => {
  if (session.value?.mode === 'wrong') {
    const suffix = session.value.materialId ? `?materialId=${session.value.materialId}` : ''
    return `/pages/wrong/index${suffix}`
  }
  if (session.value?.materialId) return `/pages/practice/setup?materialId=${session.value.materialId}`
  return '/pages/practice/setup'
})
```

Add:

```ts
function goWrongBook() {
  const suffix = session.value?.materialId ? `?materialId=${session.value.materialId}` : ''
  uni.redirectTo({ url: `/pages/wrong/index${suffix}` })
}
```

Add button:

```vue
<button class="actions__button" type="default" @click="goWrongBook">
  查看错题
</button>
```

- [ ] **Step 6: Run frontend page tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: passes.

## Task 7: End-To-End Cloud Function And Frontend Verification

**Files:**
- Modify: `docs/manual-qa/wrong-question-book-v1-1.md`

- [ ] **Step 1: Run cloud tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud
```

Expected: all cloud tests pass.

- [ ] **Step 2: Run frontend tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend
```

Expected: all frontend tests pass.

- [ ] **Step 3: Run parser tests as regression guard**

Run:

```powershell
node scripts/run-bun.mjs test tests/parser
```

Expected: parser tests pass; this feature should not affect PDF parsing.

- [ ] **Step 4: Build WeChat mini program**

Run:

```powershell
npm run build:mp-weixin
```

Expected: build completes and `dist/build/mp-weixin` exists.

- [ ] **Step 5: Create manual QA checklist**

Create `docs/manual-qa/wrong-question-book-v1-1.md`:

```markdown
# Wrong Question Book v1.1 Manual QA

Date: 2026-04-30
Project: G:\HBuilderProjects\ShuaTi

## Preconditions

- HBuilderX project is associated with the correct `uniCloud-alipay` service space.
- Existing PDF import and practice flow works.
- These cloud functions are uploaded:
  - `answerSubmit`
  - `wrongList`
  - `wrongPracticeCreate`
  - `wrongMarkMastered`
  - `practiceDetail`

## Cases

### 1. Wrong answer enters wrong book

1. Import a PDF and create a normal practice session.
2. Answer one question incorrectly.
3. Finish the practice and enter result page.
4. Tap "查看错题".

Expected:

- Wrong page opens.
- The wrong question is listed.
- `wrongCount = 1`.
- `correctStreak = 0`.

### 2. Duplicate submit does not duplicate wrong question

1. On an answered question, tap submit again if the UI allows retry or refreshes.
2. Reopen wrong page.

Expected:

- The same question appears once.
- `wrongCount` does not increase from duplicate submission in the same session.

### 3. Wrong practice reuses normal practice page

1. Open "我的".
2. Tap "查看错题".
3. Tap "练习错题".

Expected:

- App navigates to `pages/practice/do`.
- Questions render with the normal `QuestionCard`.
- Correct answers are hidden before submit.
- Submit shows correct answer and explanation.

### 4. Master after three correct answers

1. Create wrong practice sessions for the same wrong question.
2. Answer it correctly three times across sessions.
3. Reopen wrong page.

Expected:

- The question no longer appears in active wrong list.
- Backend record status is `mastered`.

### 5. Material-scoped wrong practice

1. Open a ready material detail page.
2. Tap "练习本资料错题".

Expected:

- Only active wrong questions from this material are used.
- If this material has no active wrong questions, user sees "暂无错题".
```

- [ ] **Step 6: Upload cloud functions in HBuilderX**

In HBuilderX:

1. Right click `uniCloud-alipay/cloudfunctions/wrongList`.
2. Select upload/deploy cloud function.
3. Repeat for `wrongPracticeCreate`.
4. Repeat for `wrongMarkMastered`.
5. Upload `answerSubmit` because its logic changed.
6. If HBuilderX asks to upload common modules, confirm upload for `shuati-shared`.
7. Ensure `wrong_questions` collection schema is created or uploaded in the service space.

- [ ] **Step 7: Manual QA in WeChat Developer Tools**

Run the checklist in `docs/manual-qa/wrong-question-book-v1-1.md`.

Expected: all cases pass before considering v1.1 complete.

## Self-Review

### Spec Coverage

- 新增我的页面: Task 1 registers route, Task 5 creates page, Task 6 links from home.
- 答错自动加入错题: Task 3 service, Task 4 `answerSubmit` integration.
- 我的页面可以查看错题: Task 5 profile page links to wrong page and loads active wrong count.
- 错题像题库一样练习: Task 3 `createWrongPractice`, Task 5 wrong page starts practice, existing practice page reused.
- 不做复杂统计和复习计划: Scope excludes stats dashboard and review scheduling.

### Placeholder Scan

The plan contains no `TBD`, no unassigned owner, and no undefined future phase inside execution tasks.

### Type Consistency

- Frontend uses `WrongQuestionItem`, `WrongQuestionStatus`, `PracticeSessionMode`.
- API uses `wrongList`, `wrongPracticeCreate`, `wrongMarkMastered`.
- Cloud functions use the same names as frontend API.
- Service exports are `recordWrongQuestionResult`, `listWrongQuestions`, `createWrongPractice`, `markWrongQuestionMastered`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-wrong-question-book-v1-1.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
