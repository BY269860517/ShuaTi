# ShuaTi UI Style A Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved “清爽学习工具型” UI direction across ShuaTi without changing business logic.

**Architecture:** Keep the existing uni-app page/component structure. Centralize the approved palette in `uni.scss`, then replace repeated hard-coded page/component colors with SCSS tokens. Keep layout changes conservative: 8rpx radius, clearer card separation, soft shadows, calm primary actions, and consistent state badges.

**Tech Stack:** uni-app Vue 3, scoped SCSS, TypeScript, Vitest/Bun static frontend tests, mp-weixin build.

---

## File Structure

- Modify: `uni.scss`
  - Source of truth for scheme A colors, surfaces, status colors, borders, shadows, and radii.
- Modify: `App.vue`
  - Use tokenized page background/text/font.
- Modify: `components/*.vue`
  - Tokenize shared card, badge, option, loading, empty, error, question, candidate, and material visual styles.
- Modify: `pages/**/*.vue`
  - Tokenize page background, card surfaces, buttons, section borders, notices, bottom bars, and text colors.
- Create: `tests/frontend/designTheme.spec.ts`
  - Guard against old core colors returning and assert the selected scheme A tokens.

## Scope Rules

- Do not change any API calls, cloud functions, navigation, validation, parsing, answer logic, ads, or data models.
- Do not introduce Wot Design Uni or uView yet; this is a visual-token refresh only.
- Do not increase card radius above 8rpx; keep the product work-focused.
- Keep existing Chinese copy unchanged.

### Task 1: Theme Guard Test

**Files:**
- Create: `tests/frontend/designTheme.spec.ts`

- [ ] **Step 1: Write failing test**

Create `tests/frontend/designTheme.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const themeFiles = [
  'App.vue',
  'components/CandidateCard.vue',
  'components/EmptyState.vue',
  'components/ErrorState.vue',
  'components/LoadingState.vue',
  'components/MaterialCard.vue',
  'components/OptionList.vue',
  'components/QuestionCard.vue',
  'components/StatusBadge.vue',
  'pages/index/index.vue',
  'pages/material/detail.vue',
  'pages/upload/index.vue',
  'pages/import/review.vue',
  'pages/import/edit.vue',
  'pages/practice/setup.vue',
  'pages/practice/do.vue',
  'pages/practice/result.vue',
  'pages/profile/index.vue',
  'pages/wrong/index.vue',
]

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('scheme A design theme', () => {
  test('declares the approved calm study-tool palette', () => {
    const source = read('uni.scss')

    expect(source).toContain('$brand-primary: #246d9d;')
    expect(source).toContain('$brand-success: #1f9d7a;')
    expect(source).toContain('$background: #f5f8fb;')
    expect(source).toContain('$surface-shadow: 0 4rpx 16rpx rgba(31, 95, 139, 0.06);')
  })

  test('core UI files use design tokens instead of the old scheme colors', () => {
    const combined = themeFiles.map((file) => read(file)).join('\n')

    expect(combined).not.toContain('#1f5f8b')
    expect(combined).not.toContain('#f6f7f9')
    expect(combined).not.toContain('#b8c7d8')
  })
})
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/designTheme.spec.ts
```

Expected: FAIL because `uni.scss` still contains the older palette and UI files still contain old hard-coded colors.

### Task 2: Design Tokens

**Files:**
- Modify: `uni.scss`
- Modify: `App.vue`

- [ ] **Step 1: Replace `uni.scss` token definitions**

Use this content:

```scss
$brand-primary: #246d9d;
$brand-primary-pressed: #1d5b83;
$brand-primary-soft: #e8f4fb;
$brand-primary-soft-strong: #d7e6f3;
$brand-border: #b7cadd;
$brand-border-strong: #6ea4c8;
$brand-success: #1f9d7a;
$brand-success-deep: #16643f;
$brand-success-soft: #e8f7f1;
$brand-success-border: #bfe6cf;
$text-primary: #202938;
$text-body: #364152;
$text-secondary: #64748b;
$text-muted: #697586;
$border-color: #dce3ec;
$border-soft: #e7edf3;
$surface: #ffffff;
$surface-muted: #eef2f7;
$surface-hover: #f8fafc;
$background: #f5f8fb;
$danger: #9f2a2a;
$danger-soft: #fff7f7;
$danger-border: #f0c9c9;
$warning: #7a4b08;
$warning-soft: #fffaf0;
$warning-border: #efd49c;
$radius-card: 8rpx;
$surface-shadow: 0 4rpx 16rpx rgba(31, 95, 139, 0.06);
```

- [ ] **Step 2: Tokenize `App.vue` global page style**

Change global `page` style to:

```scss
page {
  min-height: 100%;
  background: $background;
  color: $text-primary;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 3: Run theme test**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/designTheme.spec.ts
```

Expected: still FAIL until shared components and pages are tokenized.

### Task 3: Shared Component Tokenization

**Files:**
- Modify: all `components/*.vue`

- [ ] **Step 1: Replace old color literals in components**

In component style blocks, replace old repeated colors with tokens:

```text
#1f5f8b -> $brand-primary
#f6f7f9 -> $background
#ffffff -> $surface
#202938 -> $text-primary
#364152 -> $text-body
#697586 -> $text-muted
#596579 -> $text-secondary
#dce3ec -> $border-color
#d9e1ec -> $border-soft
#b8c7d8 -> $brand-border
#eef2f7 -> $surface-muted
#f8fafc -> $surface-hover
#eaf4fb -> $brand-primary-soft
#6ea4c8 -> $brand-border-strong
#eef4fa -> $brand-primary-soft
#eef6fb -> $brand-primary-soft
#d7e6f3 -> $brand-primary-soft-strong
#9f2a2a -> $danger
#9a2f2f -> $danger
#fdecec -> $danger-soft
#fff7f7 -> $danger-soft
#f2c3c3 -> $danger-border
#f0c9c9 -> $danger-border
#16643f -> $brand-success-deep
#e9f7ef -> $brand-success-soft
#e8f7f1 -> $brand-success-soft
#bfe6cf -> $brand-success-border
#7a4b08 -> $warning
#fff5df -> $warning-soft
#fffaf0 -> $warning-soft
#efd49c -> $warning-border
```

- [ ] **Step 2: Add soft shadow to card-like shared components**

Add `box-shadow: $surface-shadow;` to:

- `.material-card`
- `.candidate-card`
- `.question-card`

- [ ] **Step 3: Run theme test**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/designTheme.spec.ts
```

Expected: still FAIL if pages have old literals.

### Task 4: Page Tokenization

**Files:**
- Modify: all `pages/**/*.vue`

- [ ] **Step 1: Replace old color literals in page style blocks**

Apply the same token mapping from Task 3 to `pages/**/*.vue`.

- [ ] **Step 2: Add soft shadow to primary page card containers**

Add `box-shadow: $surface-shadow;` to card-like page containers that already have white background and border:

- `.summary`, `.stats`, `.notice` in `pages/material/detail.vue`
- `.section` in `pages/upload/index.vue`
- `.summary`, `.section` in `pages/practice/setup.vue`
- `.result-card` in `pages/practice/result.vue`
- `.stat` in `pages/profile/index.vue`
- `.wrong-item` in `pages/wrong/index.vue`

- [ ] **Step 3: Keep bottom bars calm**

Bottom action bars should use:

```scss
border-top: 1rpx solid $border-color;
background: $surface;
```

- [ ] **Step 4: Run theme test**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/designTheme.spec.ts
```

Expected: PASS.

### Task 5: Verification

**Files:**
- No new production files.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
node scripts/run-bun.mjs test tests/frontend/designTheme.spec.ts tests/frontend/pages.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
node scripts/run-bun.mjs test
```

Expected: PASS.

- [ ] **Step 3: Run mini-program build**

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

Expected: UI refresh files are modified; existing untracked generated PDF/temp files remain unrelated.

## Self-Review

- Spec coverage: Implements selected scheme A, preserves business logic, covers shared components and core pages.
- Placeholder scan: No placeholders remain.
- Type consistency: No TypeScript API shape changes are introduced by this plan.
