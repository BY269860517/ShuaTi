import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('pdf import frontend pages', () => {
  test('declares required routes in pages.json', () => {
    const pagesJson = JSON.parse(read('pages.json')) as { pages: Array<{ path: string }> }
    const paths = pagesJson.pages.map((page) => page.path)

    expect(paths).toContain('pages/index/index')
    expect(paths).toContain('pages/upload/index')
    expect(paths).toContain('pages/profile/index')
    expect(paths).toContain('pages/wrong/index')
    expect(paths).toContain('pages/material/detail')
    expect(paths).toContain('pages/import/review')
    expect(paths).toContain('pages/import/edit')
    expect(paths).toContain('pages/practice/setup')
    expect(paths).toContain('pages/practice/do')
    expect(paths).toContain('pages/practice/result')
  })

  test('practice route page files exist', () => {
    expect(existsSync('pages/practice/setup.vue')).toBe(true)
    expect(existsSync('pages/practice/do.vue')).toBe(true)
    expect(existsSync('pages/practice/result.vue')).toBe(true)
  })

  test('profile and wrong-question pages exist', () => {
    expect(existsSync('pages/profile/index.vue')).toBe(true)
    expect(existsSync('pages/wrong/index.vue')).toBe(true)
  })

  test('home page logs in, loads materials, and navigates to upload/detail', () => {
    const source = read('pages/index/index.vue')

    expect(source).toContain('api.userLogin()')
    expect(source).toContain('api.materialList()')
    expect(source).toContain('MaterialCard')
    expect(source).toContain('EmptyState')
    expect(source).toContain('/pages/upload/index')
    expect(source).toContain('/pages/material/detail?materialId=')
  })

  test('home page links to profile page', () => {
    const source = read('pages/index/index.vue')

    expect(source).toContain('/pages/profile/index')
    expect(source).toContain('@click="goProfile"')
    expect(source).toContain('toolbar__secondary-button')
    expect(source).toContain('我的')
  })

  test('home material cards expose a safe delete interaction', () => {
    const cardSource = read('components/MaterialCard.vue')
    const homeSource = read('pages/index/index.vue')
    const loadMaterialsStart = homeSource.indexOf('async function loadMaterials')
    const loadMaterialsEnd = homeSource.indexOf('function deleteConfirmText')
    const loadMaterialsSource = homeSource.slice(loadMaterialsStart, loadMaterialsEnd)
    const deleteHandlerStart = homeSource.indexOf('async function confirmDeleteMaterial')
    const deleteHandlerEnd = homeSource.indexOf('function goUpload')
    const deleteHandlerSource = homeSource.slice(deleteHandlerStart, deleteHandlerEnd)
    const deleteGuardIndex = deleteHandlerSource.indexOf('if (!material || deletedId.value) return')
    const deletingSetIndex = deleteHandlerSource.indexOf('deletedId.value = material._id')
    const confirmIndex = deleteHandlerSource.indexOf('const confirmed = await showDeleteConfirm(material)')

    expect(cardSource).toContain('deleting?: boolean')
    expect(cardSource).toContain('delete: [id: string]')
    expect(cardSource).toContain('@click.stop')
    expect(cardSource).toContain("emit('delete', props.material._id)")
    expect(cardSource).toContain('删除')
    expect(cardSource).toContain('删除中')
    expect(homeSource).toContain('@delete="confirmDeleteMaterial"')
    expect(homeSource).toContain('api.materialDelete(material._id)')
    expect(homeSource).toContain('showDeleteConfirm')
    expect(homeSource).toContain('deletedId')
    expect(homeSource).toContain('materials.value = materials.value.filter')
    expect(homeSource).toContain('const deleteErrorMessage = ref')
    expect(homeSource).toContain("deleteErrorMessage.value = ''")
    expect(homeSource).toContain('deleteErrorMessage.value = error instanceof Error')
    expect(homeSource).toContain("uni.showToast({ title: deleteErrorMessage.value, icon: 'none' })")
    expect(homeSource).toContain('v-if="deleteErrorMessage"')
    expect(homeSource).toContain('material-list__delete-error')
    expect(loadMaterialsSource.match(/deleteErrorMessage\.value = ''/g)?.length).toBe(2)
    expect(deleteGuardIndex).toBeGreaterThan(-1)
    expect(deletingSetIndex).toBeGreaterThan(deleteGuardIndex)
    expect(confirmIndex).toBeGreaterThan(deletingSetIndex)
    expect(deleteHandlerSource).toContain('if (!confirmed) {')
    expect(deleteHandlerSource).not.toContain('errorMessage.value')
    expect(homeSource).toContain('已生成的题目、历史练习和错题记录会保留')
    expect(homeSource).toContain('可能仍在后台解析')
  })

  test('profile page loads user, materials, wrong questions, and links to wrong book', () => {
    const source = read('pages/profile/index.vue')

    expect(source).toContain('onLoad(loadProfile)')
    expect(source).toContain('api.userLogin()')
    expect(source).toContain('api.materialList()')
    expect(source).toContain("api.wrongList({ status: 'active' })")
    expect(source).toContain('materialCount')
    expect(source).toContain('activeWrongCount')
    expect(source).toContain("uni.reLaunch({ url: '/pages/index/index' })")
    expect(source).toContain("uni.navigateTo({ url: '/pages/wrong/index' })")
    expect(source).toContain('/pages/wrong/index')
    expect(source).toContain('我的')
    expect(source).toContain('资料')
    expect(source).toContain('当前错题')
    expect(source).toContain('查看错题')
    expect(source).toContain('返回资料')
    expect(source).toContain('LoadingState')
    expect(source).toContain('ErrorState')
  })

  test('wrong page lists active wrong questions and starts wrong practice', () => {
    const source = read('pages/wrong/index.vue')
    const normalizedWrongSource = source.replaceAll('item.', 'wrong.')
    const markIndex = source.indexOf('api.wrongMarkMastered')
    const reloadAfterMarkIndex = source.indexOf('await loadWrongQuestions()', markIndex)

    expect(source).toContain("materialId.value = String(options?.materialId || '')")
    expect(source).toContain("api.wrongList({ status: 'active'")
    expect(source).toContain('materialId: materialId.value || undefined')
    expect(source).toContain('api.wrongPracticeCreate')
    expect(source).toContain('/pages/practice/do?sessionId=')
    expect(source).toContain('Math.min(10, wrongQuestions.value.length)')
    expect(source).toContain('uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })')
    expect(source).toContain('api.wrongMarkMastered')
    expect(source).toContain('暂无错题')
    expect(source).toContain('答错的题会自动进入这里。')
    expect(normalizedWrongSource).toContain('wrong.question.stem')
    expect(normalizedWrongSource).toContain('wrong.question.type')
    expect(normalizedWrongSource).toContain('wrong.wrongCount')
    expect(normalizedWrongSource).toContain('wrong.correctStreak')
    expect(normalizedWrongSource).toContain('wrong.lastWrongAt')
    expect(source).toContain('练习错题')
    expect(source).toContain('LoadingState')
    expect(source).toContain('ErrorState')
    expect(source).toContain('EmptyState')
    expect(markIndex).toBeGreaterThan(-1)
    expect(reloadAfterMarkIndex).toBeGreaterThan(markIndex)
  })

  test('cloud api uses uni-app runtime identifiers so mini-program builds bind them', () => {
    const source = read('common/api/cloud.ts')

    expect(source).toContain("typeof uni !== 'undefined'")
    expect(source).toContain("typeof uniCloud !== 'undefined'")
    expect(source).not.toContain('const runtime = (globalThis as { uni?: UniRuntime }).uni')
    expect(source).not.toContain('const runtime = (globalThis as { uniCloud?: UniCloudRuntime }).uniCloud')
  })

  test('upload page chooses a pdf, uploads to cloud storage, and starts parsing', () => {
    const source = read('pages/upload/index.vue')

    expect(source).toContain('chooseMessageFile')
    expect(source).toContain("extension: ['pdf']")
    expect(source).toContain('uniCloud.uploadFile')
    expect(source).not.toContain(['wx', 'cloud', 'uploadFile'].join('.'))
    expect(source).toContain('api.userLogin()')
    expect(source).toContain('materials/${loginResult.user.openid}/${Date.now()}-${sanitizeCloudFileName(file.name)}')
    expect(source).toContain('api.materialCreate')
    expect(source).toContain('const parseResult = await api.parseStart(material._id)')
    expect(source).toContain('await api.parseRunner(parseResult.job._id)')
    expect(source).toContain("parseMode = ref<ParseMode>('inline_answer')")
    expect(source).toContain('answer_at_end')
  })

  test('upload page wraps callback-only file chooser and sanitizes cloud path filenames', () => {
    const source = read('pages/upload/index.vue')

    expect(source).toContain('function chooseMessageFile()')
    expect(source).toContain('return new Promise')
    expect(source).toContain('success: resolve')
    expect(source).toContain('fail: reject')
    expect(source).toContain('const result = await chooseMessageFile()')
    expect(source).not.toContain('await wx.chooseMessageFile')
    expect(source).toContain('sanitizeCloudFileName')
    expect(source).toContain('replace(')
    expect(source).toContain('?%#')
  })

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
    expect(choosePdfSource).toContain('const validationError = validateSelectedFile(chosenFile)')
    expect(choosePdfSource).toContain('selectedFile.value = null')
    expect(choosePdfSource).toContain('errorMessage.value = validationError')
    expect(validationIndex).toBeGreaterThan(-1)
    expect(uploadingIndex).toBeGreaterThan(validationIndex)
  })

  test('package scripts invoke uni through a cross-platform node wrapper', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const wrapperSource = read('scripts/uni-cli.mjs')
    const bunWrapperSource = read('scripts/run-bun.mjs')

    expect(existsSync('scripts/uni-cli.mjs')).toBe(true)
    expect(existsSync('scripts/run-bun.mjs')).toBe(true)
    expect(packageJson.scripts['dev:mp-weixin']).toBe('node scripts/uni-cli.mjs -p mp-weixin')
    expect(packageJson.scripts['build:mp-weixin']).toBe('node scripts/uni-cli.mjs build -p mp-weixin')
    expect(packageJson.scripts.test).toBe('node scripts/run-bun.mjs test')
    expect(packageJson.scripts['test:cloud']).toBe('node scripts/run-bun.mjs test tests/cloud')
    expect(wrapperSource).toContain("process.env.UNI_INPUT_DIR || '.'")
    expect(wrapperSource).toContain('@dcloudio')
    expect(wrapperSource).toContain('vite-plugin-uni')
    expect(wrapperSource).toContain('spawn')
    expect(wrapperSource).toContain('runUniCli(args)')
    expect(bunWrapperSource).toContain("F:\\\\.bun\\\\bin\\\\bun.exe")
    expect(bunWrapperSource).toContain('BUN_EXE')
    expect(wrapperSource).not.toContain('syncCloudfunctionsOutput')
    expect(wrapperSource).not.toContain('copyCloudfunctions')
    expect(wrapperSource).not.toContain('vendorCommonIntoFunctionPackages')
    expect(wrapperSource).not.toContain('cloudfunctionRoot')
  })

  test('material detail page loads detail, polls parse status, and links review/practice', () => {
    const source = read('pages/material/detail.vue')

    expect(source).toContain('api.materialDetail(materialId.value)')
    expect(source).toContain('api.parseStatus(materialId.value)')
    expect(source).toContain('triggerParseRunnerIfNeeded()')
    expect(source).toContain('api.parseRunner(currentJob._id)')
    expect(source).toContain("item.status === 'ready' && item.questionCount > 0")
    expect(source).not.toContain("item.status === 'ready' || item.questionCount > 0")
    expect(source).toContain('setInterval')
    expect(source).toContain('3000')
    expect(source).toContain('clearPolling()')
    expect(source).toContain('/pages/import/review?materialId=')
    expect(source).toContain('/pages/practice/setup?materialId=')
  })

  test('material detail links to material wrong questions', () => {
    const source = read('pages/material/detail.vue')
    const wrongButtonIndex = source.indexOf('@click="goMaterialWrong"')
    const wrongButtonSource = source.slice(Math.max(0, wrongButtonIndex - 160), wrongButtonIndex + 160)

    expect(source).toContain('/pages/wrong/index?materialId=')
    expect(source).toContain('@click="goMaterialWrong"')
    expect(wrongButtonIndex).toBeGreaterThan(-1)
    expect(wrongButtonSource).toContain('v-if="canPractice"')
    expect(source).toContain('错题')
  })

  test('material detail polling is active-page aware and blocks overlapping status refreshes', () => {
    const source = read('pages/material/detail.vue')

    expect(source).toContain('const pageActive = ref(false)')
    expect(source).toContain('let statusRefreshInFlight = false')
    expect(source).toContain('const runnerTriggeredJobIds = new Set<string>()')
    expect(source).toContain('pageActive.value = true')
    expect(source).toContain('pageActive.value = false')
    expect(source).toContain('if (!materialId.value || !pageActive.value || statusRefreshInFlight) return')
    expect(source).toContain('runnerTriggeredJobIds.has(currentJob._id)')
    expect(source).toContain('if (!pageActive.value) return')
  })

  test('candidate review page groups candidates and confirms import', () => {
    const source = read('pages/import/review.vue')

    expect(source).toContain('api.candidateList(materialId.value)')
    expect(source).toContain('StatusBadge')
    expect(source).toContain('CandidateCard')
    expect(source).toContain('/pages/import/edit?candidateId=')
    expect(source).toContain('api.importConfirm(materialId.value)')
    expect(source).toContain('safe-area-inset-bottom')
  })

  test('candidate review import count matches backend import eligibility', () => {
    const source = read('pages/import/review.vue')

    expect(source).toContain("candidate.status === 'ready' && !candidate.importedQuestionId")
    expect(source).toContain('importableCount === 0')
    expect(source).not.toContain("candidate.status !== 'imported'")
  })

  test('candidate edit page validates and saves editable fields', () => {
    const source = read('pages/import/edit.vue')

    expect(source).toContain('api.candidateDetail(candidateId.value)')
    expect(source).toContain('api.candidateUpdate(candidateId.value')
    expect(source).toContain('validateForm()')
    expect(source).toContain('addOption')
    expect(source).toContain('removeOption')
    expect(source).toContain('answerKeys')
    expect(source).toContain('navigateBack')
  })

  test('candidate edit validation normalizes answers and rejects invalid answer/option states', () => {
    const source = read('pages/import/edit.vue')

    expect(source).toContain('normalizeOptions()')
    expect(source).toContain('normalizeAnswerKeys(answerKeys.value)')
    expect(source).toContain('new Set(normalizedOptions.map((option) => option.key))')
    expect(source).toContain('optionKeySet.size !== normalizedOptions.length')
    expect(source).toContain('normalizedAnswers.some((key) => !optionKeySet.has(key))')
    expect(source).toContain("type.value !== 'multiple' && normalizedAnswers.length > 1")
    expect(source).toContain('options: normalizedOptions')
    expect(source).toContain('answerKeys: normalizedAnswers')
  })

  test('practice setup loads question count, offers fixed counts, and creates sessions', () => {
    const source = read('pages/practice/setup.vue')

    expect(source).toContain('onLoad')
    expect(source).toContain('materialId.value = String(options?.materialId ||')
    expect(source).toContain('api.questionList(materialId.value || undefined)')
    expect(source).toContain('api.practiceCreate({ materialId: materialId.value || undefined, count: selectedCount.value })')
    expect(source).toContain('countOptions = [5, 10, 20]')
    expect(source).toContain('uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })')
    expect(source).not.toContain('uni.navigateTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })')
    expect(source).toContain('/pages/practice/do?sessionId=')
    expect(source).toContain('LoadingState')
    expect(source).toContain('ErrorState')
    expect(source).toContain('EmptyState')
  })

  test('practice do page loads safe questions, submits answers, and stores grading results', () => {
    const source = read('pages/practice/do.vue')
    const submitIndex = source.indexOf('api.answerSubmit')
    const answerKeysIndex = source.indexOf('gradingResult.answerKeys')

    expect(source).toContain('sessionId.value = String(options?.sessionId ||')
    expect(source).toContain('api.practiceDetail(sessionId.value)')
    expect(source).toContain('QuestionCard')
    expect(source).toContain('createPracticeFlowData')
    expect(source).toContain('resetPracticeFlow(flow, result.questions.map((question) => question._id))')
    expect(source).toContain('selectAnswer(flow, questionId, keys)')
    expect(source).toContain('api.answerSubmit({ sessionId: sessionId.value, questionId, selectedKeys })')
    expect(source).toContain('recordGradingResult(flow, result)')
    expect(source).toContain('uni.redirectTo({ url: `/pages/practice/result?sessionId=${sessionId.value}` })')
    expect(source).not.toContain('uni.navigateTo({ url: `/pages/practice/result?sessionId=${sessionId.value}` })')
    expect(source).toContain(':disabled="Boolean(currentGradingResult)"')
    expect(source).toContain('/pages/practice/result?sessionId=')
    expect(source).not.toContain('question.answerKeys')
    expect(submitIndex).toBeGreaterThan(-1)
    expect(answerKeysIndex).toBeGreaterThan(submitIndex)
  })

  test('practice result page loads detail, shows score, and links home or retry setup', () => {
    const source = read('pages/practice/result.vue')

    expect(source).toContain('sessionId.value = String(options?.sessionId ||')
    expect(source).toContain('api.practiceDetail(sessionId.value)')
    expect(source).toContain('session.value.correctCount')
    expect(source).toContain('session.value.totalCount')
    expect(source).toContain('uni.reLaunch({ url: \'/pages/index/index\' })')
    expect(source).toContain('uni.redirectTo({ url: retryUrl.value })')
    expect(source).not.toContain('uni.navigateTo({ url: retryUrl.value })')
    expect(source).toContain('/pages/index/index')
    expect(source).toContain('/pages/practice/setup?materialId=')
    expect(source).toContain('/pages/practice/setup')
    expect(source).toContain('LoadingState')
    expect(source).toContain('ErrorState')
  })

  test('practice result links to wrong questions and handles wrong-practice retry', () => {
    const source = read('pages/practice/result.vue')

    expect(source).toContain("session.value?.mode === 'wrong'")
    expect(source).toContain('/pages/wrong/index')
    expect(source).toContain('@click="goWrongBook"')
    expect(source).toContain('const suffix = session.value?.materialId ?')
    expect(source).toContain('uni.redirectTo({ url: `/pages/wrong/index${suffix}` })')
    expect(source).toContain('查看错题')
  })
})
