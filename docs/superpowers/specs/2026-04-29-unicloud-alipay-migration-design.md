# ShuaTi uniCloud Alipay Migration Design

Date: 2026-04-29
Status: Design approved; implementation plan pending
Project: `G:\HBuilderProjects\ShuaTi`
Reference project: `G:\HBuilderProjects\PapaWorkshopGenerated`

## 1. Goal

Move ShuaTi's backend from WeChat Cloud Development to DCloud `uniCloud-alipay`, so HBuilderX can associate the project with an Alipay cloud service space and manage cloud functions directly.

The user-facing product stays the same:

- Upload a PDF.
- Parse questions from the PDF.
- Review and fix parsed candidates.
- Confirm import into the question bank.
- Create practice sessions and answer questions.

This migration is a backend platform change, not a product redesign.

## 2. Confirmed Decisions

- Use `uniCloud-alipay` as the cloud directory.
- Keep the frontend target as WeChat mini program through uni-app.
- Keep page routes, UI flow, API method names, and business behavior unchanged.
- Replace WeChat cloud calls with `uniCloud.callFunction`.
- Replace `wx.cloud.uploadFile` with `uniCloud.uploadFile`.
- Keep the existing ordinary cloud function shape instead of converting to cloud objects in this phase.
- Use `uni-id` for login and trusted user identity.
- Use `uni-id uid` as the server-side owner identity.
- Preserve compatibility aliases in the first migration: existing `ownerOpenid` and returned `user.openid` may still exist, but their value will be the `uni-id uid`.
- Do not copy real secrets from `PapaWorkshopGenerated`. ShuaTi must use its own `uni-id` configuration.

## 3. Non-Goals

- No UI redesign.
- No new product features.
- No OCR, AI parsing, wrong-question book, analytics dashboard, admin panel, payment, or social sharing.
- No migration of historical WeChat Cloud data in this phase.
- No conversion to `uniCloud.importObject` cloud objects in this phase.
- No direct reuse of PapaWorkshopGenerated secrets or service-space credentials.

## 4. Architecture

### Frontend Boundary

The page layer continues to use the existing `api` object from `common/api/cloud.ts`.

`common/api/cloud.ts` becomes the backend adapter:

- `callFunction(name, data)` calls `uniCloud.callFunction({ name, data })`.
- `api.userLogin()` internally performs WeChat mini-program login through `uni.login({ provider: 'weixin' })`, sends the code to `userLogin`, stores the returned `uni_id_token`, and returns the same logical user shape to existing pages.
- Subsequent API calls attach the stored token as `_uniToken` and `uniToken` in the event payload so cloud functions can verify the user.

`pages/upload/index.vue` keeps the current upload workflow, but replaces storage upload with `uniCloud.uploadFile`.

`App.vue` no longer initializes `wx.cloud`.

### Cloud Directory

The new backend lives under:

```text
uniCloud-alipay/
  cloudfunctions/
    common/
      shuati-shared/
        auth.js
        response.js
        parser/
        services/
        package.json
    userLogin/
      index.js
    materialCreate/
      index.js
    materialList/
      index.js
    materialDetail/
      index.js
    parseStart/
      index.js
    parseRunner/
      index.js
    parseStatus/
      index.js
    candidateList/
      index.js
    candidateDetail/
      index.js
    candidateUpdate/
      index.js
    importConfirm/
      index.js
    questionList/
      index.js
    practiceCreate/
      index.js
    practiceDetail/
      index.js
    answerSubmit/
      index.js
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

The ordinary cloud function names stay the same to minimize frontend changes and make HBuilderX upload/association straightforward.

### Shared Cloud Module

The current `cloudfunctions/common` logic moves into `uniCloud-alipay/cloudfunctions/common/shuati-shared`.

The shared module owns:

- Response helpers: `ok`, `fail`, `toErrorResponse`, `assertRequired`.
- Auth helpers: token extraction, token verification, `requireUid`.
- Parser helpers.
- Material, parse, candidate, import, practice, and user services.

Services should remain platform-neutral where possible. Function entry files should handle platform-specific setup such as `uniCloud.database()` and `uniCloud.downloadFile`.

## 5. Identity Design

Current WeChat Cloud code trusts `cloud.getWXContext().OPENID`. That is not available after moving to `uniCloud-alipay`.

The migration uses `uni-id`:

1. `api.userLogin()` calls `uni.login({ provider: 'weixin' })` on the client.
2. `userLogin` receives the WeChat login code.
3. `userLogin` calls `uniID.loginByWeixin({ code })`.
4. `uni-id` returns a stable `uid` and token.
5. The client stores `uni_id_token` and `uni_id_token_expired`.
6. Each business cloud function verifies the token and resolves `uid`.
7. Existing ownership checks use the resolved `uid`.

For minimal migration risk, first-phase data can keep the `ownerOpenid` field name while storing `uid` as its value. A later cleanup can rename this field to `ownerUid` after the cloud migration is stable.

## 6. Storage Design

PDF upload remains client-direct-to-cloud-storage.

Current:

```text
wx.cloud.uploadFile -> cloud://... -> materialCreate -> parseRunner downloads PDF
```

Target:

```text
uniCloud.uploadFile -> cloud://... -> materialCreate -> parseRunner downloads PDF
```

Upload path format:

```text
materials/{uid}/{timestamp}-{sanitizedFileName}
```

`materialCreate` must validate that the submitted `fileID` belongs to the current user path before creating the material record.

`parseRunner` downloads the PDF with `uniCloud.downloadFile({ fileID })`, passes `fileContent` to `pdf-parse`, and keeps the existing parser behavior.

## 7. Database Design

The logical collections stay the same:

- `users`
- `materials`
- `parse_jobs`
- `material_pages`
- `parse_candidates`
- `questions`
- `practice_sessions`
- `attempts`

The implementation adds `uniCloud-alipay/database/*.schema.json` files so HBuilderX can initialize and synchronize collections.

Schema permissions should default to conservative server-side access. The frontend should not directly read or write these collections through clientDB in this phase; all access goes through cloud functions.

## 8. Data Flow

### Login

1. Page calls `api.userLogin()`.
2. API adapter gets a WeChat login code.
3. `userLogin` exchanges the code for `uni-id uid/token`.
4. The backend creates or updates the `users` record.
5. Frontend stores token and receives `{ user }`.

### Upload

1. User chooses a PDF from WeChat chat files.
2. Frontend uploads it through `uniCloud.uploadFile`.
3. Frontend calls `materialCreate`.
4. Backend verifies token, checks file path ownership, and creates the material.
5. Frontend calls `parseStart` and then `parseRunner`.

### Parse

1. `parseStart` creates or resets a parse job.
2. `parseRunner` claims the job lock.
3. `parseRunner` downloads the PDF from uniCloud storage.
4. Existing parser extracts candidates.
5. Backend writes material pages, parse candidates, job status, and material stats.

### Review and Import

Candidate list/detail/update and import confirm keep the current behavior. All ownership checks use the resolved `uid`.

### Practice

Practice creation, question retrieval, answer submission, scoring, and attempt recording keep the current behavior. Answer keys remain hidden from `practiceDetail`.

## 9. Error Handling

The response envelope remains:

```js
{ ok: true, data }
{ ok: false, error: { code, message } }
```

Expected error codes include:

- `unauthorized`: missing or invalid login token.
- `missing_file_id`: upload metadata is incomplete.
- `invalid_file_owner`: submitted file path does not belong to the current user.
- `material_not_found`: material is missing or not owned by the current user.
- `parse_job_not_found`: parse job is missing or not owned by the current user.
- `internal_error`: unexpected backend failure.

The frontend adapter keeps converting failed envelopes into thrown errors, so pages can keep existing error handling.

## 10. Compatibility Notes

- HBuilderX recognizes uniCloud functions under `uniCloud-alipay/cloudfunctions`.
- DCloud ordinary cloud functions use `index.js`; cloud objects use `index.obj.js`. This migration uses ordinary cloud functions.
- DCloud docs state that `uniCloud.callFunction` returns the cloud function return value in `result`.
- DCloud docs state that `uniCloud.uploadFile` returns `fileID`.
- DCloud docs state that `uniCloud.downloadFile` is supported by Tencent Cloud and Alipay Cloud cloud functions, returning `fileContent` when `tempFilePath` is not provided.

References:

- https://doc.dcloud.net.cn/uniCloud/cf-functions.html
- https://doc.dcloud.net.cn/uniCloud/cf-callfunction.html
- https://doc.dcloud.net.cn/uniCloud/storage/dev.html
- https://doc.dcloud.net.cn/uniCloud/wx2unicloud.html

## 11. Verification Plan

Local verification:

```powershell
F:\.bun\bin\bun.exe test
F:\.bun\bin\bun.exe run build:mp-weixin
```

HBuilderX verification:

1. Open `G:\HBuilderProjects\ShuaTi`.
2. Associate `uniCloud-alipay` with the Alipay cloud service space.
3. Upload `common/shuati-shared`.
4. Upload all business cloud functions.
5. Initialize or synchronize database schemas.
6. Build or run the WeChat mini program.
7. Open `dist/build/mp-weixin` in WeChat DevTools.
8. Test login, PDF upload, parsing, review, import, practice creation, answering, and result display.

Manual success criteria:

- HBuilderX shows `uniCloud-alipay` as associated with the service space.
- No code path calls `wx.cloud.callFunction`.
- No code path calls `wx.cloud.uploadFile`.
- Upload returns a uniCloud `fileID`.
- `materialCreate` stores the material for the logged-in `uid`.
- `parseRunner` extracts text from the uploaded PDF.
- Imported questions can be practiced without exposing answer keys before submission.

## 12. Risks and Mitigations

- Risk: `uni-id` configuration is missing or uses copied secrets.
  - Mitigation: create ShuaTi-specific config and avoid committing real service secrets.
- Risk: Token is not automatically available in ordinary cloud functions.
  - Mitigation: explicitly attach `_uniToken` and verify it in shared auth helpers.
- Risk: Existing tests assume WeChat Cloud database write syntax.
  - Mitigation: update tests alongside service adapters to cover uniCloud add/update behavior.
- Risk: Alipay cloud storage path rules differ from WeChat Cloud.
  - Mitigation: sanitize filenames and validate the `materials/{uid}/...` path.
- Risk: Cloud function dependency size exceeds limits.
  - Mitigation: keep `pdf-parse` only where needed and use shared modules for common code.

## 13. Out of Scope Follow-Up

After the migration is stable, a later cleanup can:

- Rename `ownerOpenid` to `ownerUid`.
- Convert related functions into one or more cloud objects if that improves maintainability.
- Add historical data migration from WeChat Cloud exports.
- Add a proper login/profile page if the product requires visible account management.

## 14. Self-Review

- No implementation code is included in this document.
- Scope is limited to backend cloud platform migration.
- Identity source is explicit: `uni-id uid`.
- The compatibility alias decision is explicit and temporary.
- Secrets from the reference project are not copied or documented.
- Verification covers unit tests, build, HBuilderX association, and manual product flow.
