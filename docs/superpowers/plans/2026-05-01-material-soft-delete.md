# Material Soft Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页“我的资料”中支持删除资料，让解析失败、重复上传、解析中卡住、已完成但不再需要的资料可以从用户视图中移除。

**Architecture:** 采用服务端软删除：`materials.deletedAt` 有值即视为已删除，首页列表和资料详情默认排除已删除资料。第一版不物理删除 PDF、候选题、题目、练习记录和错题记录，避免破坏历史答题链路；以后需要释放存储时再做后台清理任务。

**Tech Stack:** uni-app Vue 3 + TypeScript、DCloud uniCloud 支付宝云函数、CommonJS shared services、Bun/Vitest 测试、HBuilderX 微信小程序构建。

---

## 当前结论

首页需要删除能力，原因：

- 上传失败或解析失败的资料现在无法清理，会一直占首页。
- 解析中卡住的资料没有退出路径。
- 成功导入后的资料如果用户不再需要，也应该能从首页移除。
- 成功资料已经关联 `questions`、`practice_sessions`、`attempts`、`wrong_questions`，所以第一版不能直接物理级联删除。

本计划选择软删除：

- `materials.deletedAt = ''`：未删除。
- `materials.deletedAt = ISO 时间字符串`：已删除。
- `materialList` 不返回已删除资料。
- `materialDetail`、`getMaterialForOwner` 默认把已删除资料当作不存在。
- `materialDelete` 只更新当前用户自己的资料。

## 文件结构

- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js`
  - 增加 `deletedAt` 字段汇总。
  - `listMaterials` 过滤软删除资料。
  - `getMaterialForOwner` / `getMaterialDetail` 默认排除软删除资料。
  - 新增 `deleteMaterial` 服务方法。
- Modify: `uniCloud-alipay/database/materials.schema.json`
  - 增加 `deletedAt` 字段。
- Modify: `tests/cloud/materialService.spec.js`
  - 增加软删除、过滤、权限、缺参测试。
- Modify: `tests/cloud/unicloudDatabaseSchema.spec.js`
  - 增加 `materials.deletedAt` schema 测试。
- Create: `uniCloud-alipay/cloudfunctions/materialDelete/index.js`
  - 新增云函数入口。
- Create: `uniCloud-alipay/cloudfunctions/materialDelete/package.json`
  - 声明 `shuati-shared` 依赖，支持 HBuilderX 上传。
- Modify: `tests/cloud/unicloudFunctionWrappers.spec.js`
  - 把 `materialDelete` 加入普通云函数包装器检查。
- Modify: `common/types.ts`
  - `Material` 增加 `deletedAt: string`。
- Modify: `common/api/cloud.ts`
  - 增加 `api.materialDelete(materialId)`。
- Modify: `tests/frontend/cloudApi.spec.ts`
  - 增加前端 API 调用测试。
- Modify: `components/MaterialCard.vue`
  - 增加删除按钮、删除事件、删除中状态。
- Modify: `pages/index/index.vue`
  - 处理删除确认、调用 API、删除后刷新本地列表。
- Modify: `tests/frontend/pages.spec.ts`
  - 增加首页删除入口和交互结构检查。
- Create: `docs/manual-qa/material-delete-v1-1.md`
  - 增加中文手动验收文档。

---

## Task 1: Backend Soft Delete Service

**Files:**
- Modify: `tests/cloud/materialService.spec.js`
- Modify: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js`
- Modify: `uniCloud-alipay/database/materials.schema.json`
- Modify: `tests/cloud/unicloudDatabaseSchema.spec.js`

- [ ] **Step 1: Write failing service tests**

In `tests/cloud/materialService.spec.js`, update the import:

```js
const { createMaterial, deleteMaterial, getMaterialDetail, getMaterialForOwner, listMaterials } = sharedModule('services/materialService')
```

Append these tests before the final `})`:

```js
  it('soft deletes an owned material and excludes it from material lists', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'delete.pdf'), fileName: 'delete.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    const deleted = await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:01:00.000Z',
    })
    const listed = await listMaterials({ db, openid: 'user_a' })

    expect(deleted).toMatchObject({
      _id: material._id,
      fileName: 'delete.pdf',
      deletedAt: '2026-05-01T00:01:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
    })
    expect(listed).toEqual([])
  })

  it('treats a deleted material as missing for detail and owner reads', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'hidden.pdf'), fileName: 'hidden.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:02:00.000Z',
    })

    await expect(getMaterialDetail({ db, openid: 'user_a', materialId: material._id })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })
    await expect(getMaterialForOwner({ db, openid: 'user_a', materialId: material._id })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })
  })

  it('does not allow deleting another users material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'private.pdf'), fileName: 'private.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    await expect(deleteMaterial({
      db,
      openid: 'user_b',
      materialId: material._id,
      now: '2026-05-01T00:03:00.000Z',
    })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })

    const listed = await listMaterials({ db, openid: 'user_a' })
    expect(listed).toHaveLength(1)
    expect(listed[0]._id).toBe(material._id)
  })

  it('requires material id and timestamp when deleting material', async () => {
    const db = createFakeDb()

    await expect(deleteMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:04:00.000Z',
    })).rejects.toMatchObject({
      code: 'missing_material_id',
      message: '缺少资料 ID',
    })

    await expect(deleteMaterial({
      db,
      openid: 'user_a',
      materialId: 'material_a',
    })).rejects.toMatchObject({
      code: 'missing_timestamp',
      message: '缺少删除时间',
    })
  })
```

- [ ] **Step 2: Run service test to verify failure**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js
```

Expected: fails because `deleteMaterial` is not exported or not implemented.

- [ ] **Step 3: Implement soft delete in material service**

In `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js`, add helpers after `assertFileBelongsToOwner`:

```js
function isMaterialDeleted(material) {
  return Boolean(material && material.deletedAt)
}

function createMaterialNotFoundError() {
  const error = new Error('资料不存在')
  error.code = 'material_not_found'
  return error
}
```

Change `summarizeMaterial(material)` to include:

```js
    deletedAt: material.deletedAt || '',
```

Change `createMaterial` data to include:

```js
    deletedAt: '',
```

Replace `listMaterials` with:

```js
async function listMaterials({ db, openid }) {
  const result = await db.collection('materials').where({ ownerOpenid: openid }).orderBy('createdAt', 'desc').get()
  return result.data.filter((material) => !isMaterialDeleted(material)).map(summarizeMaterial)
}
```

Add this shared finder before `getMaterialForOwner`:

```js
async function findMaterialForOwner({ db, openid, materialId, includeDeleted = false }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')

  const result = await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).get()
  const material = result.data[0]
  if (!material || (!includeDeleted && isMaterialDeleted(material))) {
    throw createMaterialNotFoundError()
  }
  return material
}
```

Replace `getMaterialForOwner`:

```js
async function getMaterialForOwner({ db, openid, materialId, includeDeleted = false }) {
  return findMaterialForOwner({ db, openid, materialId, includeDeleted })
}
```

Replace `getMaterialDetail`:

```js
async function getMaterialDetail({ db, openid, materialId }) {
  const material = await findMaterialForOwner({ db, openid, materialId })
  return summarizeMaterial(material)
}
```

Add `deleteMaterial`:

```js
async function deleteMaterial({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少删除时间')

  const material = await findMaterialForOwner({ db, openid, materialId, includeDeleted: true })
  if (isMaterialDeleted(material)) return summarizeMaterial(material)

  const data = {
    deletedAt: now,
    updatedAt: now,
  }
  await db.collection('materials').doc(material._id).update({ data })
  return summarizeMaterial({ ...material, ...data })
}
```

Update exports:

```js
module.exports = {
  createMaterial,
  deleteMaterial,
  getMaterialDetail,
  getMaterialForOwner,
  listMaterials,
}
```

- [ ] **Step 4: Add `deletedAt` to database schema**

In `uniCloud-alipay/database/materials.schema.json`, add:

```json
"deletedAt": { "bsonType": "string" }
```

Place it with the other timestamp fields:

```json
"createdAt": { "bsonType": "string" },
"updatedAt": { "bsonType": "string" },
"deletedAt": { "bsonType": "string" }
```

Do not add `deletedAt` to `required`.

- [ ] **Step 5: Add schema test**

In `tests/cloud/unicloudDatabaseSchema.spec.js`, add:

```js
  it('allows materials to be soft deleted with deletedAt', () => {
    const materials = readSchema('materials')

    expect(materials.properties.deletedAt).toEqual({ bsonType: 'string' })
    expect(materials.required).not.toContain('deletedAt')
  })
```

- [ ] **Step 6: Run backend tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: all tests pass.

---

## Task 2: Cloud Function Wrapper and Frontend API

**Files:**
- Create: `uniCloud-alipay/cloudfunctions/materialDelete/index.js`
- Create: `uniCloud-alipay/cloudfunctions/materialDelete/package.json`
- Modify: `tests/cloud/unicloudFunctionWrappers.spec.js`
- Modify: `common/types.ts`
- Modify: `common/api/cloud.ts`
- Modify: `tests/frontend/cloudApi.spec.ts`

- [ ] **Step 1: Write cloud wrapper test**

In `tests/cloud/unicloudFunctionWrappers.spec.js`, add `materialDelete` immediately after `materialDetail`:

```js
  'materialDelete',
```

- [ ] **Step 2: Run wrapper test to verify failure**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/unicloudFunctionWrappers.spec.js
```

Expected: fails because `uniCloud-alipay/cloudfunctions/materialDelete/index.js` and `package.json` do not exist.

- [ ] **Step 3: Create `materialDelete` cloud function**

Create `uniCloud-alipay/cloudfunctions/materialDelete/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { deleteMaterial } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const now = new Date().toISOString()
    const material = await deleteMaterial({ db, openid: uid, materialId: event.materialId, now })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `uniCloud-alipay/cloudfunctions/materialDelete/package.json`:

```json
{
  "dependencies": {
    "shuati-shared": "file:../common/shuati-shared"
  }
}
```

- [ ] **Step 4: Update frontend type and API tests**

In `common/types.ts`, add to `Material`:

```ts
  deletedAt: string
```

In `tests/frontend/cloudApi.spec.ts`, append:

```ts
  test('materialDelete calls cloud function with material id and auth tokens', async () => {
    const material = {
      _id: 'material_1',
      fileName: 'demo.pdf',
      fileSize: 1024,
      status: 'failed',
      parseMode: 'inline_answer',
      questionCount: 0,
      readyCandidateCount: 0,
      needReviewCandidateCount: 0,
      invalidCandidateCount: 0,
      errorMessage: '解析失败',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
      deletedAt: '2026-05-01T00:01:00.000Z',
    }
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: { material },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.materialDelete('material_1')).resolves.toEqual({ material })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'materialDelete',
      data: { materialId: 'material_1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })
```

- [ ] **Step 5: Implement frontend API**

In `common/api/cloud.ts`, add to `api` after `materialDetail`:

```ts
  materialDelete: (materialId: string) => callFunction<{ material: Material }>('materialDelete', { materialId }),
```

- [ ] **Step 6: Run wrapper and frontend API tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/unicloudFunctionWrappers.spec.js tests/frontend/cloudApi.spec.ts tests/frontend/types.spec.ts
```

Expected: all tests pass.

---

## Task 3: Home Page Delete Interaction

**Files:**
- Modify: `components/MaterialCard.vue`
- Modify: `pages/index/index.vue`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Write page structure tests**

In `tests/frontend/pages.spec.ts`, add:

```ts
  test('home material cards expose a safe delete interaction', () => {
    const cardSource = read('components/MaterialCard.vue')
    const homeSource = read('pages/index/index.vue')

    expect(cardSource).toContain("delete: [id: string]")
    expect(cardSource).toContain('@click.stop')
    expect(cardSource).toContain("emit('delete', props.material._id)")
    expect(cardSource).toContain('删除')
    expect(homeSource).toContain('@delete="confirmDeleteMaterial"')
    expect(homeSource).toContain('api.materialDelete(material._id)')
    expect(homeSource).toContain('showDeleteConfirm')
    expect(homeSource).toContain('deletedId')
    expect(homeSource).toContain('materials.value = materials.value.filter')
  })
```

- [ ] **Step 2: Run page test to verify failure**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: fails because the delete interaction is not implemented.

- [ ] **Step 3: Update `MaterialCard.vue` contract**

Change props and emits:

```ts
const props = withDefaults(defineProps<{ material: Material; deleting?: boolean }>(), {
  deleting: false,
})
const emit = defineEmits<{ open: [id: string]; delete: [id: string] }>()
```

Add:

```ts
function requestDelete() {
  if (props.deleting) return
  emit('delete', props.material._id)
}
```

In the header, keep the status badge and add a small delete button next to it:

```vue
      <view class="material-card__actions">
        <StatusBadge
          :text="MATERIAL_STATUS_TEXT[props.material.status]"
          :type="statusType(props.material.status)"
        />
        <button
          class="material-card__delete"
          type="default"
          :disabled="props.deleting"
          @click.stop="requestDelete"
        >
          {{ props.deleting ? '删除中' : '删除' }}
        </button>
      </view>
```

Add styles:

```scss
.material-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.material-card__delete {
  width: 96rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #d6dde8;
  background: #ffffff;
  color: #9f2a2a;
  font-size: 24rpx;
  line-height: 52rpx;
}

.material-card__delete[disabled] {
  color: #a4acb9;
  background: #f2f4f7;
}
```

- [ ] **Step 4: Update home page deletion handler**

In `pages/index/index.vue`, add:

```ts
const deletedId = ref('')
```

Add functions before navigation functions:

```ts
function deleteConfirmText(material: Material) {
  if (material.status === 'ready' && material.questionCount > 0) {
    return '删除后首页不再显示该资料。已生成的题目、历史练习和错题记录会保留，确认删除？'
  }
  if (material.status === 'parsing') {
    return '该资料可能仍在后台解析。删除后首页不再显示，后续可重新上传，确认删除？'
  }
  return '删除后首页不再显示该资料，后续可重新上传，确认删除？'
}

function showDeleteConfirm(material: Material): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '删除资料',
      content: deleteConfirmText(material),
      confirmText: '删除',
      confirmColor: '#d93025',
      cancelText: '取消',
      success(result) {
        resolve(Boolean(result.confirm))
      },
      fail() {
        resolve(false)
      },
    })
  })
}

async function confirmDeleteMaterial(materialId: string) {
  const material = materials.value.find((item) => item._id === materialId)
  if (!material || deletedId.value) return

  const confirmed = await showDeleteConfirm(material)
  if (!confirmed) return

  deletedId.value = material._id
  errorMessage.value = ''

  try {
    await api.materialDelete(material._id)
    materials.value = materials.value.filter((item) => item._id !== material._id)
    uni.showToast({ title: '已删除资料', icon: 'none' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败，请重试'
  } finally {
    deletedId.value = ''
  }
}
```

Update the component usage:

```vue
      <MaterialCard
        v-for="material in materials"
        :key="material._id"
        :material="material"
        :deleting="deletedId === material._id"
        @open="openMaterial"
        @delete="confirmDeleteMaterial"
      />
```

- [ ] **Step 5: Run frontend page tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: all tests pass.

---

## Task 4: Manual QA and Full Verification

**Files:**
- Create: `docs/manual-qa/material-delete-v1-1.md`

- [ ] **Step 1: Create Chinese manual QA document**

Create `docs/manual-qa/material-delete-v1-1.md`:

```md
# 资料删除 v1.1 手动验收清单

验收日期：2026-05-01

项目路径：`G:\HBuilderProjects\ShuaTi`

## 验收前准备

- HBuilderX 项目已经关联正确的 `uniCloud-alipay` 支付宝云服务空间。
- 已上传公共模块 `uniCloud-alipay/cloudfunctions/common/shuati-shared`。
- 已上传云函数 `materialDelete`。
- 已同步 `materials` 数据库 schema，确认存在 `deletedAt` 字段。
- 首页已有至少一条资料记录，建议同时准备：解析失败资料、解析中资料、待审核资料、可刷题资料。

## 验收场景

### 1. 删除解析失败资料

操作步骤：

1. 打开首页“我的资料”。
2. 找到状态为“解析失败”的资料。
3. 点击资料卡片上的“删除”。
4. 在确认弹窗中点击“删除”。

预期结果：

- 资料卡片从首页消失。
- 刷新首页后该资料仍不再出现。
- 云数据库 `materials` 中该记录的 `deletedAt` 有值。

### 2. 删除可刷题资料

操作步骤：

1. 打开首页“我的资料”。
2. 找到状态为“可刷题”的资料。
3. 点击“删除”。
4. 阅读确认弹窗文案并点击“删除”。

预期结果：

- 首页不再展示该资料。
- 不出现白屏或云函数错误。
- 历史练习记录不需要在本版本物理清除。

### 3. 取消删除

操作步骤：

1. 点击任意资料卡片上的“删除”。
2. 在确认弹窗中点击“取消”。

预期结果：

- 资料仍然保留在首页。
- 不调用删除后的刷新逻辑。

### 4. 删除中防重复点击

操作步骤：

1. 点击“删除”并确认。
2. 在删除请求未完成前观察按钮状态。

预期结果：

- 当前卡片显示“删除中”。
- 重复点击不会发起多个删除请求。

## 验收结论记录

- 测试环境：开发者工具 / 真机 / 体验版
- 云服务空间：
- 测试账号：
- 是否通过：
- 失败截图或错误日志：
```

- [ ] **Step 2: Run focused tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud/materialService.spec.js tests/cloud/unicloudDatabaseSchema.spec.js tests/cloud/unicloudFunctionWrappers.spec.js tests/frontend/cloudApi.spec.ts tests/frontend/pages.spec.ts tests/frontend/types.spec.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run full cloud and frontend tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/cloud
node scripts/run-bun.mjs test tests/frontend
```

Expected: all tests pass.

- [ ] **Step 4: Build WeChat mini-program output**

Run:

```powershell
npm.cmd run build:mp-weixin
```

Expected: build completes and prints:

```text
DONE  Build complete.
Run method: open Weixin Mini Program Devtools, import dist\build\mp-weixin run.
```

---

## Subagent-Driven Execution Plan

Use fresh subagents sequentially, not in parallel, because tasks touch shared API and page contracts.

### Subagent Task Order

1. **Backend worker:** Execute Task 1 only.
   - Owns `materialService.js`, `materials.schema.json`, `materialService.spec.js`, `unicloudDatabaseSchema.spec.js`.
   - Must not edit frontend files.
   - After implementation, run the Task 1 test command and report changed paths.

2. **Backend wrapper/API worker:** Execute Task 2 only.
   - Owns `materialDelete` cloud function, `unicloudFunctionWrappers.spec.js`, `common/types.ts`, `common/api/cloud.ts`, `cloudApi.spec.ts`.
   - Must not edit page UI files.
   - After implementation, run the Task 2 test command and report changed paths.

3. **Frontend worker:** Execute Task 3 only.
   - Owns `MaterialCard.vue`, `pages/index/index.vue`, `pages.spec.ts`.
   - Must not edit backend service files.
   - After implementation, run the Task 3 test command and report changed paths.

4. **QA/docs worker:** Execute Task 4 only.
   - Owns `docs/manual-qa/material-delete-v1-1.md`.
   - Runs focused tests, full cloud/frontend tests, and mini-program build.
   - Reports any environment-only warnings separately from failures.

### Review After Each Worker

After each implementation worker returns:

1. Dispatch a spec reviewer subagent with the exact task text and the changed paths.
2. If spec reviewer finds gaps, send the same worker back to fix them.
3. Dispatch a code quality reviewer subagent only after spec review passes.
4. If code quality reviewer finds issues, send the same worker back to fix them.
5. Mark that task complete only after both reviews pass.

### Branch and Commit Rule

The current worktree already contains previous feature changes. Subagents must not run `git commit`, `git reset`, `git checkout`, or revert unrelated files. Each subagent reports changed paths and verification output; final commit/push is handled separately after user approval.

## Self-Review

- Spec coverage: Failed, parsing, reviewing, ready materials all get the same soft-delete capability through `materialDelete`; homepage exposes the action; schema and tests cover soft deletion.
- Scope control: This plan does not physically delete cloud storage files or cascade-delete questions/attempts/wrong questions. That is intentional to avoid breaking existing history.
- Type consistency: `deletedAt` is a string across schema, backend summary, frontend `Material`, tests, and API response.
- No placeholders: All tasks list exact files, exact commands, and concrete code snippets.
