# Material Practice Progress v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页资料卡在解析/导入统计下方展示“已刷 X/Y 题”和进度条，让用户直观看到每份资料的练习进度。

**Architecture:** 后端 `materialList` 负责计算每份资料下用户已提交过答案的去重题目数，前端 `MaterialCard` 只读取 `practicedQuestionCount` 并展示。统计口径为当前用户、当前资料、至少有一次 `attempts` 记录的去重 `questionId`，错题练习中的同资料题目也计入。

**Tech Stack:** uni-app Vue 3 + TypeScript, uniCloud 支付宝云函数, Vitest/Bun test runner, existing fakeDb cloud service tests.

---

## File Structure

- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js`
  - Add `practicedQuestionCount` to material summaries.
  - Add a helper that maps current user's `attempts.questionId` to owned `questions.materialId`.
- Modify: `common/types.ts`
  - Add `practicedQuestionCount: number` to `Material`.
- Modify: `components/MaterialCard.vue`
  - Render progress text and progress bar below existing four-stat row.
- Modify: `tests/cloud/materialService.spec.js`
  - Add backend test for distinct practiced count per material and per owner.
- Modify: `tests/frontend/pages.spec.ts`
  - Add static assertions that the card renders progress text and classes.

## Scope Rules

- Do not add complex analytics, accuracy, streaks, or per-material history.
- Do not change practice creation or answer submission behavior.
- Do not count candidate questions that were not imported to `questions`.
- Do not count duplicate attempts for the same question more than once.

### Task 1: Backend Failing Test

**Files:**
- Modify: `tests/cloud/materialService.spec.js`

- [ ] **Step 1: Write the failing backend test**

Add this test after `lists current user materials newest first`:

```js
  it('includes distinct practiced question count per material for current user', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'a.pdf'), fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:01:00.000Z', input: { fileID: ownedFileId('user_a', 'b.pdf'), fileName: 'b.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await db.collection('questions').add({ data: { _id: 'q_a_1', ownerOpenid: 'user_a', materialId: 'materials_1' } })
    await db.collection('questions').add({ data: { _id: 'q_a_2', ownerOpenid: 'user_a', materialId: 'materials_1' } })
    await db.collection('questions').add({ data: { _id: 'q_b_1', ownerOpenid: 'user_a', materialId: 'materials_2' } })
    await db.collection('questions').add({ data: { _id: 'q_other', ownerOpenid: 'user_b', materialId: 'materials_1' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_1', ownerOpenid: 'user_a', sessionId: 'session_1', questionId: 'q_a_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:02:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_2', ownerOpenid: 'user_a', sessionId: 'session_2', questionId: 'q_a_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:03:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_3', ownerOpenid: 'user_a', sessionId: 'session_3', questionId: 'q_a_2', selectedKeys: ['B'], isCorrect: false, createdAt: '2026-04-26T00:04:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_4', ownerOpenid: 'user_a', sessionId: 'session_4', questionId: 'q_b_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:05:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_5', ownerOpenid: 'user_b', sessionId: 'session_5', questionId: 'q_other', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:06:00.000Z' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result.map((material) => ({
      fileName: material.fileName,
      practicedQuestionCount: material.practicedQuestionCount,
    }))).toEqual([
      { fileName: 'b.pdf', practicedQuestionCount: 1 },
      { fileName: 'a.pdf', practicedQuestionCount: 2 },
    ])
  })
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js
```

Expected: FAIL because `practicedQuestionCount` is missing or `undefined`.

### Task 2: Backend Implementation

**Files:**
- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js`

- [ ] **Step 1: Add practiced count to summary**

Change `summarizeMaterial` signature and returned object:

```js
function summarizeMaterial(material, practicedQuestionCount = 0) {
  return {
    _id: material._id,
    fileName: material.fileName,
    fileSize: material.fileSize,
    status: material.status,
    parseMode: material.parseMode,
    questionCount: material.questionCount || 0,
    practicedQuestionCount,
    readyCandidateCount: material.readyCandidateCount || 0,
    needReviewCandidateCount: material.needReviewCandidateCount || 0,
    invalidCandidateCount: material.invalidCandidateCount || 0,
    errorMessage: material.errorMessage || '',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    deletedAt: material.deletedAt || '',
    ownerOpenid: material.ownerOpenid,
  }
}
```

- [ ] **Step 2: Add per-material practiced count helper**

Insert before `createMaterial`:

```js
async function getPracticedQuestionCountsByMaterial({ db, openid }) {
  const attempts = await db.collection('attempts').where({ ownerOpenid: openid }).get()
  const attemptedQuestionIds = [...new Set(attempts.data.map((attempt) => attempt.questionId).filter(Boolean))]
  if (attemptedQuestionIds.length === 0) return new Map()

  const questions = await db.collection('questions').where({ ownerOpenid: openid }).get()
  const attemptedQuestionIdsSet = new Set(attemptedQuestionIds)
  const materialQuestionIds = new Map()

  for (const question of questions.data) {
    if (!attemptedQuestionIdsSet.has(question._id) || !question.materialId) continue
    if (!materialQuestionIds.has(question.materialId)) materialQuestionIds.set(question.materialId, new Set())
    materialQuestionIds.get(question.materialId).add(question._id)
  }

  const counts = new Map()
  for (const [materialId, questionIds] of materialQuestionIds.entries()) {
    counts.set(materialId, questionIds.size)
  }
  return counts
}
```

- [ ] **Step 3: Use helper in `listMaterials` only**

Replace `listMaterials` with:

```js
async function listMaterials({ db, openid }) {
  const result = await db.collection('materials').where({ ownerOpenid: openid }).orderBy('createdAt', 'desc').get()
  const practicedCounts = await getPracticedQuestionCountsByMaterial({ db, openid })
  return result.data
    .filter((material) => !isMaterialDeleted(material))
    .map((material) => summarizeMaterial(material, practicedCounts.get(material._id) || 0))
}
```

- [ ] **Step 4: Run backend test to verify GREEN**

Run:

```bash
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js
```

Expected: PASS.

### Task 3: Frontend Types and Card Display

**Files:**
- Modify: `common/types.ts`
- Modify: `components/MaterialCard.vue`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Write frontend static assertions**

Add these expectations to the `home material cards expose a safe delete interaction` test:

```ts
    expect(cardSource).toContain('practicedQuestionCount')
    expect(cardSource).toContain('已刷')
    expect(cardSource).toContain('material-card__progress')
    expect(cardSource).toContain('material-card__progress-fill')
```

- [ ] **Step 2: Run frontend test to verify RED**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: FAIL because the card has no progress UI yet.

- [ ] **Step 3: Add Material type field**

In `common/types.ts`, add:

```ts
  practicedQuestionCount: number
```

immediately after:

```ts
  questionCount: number
```

- [ ] **Step 4: Add MaterialCard computed helpers**

In `components/MaterialCard.vue`, add after `const emit = ...`:

```ts
const practicedCount = computed(() => Math.min(
  Math.max(Number(props.material.practicedQuestionCount || 0), 0),
  Math.max(Number(props.material.questionCount || 0), 0),
))
const progressPercent = computed(() => {
  const total = Number(props.material.questionCount || 0)
  if (total <= 0) return 0
  return Math.round((practicedCount.value / total) * 100)
})
```

Also update the import:

```ts
import { computed } from 'vue'
```

- [ ] **Step 5: Add progress UI below stats**

Insert after `</view>` for `.material-card__stats`:

```vue
    <view class="material-card__progress">
      <view class="material-card__progress-row">
        <text class="material-card__progress-text">已刷 {{ practicedCount }}/{{ props.material.questionCount }} 题</text>
        <text class="material-card__progress-percent">{{ progressPercent }}%</text>
      </view>
      <view class="material-card__progress-track">
        <view class="material-card__progress-fill" :style="{ width: `${progressPercent}%` }" />
      </view>
    </view>
```

- [ ] **Step 6: Add progress styles**

Append before `.material-card__meta`:

```scss
.material-card__progress {
  margin-top: 20rpx;
}

.material-card__progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.material-card__progress-text,
.material-card__progress-percent {
  color: #4f6475;
  font-size: 24rpx;
  line-height: 34rpx;
}

.material-card__progress-track {
  height: 8rpx;
  margin-top: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e7edf3;
}

.material-card__progress-fill {
  height: 100%;
  border-radius: 999rpx;
  background: #246d9d;
}
```

- [ ] **Step 7: Run frontend test to verify GREEN**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: PASS.

### Task 4: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend and frontend tests**

Run:

```bash
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js tests/frontend/pages.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
node scripts/run-bun.mjs test
```

Expected: PASS.

- [ ] **Step 3: Run mp-weixin build**

Run:

```bash
npm.cmd run build:mp-weixin
```

Expected: build complete. Existing Sass legacy API warnings are acceptable.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: modified files should include this plan, service, type, card, and tests. Existing untracked PDF/temp files may remain unrelated and must not be staged unless the user asks.

## Self-Review

- Spec coverage: The plan covers backend count, frontend display, type safety, and tests. It intentionally excludes accuracy and analytics.
- Placeholder scan: No TBD/TODO/later placeholders.
- Type consistency: The new field is consistently named `practicedQuestionCount` in backend, TypeScript, card, and tests.
