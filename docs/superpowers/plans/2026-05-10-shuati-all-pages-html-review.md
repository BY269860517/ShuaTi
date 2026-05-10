# ShuaTi All Pages HTML Review Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate static HTML review drafts for all existing mini-program pages under the selected "清爽学习工具型 (A)" visual direction, without changing current business logic.

**Architecture:** Build a documentation-only review pack in `docs/design/review-a/` with one shared stylesheet and one HTML file per page route. Each page mirrors current UI structure and key states so product/design can approve visuals before any further implementation changes.

**Tech Stack:** HTML5, CSS3, documentation assets in repo (`docs/design`).

---

### Task 1: Page Inventory and Structure Lock

**Files:**
- Modify: `pages.json`
- Modify: `pages/index/index.vue`
- Modify: `pages/upload/index.vue`
- Modify: `pages/material/detail.vue`
- Modify: `pages/import/review.vue`
- Modify: `pages/import/edit.vue`
- Modify: `pages/practice/setup.vue`
- Modify: `pages/practice/do.vue`
- Modify: `pages/practice/result.vue`
- Modify: `pages/profile/index.vue`
- Modify: `pages/wrong/index.vue`

- [ ] **Step 1: Extract current page routes and major sections**
- [ ] **Step 2: Freeze review scope as 10 pages (exactly matching `pages.json`)**
- [ ] **Step 3: Capture key states/components to represent in static review drafts**

### Task 2: Shared Design System for Review Drafts

**Files:**
- Create: `docs/design/review-a/styles.css`

- [ ] **Step 1: Define Scheme A tokens (brand, text, border, background, status)**
- [ ] **Step 2: Define reusable mobile frame and card patterns**
- [ ] **Step 3: Define common controls (buttons, chips, stats, badges, progress)**

### Task 3: Generate All Page HTML Drafts

**Files:**
- Create: `docs/design/review-a/home.html`
- Create: `docs/design/review-a/profile.html`
- Create: `docs/design/review-a/wrong.html`
- Create: `docs/design/review-a/upload.html`
- Create: `docs/design/review-a/material-detail.html`
- Create: `docs/design/review-a/import-review.html`
- Create: `docs/design/review-a/import-edit.html`
- Create: `docs/design/review-a/practice-setup.html`
- Create: `docs/design/review-a/practice-do.html`
- Create: `docs/design/review-a/practice-result.html`

- [ ] **Step 1: Implement static layout for each page with current interaction entry points**
- [ ] **Step 2: Keep all copy/labels aligned with current product intent**
- [ ] **Step 3: Keep content mock data realistic for QA/product review**

### Task 4: Review Entry and Quick Verification

**Files:**
- Create: `docs/design/review-a/index.html`

- [ ] **Step 1: Add a review hub page linking all page drafts**
- [ ] **Step 2: Verify all links and desktop/mobile layout readability**
- [ ] **Step 3: Confirm no runtime/business-logic source files were edited**

