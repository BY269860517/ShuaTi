# PDF Import Practice MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat mini program MVP that imports text PDFs into reviewed objective questions, then lets the user practice and submit answers with backend grading.

**Architecture:** Use a uni-app Vue 3 mini program for the client, WeChat CloudBase cloud functions for all trusted operations, and a pure Node parser module under `cloudfunctions/common/parser` so parsing can be tested before any cloud integration. Frontend pages call narrow cloud-function APIs; cloud services enforce ownership through server-side `OPENID`, keep parse/import operations idempotent, and never expose answer keys before submission.

**Tech Stack:** uni-app + Vue 3 + TypeScript for the mini program, WeChat CloudBase / wx-server-sdk for cloud functions, Node.js CommonJS for cloud services, Vitest for parser and service unit tests, Bun from `F:\.bun` for package installation.

---

## Current State

The workspace `G:\HBuilderProjects\ShuaTi` is not a git repository and contains no app source code yet. Existing files are:

- `doc/需求文档.md`
- `docs/superpowers/specs/2026-04-26-pdf-import-practice-mvp-design.md`
- `AI_WORKFLOW.md`

This plan intentionally starts by creating a repository, toolchain files, and the uni-app skeleton.

## File Structure

Create this structure:

```text
G:\HBuilderProjects\ShuaTi
├─ App.vue
├─ main.ts
├─ manifest.json
├─ pages.json
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ uni.scss
├─ .gitignore
├─ .npmrc
├─ common
│  ├─ api
│  │  └─ cloud.ts
│  ├─ constants
│  │  └─ status.ts
│  ├─ format.ts
│  └─ types.ts
├─ components
│  ├─ CandidateCard.vue
│  ├─ EmptyState.vue
│  ├─ ErrorState.vue
│  ├─ LoadingState.vue
│  ├─ MaterialCard.vue
│  ├─ OptionList.vue
│  ├─ QuestionCard.vue
│  └─ StatusBadge.vue
├─ pages
│  ├─ index
│  │  └─ index.vue
│  ├─ upload
│  │  └─ index.vue
│  ├─ material
│  │  └─ detail.vue
│  ├─ import
│  │  ├─ review.vue
│  │  └─ edit.vue
│  └─ practice
│     ├─ setup.vue
│     ├─ do.vue
│     └─ result.vue
├─ cloudfunctions
│  ├─ common
│  │  ├─ auth.js
│  │  ├─ response.js
│  │  ├─ parser
│  │  │  ├─ index.js
│  │  │  ├─ normalize.js
│  │  │  └─ validate.js
│  │  └─ services
│  │     ├─ candidateService.js
│  │     ├─ importService.js
│  │     ├─ materialService.js
│  │     ├─ parseService.js
│  │     ├─ practiceService.js
│  │     └─ userService.js
│  ├─ userLogin
│  │  ├─ index.js
│  │  └─ package.json
│  ├─ materialCreate
│  ├─ materialList
│  ├─ materialDetail
│  ├─ parseStart
│  ├─ parseRunner
│  ├─ parseStatus
│  ├─ candidateList
│  ├─ candidateDetail
│  ├─ candidateUpdate
│  ├─ importConfirm
│  ├─ questionList
│  ├─ practiceCreate
│  ├─ practiceDetail
│  └─ answerSubmit
├─ tests
│  ├─ cloud
│  │  ├─ candidateService.spec.js
│  │  ├─ fakeDb.js
│  │  ├─ materialService.spec.js
│  │  ├─ parseService.spec.js
│  │  └─ practiceService.spec.js
│  └─ parser
│     └─ parser.spec.js
└─ docs
   └─ manual-qa
      └─ pdf-import-practice-mvp.md
```

Every cloud function directory not expanded above has exactly two files: `index.js` and `package.json`.

## Task 0: Repository And Local Tooling Guard

**Files:**
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Confirm the workspace is not on C drive**

Run:

```powershell
Get-Location
```

Expected: output path starts with `G:\HBuilderProjects\ShuaTi`.

- [ ] **Step 2: Initialize git**

Run:

```powershell
git init -b main
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 3: Create `.gitignore`**

Write:

```gitignore
node_modules/
unpackage/
dist/
.hbuilderx/
.DS_Store
*.log
*.local
.env
.env.*
coverage/
```

- [ ] **Step 4: Create `.npmrc` so package caches stay off C drive**

Write:

```ini
cache=F:\.npm-cache
prefix=F:\.npm-global
```

- [ ] **Step 5: Commit tooling guard**

Run:

```powershell
git add .gitignore .npmrc docs/superpowers/specs/2026-04-26-pdf-import-practice-mvp-design.md docs/superpowers/plans/2026-04-26-pdf-import-practice-mvp.md AI_WORKFLOW.md doc/需求文档.md
git commit -m "docs: add pdf import practice mvp plan"
```

Expected: a commit containing only docs and repository hygiene files.

## Task 1: Uni-App Shell And Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `App.vue`
- Create: `main.ts`
- Create: `manifest.json`
- Create: `pages.json`
- Create: `uni.scss`

- [ ] **Step 1: Create `package.json`**

Write:

```json
{
  "name": "shuati",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:mp-weixin": "uni build -p mp-weixin",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:parser": "vitest run tests/parser",
    "test:cloud": "vitest run tests/cloud"
  },
  "dependencies": {
    "@dcloudio/uni-app": "latest",
    "@dcloudio/uni-components": "latest",
    "@dcloudio/uni-mp-weixin": "latest",
    "vue": "latest"
  },
  "devDependencies": {
    "@dcloudio/vite-plugin-uni": "latest",
    "@vue/compiler-sfc": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies using Bun on F drive**

Run:

```powershell
$env:BUN_INSTALL='F:\.bun'
$env:BUN_CACHE_DIR='F:\.bun\cache'
$env:PATH='F:\.bun\bin;' + $env:PATH
bun install
```

Expected: `bun.lock` is created and `node_modules` appears under `G:\HBuilderProjects\ShuaTi\node_modules`.

- [ ] **Step 3: Create TypeScript and Vite config**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["@dcloudio/types", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.vue", "tests/**/*.js"]
}
```

Write `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
})
```

Write `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.js'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
```

- [ ] **Step 4: Create app entry files**

Write `main.ts`:

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
```

Write `App.vue`:

```vue
<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  const wxRuntime = typeof wx !== 'undefined' ? wx : null
  if (wxRuntime?.cloud) {
    wxRuntime.cloud.init({ traceUser: true })
  }
})
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: #f6f7f9;
  color: #18202f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
```

Write `uni.scss`:

```scss
$brand-primary: #1f6feb;
$text-primary: #18202f;
$text-secondary: #5d6679;
$border-color: #dfe3ea;
$surface: #ffffff;
$background: #f6f7f9;
```

- [ ] **Step 5: Create app manifest and routes**

Write `manifest.json`:

```json
{
  "name": "刷题导入",
  "appid": "",
  "description": "PDF 原题导入刷题小程序 MVP",
  "versionName": "0.1.0",
  "versionCode": "1",
  "transformPx": false,
  "mp-weixin": {
    "appid": "",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true
  }
}
```

Write `pages.json`:

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": { "navigationBarTitleText": "我的资料" }
    },
    {
      "path": "pages/upload/index",
      "style": { "navigationBarTitleText": "上传 PDF" }
    },
    {
      "path": "pages/material/detail",
      "style": { "navigationBarTitleText": "资料详情" }
    },
    {
      "path": "pages/import/review",
      "style": { "navigationBarTitleText": "解析结果" }
    },
    {
      "path": "pages/import/edit",
      "style": { "navigationBarTitleText": "编辑题目" }
    },
    {
      "path": "pages/practice/setup",
      "style": { "navigationBarTitleText": "开始练习" }
    },
    {
      "path": "pages/practice/do",
      "style": { "navigationBarTitleText": "答题" }
    },
    {
      "path": "pages/practice/result",
      "style": { "navigationBarTitleText": "练习结果" }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "刷题导入",
    "navigationBarBackgroundColor": "#ffffff",
    "backgroundColor": "#f6f7f9"
  }
}
```

- [ ] **Step 6: Run tests to confirm harness works**

Run:

```powershell
bun test
```

Expected: Vitest starts and reports no test files or exits cleanly after files are added in the next task.

- [ ] **Step 7: Commit app shell**

Run:

```powershell
git add package.json bun.lock tsconfig.json vite.config.ts vitest.config.ts App.vue main.ts manifest.json pages.json uni.scss
git commit -m "feat: scaffold uni-app shell"
```

## Task 2: Parser Pure Function With Unit Tests

**Files:**
- Create: `cloudfunctions/common/parser/index.js`
- Create: `cloudfunctions/common/parser/normalize.js`
- Create: `cloudfunctions/common/parser/validate.js`
- Create: `tests/parser/parser.spec.js`

- [ ] **Step 1: Write parser tests first**

Write `tests/parser/parser.spec.js`:

```js
const { describe, expect, it } = require('vitest')
const { parseQuestions } = require('../../cloudfunctions/common/parser')

describe('parseQuestions inline_answer', () => {
  it('parses a single choice question with inline answer', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '1. 下列说法正确的是（ ）\nA. 选项一\nB. 选项二\n答案：A\n解析：基础概念题',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      questionNo: '1',
      type: 'single',
      stem: '下列说法正确的是（ ）',
      answerKeys: ['A'],
      explanation: '基础概念题',
      status: 'ready',
    })
    expect(result[0].options).toEqual([
      { key: 'A', text: '选项一' },
      { key: 'B', text: '选项二' },
    ])
  })

  it('parses a multiple choice question', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '2. 多选题\nA. 甲\nB. 乙\nC. 丙\n答案：AC',
    })

    expect(result[0].type).toBe('multiple')
    expect(result[0].answerKeys).toEqual(['A', 'C'])
    expect(result[0].status).toBe('ready')
  })

  it('parses a judge question', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '3. 水在标准大气压下 100 摄氏度沸腾。\nA. 正确\nB. 错误\n答案：正确',
    })

    expect(result[0].type).toBe('judge')
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[0].status).toBe('ready')
  })

  it('marks a question without answer as need_review', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '4. 没有答案的题\nA. 甲\nB. 乙',
    })

    expect(result[0].status).toBe('need_review')
    expect(result[0].validationErrors).toContain('missing_answer')
  })

  it('marks a block without options as invalid', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '5. 只有题干\n答案：A',
    })

    expect(result[0].status).toBe('invalid')
    expect(result[0].validationErrors).toContain('missing_options')
  })
})

describe('parseQuestions answer_at_end', () => {
  it('matches answers from the answer section', () => {
    const result = parseQuestions({
      mode: 'answer_at_end',
      text: '1. 第一题\nA. 甲\nB. 乙\n\n2. 第二题\nA. 甲\nB. 乙\nC. 丙\n\n参考答案\n1.A\n2.BC',
    })

    expect(result).toHaveLength(2)
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[0].type).toBe('single')
    expect(result[1].answerKeys).toEqual(['B', 'C'])
    expect(result[1].type).toBe('multiple')
  })
})
```

- [ ] **Step 2: Run parser tests and verify failure**

Run:

```powershell
bun run test:parser
```

Expected: FAIL because `cloudfunctions/common/parser` does not exist yet.

- [ ] **Step 3: Implement normalization helpers**

Write `cloudfunctions/common/parser/normalize.js`:

```js
function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeAnswer(raw, options) {
  const value = String(raw || '').replace(/\s/g, '').toUpperCase()
  const judgeMap = {
    正确: 'A',
    对: 'A',
    '√': 'A',
    错误: 'B',
    错: 'B',
    '×': 'B',
  }
  const mapped = judgeMap[value] || value
  const optionKeys = new Set((options || []).map((option) => option.key))
  return mapped
    .split('')
    .filter((key, index, arr) => /^[A-H]$/.test(key) && arr.indexOf(key) === index)
    .filter((key) => optionKeys.size === 0 || optionKeys.has(key))
}

function inferType(options, answerKeys) {
  const optionText = options.map((option) => option.text).join('')
  if (/正确|错误|对|错/.test(optionText) && options.length <= 2) {
    return 'judge'
  }
  return answerKeys.length > 1 ? 'multiple' : 'single'
}

module.exports = {
  inferType,
  normalizeAnswer,
  normalizeText,
}
```

- [ ] **Step 4: Implement validation**

Write `cloudfunctions/common/parser/validate.js`:

```js
function validateCandidate(candidate) {
  const validationErrors = []

  if (!candidate.stem) {
    validationErrors.push('missing_stem')
  }

  if (!Array.isArray(candidate.options) || candidate.options.length === 0) {
    validationErrors.push('missing_options')
  }

  if (!Array.isArray(candidate.answerKeys) || candidate.answerKeys.length === 0) {
    validationErrors.push('missing_answer')
  }

  const optionKeys = new Set((candidate.options || []).map((option) => option.key))
  const invalidAnswer = (candidate.answerKeys || []).some((key) => !optionKeys.has(key))
  if (invalidAnswer) {
    validationErrors.push('answer_not_in_options')
  }

  let status = 'ready'
  if (validationErrors.includes('missing_stem') || validationErrors.includes('missing_options')) {
    status = 'invalid'
  } else if (validationErrors.length > 0) {
    status = 'need_review'
  }

  return {
    ...candidate,
    validationErrors,
    status,
  }
}

module.exports = {
  validateCandidate,
}
```

- [ ] **Step 5: Implement parser entry point**

Write `cloudfunctions/common/parser/index.js`:

```js
const { inferType, normalizeAnswer, normalizeText } = require('./normalize')
const { validateCandidate } = require('./validate')

function splitQuestionBlocks(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  return normalized
    .split(/\n(?=\s*\d+[.、．]\s*)/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function extractQuestionNo(block) {
  const match = block.match(/^\s*(\d+)[.、．]\s*/)
  return match ? match[1] : ''
}

function extractAnswer(block) {
  const match = block.match(/(?:答案|正确答案|参考答案)\s*[:：]?\s*([A-Ha-h正确错误对错√×]+)/)
  return match ? match[1] : ''
}

function extractExplanation(block) {
  const match = block.match(/解析\s*[:：]\s*([\s\S]*)$/)
  return match ? normalizeText(match[1]) : ''
}

function stripAnswerAndExplanation(block) {
  return block
    .replace(/(?:答案|正确答案|参考答案)\s*[:：]?\s*[A-Ha-h正确错误对错√×]+[\s\S]*$/m, '')
    .replace(/解析\s*[:：][\s\S]*$/m, '')
    .trim()
}

function parseOptions(lines) {
  const options = []
  const stemLines = []
  let currentOption = null

  lines.forEach((line) => {
    const optionMatch = line.match(/^\s*([A-Ha-h])[.、．]\s*(.+)$/)
    if (optionMatch) {
      currentOption = {
        key: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim(),
      }
      options.push(currentOption)
      return
    }

    if (currentOption) {
      currentOption.text = `${currentOption.text} ${line.trim()}`.trim()
    } else {
      stemLines.push(line.trim())
    }
  })

  return {
    stem: stemLines.join(' ').replace(/^\d+[.、．]\s*/, '').trim(),
    options,
  }
}

function parseBlock(block, answerMap) {
  const questionNo = extractQuestionNo(block)
  const rawAnswer = answerMap?.get(questionNo) || extractAnswer(block)
  const explanation = extractExplanation(block)
  const contentBlock = stripAnswerAndExplanation(block)
  const lines = contentBlock.split('\n').map((line) => line.trim()).filter(Boolean)
  const { stem, options } = parseOptions(lines)
  const answerKeys = normalizeAnswer(rawAnswer, options)
  const type = inferType(options, answerKeys)

  return validateCandidate({
    questionNo,
    type,
    stem,
    options,
    answerKeys,
    explanation,
    sourceText: block,
    sourcePageNo: null,
  })
}

function extractAnswerSection(text) {
  const match = normalizeText(text).match(/(?:参考答案|答案)[\s\S]*$/)
  if (!match) {
    return { questionText: text, answerMap: new Map() }
  }

  const answerSection = match[0]
  const questionText = normalizeText(text).slice(0, normalizeText(text).indexOf(answerSection)).trim()
  const answerMap = new Map()
  const answerRegex = /(\d+)\s*[.、:：]\s*([A-Ha-h正确错误对错√×]+)/g
  let answerMatch = answerRegex.exec(answerSection)

  while (answerMatch) {
    answerMap.set(answerMatch[1], answerMatch[2])
    answerMatch = answerRegex.exec(answerSection)
  }

  return { questionText, answerMap }
}

function parseQuestions({ text, mode }) {
  if (mode !== 'inline_answer' && mode !== 'answer_at_end') {
    throw new Error(`Unsupported parse mode: ${mode}`)
  }

  if (mode === 'answer_at_end') {
    const { questionText, answerMap } = extractAnswerSection(text)
    return splitQuestionBlocks(questionText).map((block) => parseBlock(block, answerMap))
  }

  return splitQuestionBlocks(text).map((block) => parseBlock(block))
}

module.exports = {
  parseQuestions,
}
```

- [ ] **Step 6: Run parser tests and verify pass**

Run:

```powershell
bun run test:parser
```

Expected: PASS for all parser tests.

- [ ] **Step 7: Commit parser**

Run:

```powershell
git add cloudfunctions/common/parser tests/parser/parser.spec.js
git commit -m "feat: add text pdf parser"
```

## Task 3: Cloud Service Test Harness

**Files:**
- Create: `cloudfunctions/common/response.js`
- Create: `cloudfunctions/common/auth.js`
- Create: `tests/cloud/fakeDb.js`

- [ ] **Step 1: Create response helper**

Write `cloudfunctions/common/response.js`:

```js
function ok(data = {}) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function assertRequired(value, code, message) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(message)
    error.code = code
    throw error
  }
}

function toErrorResponse(error) {
  return fail(error.code || 'internal_error', error.message || '服务异常')
}

module.exports = {
  assertRequired,
  fail,
  ok,
  toErrorResponse,
}
```

- [ ] **Step 2: Create auth helper**

Write `cloudfunctions/common/auth.js`:

```js
function requireOpenid(context) {
  const openid = context && context.OPENID
  if (!openid) {
    const error = new Error('缺少用户身份')
    error.code = 'unauthorized'
    throw error
  }
  return openid
}

module.exports = {
  requireOpenid,
}
```

- [ ] **Step 3: Create in-memory fake database for service tests**

Write `tests/cloud/fakeDb.js`:

```js
function createFakeDb() {
  const store = new Map()
  const counters = new Map()

  function collection(name) {
    if (!store.has(name)) store.set(name, [])
    const rows = store.get(name)

    return {
      async add({ data }) {
        const next = (counters.get(name) || 0) + 1
        counters.set(name, next)
        const row = { _id: `${name}_${next}`, ...structuredClone(data) }
        rows.push(row)
        return { _id: row._id }
      },
      doc(id) {
        return {
          async get() {
            return { data: rows.filter((row) => row._id === id).map(structuredClone) }
          },
          async update({ data }) {
            const row = rows.find((item) => item._id === id)
            if (!row) return { stats: { updated: 0 } }
            Object.assign(row, structuredClone(data))
            return { stats: { updated: 1 } }
          },
        }
      },
      where(query) {
        const matched = () =>
          rows.filter((row) =>
            Object.entries(query || {}).every(([key, value]) => row[key] === value),
          )
        return {
          async get() {
            return { data: matched().map(structuredClone) }
          },
          async update({ data }) {
            const items = matched()
            items.forEach((row) => Object.assign(row, structuredClone(data)))
            return { stats: { updated: items.length } }
          },
        }
      },
      _rows: rows,
    }
  }

  return { collection }
}

module.exports = {
  createFakeDb,
}
```

- [ ] **Step 4: Run cloud tests and verify harness has no tests yet**

Run:

```powershell
bun run test:cloud
```

Expected: Vitest runs; if no test files exist yet, this is acceptable before Task 4 creates them.

- [ ] **Step 5: Commit cloud test harness**

Run:

```powershell
git add cloudfunctions/common/response.js cloudfunctions/common/auth.js tests/cloud/fakeDb.js
git commit -m "test: add cloud service harness"
```

## Task 4: User And Material Services

**Files:**
- Create: `cloudfunctions/common/services/userService.js`
- Create: `cloudfunctions/common/services/materialService.js`
- Create: `tests/cloud/materialService.spec.js`
- Create: `cloudfunctions/userLogin/index.js`
- Create: `cloudfunctions/userLogin/package.json`
- Create: `cloudfunctions/materialCreate/index.js`
- Create: `cloudfunctions/materialCreate/package.json`
- Create: `cloudfunctions/materialList/index.js`
- Create: `cloudfunctions/materialList/package.json`
- Create: `cloudfunctions/materialDetail/index.js`
- Create: `cloudfunctions/materialDetail/package.json`

- [ ] **Step 1: Write service tests**

Write `tests/cloud/materialService.spec.js`:

```js
const { describe, expect, it } = require('vitest')
const { createFakeDb } = require('./fakeDb')
const { upsertUser } = require('../../cloudfunctions/common/services/userService')
const { createMaterial, getMaterialDetail, listMaterials } = require('../../cloudfunctions/common/services/materialService')

describe('material services', () => {
  it('creates user from server openid', async () => {
    const db = createFakeDb()
    const result = await upsertUser({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z' })

    expect(result.openid).toBe('user_a')
    expect(result.created).toBe(true)
  })

  it('creates material with owner from server openid', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: 'cloud://env/materials/user_a/demo.pdf',
        fileName: 'demo.pdf',
        fileSize: 1024,
        parseMode: 'inline_answer',
        ownerOpenid: 'forged_user',
      },
    })

    expect(material.ownerOpenid).toBe('user_a')
    expect(material.status).toBe('uploaded')
    expect(material.parseMode).toBe('inline_answer')
  })

  it('lists only current user materials', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'a', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_b', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'b', fileName: 'b.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
  })

  it('blocks detail access for other users', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'a', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    await expect(getMaterialDetail({ db, openid: 'user_b', materialId: material._id })).rejects.toThrow('资料不存在')
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
bun run test:cloud -- tests/cloud/materialService.spec.js
```

Expected: FAIL because services do not exist.

- [ ] **Step 3: Implement user service**

Write `cloudfunctions/common/services/userService.js`:

```js
async function upsertUser({ db, openid, now }) {
  const users = db.collection('users')
  const existing = await users.where({ openid }).get()

  if (existing.data[0]) {
    await users.doc(existing.data[0]._id).update({ data: { updatedAt: now } })
    return { ...existing.data[0], updatedAt: now, created: false }
  }

  const data = { openid, createdAt: now, updatedAt: now }
  const created = await users.add({ data })
  return { _id: created._id, ...data, created: true }
}

module.exports = {
  upsertUser,
}
```

- [ ] **Step 4: Implement material service**

Write `cloudfunctions/common/services/materialService.js`:

```js
const { assertRequired } = require('../response')

const VALID_PARSE_MODES = new Set(['inline_answer', 'answer_at_end'])

function summarizeMaterial(material) {
  return {
    _id: material._id,
    fileName: material.fileName,
    fileSize: material.fileSize,
    status: material.status,
    parseMode: material.parseMode,
    questionCount: material.questionCount || 0,
    readyCandidateCount: material.readyCandidateCount || 0,
    needReviewCandidateCount: material.needReviewCandidateCount || 0,
    invalidCandidateCount: material.invalidCandidateCount || 0,
    errorMessage: material.errorMessage || '',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    ownerOpenid: material.ownerOpenid,
  }
}

async function createMaterial({ db, openid, now, input }) {
  assertRequired(input.fileID, 'missing_file_id', '缺少 PDF 文件')
  assertRequired(input.fileName, 'missing_file_name', '缺少文件名')

  const parseMode = VALID_PARSE_MODES.has(input.parseMode) ? input.parseMode : 'inline_answer'
  const data = {
    ownerOpenid: openid,
    fileID: input.fileID,
    fileName: input.fileName,
    fileSize: Number(input.fileSize || 0),
    status: 'uploaded',
    parseMode,
    questionCount: 0,
    readyCandidateCount: 0,
    needReviewCandidateCount: 0,
    invalidCandidateCount: 0,
    errorMessage: '',
    createdAt: now,
    updatedAt: now,
  }

  const created = await db.collection('materials').add({ data })
  return { _id: created._id, ...data }
}

async function listMaterials({ db, openid }) {
  const result = await db.collection('materials').where({ ownerOpenid: openid }).get()
  return result.data.map(summarizeMaterial)
}

async function getMaterialDetail({ db, openid, materialId }) {
  const result = await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).get()
  const material = result.data[0]
  if (!material) {
    throw new Error('资料不存在')
  }
  return summarizeMaterial(material)
}

module.exports = {
  createMaterial,
  getMaterialDetail,
  listMaterials,
}
```

- [ ] **Step 5: Implement cloud function wrappers**

For `cloudfunctions/userLogin/index.js`, write:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { upsertUser } = require('../common/services/userService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const user = await upsertUser({ db, openid, now })
    return ok({ user })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

For `cloudfunctions/materialCreate/index.js`, write:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { createMaterial } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const material = await createMaterial({ db, openid, now, input: event })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

For `cloudfunctions/materialList/index.js`, write:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listMaterials } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const materials = await listMaterials({ db, openid })
    return ok({ materials })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

For `cloudfunctions/materialDetail/index.js`, write:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getMaterialDetail } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const material = await getMaterialDetail({ db, openid, materialId: event.materialId })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Each of the four function directories gets this `package.json`:

```json
{
  "name": "cloud-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 6: Run material tests**

Run:

```powershell
bun run test:cloud -- tests/cloud/materialService.spec.js
```

Expected: PASS.

- [ ] **Step 7: Commit material services**

Run:

```powershell
git add cloudfunctions/common/services/userService.js cloudfunctions/common/services/materialService.js cloudfunctions/userLogin cloudfunctions/materialCreate cloudfunctions/materialList cloudfunctions/materialDetail tests/cloud/materialService.spec.js
git commit -m "feat: add user and material cloud services"
```

## Task 5: Parse Job Service And Runner

**Files:**
- Create: `cloudfunctions/common/services/parseService.js`
- Create: `tests/cloud/parseService.spec.js`
- Create: `cloudfunctions/parseStart/index.js`
- Create: `cloudfunctions/parseRunner/index.js`
- Create: `cloudfunctions/parseStatus/index.js`
- Create: matching `package.json` files for the three cloud functions

- [ ] **Step 1: Write parse service tests**

Write `tests/cloud/parseService.spec.js`:

```js
const { describe, expect, it } = require('vitest')
const { createFakeDb } = require('./fakeDb')
const { createMaterial } = require('../../cloudfunctions/common/services/materialService')
const { getParseStatus, runParseJob, startParse } = require('../../cloudfunctions/common/services/parseService')

describe('parse service', () => {
  it('creates one parse job for a material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const first = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    const second = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:02.000Z' })

    expect(first._id).toBe(second._id)
    expect(second.status).toBe('pending')
  })

  it('runs parser and stores candidates', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    const result = await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => '1. 题目\nA. 甲\nB. 乙\n答案：A',
    })

    expect(result.status).toBe('done')
    expect(result.stats.readyCandidateCount).toBe(1)
    const status = await getParseStatus({ db, openid: 'user_a', materialId: material._id })
    expect(status.job.status).toBe('done')
    expect(status.material.readyCandidateCount).toBe(1)
  })

  it('returns existing result when job is already done', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:02.000Z', extractText: async () => '1. 题目\nA. 甲\nB. 乙\n答案：A' })
    const second = await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:03.000Z', extractText: async () => { throw new Error('should not run') } })

    expect(second.status).toBe('done')
  })
})
```

- [ ] **Step 2: Run parse tests and verify failure**

Run:

```powershell
bun run test:cloud -- tests/cloud/parseService.spec.js
```

Expected: FAIL because `parseService.js` does not exist.

- [ ] **Step 3: Implement parse service**

Write `cloudfunctions/common/services/parseService.js` with these exported functions:

```js
const { parseQuestions } = require('../parser')
const { getMaterialDetail } = require('./materialService')

function countStatuses(candidates) {
  return {
    readyCandidateCount: candidates.filter((item) => item.status === 'ready').length,
    needReviewCandidateCount: candidates.filter((item) => item.status === 'need_review').length,
    invalidCandidateCount: candidates.filter((item) => item.status === 'invalid').length,
  }
}

async function startParse({ db, openid, materialId, now }) {
  const material = await getMaterialDetail({ db, openid, materialId })
  const existing = await db.collection('parse_jobs').where({ materialId, ownerOpenid: openid }).get()
  const active = existing.data.find((job) => ['pending', 'running', 'done'].includes(job.status))
  if (active) return active

  const data = {
    materialId,
    ownerOpenid: openid,
    status: 'pending',
    lockUntil: '',
    startedAt: '',
    finishedAt: '',
    errorMessage: '',
    stats: {},
    createdAt: now,
    updatedAt: now,
  }

  const created = await db.collection('parse_jobs').add({ data })
  await db.collection('materials').doc(material._id).update({ data: { status: 'parsing', updatedAt: now } })
  return { _id: created._id, ...data }
}

async function getJobForUser({ db, openid, jobId }) {
  const result = await db.collection('parse_jobs').where({ _id: jobId, ownerOpenid: openid }).get()
  const job = result.data[0]
  if (!job) throw new Error('解析任务不存在')
  return job
}

async function runParseJob({ db, openid, jobId, now, extractText }) {
  const job = await getJobForUser({ db, openid, jobId })
  if (job.status === 'done') return job
  if (job.status === 'running' && job.lockUntil && job.lockUntil > now) {
    return job
  }

  await db.collection('parse_jobs').doc(job._id).update({
    data: {
      status: 'running',
      lockUntil: new Date(Date.parse(now) + 5 * 60 * 1000).toISOString(),
      startedAt: job.startedAt || now,
      updatedAt: now,
    },
  })

  try {
    const material = await getMaterialDetail({ db, openid, materialId: job.materialId })
    const text = await extractText(material)
    if (!text || !text.trim()) throw new Error('PDF 无可解析文本')

    await db.collection('material_pages').add({
      data: {
        materialId: material._id,
        ownerOpenid: openid,
        pageNo: 1,
        text,
        createdAt: now,
      },
    })

    const candidates = parseQuestions({ text, mode: material.parseMode })
    for (const candidate of candidates) {
      await db.collection('parse_candidates').add({
        data: {
          ...candidate,
          materialId: material._id,
          ownerOpenid: openid,
          importedQuestionId: '',
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    const stats = countStatuses(candidates)
    const materialStatus = candidates.length > 0 ? 'reviewing' : 'failed'
    const errorMessage = candidates.length > 0 ? '' : '未解析出题目'
    await db.collection('materials').doc(material._id).update({
      data: {
        status: materialStatus,
        questionCount: candidates.length,
        ...stats,
        errorMessage,
        updatedAt: now,
      },
    })
    await db.collection('parse_jobs').doc(job._id).update({
      data: {
        status: candidates.length > 0 ? 'done' : 'failed',
        finishedAt: now,
        lockUntil: '',
        stats,
        errorMessage,
        updatedAt: now,
      },
    })

    return { ...job, status: candidates.length > 0 ? 'done' : 'failed', stats, errorMessage }
  } catch (error) {
    await db.collection('parse_jobs').doc(job._id).update({
      data: { status: 'failed', finishedAt: now, lockUntil: '', errorMessage: error.message, updatedAt: now },
    })
    await db.collection('materials').doc(job.materialId).update({
      data: { status: 'failed', errorMessage: error.message, updatedAt: now },
    })
    throw error
  }
}

async function getParseStatus({ db, openid, materialId }) {
  const material = await getMaterialDetail({ db, openid, materialId })
  const jobs = await db.collection('parse_jobs').where({ materialId, ownerOpenid: openid }).get()
  return { material, job: jobs.data[0] || null }
}

module.exports = {
  getParseStatus,
  runParseJob,
  startParse,
}
```

- [ ] **Step 4: Implement parse cloud function wrappers**

Write `cloudfunctions/parseStart/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { startParse } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const job = await startParse({ db, openid, materialId: event.materialId, now })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/parseStatus/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getParseStatus } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const status = await getParseStatus({ db, openid, materialId: event.materialId })
    return ok(status)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/parseRunner/index.js`; it must download the cloud file and pass an `extractText` function:

```js
const cloud = require('wx-server-sdk')
const pdfParse = require('pdf-parse')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { runParseJob } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const job = await runParseJob({
      db,
      openid,
      jobId: event.jobId,
      now,
      extractText: async (material) => {
        const file = await cloud.downloadFile({ fileID: material.fileID })
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

Write `cloudfunctions/parseStart/package.json` and `cloudfunctions/parseStatus/package.json`:

```json
{
  "name": "parse-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

Write `cloudfunctions/parseRunner/package.json` with both dependencies:

```json
{
  "name": "parse-runner",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "pdf-parse": "latest",
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 5: Run parser and parse service tests**

Run:

```powershell
bun run test:parser
bun run test:cloud -- tests/cloud/parseService.spec.js
```

Expected: PASS.

- [ ] **Step 6: Commit parse service**

Run:

```powershell
git add cloudfunctions/common/services/parseService.js cloudfunctions/parseStart cloudfunctions/parseRunner cloudfunctions/parseStatus tests/cloud/parseService.spec.js
git commit -m "feat: add idempotent parse jobs"
```

## Task 6: Candidate Review And Idempotent Import

**Files:**
- Create: `cloudfunctions/common/services/candidateService.js`
- Create: `cloudfunctions/common/services/importService.js`
- Create: `tests/cloud/candidateService.spec.js`
- Create: wrappers for `candidateList`, `candidateDetail`, `candidateUpdate`, `importConfirm`

- [ ] **Step 1: Write candidate and import tests**

Write `tests/cloud/candidateService.spec.js`:

```js
const { describe, expect, it } = require('vitest')
const { createFakeDb } = require('./fakeDb')
const { updateCandidate, listCandidates } = require('../../cloudfunctions/common/services/candidateService')
const { confirmImport } = require('../../cloudfunctions/common/services/importService')

async function seedCandidate(db, overrides = {}) {
  const result = await db.collection('parse_candidates').add({
    data: {
      materialId: 'material_1',
      ownerOpenid: 'user_a',
      questionNo: '1',
      type: 'single',
      stem: '题目',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answerKeys: ['A'],
      explanation: '',
      status: 'ready',
      importedQuestionId: '',
      validationErrors: [],
      sourceText: 'source',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

describe('candidate service', () => {
  it('lists only current user candidates for a material', async () => {
    const db = createFakeDb()
    await seedCandidate(db)
    await seedCandidate(db, { ownerOpenid: 'user_b' })

    const result = await listCandidates({ db, openid: 'user_a', materialId: 'material_1' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
  })

  it('validates edited candidate and marks it ready', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, { status: 'need_review', answerKeys: [] })

    const result = await updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })

    expect(result.status).toBe('ready')
    expect(result.answerKeys).toEqual(['B'])
  })

  it('imports ready candidates once', async () => {
    const db = createFakeDb()
    await seedCandidate(db)

    const first = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const second = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:11.000Z' })

    expect(first.importedCount).toBe(1)
    expect(second.importedCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
bun run test:cloud -- tests/cloud/candidateService.spec.js
```

Expected: FAIL because services do not exist.

- [ ] **Step 3: Implement candidate service**

Write `cloudfunctions/common/services/candidateService.js`:

```js
const { validateCandidate } = require('../parser/validate')

async function listCandidates({ db, openid, materialId }) {
  const result = await db.collection('parse_candidates').where({ ownerOpenid: openid, materialId }).get()
  return result.data
}

async function getCandidateDetail({ db, openid, candidateId }) {
  const result = await db.collection('parse_candidates').where({ ownerOpenid: openid, _id: candidateId }).get()
  const candidate = result.data[0]
  if (!candidate) throw new Error('候选题不存在')
  return candidate
}

async function updateCandidate({ db, openid, candidateId, now, input }) {
  const existing = await getCandidateDetail({ db, openid, candidateId })
  if (existing.status === 'imported') throw new Error('已导入题目不能编辑')

  const merged = validateCandidate({
    ...existing,
    type: input.type || existing.type,
    stem: input.stem ?? existing.stem,
    options: input.options || existing.options,
    answerKeys: input.answerKeys || existing.answerKeys,
    explanation: input.explanation ?? existing.explanation,
  })

  const data = {
    type: merged.type,
    stem: merged.stem,
    options: merged.options,
    answerKeys: merged.answerKeys,
    explanation: merged.explanation,
    validationErrors: merged.validationErrors,
    status: merged.status,
    updatedAt: now,
  }
  await db.collection('parse_candidates').doc(candidateId).update({ data })
  return { ...existing, ...data }
}

module.exports = {
  getCandidateDetail,
  listCandidates,
  updateCandidate,
}
```

- [ ] **Step 4: Implement import service**

Write `cloudfunctions/common/services/importService.js`:

```js
const { listCandidates } = require('./candidateService')

async function confirmImport({ db, openid, materialId, now }) {
  const candidates = await listCandidates({ db, openid, materialId })
  const ready = candidates.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId)
  let importedCount = 0

  for (const candidate of ready) {
    const questionData = {
      ownerOpenid: openid,
      materialId,
      candidateId: candidate._id,
      type: candidate.type,
      stem: candidate.stem,
      options: candidate.options,
      answerKeys: candidate.answerKeys,
      explanation: candidate.explanation || '',
      sourcePageNo: candidate.sourcePageNo || null,
      createdAt: now,
      updatedAt: now,
    }
    const created = await db.collection('questions').add({ data: questionData })
    await db.collection('parse_candidates').doc(candidate._id).update({
      data: {
        importedQuestionId: created._id,
        status: 'imported',
        updatedAt: now,
      },
    })
    importedCount += 1
  }

  return { importedCount, skippedCount: candidates.length - importedCount }
}

module.exports = {
  confirmImport,
}
```

- [ ] **Step 5: Implement cloud wrappers**

Write `cloudfunctions/candidateList/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listCandidates } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidates = await listCandidates({ db, openid, materialId: event.materialId })
    return ok({ candidates })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/candidateDetail/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getCandidateDetail } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidate = await getCandidateDetail({ db, openid, candidateId: event.candidateId })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/candidateUpdate/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { updateCandidate } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidate = await updateCandidate({
      db,
      openid,
      candidateId: event.candidateId,
      now,
      input: event.candidate || {},
    })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/importConfirm/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { confirmImport } = require('../common/services/importService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const result = await confirmImport({
      db,
      openid,
      materialId: event.materialId,
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write this package file in each of `candidateList`, `candidateDetail`, `candidateUpdate`, and `importConfirm`:

```json
{
  "name": "candidate-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 6: Run candidate tests**

Run:

```powershell
bun run test:cloud -- tests/cloud/candidateService.spec.js
```

Expected: PASS.

- [ ] **Step 7: Commit candidate and import services**

Run:

```powershell
git add cloudfunctions/common/services/candidateService.js cloudfunctions/common/services/importService.js cloudfunctions/candidateList cloudfunctions/candidateDetail cloudfunctions/candidateUpdate cloudfunctions/importConfirm tests/cloud/candidateService.spec.js
git commit -m "feat: add candidate review and import"
```

## Task 7: Practice Services With Backend Grading

**Files:**
- Create: `cloudfunctions/common/services/practiceService.js`
- Create: `tests/cloud/practiceService.spec.js`
- Create: wrappers for `questionList`, `practiceCreate`, `practiceDetail`, `answerSubmit`

- [ ] **Step 1: Write practice tests**

Write `tests/cloud/practiceService.spec.js`:

```js
const { describe, expect, it } = require('vitest')
const { createFakeDb } = require('./fakeDb')
const { answerSubmit, createPractice, getPracticeDetail, listQuestions } = require('../../cloudfunctions/common/services/practiceService')

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
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

describe('practice service', () => {
  it('lists only current user questions', async () => {
    const db = createFakeDb()
    await seedQuestion(db)
    await seedQuestion(db, { ownerOpenid: 'user_b' })

    const questions = await listQuestions({ db, openid: 'user_a', materialId: 'material_1' })

    expect(questions).toHaveLength(1)
    expect(questions[0].answerKeys).toBeUndefined()
  })

  it('creates practice session and hides answers in detail', async () => {
    const db = createFakeDb()
    await seedQuestion(db)
    const session = await createPractice({ db, openid: 'user_a', materialId: 'material_1', count: 5, now: '2026-04-26T00:00:01.000Z' })
    const detail = await getPracticeDetail({ db, openid: 'user_a', sessionId: session._id })

    expect(detail.questions).toHaveLength(1)
    expect(detail.questions[0].answerKeys).toBeUndefined()
  })

  it('grades answer on backend and stores attempt', async () => {
    const db = createFakeDb()
    await seedQuestion(db)
    const session = await createPractice({ db, openid: 'user_a', materialId: 'material_1', count: 5, now: '2026-04-26T00:00:01.000Z' })

    const result = await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['A'],
      now: '2026-04-26T00:00:02.000Z',
    })

    expect(result.isCorrect).toBe(true)
    expect(result.answerKeys).toEqual(['A'])
    expect(result.explanation).toBe('解析')
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
bun run test:cloud -- tests/cloud/practiceService.spec.js
```

Expected: FAIL because `practiceService.js` does not exist.

- [ ] **Step 3: Implement practice service**

Write `cloudfunctions/common/services/practiceService.js`:

```js
function hideAnswer(question) {
  const { answerKeys, ...safeQuestion } = question
  return safeQuestion
}

function normalizeSelected(keys) {
  return Array.from(new Set((keys || []).map((key) => String(key).toUpperCase()))).sort()
}

function sameKeys(a, b) {
  return normalizeSelected(a).join('|') === normalizeSelected(b).join('|')
}

async function listQuestions({ db, openid, materialId }) {
  const query = materialId ? { ownerOpenid: openid, materialId } : { ownerOpenid: openid }
  const result = await db.collection('questions').where(query).get()
  return result.data.map(hideAnswer)
}

async function createPractice({ db, openid, materialId, count, now }) {
  const query = materialId ? { ownerOpenid: openid, materialId } : { ownerOpenid: openid }
  const questions = await db.collection('questions').where(query).get()
  const selected = questions.data.slice(0, Number(count || 10))
  if (selected.length === 0) throw new Error('没有可练习题目')

  const data = {
    ownerOpenid: openid,
    materialId: materialId || '',
    questionIds: selected.map((question) => question._id),
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

async function getPracticeDetail({ db, openid, sessionId }) {
  const sessions = await db.collection('practice_sessions').where({ _id: sessionId, ownerOpenid: openid }).get()
  const session = sessions.data[0]
  if (!session) throw new Error('练习不存在')

  const questions = []
  for (const questionId of session.questionIds) {
    const result = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
    if (result.data[0]) questions.push(hideAnswer(result.data[0]))
  }

  return { session, questions }
}

async function answerSubmit({ db, openid, sessionId, questionId, selectedKeys, now }) {
  const detail = await getPracticeDetail({ db, openid, sessionId })
  if (!detail.session.questionIds.includes(questionId)) throw new Error('题目不属于本次练习')

  const questionResult = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
  const question = questionResult.data[0]
  if (!question) throw new Error('题目不存在')

  const normalizedSelected = normalizeSelected(selectedKeys)
  const isCorrect = sameKeys(normalizedSelected, question.answerKeys)
  await db.collection('attempts').add({
    data: {
      ownerOpenid: openid,
      sessionId,
      questionId,
      selectedKeys: normalizedSelected,
      isCorrect,
      createdAt: now,
    },
  })

  const attempts = await db.collection('attempts').where({ ownerOpenid: openid, sessionId }).get()
  const correctCount = attempts.data.filter((attempt) => attempt.isCorrect).length
  const submitted = attempts.data.length >= detail.session.totalCount
  await db.collection('practice_sessions').doc(sessionId).update({
    data: {
      correctCount,
      status: submitted ? 'submitted' : 'active',
      submittedAt: submitted ? now : '',
      updatedAt: now,
    },
  })

  return {
    questionId,
    selectedKeys: normalizedSelected,
    isCorrect,
    answerKeys: question.answerKeys,
    explanation: question.explanation || '',
  }
}

module.exports = {
  answerSubmit,
  createPractice,
  getPracticeDetail,
  listQuestions,
}
```

- [ ] **Step 4: Implement practice wrappers**

Write `cloudfunctions/questionList/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listQuestions } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const questions = await listQuestions({ db, openid, materialId: event.materialId })
    return ok({ questions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/practiceCreate/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { createPractice } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const session = await createPractice({
      db,
      openid,
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

Write `cloudfunctions/practiceDetail/index.js`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getPracticeDetail } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const detail = await getPracticeDetail({ db, openid, sessionId: event.sessionId })
    return ok(detail)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write `cloudfunctions/answerSubmit/index.js`; this is the only practice wrapper that returns `answerKeys`:

```js
const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { answerSubmit } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const result = await answerSubmit({
      db,
      openid,
      sessionId: event.sessionId,
      questionId: event.questionId,
      selectedKeys: event.selectedKeys || [],
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

Write this package file in each of `questionList`, `practiceCreate`, `practiceDetail`, and `answerSubmit`:

```json
{
  "name": "practice-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 5: Run practice tests**

Run:

```powershell
bun run test:cloud -- tests/cloud/practiceService.spec.js
```

Expected: PASS.

- [ ] **Step 6: Run full backend tests**

Run:

```powershell
bun test
```

Expected: all parser and cloud service tests PASS.

- [ ] **Step 7: Commit practice services**

Run:

```powershell
git add cloudfunctions/common/services/practiceService.js cloudfunctions/questionList cloudfunctions/practiceCreate cloudfunctions/practiceDetail cloudfunctions/answerSubmit tests/cloud/practiceService.spec.js
git commit -m "feat: add practice backend grading"
```

## Task 8: Frontend API Client And Shared Types

**Files:**
- Create: `common/types.ts`
- Create: `common/api/cloud.ts`
- Create: `common/constants/status.ts`
- Create: `common/format.ts`

- [ ] **Step 1: Create shared frontend types**

Write `common/types.ts`:

```ts
export type ParseMode = 'inline_answer' | 'answer_at_end'
export type MaterialStatus = 'uploaded' | 'parsing' | 'reviewing' | 'ready' | 'failed'
export type CandidateStatus = 'ready' | 'need_review' | 'invalid' | 'imported'
export type QuestionType = 'single' | 'multiple' | 'judge'

export interface OptionItem {
  key: string
  text: string
}

export interface Material {
  _id: string
  fileName: string
  fileSize: number
  status: MaterialStatus
  parseMode: ParseMode
  questionCount: number
  readyCandidateCount: number
  needReviewCandidateCount: number
  invalidCandidateCount: number
  errorMessage: string
  createdAt: string
  updatedAt: string
}

export interface Candidate {
  _id: string
  materialId: string
  questionNo: string
  type: QuestionType
  stem: string
  options: OptionItem[]
  answerKeys: string[]
  explanation: string
  status: CandidateStatus
  validationErrors: string[]
  importedQuestionId: string
}

export interface SafeQuestion {
  _id: string
  materialId: string
  type: QuestionType
  stem: string
  options: OptionItem[]
  explanation?: string
}

export interface PracticeSession {
  _id: string
  materialId: string
  questionIds: string[]
  status: 'active' | 'submitted'
  totalCount: number
  correctCount: number
}
```

- [ ] **Step 2: Create status labels**

Write `common/constants/status.ts`:

```ts
export const MATERIAL_STATUS_TEXT = {
  uploaded: '已上传',
  parsing: '解析中',
  reviewing: '待审核',
  ready: '可刷题',
  failed: '解析失败',
} as const

export const CANDIDATE_STATUS_TEXT = {
  ready: '可导入',
  need_review: '需确认',
  invalid: '不可导入',
  imported: '已导入',
} as const
```

- [ ] **Step 3: Create formatting helpers**

Write `common/format.ts`:

```ts
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
```

- [ ] **Step 4: Create cloud API client**

Write `common/api/cloud.ts`:

```ts
interface CloudResult<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

export async function callFunction<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const result = await wx.cloud.callFunction({ name, data })
  const payload = result.result as CloudResult<T>
  if (!payload?.ok) {
    throw new Error(payload?.error?.message || '请求失败')
  }
  return payload.data as T
}

export const api = {
  userLogin: () => callFunction<{ user: unknown }>('userLogin'),
  materialCreate: (data: Record<string, unknown>) => callFunction<{ material: unknown }>('materialCreate', data),
  materialList: () => callFunction<{ materials: unknown[] }>('materialList'),
  materialDetail: (materialId: string) => callFunction<{ material: unknown }>('materialDetail', { materialId }),
  parseStart: (materialId: string) => callFunction<{ job: unknown }>('parseStart', { materialId }),
  parseStatus: (materialId: string) => callFunction<{ material: unknown; job: unknown }>('parseStatus', { materialId }),
  candidateList: (materialId: string) => callFunction<{ candidates: unknown[] }>('candidateList', { materialId }),
  candidateDetail: (candidateId: string) => callFunction<{ candidate: unknown }>('candidateDetail', { candidateId }),
  candidateUpdate: (candidateId: string, candidate: Record<string, unknown>) =>
    callFunction<{ candidate: unknown }>('candidateUpdate', { candidateId, candidate }),
  importConfirm: (materialId: string) => callFunction<{ importedCount: number; skippedCount: number }>('importConfirm', { materialId }),
  questionList: (materialId?: string) => callFunction<{ questions: unknown[] }>('questionList', { materialId }),
  practiceCreate: (data: { materialId?: string; count: number }) => callFunction<{ session: unknown }>('practiceCreate', data),
  practiceDetail: (sessionId: string) => callFunction<{ session: unknown; questions: unknown[] }>('practiceDetail', { sessionId }),
  answerSubmit: (data: { sessionId: string; questionId: string; selectedKeys: string[] }) =>
    callFunction<{ questionId: string; selectedKeys: string[]; isCorrect: boolean; answerKeys: string[]; explanation: string }>('answerSubmit', data),
}
```

- [ ] **Step 5: Type-check build**

Run:

```powershell
bun run build:mp-weixin
```

Expected: build proceeds until missing pages are reported; after UI pages are added this command should pass.

- [ ] **Step 6: Commit frontend API layer**

Run:

```powershell
git add common
git commit -m "feat: add frontend cloud api layer"
```

## Task 9: Reusable Frontend Components

**Files:**
- Create: all files under `components/`

- [ ] **Step 1: Implement status, empty, loading, and error components**

Create:

```text
components/StatusBadge.vue
components/EmptyState.vue
components/LoadingState.vue
components/ErrorState.vue
```

Each component accepts props only and emits only explicit actions. `StatusBadge` maps the `type` prop to neutral, success, warning, or danger styles. `ErrorState` emits `retry` from its retry button.

- [ ] **Step 2: Implement material and candidate display cards**

Create `MaterialCard.vue` with props:

```ts
const props = defineProps<{ material: Material }>()
const emit = defineEmits<{ open: [id: string] }>()
```

Create `CandidateCard.vue` with props:

```ts
const props = defineProps<{ candidate: Candidate }>()
const emit = defineEmits<{ edit: [id: string] }>()
```

Both cards must use 8px radius, stable padding, and no nested cards.

- [ ] **Step 3: Implement practice components**

Create `OptionList.vue` with props:

```ts
const props = defineProps<{
  options: OptionItem[]
  modelValue: string[]
  mode: 'single' | 'multiple' | 'judge'
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
```

Create `QuestionCard.vue` with props:

```ts
const props = defineProps<{
  question: SafeQuestion
  selectedKeys: string[]
  index: number
  total: number
}>()
const emit = defineEmits<{ answer: [keys: string[]] }>()
```

- [ ] **Step 4: Build mini program**

Run:

```powershell
bun run build:mp-weixin
```

Expected: build may still fail if pages are empty; component syntax errors must be resolved before continuing.

- [ ] **Step 5: Commit components**

Run:

```powershell
git add components
git commit -m "feat: add reusable mini program components"
```

## Task 10: Material, Upload, And Candidate Review Pages

**Files:**
- Create: `pages/index/index.vue`
- Create: `pages/upload/index.vue`
- Create: `pages/material/detail.vue`
- Create: `pages/import/review.vue`
- Create: `pages/import/edit.vue`

- [ ] **Step 1: Implement home page**

`pages/index/index.vue` must:

- call `api.userLogin()` on load;
- call `api.materialList()` after login;
- show `EmptyState` when there are no materials;
- render `MaterialCard` for each material;
- navigate to `/pages/upload/index` from the primary button;
- navigate to `/pages/material/detail?materialId=...` when a material is tapped.

- [ ] **Step 2: Implement upload page**

`pages/upload/index.vue` must:

- use `wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'] })`;
- upload to `materials/${Date.now()}-${file.name}` using `wx.cloud.uploadFile`;
- call `api.materialCreate({ fileID, fileName, fileSize, parseMode })`;
- call `api.parseStart(material._id)`;
- navigate to material detail after parse job creation.

Supported parse modes in the UI are exactly `inline_answer` and `answer_at_end`.

- [ ] **Step 3: Implement material detail page**

`pages/material/detail.vue` must:

- read `materialId` from route options;
- call `api.materialDetail(materialId)` and `api.parseStatus(materialId)`;
- if status is `parsing`, poll `parseStatus` every 3 seconds while page is visible;
- show counts for ready, need review, and invalid candidates;
- show buttons for candidate review and practice setup when relevant;
- show failure message when `status = failed`.

- [ ] **Step 4: Implement candidate review page**

`pages/import/review.vue` must:

- load `api.candidateList(materialId)`;
- group visually by status using `StatusBadge`;
- provide edit action for each non-imported candidate;
- call `api.importConfirm(materialId)` from a fixed bottom action area;
- reload list after import and show imported count.

- [ ] **Step 5: Implement candidate edit page**

`pages/import/edit.vue` must:

- load `api.candidateDetail(candidateId)`;
- edit stem, type, options, answer keys, and explanation;
- validate client-side that at least one option exists before saving;
- call `api.candidateUpdate(candidateId, candidate)`;
- navigate back to review after save.

- [ ] **Step 6: Build mini program**

Run:

```powershell
bun run build:mp-weixin
```

Expected: PASS and output appears under `unpackage/dist/build/mp-weixin`.

- [ ] **Step 7: Commit material and review UI**

Run:

```powershell
git add pages/index pages/upload pages/material pages/import pages.json
git commit -m "feat: add pdf upload and candidate review ui"
```

## Task 11: Practice Pages

**Files:**
- Create: `pages/practice/setup.vue`
- Create: `pages/practice/do.vue`
- Create: `pages/practice/result.vue`

- [ ] **Step 1: Implement practice setup**

`pages/practice/setup.vue` must:

- accept optional `materialId`;
- show question count from `api.questionList(materialId)`;
- let the user choose a count from `5`, `10`, and `20`;
- call `api.practiceCreate({ materialId, count })`;
- navigate to `/pages/practice/do?sessionId=...`.

- [ ] **Step 2: Implement answer page**

`pages/practice/do.vue` must:

- call `api.practiceDetail(sessionId)`;
- store selected keys by question id;
- render one `QuestionCard` at a time;
- call `api.answerSubmit({ sessionId, questionId, selectedKeys })` when user submits a question;
- store returned grading result locally;
- advance to next question until finished;
- navigate to result page with `sessionId` after all questions are submitted.

The page must not rely on `answerKeys` before `answerSubmit` returns.

- [ ] **Step 3: Implement result page**

`pages/practice/result.vue` must:

- call `api.practiceDetail(sessionId)`;
- display `correctCount / totalCount`;
- provide buttons to return to home and retry the same material.

- [ ] **Step 4: Build mini program**

Run:

```powershell
bun run build:mp-weixin
```

Expected: PASS.

- [ ] **Step 5: Commit practice UI**

Run:

```powershell
git add pages/practice
git commit -m "feat: add practice flow ui"
```

## Task 12: Cloud Function Deployment Checklist And Manual QA

**Files:**
- Create: `docs/manual-qa/pdf-import-practice-mvp.md`

- [ ] **Step 1: Create manual QA document**

Write `docs/manual-qa/pdf-import-practice-mvp.md`:

```markdown
# PDF Import Practice MVP Manual QA

## Environment

- Project path: `G:\HBuilderProjects\ShuaTi`
- Package manager: Bun from `F:\.bun`
- Mini program target: WeChat mini program
- CloudBase environment: default environment bound to the current mini program

## Cloud Collections

Create these collections in CloudBase:

- `users`
- `materials`
- `parse_jobs`
- `material_pages`
- `parse_candidates`
- `questions`
- `practice_sessions`
- `attempts`

Each collection must deny direct public writes. All writes go through cloud functions.

## Cloud Functions

Upload and deploy:

- `userLogin`
- `materialCreate`
- `materialList`
- `materialDetail`
- `parseStart`
- `parseRunner`
- `parseStatus`
- `candidateList`
- `candidateDetail`
- `candidateUpdate`
- `importConfirm`
- `questionList`
- `practiceCreate`
- `practiceDetail`
- `answerSubmit`

## Test PDF Content

Use a text PDF containing:

```text
1. 下列说法正确的是（ ）
A. 选项一
B. 选项二
答案：A
解析：基础概念题

2. 多选题
A. 甲
B. 乙
C. 丙
答案：AC
```

## QA Steps

1. Launch the mini program in WeChat DevTools.
2. Enter home page and confirm `userLogin` succeeds.
3. Upload the test PDF.
4. Confirm material status becomes `parsing`.
5. Run or trigger `parseRunner` with the created job id.
6. Confirm material status becomes `reviewing`.
7. Open candidate review and confirm two candidates appear.
8. Edit one candidate and save.
9. Confirm import and verify imported count is `2`.
10. Start a practice session from the material.
11. Confirm answer page does not display correct answers before submission.
12. Submit one correct and one wrong answer.
13. Confirm result page shows score and explanations.
14. Return to candidate review and confirm importing again creates zero new questions.
```

- [ ] **Step 2: Run automated tests**

Run:

```powershell
bun test
```

Expected: all parser and cloud tests PASS.

- [ ] **Step 3: Build mini program**

Run:

```powershell
bun run build:mp-weixin
```

Expected: PASS.

- [ ] **Step 4: Commit QA docs**

Run:

```powershell
git add docs/manual-qa/pdf-import-practice-mvp.md
git commit -m "docs: add manual qa checklist"
```

## Task 13: Final Verification

**Files:**
- Modify only files required by failing verification.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
bun test
```

Expected: PASS.

- [ ] **Step 2: Build WeChat mini program**

Run:

```powershell
bun run build:mp-weixin
```

Expected: PASS with generated output in `unpackage/dist/build/mp-weixin`.

- [ ] **Step 3: Inspect git diff**

Run:

```powershell
git status --short
git log --oneline -5
```

Expected: working tree clean except generated files ignored by `.gitignore`; recent commits match the plan tasks.

- [ ] **Step 4: Manual QA**

Run through `docs/manual-qa/pdf-import-practice-mvp.md` in WeChat DevTools. Record failures as a small fix commit before final handoff.

- [ ] **Step 5: Final commit when verification is clean**

Run:

```powershell
git status --short
```

Expected: no uncommitted source changes.

## Self-Review

### Spec Coverage

- PDF upload to cloud storage: Task 10.
- Material creation and ownership: Task 4.
- Parser modes `inline_answer` and `answer_at_end`: Task 2.
- Parser as pure testable module: Task 2.
- Parse job idempotency: Task 5.
- Candidate list, edit, status validation: Task 6 and Task 10.
- Idempotent import: Task 6.
- Question list and practice creation: Task 7 and Task 11.
- `practiceDetail` hiding answers: Task 7.
- Backend grading in `answerSubmit`: Task 7.
- Basic result page: Task 11.
- Manual CloudBase deployment and QA: Task 12.
- Deferred scope is excluded: no wrong-question collection, no OCR, no AI, no full reparse path.

### Placeholder Scan

This plan contains no unfinished sections or unspecified file ownership. The only empty values are valid uni-app manifest appid fields for an unbound local mini program.

### Type Consistency

Frontend status names match backend status names:

- Material: `uploaded | parsing | reviewing | ready | failed`
- Candidate: `ready | need_review | invalid | imported`
- Question type: `single | multiple | judge`

Cloud services consistently use `openid` from server context and collection field `ownerOpenid`.
