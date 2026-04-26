# PDF Import Practice MVP Manual QA

## Environment

- Project path: `G:\HBuilderProjects\ShuaTi\.worktrees\pdf-import-practice-mvp`
- Bun path: `F:\.bun\bin\bun.exe`
- WeChat mini program target: `mp-weixin`
- CloudBase environment: use the project CloudBase environment configured in WeChat Developer Tools / uniCloud before testing. Confirm the same environment is selected for cloud function upload, database collection creation, and runtime calls.

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

Upload and deploy these cloud functions to the selected CloudBase environment:

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

Copy the following content into a text document, export or print it as a PDF, and use that PDF for import testing:

```text
刷题导入测试题

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

1. Open the project in WeChat Developer Tools from `G:\HBuilderProjects\ShuaTi\.worktrees\pdf-import-practice-mvp`, select the correct CloudBase environment, then compile the `mp-weixin` mini program.
2. Launch the home page and confirm `userLogin` runs successfully. The app should create or load the current user without a visible login error.
3. Upload the test PDF created from the content above.
4. Confirm the created material appears with status `parsing`.
5. Trigger `parseRunner` with the parse job id for the material. If the current UI does not directly trigger the runner, call it from the CloudBase console or by a temporary cloud function invocation, passing the parse job id.
6. Wait for parsing to finish and confirm the material enters `reviewing`.
7. Open the candidate review flow. Verify candidates are listed, open a candidate detail, edit fields such as title, options, answer, or explanation, and save.
8. Confirm import from the reviewed candidates.
9. Start a practice session from the imported material. Before submitting an answer, confirm the correct answer and explanation are not shown.
10. Submit a correct answer and confirm the result state marks it correct.
11. Submit an incorrect answer in another practice attempt and confirm the result page shows the score and explanation.
12. Import the same reviewed candidates again or repeat the same PDF import flow. Confirm duplicate questions are not added.

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
