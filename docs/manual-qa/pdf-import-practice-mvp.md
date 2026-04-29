# PDF Import Practice MVP Manual QA

> Historical note: this checklist was written for the original WeChat CloudBase MVP. It is superseded on `feature/unicloud-alipay-migration`; do not use it as current verification for this branch. Current manual verification should target `uniCloud-alipay` in HBuilderX with an Alipay cloud service space. A dedicated `docs/manual-qa/unicloud-alipay.md` checklist is planned for the migration.

## Environment

- Project path: this historical checklist used an older MVP worktree. For the current branch, use `G:\HBuilderProjects\ShuaTi\.worktrees\unicloud-alipay-migration`.
- Bun path: `F:\.bun\bin\bun.exe`
- Historical WeChat mini program target: `mp-weixin`
- Current migration target: HBuilderX-associated `uniCloud-alipay` Alipay cloud service space.
- Legacy CloudBase / WeChat Developer Tools deployment steps below no longer apply to the current branch.

## Cloud Collections

Create these CloudBase collections before running manual QA:

- `users`
- `materials`
- `parse_jobs`
- `material_pages`
- `parse_candidates`
- `questions`
- `practice_sessions`
- `attempts`

All collections should deny public writes. Client writes must go through cloud functions only, so validation, ownership checks, duplicate detection, and status transitions stay server-side.

## Cloud Functions

Historical MVP functions were uploaded to WeChat CloudBase:

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

These legacy CloudBase deployment instructions no longer apply on `feature/unicloud-alipay-migration`. The root `cloudfunctions/` directory has been removed. Current backend code lives under `uniCloud-alipay/cloudfunctions`, and shared helpers live under `uniCloud-alipay/cloudfunctions/common/shuati-shared`. Do not expect WeChat CloudBase root-function build output when verifying the migrated branch.

## Test PDF Content

Copy the following content into a text document, export or print it as a PDF, and use that PDF for import testing:

```text
1. 单选题：下列哪一项是中华人民共和国的首都？
A. 上海
B. 北京
C. 广州
D. 深圳
答案：B
解析：北京是中华人民共和国的首都。

2. 多选题：下列哪些属于中国的直辖市？
A. 北京
B. 天津
C. 杭州
D. 重庆
答案：A、B、D
解析：北京、天津、重庆是直辖市，杭州是浙江省省会。

3. 单选题：计算 15 + 27 的结果是？
A. 32
B. 40
C. 42
D. 52
答案：C
解析：15 + 27 = 42。
```

## QA Steps

1. Run `F:\.bun\bin\bun.exe run build:mp-weixin`.
2. Historical CloudBase-only step: open the old `mp-weixin` build in WeChat Developer Tools and upload root cloud functions. This step is superseded for the current branch; verify the migrated backend from HBuilderX by associating `uniCloud-alipay` with the Alipay cloud service space and deploying the functions under `uniCloud-alipay/cloudfunctions`.
3. Launch the home page and confirm `userLogin` runs successfully. The app should create or load the current user without a visible login error.
4. Upload the test PDF created from the content above.
5. Confirm the created material appears with status `parsing`. The normal upload flow automatically calls `parseRunner` after `parseStart`; manually invoking `parseRunner` from the CloudBase console should only be needed for troubleshooting a stuck parse job. If troubleshooting, get the parse job `_id` from `parseStatus` / the `parse_jobs` collection and pass `{ "jobId": "..." }`.
6. Wait for parsing to finish and confirm the material enters `reviewing`.
7. Open the candidate review flow. The sample PDF should produce 3 ready candidates.
8. Open a candidate detail, edit fields such as stem / 题干, options, answer, or explanation, and save.
9. Confirm import from the reviewed candidates. The expected `importedCount` is `3`.
10. Call the same material's `importConfirm` cloud function / API again. The expected `importedCount` is `0`, or the UI import button is disabled / shows no importable questions. This verifies idempotency for the same reviewed candidate batch; it does not verify cross-material or same-content PDF deduplication.
11. Start a practice session from the imported material. Before submitting an answer, confirm the correct answer and explanation are not shown.
12. Submit a correct answer and confirm the result state marks it correct.
13. Submit an incorrect answer in another practice attempt and confirm the answer page shows the explanation after submit, then the result page shows the score.

## Troubleshooting / Expected Warnings

- The local build may print a Node circular dependency warning. This is expected for the current build and should not block QA unless it becomes a hard error.
- The local build may print a Sass legacy API warning. This is expected for the current dependency stack and should not block QA unless it becomes a hard error.
- The mini program should not report `practice page not found`. If that appears, treat it as a blocking routing or page registration issue.

## Automated Verification

Run these commands locally before manual QA:

```powershell
F:\.bun\bin\bun.exe test
F:\.bun\bin\bun.exe run build:mp-weixin
```

Optional fallback build command:

```powershell
cmd /c npm run build:mp-weixin
```
