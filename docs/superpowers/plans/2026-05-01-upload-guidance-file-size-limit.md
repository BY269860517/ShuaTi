# Upload Guidance and File Size Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在上传 PDF 页面展示清晰的上传要求，并在前端限制 PDF 文件最大 20MB。

**Architecture:** 保持现有上传和解析链路不变，只在 `pages/upload/index.vue` 增加说明文案与文件大小校验。校验发生在用户选择文件后和点击上传前，测试用静态源码断言覆盖关键逻辑，中文验收文档指导 HBuilderX/微信开发者工具手工验证。

**Tech Stack:** uni-app Vue 3 `<script setup lang="ts">`、TypeScript、uniCloud、Vitest/Bun、微信小程序 `wx.chooseMessageFile`。

---

## File Structure

- Modify: `pages/upload/index.vue`
  - 新增 `MAX_PDF_FILE_SIZE`、`MAX_PDF_FILE_SIZE_TEXT`。
  - 新增上传说明文案：20MB、单选题/多选题/判断题、题目必须有答案。
  - 新增 `validateSelectedFile(file)`，选择文件后和提交上传前都调用。
- Modify: `tests/frontend/pages.spec.ts`
  - 增加上传页说明文案和 20MB 限制的源码级测试。
  - 增加提交前兜底校验顺序测试。
- Create: `docs/manual-qa/upload-guidance-file-size-limit-v1-1.md`
  - 中文手工验收步骤，覆盖正常 PDF、大于 20MB PDF、说明文案和既有解析链路不变。

---

### Task 1: Upload Page Guidance And Validation

**Files:**
- Modify: `pages/upload/index.vue`
- Modify: `tests/frontend/pages.spec.ts`

- [ ] **Step 1: Add failing frontend assertions**

Add this test after the existing upload page tests in `tests/frontend/pages.spec.ts`:

```ts
  test('upload page explains pdf requirements and blocks files over 20MB before upload', () => {
    const source = read('pages/upload/index.vue')
    const choosePdfStart = source.indexOf('async function choosePdf')
    const choosePdfEnd = source.indexOf('function chooseMessageFile')
    const choosePdfSource = source.slice(choosePdfStart, choosePdfEnd)
    const submitStart = source.indexOf('async function submitUpload')
    const submitEnd = source.indexOf('function sanitizeCloudFileName')
    const submitSource = source.slice(submitStart, submitEnd)
    const validationIndex = submitSource.indexOf('const validationError = validateSelectedFile(file)')
    const uploadingIndex = submitSource.indexOf('uploading.value = true')

    expect(source).toContain('const MAX_PDF_FILE_SIZE = 20 * 1024 * 1024')
    expect(source).toContain("const MAX_PDF_FILE_SIZE_TEXT = '20MB'")
    expect(source).toContain('文件大小不超过 {{ MAX_PDF_FILE_SIZE_TEXT }}')
    expect(source).toContain('单选题、多选题、判断题')
    expect(source).toContain('题目必须有选项和标准答案')
    expect(source).toContain('function validateSelectedFile(file: ChosenFile): string')
    expect(source).toContain('file.size > MAX_PDF_FILE_SIZE')
    expect(source).toContain('文件大小不能超过')
    expect(choosePdfSource).toContain('const validationError = validateSelectedFile(file)')
    expect(choosePdfSource).toContain('selectedFile.value = null')
    expect(validationIndex).toBeGreaterThan(-1)
    expect(uploadingIndex).toBeGreaterThan(validationIndex)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: FAIL because `MAX_PDF_FILE_SIZE` and `validateSelectedFile` are not present yet.

- [ ] **Step 3: Add upload constants and validator**

In `pages/upload/index.vue`, after `const errorMessage = ref('')`, add:

```ts
const MAX_PDF_FILE_SIZE = 20 * 1024 * 1024
const MAX_PDF_FILE_SIZE_TEXT = '20MB'
```

Before `async function submitUpload()`, add:

```ts
function validateSelectedFile(file: ChosenFile): string {
  if (file.size > MAX_PDF_FILE_SIZE) {
    return `文件大小不能超过 ${MAX_PDF_FILE_SIZE_TEXT}，请重新选择较小的 PDF。`
  }

  return ''
}
```

- [ ] **Step 4: Validate immediately after file selection**

In `choosePdf()`, replace the current `selectedFile.value = { ... }` assignment with:

```ts
    const chosenFile = {
      name: file.name,
      size: file.size,
      path: file.path,
    }
    const validationError = validateSelectedFile(chosenFile)
    if (validationError) {
      selectedFile.value = null
      errorMessage.value = validationError
      return
    }

    selectedFile.value = chosenFile
```

- [ ] **Step 5: Validate again before upload**

In `submitUpload()`, insert validation before `uploading.value = true`:

```ts
  const validationError = validateSelectedFile(file)
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  uploading.value = true
```

- [ ] **Step 6: Add guidance UI in the PDF section**

In `pages/upload/index.vue`, inside the PDF section after the existing selected file / hint block, add:

```vue
      <view class="upload-guidance">
        <text class="upload-guidance__item">文件大小不超过 {{ MAX_PDF_FILE_SIZE_TEXT }}。</text>
        <text class="upload-guidance__item">目前支持单选题、多选题、判断题。</text>
        <text class="upload-guidance__item">题目必须有选项和标准答案，缺少答案会进入待审核或不可用。</text>
      </view>
```

Add these styles near the existing `.file-info__size, .hint` block:

```scss
.upload-guidance {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eef2f7;
}

.upload-guidance__item {
  display: block;
  color: #475467;
  font-size: 26rpx;
  line-height: 38rpx;
}

.upload-guidance__item + .upload-guidance__item {
  margin-top: 6rpx;
}
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend/pages.spec.ts
```

Expected: PASS.

---

### Task 2: Manual QA Documentation And Verification

**Files:**
- Create: `docs/manual-qa/upload-guidance-file-size-limit-v1-1.md`

- [ ] **Step 1: Create Chinese manual QA document**

Create `docs/manual-qa/upload-guidance-file-size-limit-v1-1.md` with:

```md
# 上传提示和文件大小限制验收说明

## 验收目标

- 上传 PDF 页面展示三条说明：文件不超过 20MB、支持单选题/多选题/判断题、题目必须有答案。
- 选择超过 20MB 的 PDF 后，不进入已选文件状态，也不能点击上传解析。
- 选择 20MB 以内的 PDF 后，仍按原流程上传、创建资料并触发解析。
- 本次只做上传前提示和前端拦截，不改 PDF 解析算法和题型识别规则。

## 准备

- 用 HBuilderX 运行到微信开发者工具。
- 准备两个 PDF：
  - `doc/shuati-test-sample.pdf`，用于验证正常上传。
  - 任意大于 20MB 的 PDF，用于验证拦截。

## 验收步骤

1. 进入“我的资料”页面，点击“上传 PDF”。
2. 确认页面上能看到：
   - 文件大小不超过 20MB。
   - 目前支持单选题、多选题、判断题。
   - 题目必须有选项和标准答案，缺少答案会进入待审核或不可用。
3. 点击“选择 PDF”，选择大于 20MB 的 PDF。
4. 预期结果：页面显示“文件大小不能超过 20MB”，不展示该文件名，“上传并解析”按钮不可点击。
5. 重新点击“选择 PDF”，选择 `doc/shuati-test-sample.pdf`。
6. 预期结果：页面展示文件名和文件大小，“上传并解析”按钮可点击。
7. 点击“上传并解析”。
8. 预期结果：资料被创建，解析流程和改动前一致。

## 通过标准

- 大文件在前端被拦截，没有发起 `uniCloud.uploadFile`。
- 合规 PDF 可以继续上传解析。
- 说明文字清晰，不挤压按钮和文件信息。
```

- [ ] **Step 2: Run frontend tests**

Run:

```powershell
node scripts/run-bun.mjs test tests/frontend
```

Expected: PASS.

- [ ] **Step 3: Run mini-program build**

Run:

```powershell
npm.cmd run build:mp-weixin
```

Expected: build succeeds. Existing Sass deprecation warnings are acceptable if there are no build errors.

---

## Self-Review

- Spec coverage: The plan covers upload guidance text, supported three question types, answer requirement, and file size limit logic.
- Scope control: No backend parsing, cloud functions, question import, or practice flow changes.
- Type consistency: `ChosenFile` already has `size: number`, so `validateSelectedFile(file: ChosenFile): string` can be used in both selection and submission paths.
- Testability: Focused source assertions cover constants, UI text, file-size comparison, file clearing, and validation-before-upload ordering.
