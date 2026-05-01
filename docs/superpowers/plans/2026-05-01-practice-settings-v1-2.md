# 练习设置增强 v1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在“开始练习”页增加全部练习、自定义题数、顺序/随机、全部/未练习、题型筛选，让用户能按自己的刷题目标创建练习。

**Architecture:** 前端设置页只负责收集用户选择并做基础校验；真正的筛题、排序、随机和未练习过滤放在 `practiceCreate` 后端服务里，防止前端绕过规则。练习会话保存本次设置，便于后续结果页、排查和未来统计复用。

**Tech Stack:** uni-app Vue 3 `<script setup lang="ts">`、TypeScript、uniCloud 支付宝云函数、Bun/Vitest、HBuilderX 云函数目录结构。

---

## Scope

### In

- 题量选择：`5`、`10`、`20`、`全部`、`自定义`。
- 出题方式：`顺序`、`随机`。
- 练习范围：`全部题目`、`未练习题目`。
- 题型筛选：`全部`、`单选`、`多选`、`判断`。
- 后端按设置创建练习，并把本次设置写入 `practice_sessions`。
- 中文手工验收文档。

### Out

- 不做复习计划。
- 不做复杂统计面板。
- 不做多选题型组合，例如“单选 + 判断”。
- 不改做题页答题流程。
- 不改错题本练习入口；错题练习仍走现有 `wrongPracticeCreate`。

---

## File Structure

- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js`
  - 增加练习创建参数解析。
  - 增加题型过滤。
  - 增加未练习过滤。
  - 增加题号顺序排序。
  - 增加随机打乱。
  - 会话保存 `countMode`、`requestedCount`、`orderMode`、`scope`、`questionType`。
- Modify: `uniCloud-alipay/database/practice_sessions.schema.json`
  - 声明新增会话设置字段。
- Modify: `common/types.ts`
  - 增加练习设置相关联合类型。
  - `PracticeSession` 增加会话设置字段。
- Modify: `common/api/cloud.ts`
  - `PracticeCreateInput` 增加可选设置字段。
- Modify: `pages/practice/setup.vue`
  - 新增题量、出题方式、练习范围、题型筛选 UI。
  - 自定义题数输入和校验。
  - 创建练习时传完整设置。
- Modify: `tests/cloud/practiceService.spec.js`
  - 覆盖全部练习、自定义题数、题型筛选、未练习、随机/顺序。
- Modify: `tests/cloud/unicloudDatabaseSchema.spec.js`
  - 覆盖 `practice_sessions` 新增字段。
- Modify: `tests/frontend/pages.spec.ts`
  - 覆盖设置页 UI 和请求参数。
- Modify: `tests/frontend/cloudApi.spec.ts`
  - 覆盖 `practiceCreate` 透传新参数。
- Modify: `tests/frontend/types.spec.ts`
  - 覆盖新增类型字段。
- Create: `docs/manual-qa/practice-settings-v1-2.md`
  - 中文手工验收。

---

## Data Contract

### Frontend API Input

`common/api/cloud.ts`

```ts
export type PracticeCountMode = 'fixed' | 'all' | 'custom'
export type PracticeOrderMode = 'sequence' | 'random'
export type PracticeScope = 'all' | 'unattempted'
export type PracticeQuestionTypeFilter = 'all' | QuestionType

export interface PracticeCreateInput {
  materialId?: string
  count?: number
  countMode?: PracticeCountMode
  orderMode?: PracticeOrderMode
  scope?: PracticeScope
  questionType?: PracticeQuestionTypeFilter
}
```

### Backend Defaults

For backward compatibility:

- missing `countMode` means `fixed`
- missing `count` means `10`
- missing `orderMode` means `sequence`
- missing `scope` means `all`
- missing `questionType` means `all`

### Backend Selection Rules

1. Load owned questions by `ownerOpenid` and optional `materialId`.
2. If `questionType !== 'all'`, keep only matching `question.type`.
3. If `scope === 'unattempted'`, query `attempts` for current user and remove questions whose `_id` appears in any attempt.
4. If `orderMode === 'sequence'`, sort by:
   - numeric `questionNo` when both sides are numeric
   - string `questionNo`
   - `createdAt`
   - `_id`
5. If `orderMode === 'random'`, shuffle after filtering.
6. If `countMode === 'all'`, use all remaining questions.
7. Otherwise use `Math.max(1, Number(count || 10))`, capped by available questions.
8. If no question remains, throw:
   - `practice_no_unattempted_questions` when scope is `unattempted`
   - otherwise `practice_no_questions`

---

## Task 1: Backend Practice Selection

**Files:**
- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js`
- Modify: `uniCloud-alipay/database/practice_sessions.schema.json`
- Modify: `tests/cloud/practiceService.spec.js`
- Modify: `tests/cloud/unicloudDatabaseSchema.spec.js`

- [ ] **Step 1: Add failing backend tests**

In `tests/cloud/practiceService.spec.js`, add tests near existing `createPractice` tests:

```js
  it('creates a practice with all questions in sequence order', async () => {
    const db = createFakeDb()
    await seedQuestion(db, { _id: 'q10', questionNo: '10', createdAt: '2026-04-26T00:00:10.000Z' })
    await seedQuestion(db, { _id: 'q2', questionNo: '2', createdAt: '2026-04-26T00:00:02.000Z' })
    await seedQuestion(db, { _id: 'q1', questionNo: '1', createdAt: '2026-04-26T00:00:01.000Z' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'sequence',
      scope: 'all',
      questionType: 'all',
      now: '2026-05-01T00:00:00.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q2', 'q10'])
    expect(session.totalCount).toBe(3)
    expect(session.countMode).toBe('all')
    expect(session.orderMode).toBe('sequence')
    expect(session.scope).toBe('all')
    expect(session.questionType).toBe('all')
  })

  it('filters practice questions by question type and custom count', async () => {
    const db = createFakeDb()
    await seedQuestion(db, { _id: 'single_1', type: 'single', questionNo: '1' })
    await seedQuestion(db, { _id: 'multiple_1', type: 'multiple', questionNo: '2' })
    await seedQuestion(db, { _id: 'multiple_2', type: 'multiple', questionNo: '3' })
    await seedQuestion(db, { _id: 'judge_1', type: 'judge', questionNo: '4' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'custom',
      count: 1,
      orderMode: 'sequence',
      scope: 'all',
      questionType: 'multiple',
      now: '2026-05-01T00:00:00.000Z',
    })

    expect(session.questionIds).toEqual(['multiple_1'])
    expect(session.totalCount).toBe(1)
    expect(session.countMode).toBe('custom')
    expect(session.requestedCount).toBe(1)
    expect(session.questionType).toBe('multiple')
  })

  it('creates practice from unattempted questions only', async () => {
    const db = createFakeDb()
    await seedQuestion(db, { _id: 'q1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', questionNo: '3' })
    await db.collection('attempts').add({
      data: {
        _id: 'attempt_1',
        ownerOpenid: 'user_a',
        sessionId: 'old_session',
        questionId: 'q1',
        selectedKeys: ['A'],
        isCorrect: true,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
      },
    })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'sequence',
      scope: 'unattempted',
      questionType: 'all',
      now: '2026-05-01T00:00:00.000Z',
    })

    expect(session.questionIds).toEqual(['q2', 'q3'])
    expect(session.scope).toBe('unattempted')
  })

  it('randomizes questions when random order is requested', async () => {
    const db = createFakeDb()
    await seedQuestion(db, { _id: 'q1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', questionNo: '3' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'random',
      scope: 'all',
      questionType: 'all',
      now: '2026-05-01T00:00:00.000Z',
      random: () => 0,
    })

    expect(session.questionIds).toEqual(['q2', 'q3', 'q1'])
    expect(session.orderMode).toBe('random')
  })

  it('returns a clear error when no unattempted question remains', async () => {
    const db = createFakeDb()
    await seedQuestion(db, { _id: 'q1', questionNo: '1' })
    await db.collection('attempts').add({
      data: {
        _id: 'attempt_1',
        ownerOpenid: 'user_a',
        sessionId: 'old_session',
        questionId: 'q1',
        selectedKeys: ['A'],
        isCorrect: true,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
      },
    })

    await expect(createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      scope: 'unattempted',
      now: '2026-05-01T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'practice_no_unattempted_questions' })
  })
```

In `tests/cloud/unicloudDatabaseSchema.spec.js`, add:

```js
  it('declares practice session setup fields', () => {
    const sessions = readSchema('practice_sessions')

    expect(sessions.properties.countMode).toEqual({ bsonType: 'string' })
    expect(sessions.properties.requestedCount).toEqual({ bsonType: 'number' })
    expect(sessions.properties.orderMode).toEqual({ bsonType: 'string' })
    expect(sessions.properties.scope).toEqual({ bsonType: 'string' })
    expect(sessions.properties.questionType).toEqual({ bsonType: 'string' })
  })
```

- [ ] **Step 2: Run focused cloud tests to verify failure**

```powershell
node scripts/run-bun.mjs test tests/cloud/practiceService.spec.js tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: FAIL because the service and schema do not support the new fields yet.

- [ ] **Step 3: Implement backend helpers**

In `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js`, add after `questionQuery()`:

```js
const VALID_COUNT_MODES = new Set(['fixed', 'all', 'custom'])
const VALID_ORDER_MODES = new Set(['sequence', 'random'])
const VALID_SCOPES = new Set(['all', 'unattempted'])
const VALID_QUESTION_TYPES = new Set(['all', 'single', 'multiple', 'judge'])

function normalizePracticeSettings({ count, countMode, orderMode, scope, questionType }) {
  const normalizedCountMode = VALID_COUNT_MODES.has(countMode) ? countMode : 'fixed'
  const normalizedOrderMode = VALID_ORDER_MODES.has(orderMode) ? orderMode : 'sequence'
  const normalizedScope = VALID_SCOPES.has(scope) ? scope : 'all'
  const normalizedQuestionType = VALID_QUESTION_TYPES.has(questionType) ? questionType : 'all'
  const requestedCount = Math.max(1, Number(count || 10))

  return {
    countMode: normalizedCountMode,
    requestedCount,
    orderMode: normalizedOrderMode,
    scope: normalizedScope,
    questionType: normalizedQuestionType,
  }
}

function compareQuestionOrder(a, b) {
  const aNo = String(a.questionNo || '')
  const bNo = String(b.questionNo || '')
  const aNumber = Number(aNo)
  const bNumber = Number(bNo)
  if (aNo && bNo && Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber
  }
  if (aNo !== bNo) return aNo.localeCompare(bNo)
  if ((a.createdAt || '') !== (b.createdAt || '')) return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  return String(a._id || '').localeCompare(String(b._id || ''))
}

function shuffleQuestions(questions, random = Math.random) {
  const shuffled = [...questions]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }
  return shuffled
}

async function filterUnattemptedQuestions({ db, openid, questions }) {
  const attempts = await db.collection('attempts').where({ ownerOpenid: openid }).get()
  const attemptedIds = new Set(attempts.data.map((attempt) => attempt.questionId))
  return questions.filter((question) => !attemptedIds.has(question._id))
}
```

- [ ] **Step 4: Update `createPractice()`**

Replace `createPractice()` with:

```js
async function createPractice({
  db,
  openid,
  materialId,
  count,
  countMode,
  orderMode,
  scope,
  questionType,
  now,
  random = Math.random,
}) {
  assertRequired(now, 'missing_timestamp', '缺少创建时间')

  await assertMaterialReadyForPractice({ db, openid, materialId })

  const settings = normalizePracticeSettings({ count, countMode, orderMode, scope, questionType })
  const result = await db.collection('questions').where(questionQuery(openid, materialId)).get()
  let questions = result.data
  if (settings.questionType !== 'all') {
    questions = questions.filter((question) => question.type === settings.questionType)
  }
  if (settings.scope === 'unattempted') {
    questions = await filterUnattemptedQuestions({ db, openid, questions })
  }
  questions = questions.sort(compareQuestionOrder)
  if (settings.orderMode === 'random') {
    questions = shuffleQuestions(questions, random)
  }

  const selected = settings.countMode === 'all'
    ? questions
    : questions.slice(0, settings.requestedCount)
  if (selected.length === 0) {
    throw createError(
      settings.scope === 'unattempted' ? 'practice_no_unattempted_questions' : 'practice_no_questions',
      settings.scope === 'unattempted' ? '没有未练习题目' : '没有可练习题目',
    )
  }

  const data = {
    ownerOpenid: openid,
    materialId: materialId || '',
    mode: 'material',
    questionIds: selected.map((question) => question._id),
    status: 'active',
    totalCount: selected.length,
    correctCount: 0,
    countMode: settings.countMode,
    requestedCount: settings.requestedCount,
    orderMode: settings.orderMode,
    scope: settings.scope,
    questionType: settings.questionType,
    startedAt: now,
    submittedAt: '',
    createdAt: now,
    updatedAt: now,
  }
  const created = await db.collection('practice_sessions').add({ data })
  return { _id: created._id, ...data }
}
```

- [ ] **Step 5: Update schema**

In `uniCloud-alipay/database/practice_sessions.schema.json`, add these optional properties:

```json
    "countMode": { "bsonType": "string" },
    "requestedCount": { "bsonType": "number" },
    "orderMode": { "bsonType": "string" },
    "scope": { "bsonType": "string" },
    "questionType": { "bsonType": "string" },
```

- [ ] **Step 6: Run focused cloud tests**

```powershell
node scripts/run-bun.mjs test tests/cloud/practiceService.spec.js tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: PASS.

---

## Task 2: Frontend Setup Page And API Types

**Files:**
- Modify: `common/types.ts`
- Modify: `common/api/cloud.ts`
- Modify: `pages/practice/setup.vue`
- Modify: `tests/frontend/cloudApi.spec.ts`
- Modify: `tests/frontend/pages.spec.ts`
- Modify: `tests/frontend/types.spec.ts`

- [ ] **Step 1: Add failing frontend tests**

In `tests/frontend/cloudApi.spec.ts`, add:

```ts
  test('practiceCreate sends enhanced setup options', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          session: {
            _id: 'practice_1',
            materialId: 'material_1',
            mode: 'material',
            questionIds: ['question_1'],
            status: 'active',
            totalCount: 1,
            correctCount: 0,
            countMode: 'custom',
            requestedCount: 1,
            orderMode: 'random',
            scope: 'unattempted',
            questionType: 'single',
            startedAt: '2026-05-01T00:00:00.000Z',
            submittedAt: '',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
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

    await api.practiceCreate({
      materialId: 'material_1',
      count: 1,
      countMode: 'custom',
      orderMode: 'random',
      scope: 'unattempted',
      questionType: 'single',
    })

    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'practiceCreate',
      data: {
        materialId: 'material_1',
        count: 1,
        countMode: 'custom',
        orderMode: 'random',
        scope: 'unattempted',
        questionType: 'single',
        _uniToken: 'token_a',
        uniToken: 'token_a',
      },
    })
  })
```

In `tests/frontend/pages.spec.ts`, update the practice setup test to assert:

```ts
    expect(source).toContain("countOptions = [5, 10, 20]")
    expect(source).toContain("const countMode = ref<PracticeCountMode>('fixed')")
    expect(source).toContain("const orderMode = ref<PracticeOrderMode>('sequence')")
    expect(source).toContain("const practiceScope = ref<PracticeScope>('all')")
    expect(source).toContain("const questionType = ref<PracticeQuestionTypeFilter>('all')")
    expect(source).toContain('customCount')
    expect(source).toContain('全部练习')
    expect(source).toContain('自定义')
    expect(source).toContain('顺序')
    expect(source).toContain('随机')
    expect(source).toContain('全部题目')
    expect(source).toContain('未练习题目')
    expect(source).toContain('单选')
    expect(source).toContain('多选')
    expect(source).toContain('判断')
    expect(source).toContain('countMode: countMode.value')
    expect(source).toContain('orderMode: orderMode.value')
    expect(source).toContain('scope: practiceScope.value')
    expect(source).toContain('questionType: questionType.value')
```

In `tests/frontend/types.spec.ts`, add:

```ts
  test('practice session stores enhanced setup choices', () => {
    const session: PracticeSession = {
      _id: 'practice_1',
      materialId: 'material_1',
      mode: 'material',
      questionIds: ['question_1'],
      status: 'active',
      totalCount: 1,
      correctCount: 0,
      countMode: 'all',
      requestedCount: 10,
      orderMode: 'random',
      scope: 'unattempted',
      questionType: 'judge',
      startedAt: '2026-05-01T00:00:00.000Z',
      submittedAt: '',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }

    expect(session.countMode).toBe('all')
    expect(session.orderMode).toBe('random')
    expect(session.scope).toBe('unattempted')
    expect(session.questionType).toBe('judge')
  })
```

- [ ] **Step 2: Run focused frontend tests to verify failure**

```powershell
node scripts/run-bun.mjs test tests/frontend/cloudApi.spec.ts tests/frontend/pages.spec.ts tests/frontend/types.spec.ts
```

Expected: FAIL because types and UI do not exist yet.

- [ ] **Step 3: Update shared types and API**

In `common/types.ts`, add after `PracticeSessionMode`:

```ts
export type PracticeCountMode = 'fixed' | 'all' | 'custom'
export type PracticeOrderMode = 'sequence' | 'random'
export type PracticeScope = 'all' | 'unattempted'
export type PracticeQuestionTypeFilter = 'all' | QuestionType
```

Add optional fields to `PracticeSession`:

```ts
  countMode?: PracticeCountMode
  requestedCount?: number
  orderMode?: PracticeOrderMode
  scope?: PracticeScope
  questionType?: PracticeQuestionTypeFilter
```

In `common/api/cloud.ts`, import the four new types and update `PracticeCreateInput`:

```ts
export interface PracticeCreateInput {
  materialId?: string
  count?: number
  countMode?: PracticeCountMode
  orderMode?: PracticeOrderMode
  scope?: PracticeScope
  questionType?: PracticeQuestionTypeFilter
}
```

- [ ] **Step 4: Update setup page script**

In `pages/practice/setup.vue`, update imports:

```ts
import type {
  PracticeCountMode,
  PracticeOrderMode,
  PracticeQuestionTypeFilter,
  PracticeScope,
  SafeQuestion,
} from '@/common/types'
```

Add state:

```ts
const countMode = ref<PracticeCountMode>('fixed')
const customCount = ref('10')
const orderMode = ref<PracticeOrderMode>('sequence')
const practiceScope = ref<PracticeScope>('all')
const questionType = ref<PracticeQuestionTypeFilter>('all')
```

Add computed values:

```ts
const filteredQuestionCount = computed(() => {
  if (questionType.value === 'all') return questionCount.value
  return questions.value.filter((question) => question.type === questionType.value).length
})
const selectedPracticeCount = computed(() => {
  if (countMode.value === 'all') return filteredQuestionCount.value
  if (countMode.value === 'custom') return Math.max(1, Number(customCount.value || 0))
  return selectedCount.value
})
const canCreatePractice = computed(() => hasQuestions.value && filteredQuestionCount.value > 0 && selectedPracticeCount.value > 0)
const setupHint = computed(() => {
  const range = practiceScope.value === 'unattempted' ? '未练习题目' : '全部题目'
  const order = orderMode.value === 'random' ? '随机出题' : '顺序出题'
  return `${range}，${order}，系统会按当前设置创建练习。`
})
```

Add methods:

```ts
function selectCountMode(mode: PracticeCountMode, count?: number) {
  if (creating.value) return
  countMode.value = mode
  if (typeof count === 'number') selectedCount.value = count
}

function updateCustomCount(event: { detail?: { value?: string } }) {
  customCount.value = String(event.detail?.value || '').replace(/[^\d]/g, '')
}

function selectOrderMode(mode: PracticeOrderMode) {
  if (creating.value) return
  orderMode.value = mode
}

function selectPracticeScope(scope: PracticeScope) {
  if (creating.value) return
  practiceScope.value = scope
}

function selectQuestionType(type: PracticeQuestionTypeFilter) {
  if (creating.value) return
  questionType.value = type
}
```

Update `createPractice()` request:

```ts
    const result = await api.practiceCreate({
      materialId: materialId.value || undefined,
      count: selectedPracticeCount.value,
      countMode: countMode.value,
      orderMode: orderMode.value,
      scope: practiceScope.value,
      questionType: questionType.value,
    })
```

Change guard to:

```ts
  if (creating.value || !canCreatePractice.value) return
```

- [ ] **Step 5: Update setup page template**

Change summary hint:

```vue
        <text class="summary__hint">{{ setupHint }}</text>
```

Replace the count section with:

```vue
      <view class="section">
        <text class="section__title">题量</text>
        <view class="count-options">
          <button
            v-for="count in countOptions"
            :key="count"
            class="count-options__item"
            :class="{ 'count-options__item--active': countMode === 'fixed' && selectedCount === count }"
            type="default"
            :disabled="creating"
            @click="selectCountMode('fixed', count)"
          >
            {{ count }}
          </button>
          <button
            class="count-options__item"
            :class="{ 'count-options__item--active': countMode === 'all' }"
            type="default"
            :disabled="creating"
            @click="selectCountMode('all')"
          >
            全部练习
          </button>
          <button
            class="count-options__item"
            :class="{ 'count-options__item--active': countMode === 'custom' }"
            type="default"
            :disabled="creating"
            @click="selectCountMode('custom')"
          >
            自定义
          </button>
        </view>
        <view v-if="countMode === 'custom'" class="custom-count">
          <text class="custom-count__label">自定义题数</text>
          <input
            class="custom-count__input"
            type="number"
            :value="customCount"
            :disabled="creating"
            placeholder="输入题数"
            @input="updateCustomCount"
          />
        </view>
      </view>
```

Add sections after count:

```vue
      <view class="section">
        <text class="section__title">出题方式</text>
        <view class="segmented-options">
          <button class="segmented-options__item" :class="{ 'segmented-options__item--active': orderMode === 'sequence' }" type="default" :disabled="creating" @click="selectOrderMode('sequence')">顺序</button>
          <button class="segmented-options__item" :class="{ 'segmented-options__item--active': orderMode === 'random' }" type="default" :disabled="creating" @click="selectOrderMode('random')">随机</button>
        </view>
      </view>

      <view class="section">
        <text class="section__title">练习范围</text>
        <view class="segmented-options">
          <button class="segmented-options__item" :class="{ 'segmented-options__item--active': practiceScope === 'all' }" type="default" :disabled="creating" @click="selectPracticeScope('all')">全部题目</button>
          <button class="segmented-options__item" :class="{ 'segmented-options__item--active': practiceScope === 'unattempted' }" type="default" :disabled="creating" @click="selectPracticeScope('unattempted')">未练习题目</button>
        </view>
      </view>

      <view class="section">
        <text class="section__title">题型</text>
        <view class="type-options">
          <button class="type-options__item" :class="{ 'type-options__item--active': questionType === 'all' }" type="default" :disabled="creating" @click="selectQuestionType('all')">全部</button>
          <button class="type-options__item" :class="{ 'type-options__item--active': questionType === 'single' }" type="default" :disabled="creating" @click="selectQuestionType('single')">单选</button>
          <button class="type-options__item" :class="{ 'type-options__item--active': questionType === 'multiple' }" type="default" :disabled="creating" @click="selectQuestionType('multiple')">多选</button>
          <button class="type-options__item" :class="{ 'type-options__item--active': questionType === 'judge' }" type="default" :disabled="creating" @click="selectQuestionType('judge')">判断</button>
        </view>
      </view>
```

Update bottom button disabled:

```vue
        :disabled="creating || !canCreatePractice"
```

- [ ] **Step 6: Update setup page styles**

Extend existing option styles so count/type options wrap safely:

```scss
.count-options,
.segmented-options,
.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.count-options__item,
.segmented-options__item,
.type-options__item {
  flex: 1 1 180rpx;
  min-width: 0;
  height: 76rpx;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 8rpx;
  border: 1rpx solid #b8c7d8;
  background: #ffffff;
  color: #1f5f8b;
  font-size: 28rpx;
  line-height: 76rpx;
}

.count-options__item--active,
.segmented-options__item--active,
.type-options__item--active {
  border-color: #1f5f8b;
  background: #1f5f8b;
  color: #ffffff;
}

.custom-count {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
}

.custom-count__label {
  flex-shrink: 0;
  color: #697586;
  font-size: 26rpx;
}

.custom-count__input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 8rpx;
  border: 1rpx solid #cbd5e1;
  background: #ffffff;
  color: #202938;
  font-size: 28rpx;
  box-sizing: border-box;
}
```

Remove or merge the old `.count-options` / `.count-options__item` duplicate declarations.

- [ ] **Step 7: Run focused frontend tests**

```powershell
node scripts/run-bun.mjs test tests/frontend/cloudApi.spec.ts tests/frontend/pages.spec.ts tests/frontend/types.spec.ts
```

Expected: PASS.

---

## Task 3: Manual QA And Final Verification

**Files:**
- Create: `docs/manual-qa/practice-settings-v1-2.md`

- [ ] **Step 1: Create Chinese manual QA document**

Create `docs/manual-qa/practice-settings-v1-2.md` with:

```md
# 练习设置增强 v1.2 手工验收

## 验收目标

- 开始练习页支持固定题量、全部练习和自定义题数。
- 开始练习页支持顺序和随机出题。
- 开始练习页支持全部题目和未练习题目。
- 开始练习页支持全部、单选、多选、判断题型筛选。
- 创建练习后题目数量和题目范围符合所选设置。

## 准备

1. HBuilderX 上传或同步：
   - `common/shuati-shared`
   - `practiceCreate`
   - `practiceDetail`
   - `answerSubmit`
2. 同步 `practice_sessions` schema，确认包含 `countMode`、`requestedCount`、`orderMode`、`scope`、`questionType`。
3. 准备一个已导入题库的资料，最好包含单选、多选、判断三类题。

## 验收步骤

### 1. 全部练习

1. 进入资料详情，点击开始练习。
2. 选择“全部练习”。
3. 选择“全部题目”“顺序”“全部题型”。
4. 点击开始练习。

预期：进入做题页，题目数量等于当前资料可练习题目数。

### 2. 自定义题数

1. 返回开始练习页。
2. 选择“自定义”。
3. 输入 `3`。
4. 点击开始练习。

预期：进入做题页，本次练习最多 3 题；如果当前筛选后不足 3 题，则使用实际可用题数。

### 3. 题型筛选

1. 返回开始练习页。
2. 选择“全部练习”。
3. 选择“单选”。
4. 点击开始练习。

预期：做题页只出现单选题。多选、判断同理验证一次。

### 4. 未练习题目

1. 先完成至少 1 道题。
2. 回到开始练习页。
3. 选择“未练习题目”。
4. 选择“全部练习”并开始。

预期：已经提交过答案的题不再出现在本次练习里。

### 5. 随机出题

1. 回到开始练习页。
2. 选择“随机”。
3. 使用相同资料创建两次练习。

预期：两次练习题目顺序有机会不同；如果题目很少，允许偶尔相同。

## 通过标准

- 页面选项清晰，没有文字挤压或遮挡。
- 自定义题数为空或非法时不会创建 0 题练习。
- 无符合条件题目时显示错误，不白屏。
- 创建练习后能正常答题和查看结果。
```

- [ ] **Step 2: Run complete tests**

```powershell
node scripts/run-bun.mjs test
```

Expected: PASS.

- [ ] **Step 3: Run mini-program build**

```powershell
npm.cmd run build:mp-weixin
```

Expected: build succeeds. Existing Sass legacy API warnings are acceptable if there are no build errors.

---

## Self-Review

- Spec coverage: The plan covers 全部练习、自定义题数、顺序/随机、未练习题目、题型筛选。
- Backend truth source: Filtering and ordering live in `practiceService`, not only in the UI.
- Backward compatibility: Existing calls with only `{ materialId, count }` still create fixed sequence practice.
- Scope control: No复习计划、复杂统计、错题练习重构。
- Test coverage: Cloud tests cover selection behavior; frontend tests cover API contract and UI structure; manual QA covers real HBuilderX validation.
