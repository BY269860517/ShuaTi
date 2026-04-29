# uniCloud Alipay Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ShuaTi's WeChat Cloud backend with DCloud `uniCloud-alipay` while keeping the existing frontend flow and business behavior.

**Architecture:** Keep the current page-level API surface and move the platform boundary underneath it. The frontend calls `uniCloud.callFunction` and `uniCloud.uploadFile`; the backend uses ordinary uniCloud cloud functions under `uniCloud-alipay/cloudfunctions`, shared CommonJS services under `common/shuati-shared`, and `uni-id` token identity where `uid` is stored in the existing owner fields for first-phase compatibility.

**Tech Stack:** uni-app + Vue 3 + TypeScript, DCloud uniCloud Alipay ordinary cloud functions, uni-id / uni-id-common, CommonJS service modules, `pdf-parse`, Vitest, Bun from `F:\.bun`.

---

## Current State

The current repository is on `main`, with one docs commit ahead of `origin/main`:

- Spec: `docs/superpowers/specs/2026-04-29-unicloud-alipay-migration-design.md`
- Existing backend: `cloudfunctions/*` using `wx-server-sdk`
- Existing frontend adapter: `common/api/cloud.ts` using `wx.cloud.callFunction`
- Existing upload page: `pages/upload/index.vue` using `wx.cloud.uploadFile`
- Existing build helper: `scripts/uni-cli.mjs` copies `cloudfunctions` into the WeChat mini-program build output

The implementation must end with:

- `uniCloud-alipay` present and HBuilderX-recognizable.
- No runtime code path using `wx.cloud.callFunction`.
- No runtime code path using `wx.cloud.uploadFile`.
- Old `cloudfunctions` removed after its reusable logic is moved.
- Tests and build passing.

## File Structure

Create:

```text
uniCloud-alipay/
  cloudfunctions/
    common/
      shuati-shared/
        auth.js
        db.js
        index.js
        package.json
        response.js
        parser/
          index.js
          normalize.js
          validate.js
        services/
          candidateService.js
          importService.js
          materialService.js
          parseService.js
          practiceService.js
          userService.js
      uni-config-center/
        uni-id/
          config.example.json
    userLogin/index.js
    materialCreate/index.js
    materialList/index.js
    materialDetail/index.js
    parseStart/index.js
    parseRunner/index.js
    parseRunner/package.json
    parseStatus/index.js
    candidateList/index.js
    candidateDetail/index.js
    candidateUpdate/index.js
    importConfirm/index.js
    questionList/index.js
    practiceCreate/index.js
    practiceDetail/index.js
    answerSubmit/index.js
  database/
    users.schema.json
    materials.schema.json
    parse_jobs.schema.json
    material_pages.schema.json
    parse_candidates.schema.json
    questions.schema.json
    practice_sessions.schema.json
    attempts.schema.json
    uni-id-users.index.json
```

Modify:

```text
.gitignore
App.vue
common/api/cloud.ts
common/types.ts
pages/upload/index.vue
scripts/uni-cli.mjs
tests/cloud/*.spec.js
tests/frontend/cloudApi.spec.ts
tests/frontend/pages.spec.ts
```

Delete after migration is complete:

```text
cloudfunctions/
```

Do not commit real `uni-id` secrets. The local file `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json` is intentionally ignored and must be created locally before HBuilderX cloud verification.

---

### Task 1: Baseline and Branch Guard

**Files:**
- Read: `docs/superpowers/specs/2026-04-29-unicloud-alipay-migration-design.md`
- Read: `common/api/cloud.ts`
- Read: `pages/upload/index.vue`
- Read: `scripts/uni-cli.mjs`

- [ ] **Step 1: Check current git state**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Expected:

```text
## main...origin/main [ahead 1]
5603b75 docs: design unicloud alipay migration
```

If there are unrelated user changes, do not revert them. Note them before editing.

- [ ] **Step 2: Run the current baseline tests**

Run:

```powershell
F:\.bun\bin\bun.exe test
```

Expected: all existing tests pass before migration edits begin.

- [ ] **Step 3: Run the current baseline build**

Run:

```powershell
F:\.bun\bin\bun.exe run build:mp-weixin
```

Expected: build succeeds. The output may still contain the old copied `cloudfunctions` at this point.

- [ ] **Step 4: Commit only if the baseline generated tracked changes**

Run:

```powershell
git status --short
```

Expected: no tracked changes from baseline commands. Do not commit if there is nothing to commit.

---

### Task 2: Frontend uniCloud API Adapter

**Files:**
- Modify: `tests/frontend/cloudApi.spec.ts`
- Modify: `common/api/cloud.ts`
- Modify: `common/types.ts`

- [ ] **Step 1: Replace frontend API tests with uniCloud expectations**

In `tests/frontend/cloudApi.spec.ts`, replace the WeChat runtime mock with this structure:

```ts
declare global {
  // eslint-disable-next-line no-var
  var uniCloud: {
    callFunction: ReturnType<typeof vi.fn>
  } | undefined

  // eslint-disable-next-line no-var
  var uni: {
    login: ReturnType<typeof vi.fn>
    getStorageSync: ReturnType<typeof vi.fn>
    setStorageSync: ReturnType<typeof vi.fn>
  } | undefined
}
```

Update `afterEach`:

```ts
afterEach(() => {
  vi.restoreAllMocks()
  delete globalThis.uniCloud
  delete globalThis.uni
})
```

Use these concrete tests:

```ts
test('returns data for standard successful cloud responses', async () => {
  const callFunctionMock = vi.fn().mockResolvedValue({ result: { ok: true, data: { value: 1 } } })
  globalThis.uniCloud = { callFunction: callFunctionMock }
  globalThis.uni = {
    login: vi.fn(),
    getStorageSync: vi.fn().mockReturnValue('token_a'),
    setStorageSync: vi.fn(),
  }

  await expect(callFunction<{ value: number }>('demo', { id: '1' })).resolves.toEqual({ value: 1 })
  expect(callFunctionMock).toHaveBeenCalledWith({
    name: 'demo',
    data: { id: '1', _uniToken: 'token_a', uniToken: 'token_a' },
  })
})

test('calls userLogin with a WeChat login code and stores returned token', async () => {
  const callFunctionMock = vi.fn().mockResolvedValue({
    result: {
      ok: true,
      data: {
        token: 'token_next',
        tokenExpired: 1770000000000,
        user: {
          _id: 'uid_a',
          openid: 'uid_a',
          uid: 'uid_a',
          createdAt: '2026-04-29T00:00:00.000Z',
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
      },
    },
  })
  globalThis.uniCloud = { callFunction: callFunctionMock }
  globalThis.uni = {
    login: vi.fn((options) => options.success({ code: 'wx_code_a' })),
    getStorageSync: vi.fn().mockReturnValue(''),
    setStorageSync: vi.fn(),
  }

  await expect(api.userLogin()).resolves.toMatchObject({
    user: { _id: 'uid_a', openid: 'uid_a', uid: 'uid_a' },
  })
  expect(callFunctionMock).toHaveBeenCalledWith({ name: 'userLogin', data: { code: 'wx_code_a' } })
  expect(globalThis.uni.setStorageSync).toHaveBeenCalledWith('uni_id_token', 'token_next')
  expect(globalThis.uni.setStorageSync).toHaveBeenCalledWith('uni_id_token_expired', 1770000000000)
})
```

Keep the existing invalid response and backend error tests, but change their runtime setup from `globalThis.wx.cloud.callFunction` to `globalThis.uniCloud.callFunction`.

- [ ] **Step 2: Run the frontend API test and verify it fails**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/frontend/cloudApi.spec.ts
```

Expected: failures mentioning `wx` runtime usage or missing `uniCloud` adapter behavior.

- [ ] **Step 3: Implement the uniCloud adapter**

Replace the runtime section of `common/api/cloud.ts` with these interfaces and helpers:

```ts
interface UniCloudRuntime {
  callFunction<T = unknown>(options: { name: string; data?: object }): Promise<{ result?: T }>
}

interface UniRuntime {
  login(options: {
    provider: 'weixin'
    success: (result: { code?: string }) => void
    fail: (error: unknown) => void
  }): void
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
}

interface LoginData {
  token?: string
  tokenExpired?: number
  user: UserInfo
}

function getUniCloudRuntime(): UniCloudRuntime {
  const runtime = (globalThis as { uniCloud?: UniCloudRuntime }).uniCloud
  if (!runtime?.callFunction) throwCloudError('missing_unicloud', 'uniCloud runtime is unavailable')
  return runtime
}

function getUniRuntime(): UniRuntime {
  const runtime = (globalThis as { uni?: UniRuntime }).uni
  if (!runtime?.login) throwCloudError('missing_uni', 'uni runtime is unavailable')
  return runtime
}

function getStoredToken(): string {
  try {
    const token = getUniRuntime().getStorageSync('uni_id_token')
    return typeof token === 'string' ? token : ''
  } catch (_) {
    return ''
  }
}

function attachToken(data: object): object {
  const token = getStoredToken()
  if (!token) return data
  return { ...data, _uniToken: token, uniToken: token }
}

function storeLoginData(data: LoginData): void {
  if (!data?.token) return
  const runtime = getUniRuntime()
  runtime.setStorageSync('uni_id_token', data.token)
  if (data.tokenExpired) {
    runtime.setStorageSync('uni_id_token_expired', data.tokenExpired)
  }
}

function loginByWeixin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    getUniRuntime().login({
      provider: 'weixin',
      success(result) {
        const code = result?.code
        if (!code) {
          reject(Object.assign(new Error('missing weixin login code'), { code: 'missing_login_code' }))
          return
        }
        resolve({ code })
      },
      fail: reject,
    })
  })
}
```

Change `callFunction` to use `uniCloud`:

```ts
export async function callFunction<T>(name: string, data: object = {}): Promise<T> {
  const requestData = name === 'userLogin' ? data : attachToken(data)
  const response = await getUniCloudRuntime().callFunction({ name, data: requestData }) as CloudFunctionResult<T>
  const result = response.result

  if (!isCloudFunctionResponse(result)) {
    throwCloudError('invalid_response', '云函数响应格式错误')
  }

  if (result.ok === false) {
    const error = new Error(result?.error?.message || '请求失败') as CloudFunctionError
    error.code = result?.error?.code
    throw error
  }

  return result.data as T
}
```

Change `api.userLogin`:

```ts
userLogin: async () => {
  const { code } = await loginByWeixin()
  const data = await callFunction<LoginData>('userLogin', { code })
  storeLoginData(data)
  return { user: data.user }
},
```

The remaining `api.*` methods keep their names and payloads.

- [ ] **Step 4: Add uid compatibility to `UserInfo`**

Modify `common/types.ts`:

```ts
export interface UserInfo {
  _id: string
  openid: string
  uid?: string
  createdAt: string
  updatedAt: string
  created?: boolean
}
```

- [ ] **Step 5: Run the frontend API test**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/frontend/cloudApi.spec.ts
```

Expected: `tests/frontend/cloudApi.spec.ts` passes.

- [ ] **Step 6: Commit**

Run:

```powershell
git add common/api/cloud.ts common/types.ts tests/frontend/cloudApi.spec.ts
git commit -m "feat: switch frontend api adapter to unicloud"
```

---

### Task 3: Upload Page, App Startup, and Build Helper

**Files:**
- Modify: `pages/upload/index.vue`
- Modify: `App.vue`
- Modify: `scripts/uni-cli.mjs`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Update static page tests for uniCloud storage**

In `tests/frontend/pages.spec.ts`, change the upload-page test expectations:

```ts
expect(source).toContain('uniCloud.uploadFile')
expect(source).not.toContain('wx.cloud.uploadFile')
expect(source).toContain('api.userLogin()')
expect(source).toContain('materials/${loginResult.user.openid}/${Date.now()}-${sanitizeCloudFileName(file.name)}')
```

In the package-script test, remove expectations for old cloud function copying:

```ts
expect(wrapperSource).not.toContain('syncCloudfunctionsOutput')
expect(wrapperSource).not.toContain('copyCloudfunctions')
expect(wrapperSource).not.toContain('vendorCommonIntoFunctionPackages')
expect(wrapperSource).not.toContain('cloudfunctionRoot')
```

Add:

```ts
expect(wrapperSource).toContain('runUniCli(args)')
```

- [ ] **Step 2: Run the page tests and verify they fail**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/frontend/pages.spec.ts
```

Expected: failures mentioning `wx.cloud.uploadFile` and old cloudfunction output script code.

- [ ] **Step 3: Replace upload call**

In `pages/upload/index.vue`, replace:

```ts
const uploadResult = await wx.cloud.uploadFile({
  cloudPath: `materials/${loginResult.user.openid}/${Date.now()}-${sanitizeCloudFileName(file.name)}`,
  filePath: file.path,
}) as UploadResult
```

with:

```ts
const uploadResult = await uniCloud.uploadFile({
  cloudPath: `materials/${loginResult.user.openid}/${Date.now()}-${sanitizeCloudFileName(file.name)}`,
  filePath: file.path,
}) as UploadResult
```

- [ ] **Step 4: Remove wx cloud initialization**

Replace `App.vue` script with:

```vue
<script setup lang="ts">
</script>
```

Keep the existing `<style>` block unchanged.

- [ ] **Step 5: Simplify `scripts/uni-cli.mjs`**

Remove these imports because the script no longer copies WeChat cloud functions:

```js
import { cp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
```

Replace with no filesystem import.

Remove this block after `runUniCli(args)`:

```js
if (code === 0 && isMpWeixinBuild(args)) {
  await syncCloudfunctionsOutput()
}
```

Delete these functions:

```js
isMpWeixinBuild
syncCloudfunctionsOutput
copyCloudfunctions
shouldCopyCloudfunctionPath
getCloudfunctionsTargetDir
vendorCommonIntoFunctionPackages
rewriteCommonRequires
pathExists
patchProjectConfig
```

The final script should only:

- resolve `rootDir`
- resolve `uniCli`
- run `runUniCli(args)`
- exit with the CLI code

- [ ] **Step 6: Run page tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/frontend/pages.spec.ts
```

Expected: `tests/frontend/pages.spec.ts` passes.

- [ ] **Step 7: Commit**

Run:

```powershell
git add App.vue pages/upload/index.vue scripts/uni-cli.mjs tests/frontend/pages.spec.ts
git commit -m "feat: use unicloud storage in upload flow"
```

---

### Task 4: Shared uniCloud Module Skeleton

**Files:**
- Create: `uniCloud-alipay/cloudfunctions/common/shuati-shared/package.json`
- Create: `uniCloud-alipay/cloudfunctions/common/shuati-shared/index.js`
- Create: `uniCloud-alipay/cloudfunctions/common/shuati-shared/auth.js`
- Create: `uniCloud-alipay/cloudfunctions/common/shuati-shared/db.js`
- Copy then modify: `cloudfunctions/common/response.js` to `uniCloud-alipay/cloudfunctions/common/shuati-shared/response.js`
- Create: `tests/cloud/unicloudShared.spec.js`

- [ ] **Step 1: Write shared module tests**

Create `tests/cloud/unicloudShared.spec.js`:

```js
const { requireUidFromEvent } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/auth')
const { createDbCompat } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/db')

describe('uniCloud shared helpers', () => {
  it('resolves uid from trusted context auth before event tokens', async () => {
    const result = await requireUidFromEvent({
      event: { _uniToken: 'ignored' },
      context: { auth: { uid: 'uid_from_context' } },
      checkToken: async () => {
        throw new Error('should not check token when context has uid')
      },
    })

    expect(result.uid).toBe('uid_from_context')
  })

  it('verifies uid from event token', async () => {
    const result = await requireUidFromEvent({
      event: { _uniToken: 'token_a' },
      context: {},
      checkToken: async (token) => {
        expect(token).toBe('token_a')
        return { uid: 'uid_from_token' }
      },
    })

    expect(result.uid).toBe('uid_from_token')
  })

  it('rejects missing token with unauthorized code', async () => {
    await expect(requireUidFromEvent({
      event: {},
      context: {},
      checkToken: async () => ({ uid: 'never' }),
    })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('adapts WeChat-style add and update calls to uniCloud database calls', async () => {
    const calls = []
    const nativeDb = {
      collection(name) {
        calls.push(['collection', name])
        return {
          add(data) {
            calls.push(['add', data])
            return Promise.resolve({ id: 'row_1' })
          },
          doc(id) {
            calls.push(['doc', id])
            return {
              update(data) {
                calls.push(['doc.update', data])
                return Promise.resolve({ updated: 1 })
              },
              get() {
                return Promise.resolve({ data: [] })
              },
            }
          },
          where(query) {
            calls.push(['where', query])
            return {
              update(data) {
                calls.push(['where.update', data])
                return Promise.resolve({ updated: 2 })
              },
              get() {
                return Promise.resolve({ data: [] })
              },
              orderBy() {
                return this
              },
            }
          },
        }
      },
    }

    const db = createDbCompat(nativeDb)
    await expect(db.collection('materials').add({ data: { fileName: 'a.pdf' } })).resolves.toEqual({ _id: 'row_1', id: 'row_1' })
    await expect(db.collection('materials').doc('row_1').update({ data: { status: 'ready' } })).resolves.toEqual({ stats: { updated: 1 } })
    await expect(db.collection('materials').where({ ownerOpenid: 'uid_a' }).update({ data: { status: 'ready' } })).resolves.toEqual({ stats: { updated: 2 } })
    expect(calls).toContainEqual(['add', { fileName: 'a.pdf' }])
    expect(calls).toContainEqual(['doc.update', { status: 'ready' }])
    expect(calls).toContainEqual(['where.update', { status: 'ready' }])
  })
})
```

- [ ] **Step 2: Run the shared tests and verify they fail**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudShared.spec.js
```

Expected: module-not-found failures for the new shared helpers.

- [ ] **Step 3: Add shared package metadata**

Create `uniCloud-alipay/cloudfunctions/common/shuati-shared/package.json`:

```json
{
  "name": "shuati-shared",
  "version": "1.0.0",
  "main": "index.js"
}
```

Create `uniCloud-alipay/cloudfunctions/common/shuati-shared/index.js`:

```js
module.exports = {
  ...require('./auth'),
  ...require('./db'),
  ...require('./response'),
}
```

- [ ] **Step 4: Add auth helper**

Create `uniCloud-alipay/cloudfunctions/common/shuati-shared/auth.js`:

```js
function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function getTrustedContextUid(context = {}) {
  return (context.auth && context.auth.uid) ||
    (context.AUTH && context.AUTH.uid) ||
    context.uid ||
    ''
}

function getEventToken(event = {}) {
  return event._uniToken ||
    event.uniToken ||
    event.uniIdToken ||
    event.uni_id_token ||
    ''
}

async function defaultCheckToken(token, context = {}) {
  const uniIdCommon = require('uni-id-common')
  const uniID = uniIdCommon.createInstance({ context })
  const result = await uniID.checkToken(token)
  if (result && result.errCode) {
    const error = createError('unauthorized', result.errMsg || result.message || '登录已失效')
    error.detail = result
    throw error
  }
  return result
}

async function requireUidFromEvent({ event = {}, context = {}, checkToken = defaultCheckToken } = {}) {
  const trustedUid = getTrustedContextUid(context)
  if (trustedUid) return { uid: trustedUid }

  const token = getEventToken(event)
  if (!token) throw createError('unauthorized', '缺少用户身份')

  const result = await checkToken(token, context)
  const uid = result && result.uid
  if (!uid) throw createError('unauthorized', '用户身份无效')

  return {
    uid,
    token: result.token || '',
    tokenExpired: result.tokenExpired || 0,
    role: Array.isArray(result.role) ? result.role : [],
    permission: Array.isArray(result.permission) ? result.permission : [],
  }
}

module.exports = {
  getEventToken,
  requireUidFromEvent,
}
```

- [ ] **Step 5: Add database compatibility helper**

Create `uniCloud-alipay/cloudfunctions/common/shuati-shared/db.js`:

```js
function unwrapDataArg(arg) {
  if (arg && typeof arg === 'object' && Object.prototype.hasOwnProperty.call(arg, 'data')) {
    return arg.data
  }
  return arg
}

function normalizeAddResult(result = {}) {
  const id = result._id || result.id
  return id ? { ...result, _id: id, id } : result
}

function normalizeUpdateResult(result = {}) {
  if (result.stats && typeof result.stats.updated === 'number') return result
  const updated = Number(result.updated ?? result.updatedCount ?? result.modifiedCount ?? 0)
  return { ...result, stats: { updated } }
}

function wrapQuery(query) {
  return {
    get() {
      return query.get()
    },
    update(arg) {
      return Promise.resolve(query.update(unwrapDataArg(arg))).then(normalizeUpdateResult)
    },
    orderBy(field, direction) {
      return wrapQuery(query.orderBy(field, direction))
    },
    limit(size) {
      return wrapQuery(query.limit(size))
    },
    field(fields) {
      return wrapQuery(query.field(fields))
    },
  }
}

function wrapCollection(collection) {
  return {
    add(arg) {
      return Promise.resolve(collection.add(unwrapDataArg(arg))).then(normalizeAddResult)
    },
    doc(id) {
      const doc = collection.doc(id)
      return {
        get() {
          return doc.get()
        },
        update(arg) {
          return Promise.resolve(doc.update(unwrapDataArg(arg))).then(normalizeUpdateResult)
        },
        remove(arg) {
          return doc.remove ? doc.remove(arg) : Promise.resolve({ stats: { deleted: 0 } })
        },
      }
    },
    where(query) {
      return wrapQuery(collection.where(query))
    },
    orderBy(field, direction) {
      return wrapQuery(collection.orderBy(field, direction))
    },
    limit(size) {
      return wrapQuery(collection.limit(size))
    },
    field(fields) {
      return wrapQuery(collection.field(fields))
    },
  }
}

function createDbCompat(nativeDb) {
  return {
    command: nativeDb.command,
    collection(name) {
      return wrapCollection(nativeDb.collection(name))
    },
  }
}

module.exports = {
  createDbCompat,
}
```

- [ ] **Step 6: Copy response helper**

Copy `cloudfunctions/common/response.js` to:

```text
uniCloud-alipay/cloudfunctions/common/shuati-shared/response.js
```

Then fix its fallback messages to readable UTF-8 strings:

```js
function toErrorResponse(error) {
  return fail(error.code || 'internal_error', error.message || '服务异常')
}
```

- [ ] **Step 7: Run shared tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudShared.spec.js
```

Expected: shared tests pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add uniCloud-alipay/cloudfunctions/common/shuati-shared tests/cloud/unicloudShared.spec.js
git commit -m "feat: add unicloud shared backend helpers"
```

---

### Task 5: Move Parser and Services Into uniCloud Shared Module

**Files:**
- Create/copy: `uniCloud-alipay/cloudfunctions/common/shuati-shared/parser/*`
- Create/copy: `uniCloud-alipay/cloudfunctions/common/shuati-shared/services/*`
- Modify: `tests/cloud/candidateService.spec.js`
- Modify: `tests/cloud/materialService.spec.js`
- Modify: `tests/cloud/parseService.spec.js`
- Modify: `tests/cloud/practiceService.spec.js`
- Modify: `tests/parser/parser.spec.js`

- [ ] **Step 1: Copy parser and services**

Copy these existing files without changing behavior:

```text
cloudfunctions/common/parser/index.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/parser/index.js
cloudfunctions/common/parser/normalize.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/parser/normalize.js
cloudfunctions/common/parser/validate.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/parser/validate.js
cloudfunctions/common/services/candidateService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/candidateService.js
cloudfunctions/common/services/importService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/importService.js
cloudfunctions/common/services/materialService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService.js
cloudfunctions/common/services/parseService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/parseService.js
cloudfunctions/common/services/practiceService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/practiceService.js
cloudfunctions/common/services/userService.js -> uniCloud-alipay/cloudfunctions/common/shuati-shared/services/userService.js
```

- [ ] **Step 2: Update imports inside copied services**

In the copied `services/materialService.js`, replace:

```js
const { assertRequired } = require('../response')
```

with:

```js
const { assertRequired } = require('../response')
```

No text change is needed for this file after copy if the relative layout is preserved.

In copied `services/parseService.js`, confirm these imports remain valid:

```js
const { parseQuestions } = require('../parser')
const { assertRequired } = require('../response')
const { getMaterialDetail, getMaterialForOwner } = require('./materialService')
```

In copied `services/candidateService.js`, `importService.js`, `practiceService.js`, and `userService.js`, keep existing relative imports. The shared module layout intentionally mirrors the old `common` layout.

- [ ] **Step 3: Update cloud service test imports**

Change every test import from:

```js
require('../../cloudfunctions/common/services/...')
require('../../cloudfunctions/common/parser')
```

to:

```js
require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/services/...')
require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/parser')
```

Concrete examples:

```js
const { upsertUser } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/services/userService')
const { createMaterial, getMaterialDetail, getMaterialForOwner, listMaterials } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/services/materialService')
```

```js
const { parseQuestions } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/parser')
```

- [ ] **Step 4: Run cloud and parser tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud tests/parser
```

Expected: all cloud and parser tests pass with the new shared module path.

- [ ] **Step 5: Commit**

Run:

```powershell
git add uniCloud-alipay/cloudfunctions/common/shuati-shared/parser uniCloud-alipay/cloudfunctions/common/shuati-shared/services tests/cloud tests/parser
git commit -m "refactor: move backend services to unicloud shared module"
```

---

### Task 6: uni-id Login Config and userLogin Function

**Files:**
- Modify: `.gitignore`
- Create: `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.example.json`
- Create: `uniCloud-alipay/cloudfunctions/userLogin/index.js`
- Test: `tests/cloud/userLoginFunction.spec.js`

- [ ] **Step 1: Ignore local uni-id config**

Add this line to `.gitignore`:

```text
uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json
```

- [ ] **Step 2: Add non-secret config example**

Create `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.example.json`:

```json
{
  "passwordSecret": "",
  "tokenSecret": "",
  "tokenExpiresIn": 7200,
  "tokenExpiresThreshold": 1200,
  "passwordErrorLimit": 6,
  "passwordErrorRetryTime": 3600,
  "autoSetInviteCode": false,
  "forceInviteCode": false,
  "mp-weixin": {
    "oauth": {
      "weixin": {
        "appid": "",
        "appsecret": ""
      }
    }
  }
}
```

Implementation note for the human operator: before HBuilderX cloud upload, create the ignored local file:

```text
uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json
```

Use the same JSON shape as `config.example.json`, but fill real ShuaTi `passwordSecret`, `tokenSecret`, WeChat mini-program appid, and appsecret. Do not commit that file.

- [ ] **Step 3: Write userLogin tests with injected login dependency**

Create `tests/cloud/userLoginFunction.spec.js`:

```js
const { createFakeDb } = require('./fakeDb')
const { handleUserLogin } = require('../../uniCloud-alipay/cloudfunctions/userLogin/index')

describe('uniCloud userLogin function', () => {
  it('exchanges code for uid and returns compatibility user shape', async () => {
    const db = createFakeDb()
    const result = await handleUserLogin({
      event: { code: 'wx_code_a' },
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async ({ code }) => {
        expect(code).toBe('wx_code_a')
        return { uid: 'uid_a', token: 'token_a', tokenExpired: 1770000000000 }
      },
    })

    expect(result).toMatchObject({
      token: 'token_a',
      tokenExpired: 1770000000000,
      user: {
        _id: 'uid_a',
        uid: 'uid_a',
        openid: 'uid_a',
        created: true,
      },
    })
  })

  it('rejects missing login code', async () => {
    const db = createFakeDb()
    await expect(handleUserLogin({
      event: {},
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async () => ({ uid: 'never' }),
    })).rejects.toMatchObject({ code: 'missing_login_code' })
  })
})
```

- [ ] **Step 4: Run userLogin tests and verify they fail**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/userLoginFunction.spec.js
```

Expected: module-not-found or missing `handleUserLogin`.

- [ ] **Step 5: Implement `userLogin/index.js`**

Create `uniCloud-alipay/cloudfunctions/userLogin/index.js`:

```js
const uniID = require('uni-id')
const { createDbCompat } = require('shuati-shared/db')
const { ok, toErrorResponse, assertRequired } = require('shuati-shared/response')
const { upsertUser } = require('shuati-shared/services/userService')

async function handleUserLogin({ event = {}, db, now, loginByWeixin }) {
  assertRequired(event.code, 'missing_login_code', '缺少登录凭证')

  const loginResult = await loginByWeixin({ code: event.code })
  if (loginResult.code && loginResult.code !== 0) {
    const error = new Error(loginResult.msg || loginResult.message || '登录失败')
    error.code = loginResult.code
    throw error
  }

  const uid = loginResult.uid
  assertRequired(uid, 'missing_uid', '登录结果缺少用户 ID')

  const user = await upsertUser({ db, openid: uid, now })
  return {
    token: loginResult.token || '',
    tokenExpired: loginResult.tokenExpired || loginResult.token_expired || 0,
    user: {
      ...user,
      uid,
      openid: uid,
    },
  }
}

exports.main = async (event = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const data = await handleUserLogin({
      event,
      db,
      now,
      loginByWeixin: (params) => uniID.loginByWeixin(params),
    })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}

module.exports.handleUserLogin = handleUserLogin
```

- [ ] **Step 6: Run userLogin tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/userLoginFunction.spec.js
```

Expected: userLogin tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add .gitignore uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.example.json uniCloud-alipay/cloudfunctions/userLogin tests/cloud/userLoginFunction.spec.js
git commit -m "feat: add unicloud uni-id login function"
```

---

### Task 7: Business Cloud Function Wrappers

**Files:**
- Create: `uniCloud-alipay/cloudfunctions/materialCreate/index.js`
- Create: `uniCloud-alipay/cloudfunctions/materialList/index.js`
- Create: `uniCloud-alipay/cloudfunctions/materialDetail/index.js`
- Create: `uniCloud-alipay/cloudfunctions/parseStart/index.js`
- Create: `uniCloud-alipay/cloudfunctions/parseRunner/index.js`
- Create: `uniCloud-alipay/cloudfunctions/parseRunner/package.json`
- Create: `uniCloud-alipay/cloudfunctions/parseStatus/index.js`
- Create: `uniCloud-alipay/cloudfunctions/candidateList/index.js`
- Create: `uniCloud-alipay/cloudfunctions/candidateDetail/index.js`
- Create: `uniCloud-alipay/cloudfunctions/candidateUpdate/index.js`
- Create: `uniCloud-alipay/cloudfunctions/importConfirm/index.js`
- Create: `uniCloud-alipay/cloudfunctions/questionList/index.js`
- Create: `uniCloud-alipay/cloudfunctions/practiceCreate/index.js`
- Create: `uniCloud-alipay/cloudfunctions/practiceDetail/index.js`
- Create: `uniCloud-alipay/cloudfunctions/answerSubmit/index.js`
- Test: `tests/cloud/unicloudFunctionWrappers.spec.js`

- [ ] **Step 1: Add wrapper smoke tests**

Create `tests/cloud/unicloudFunctionWrappers.spec.js`:

```js
const path = require('node:path')
const { existsSync, readFileSync } = require('node:fs')

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
]

describe('uniCloud function wrappers', () => {
  for (const name of functions) {
    it(`${name} has an ordinary cloud function entry`, () => {
      const filePath = path.join('uniCloud-alipay', 'cloudfunctions', name, 'index.js')
      expect(existsSync(filePath)).toBe(true)
      const source = readFileSync(filePath, 'utf8')
      expect(source).toContain('exports.main')
      expect(source).toContain('requireUidFromEvent')
      expect(source).toContain('createDbCompat')
      expect(source).not.toContain('wx-server-sdk')
      expect(source).not.toContain('cloud.getWXContext')
    })
  }

  it('parseRunner declares pdf-parse without wx-server-sdk', () => {
    const packageJson = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/parseRunner/package.json', 'utf8'))
    expect(packageJson.dependencies['pdf-parse']).toBe('latest')
    expect(packageJson.dependencies['wx-server-sdk']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run wrapper smoke tests and verify they fail**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudFunctionWrappers.spec.js
```

Expected: missing wrapper files.

- [ ] **Step 3: Use the shared imports in every business wrapper**

Every business wrapper starts with these shared imports plus its own service import:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
```

The following steps provide each complete `exports.main` body. Do not add a generic wrapper file; create the exact function files listed below.

- [ ] **Step 4: Create material wrappers**

Create `materialCreate/index.js` with:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { createMaterial } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const material = await createMaterial({ db, openid: uid, now, input: event })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `materialList/index.js` with:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listMaterials } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const materials = await listMaterials({ db, openid: uid })
    return ok({ materials })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `materialDetail/index.js` with:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getMaterialDetail } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const material = await getMaterialDetail({ db, openid: uid, materialId: event.materialId })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

- [ ] **Step 5: Create parse wrappers**

Create `parseStart/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { startParse } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const job = await startParse({ db, openid: uid, materialId: event.materialId, now })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `parseRunner/index.js`:

```js
const pdfParse = require('pdf-parse')
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { runParseJob } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const job = await runParseJob({
      db,
      openid: uid,
      jobId: event.jobId,
      now,
      extractText: async (material) => {
        const file = await uniCloud.downloadFile({ fileID: material.fileID })
        const parsed = await pdfParse(file.fileContent)
        return parsed.text || ''
      },
    })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `parseRunner/package.json`:

```json
{
  "name": "parse-runner",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "pdf-parse": "latest"
  }
}
```

Create `parseStatus/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getParseStatus } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const data = await getParseStatus({ db, openid: uid, materialId: event.materialId })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

- [ ] **Step 6: Create candidate and import wrappers**

Create `candidateList/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listCandidates } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidates = await listCandidates({ db, openid: uid, materialId: event.materialId })
    return ok({ candidates })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `candidateDetail/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getCandidateDetail } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidate = await getCandidateDetail({ db, openid: uid, candidateId: event.candidateId })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `candidateUpdate/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { updateCandidate } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidate = await updateCandidate({
      db,
      openid: uid,
      candidateId: event.candidateId,
      input: event.candidate || {},
      now,
    })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `importConfirm/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { confirmImport } = require('shuati-shared/services/importService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const result = await confirmImport({ db, openid: uid, materialId: event.materialId, now })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

- [ ] **Step 7: Create practice wrappers**

Create `questionList/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listQuestions } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const questions = await listQuestions({ db, openid: uid, materialId: event.materialId })
    return ok({ questions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `practiceCreate/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { createPractice } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const session = await createPractice({
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

Create `practiceDetail/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getPracticeDetail } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const data = await getPracticeDetail({ db, openid: uid, sessionId: event.sessionId })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Create `answerSubmit/index.js`:

```js
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { answerSubmit } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const result = await answerSubmit({
      db,
      openid: uid,
      sessionId: event.sessionId,
      questionId: event.questionId,
      selectedKeys: event.selectedKeys,
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

- [ ] **Step 8: Run wrapper smoke tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudFunctionWrappers.spec.js
```

Expected: wrapper smoke tests pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add uniCloud-alipay/cloudfunctions tests/cloud/unicloudFunctionWrappers.spec.js
git commit -m "feat: add unicloud business cloud functions"
```

---

### Task 8: Database Schema Files

**Files:**
- Create: `uniCloud-alipay/database/users.schema.json`
- Create: `uniCloud-alipay/database/materials.schema.json`
- Create: `uniCloud-alipay/database/parse_jobs.schema.json`
- Create: `uniCloud-alipay/database/material_pages.schema.json`
- Create: `uniCloud-alipay/database/parse_candidates.schema.json`
- Create: `uniCloud-alipay/database/questions.schema.json`
- Create: `uniCloud-alipay/database/practice_sessions.schema.json`
- Create: `uniCloud-alipay/database/attempts.schema.json`
- Create: `uniCloud-alipay/database/uni-id-users.index.json`
- Test: `tests/cloud/unicloudDatabaseSchema.spec.js`

- [ ] **Step 1: Add schema presence tests**

Create `tests/cloud/unicloudDatabaseSchema.spec.js`:

```js
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

const schemaNames = [
  'users',
  'materials',
  'parse_jobs',
  'material_pages',
  'parse_candidates',
  'questions',
  'practice_sessions',
  'attempts',
]

describe('uniCloud database schemas', () => {
  for (const name of schemaNames) {
    it(`${name} schema blocks direct client access`, () => {
      const filePath = path.join('uniCloud-alipay', 'database', `${name}.schema.json`)
      expect(existsSync(filePath)).toBe(true)
      const schema = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(schema.bsonType).toBe('object')
      expect(schema.permission).toEqual({
        read: false,
        create: false,
        update: false,
        delete: false,
      })
      expect(schema.properties).toBeTruthy()
    })
  }

  it('declares uni-id users index file', () => {
    const filePath = path.join('uniCloud-alipay', 'database', 'uni-id-users.index.json')
    expect(existsSync(filePath)).toBe(true)
    const index = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(Array.isArray(index.indexes)).toBe(true)
  })
})
```

- [ ] **Step 2: Run schema tests and verify they fail**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: schema files are missing.

- [ ] **Step 3: Add schema file template to each collection**

Use this exact permission block in every `.schema.json` file:

```json
"permission": {
  "read": false,
  "create": false,
  "update": false,
  "delete": false
}
```

For `users.schema.json`:

```json
{
  "bsonType": "object",
  "required": ["openid", "createdAt", "updatedAt"],
  "permission": {
    "read": false,
    "create": false,
    "update": false,
    "delete": false
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "openid": { "bsonType": "string" },
    "createdAt": { "bsonType": "string" },
    "updatedAt": { "bsonType": "string" }
  }
}
```

For `materials.schema.json`, include:

```json
{
  "bsonType": "object",
  "required": ["ownerOpenid", "fileID", "fileName", "status", "parseMode", "createdAt", "updatedAt"],
  "permission": {
    "read": false,
    "create": false,
    "update": false,
    "delete": false
  },
  "properties": {
    "_id": { "bsonType": "string" },
    "ownerOpenid": { "bsonType": "string" },
    "fileID": { "bsonType": "string" },
    "fileName": { "bsonType": "string" },
    "fileSize": { "bsonType": "number" },
    "status": { "bsonType": "string" },
    "parseMode": { "bsonType": "string" },
    "questionCount": { "bsonType": "number" },
    "readyCandidateCount": { "bsonType": "number" },
    "needReviewCandidateCount": { "bsonType": "number" },
    "invalidCandidateCount": { "bsonType": "number" },
    "errorMessage": { "bsonType": "string" },
    "createdAt": { "bsonType": "string" },
    "updatedAt": { "bsonType": "string" }
  }
}
```

For all other business schemas, use the same shape with collection-specific `properties` and server-only permissions. Include at least the fields used by services:

- `parse_jobs`: `_id`, `materialId`, `ownerOpenid`, `status`, `lockUntil`, `lockToken`, `startedAt`, `finishedAt`, `errorMessage`, `stats`, `createdAt`, `updatedAt`
- `material_pages`: `_id`, `jobId`, `materialId`, `ownerOpenid`, `pageNo`, `text`, `createdAt`
- `parse_candidates`: `_id`, `jobId`, `materialId`, `ownerOpenid`, `questionNo`, `type`, `stem`, `options`, `answerKeys`, `explanation`, `status`, `validationErrors`, `importedQuestionId`, `sourcePageNo`, `sourceText`, `createdAt`, `updatedAt`, `importClaimToken`, `importSourceUpdatedAt`, `importClaimUntil`
- `questions`: `_id`, `ownerOpenid`, `materialId`, `candidateId`, `type`, `stem`, `options`, `answerKeys`, `explanation`, `questionNo`, `sourcePageNo`, `sourceCandidateUpdatedAt`, `createdAt`, `updatedAt`
- `practice_sessions`: `_id`, `ownerOpenid`, `materialId`, `questionIds`, `status`, `totalCount`, `correctCount`, `startedAt`, `submittedAt`, `createdAt`, `updatedAt`
- `attempts`: `_id`, `ownerOpenid`, `sessionId`, `questionId`, `selectedKeys`, `isCorrect`, `answerKeys`, `explanation`, `createdAt`

Use `"bsonType": "array"` for arrays, `"bsonType": "object"` for `stats`, and `"bsonType": "bool"` for `isCorrect`.

- [ ] **Step 4: Add uni-id users index file**

Create `uniCloud-alipay/database/uni-id-users.index.json`:

```json
{
  "indexes": [
    {
      "IndexName": "username_unique",
      "MgoKeySchema": {
        "MgoIndexKeys": [
          {
            "Name": "username",
            "Direction": "1"
          }
        ],
        "MgoIsUnique": true
      }
    }
  ]
}
```

- [ ] **Step 5: Run schema tests**

Run:

```powershell
F:\.bun\bin\bun.exe test tests/cloud/unicloudDatabaseSchema.spec.js
```

Expected: schema tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add uniCloud-alipay/database tests/cloud/unicloudDatabaseSchema.spec.js
git commit -m "feat: add unicloud database schemas"
```

---

### Task 9: Remove Legacy WeChat Cloud Backend

**Files:**
- Delete: `cloudfunctions/`
- Modify: tests that still reference `cloudfunctions`

- [ ] **Step 1: Scan for remaining WeChat cloud references**

Run:

```powershell
rg "wx-server-sdk|wx\\.cloud|cloud\\.getWXContext|cloudfunctions/common|cloudfunctions\\\\common|DYNAMIC_CURRENT_ENV" -n .
```

Expected before deletion: references remain in `cloudfunctions/` and possibly tests.

- [ ] **Step 2: Remove legacy backend directory**

Run:

```powershell
git rm -r cloudfunctions
```

This is intentional because the backend has moved to `uniCloud-alipay`.

- [ ] **Step 3: Scan again**

Run:

```powershell
rg "wx-server-sdk|wx\\.cloud|cloud\\.getWXContext|cloudfunctions/common|cloudfunctions\\\\common|DYNAMIC_CURRENT_ENV" -n .
```

Expected: no matches in runtime source or tests. If matches remain in historical docs, leave them only if they are clearly historical; otherwise update the text.

- [ ] **Step 4: Run all tests**

Run:

```powershell
F:\.bun\bin\bun.exe test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -A
git commit -m "refactor: remove legacy wechat cloud backend"
```

---

### Task 10: Final Build and HBuilderX Verification Notes

**Files:**
- Modify if needed: `docs/manual-qa/unicloud-alipay.md`

- [ ] **Step 1: Add manual verification doc**

Create `docs/manual-qa/unicloud-alipay.md`:

```markdown
# uniCloud Alipay Manual Verification

## Local config

Create this ignored local file before uploading cloud functions:

`uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`

Use the shape from:

`uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.example.json`

Fill ShuaTi-specific `passwordSecret`, `tokenSecret`, WeChat mini-program appid, and WeChat appsecret.

## HBuilderX

1. Open `G:\HBuilderProjects\ShuaTi`.
2. Right-click `uniCloud-alipay`.
3. Associate it with the Alipay cloud service space.
4. Upload `common/shuati-shared`.
5. Upload `common/uni-config-center`.
6. Upload all business cloud functions.
7. Initialize or synchronize database schemas under `uniCloud-alipay/database`.

## WeChat DevTools

1. Run `F:\.bun\bin\bun.exe run build:mp-weixin`.
2. Open `G:\HBuilderProjects\ShuaTi\dist\build\mp-weixin`.
3. Confirm no `cloud.callFunction:fail resource is not found` error appears.
4. Upload a PDF.
5. Confirm the material is created.
6. Confirm parsing completes.
7. Confirm candidates can be reviewed.
8. Confirm ready candidates import into questions.
9. Confirm practice creation, answer submission, and result display work.
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
F:\.bun\bin\bun.exe test
F:\.bun\bin\bun.exe run build:mp-weixin
```

Expected:

- Tests pass.
- Build succeeds.
- Build output does not contain the old WeChat `cloudfunctions` directory copied by `scripts/uni-cli.mjs`.

- [ ] **Step 3: Final scan**

Run:

```powershell
rg "wx-server-sdk|wx\\.cloud|cloud\\.getWXContext|DYNAMIC_CURRENT_ENV" -n App.vue common pages scripts tests uniCloud-alipay
```

Expected: no matches.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/manual-qa/unicloud-alipay.md
git commit -m "docs: add unicloud manual verification"
```

---

## Self-Review Checklist

- Spec coverage:
  - `uniCloud-alipay` directory: Tasks 4-8.
  - Frontend unchanged at page-flow level: Tasks 2-3.
  - `uniCloud.callFunction`: Task 2.
  - `uniCloud.uploadFile`: Task 3.
  - `uni-id uid` identity: Tasks 2, 4, 6, 7.
  - Ordinary cloud functions, not cloud objects: Task 7.
  - Database schemas: Task 8.
  - HBuilderX verification: Task 10.
  - No copied secrets: Task 6.
  - Remove legacy WeChat backend: Task 9.

- Placeholder scan:
  - The plan intentionally uses empty strings in `config.example.json` because real secrets must not be committed.
  - The real local `config.json` is explicitly a manual, ignored file.
  - Every implementation task has exact files, code shape, and commands.

- Type consistency:
  - Frontend keeps `UserInfo.openid` and adds optional `uid`.
  - Backend services keep `openid` parameter names but receive `uid` values.
  - Ownership fields remain `ownerOpenid` for first-phase compatibility.
  - Token names are consistent: `_uniToken`, `uniToken`, `uni_id_token`, `uni_id_token_expired`.

## Execution Choice

After this plan is approved, use one of:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, with checkpoints.
