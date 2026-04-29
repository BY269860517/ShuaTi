# uniCloud Alipay Manual Verification

Use this checklist for the `feature/unicloud-alipay-migration` branch after the local build and automated tests pass. Do not commit local cloud secrets or HBuilderX-generated environment files.

## Local Config

Create this ignored local file before uploading cloud functions:

```text
uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json
```

Use this committed reference example as the shape:

```text
uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.example.json
```

Fill the local `config.json` with ShuaTi-specific values for:

- `passwordSecret`
- `tokenSecret`
- `mp-weixin.oauth.weixin.appid`
- `mp-weixin.oauth.weixin.appsecret`

Do not paste real secrets into this document, screenshots, commits, or issue comments. The committed example intentionally keeps secret fields blank.

## HBuilderX Deployment

1. Open the ShuaTi project in HBuilderX.
2. Right-click `uniCloud-alipay`.
3. Associate `uniCloud-alipay` with the target Alipay cloud service space.
4. Upload cloud function common module `common/shuati-shared`.
5. Upload cloud function common module `common/uni-config-center`.
6. Upload every business cloud function under `uniCloud-alipay/cloudfunctions`:
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
7. Initialize or synchronize all database schemas under `uniCloud-alipay/database`.
8. Confirm the cloud space has the business collections and the `uni-id-users` index initialized before running the mini program.

## WeChat DevTools Verification

1. Run the WeChat mini-program build:

```powershell
F:\.bun\bin\bun.exe run build:mp-weixin
```

2. Open this build output in WeChat DevTools:

```text
G:\HBuilderProjects\ShuaTi\dist\build\mp-weixin
```

If you are verifying from the migration worktree directly, use the equivalent worktree output:

```text
G:\HBuilderProjects\ShuaTi\.worktrees\unicloud-alipay-migration\dist\build\mp-weixin
```

3. Confirm the DevTools console does not show the legacy error:

```text
cloud.callFunction:fail resource is not found
```

4. Upload a PDF from the upload page.
5. Confirm a material record is created and appears in the material list.
6. Confirm parsing starts and completes for the uploaded material.
7. Open candidate review and confirm parsed candidates can be reviewed.
8. Mark or edit candidates until they are ready.
9. Import ready candidates and confirm questions are created.
10. Start a practice session from the imported material.
11. Submit at least one answer.
12. Confirm the answer result and final practice result display correctly.

## Build Output Check

The WeChat mini-program build output should not contain the old root WeChat CloudBase `cloudfunctions` directory. The migrated backend lives under `uniCloud-alipay` and must be deployed from HBuilderX.

Run this from the project root after `build:mp-weixin`:

```powershell
Test-Path dist\build\mp-weixin\cloudfunctions
```

Expected result:

```text
False
```

## Automated Verification

Run these commands before manual HBuilderX and DevTools verification:

```powershell
F:\.bun\bin\bun.exe test
F:\.bun\bin\bun.exe run build:mp-weixin
Test-Path dist\build\mp-weixin\cloudfunctions
rg "wx-server-sdk|wx\.cloud|cloud\.getWXContext|DYNAMIC_CURRENT_ENV" -n App.vue common pages scripts tests uniCloud-alipay
```

Expected results:

- Tests pass.
- Build succeeds.
- `Test-Path dist\build\mp-weixin\cloudfunctions` returns `False`.
- The `rg` scan returns no matches.
