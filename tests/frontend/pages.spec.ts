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

  test('home page logs in, loads materials, and navigates to upload/detail', () => {
    const source = read('pages/index/index.vue')

    expect(source).toContain('api.userLogin()')
    expect(source).toContain('api.materialList()')
    expect(source).toContain('MaterialCard')
    expect(source).toContain('EmptyState')
    expect(source).toContain('/pages/upload/index')
    expect(source).toContain('/pages/material/detail?materialId=')
  })

  test('upload page chooses a pdf, uploads to cloud storage, and starts parsing', () => {
    const source = read('pages/upload/index.vue')

    expect(source).toContain('chooseMessageFile')
    expect(source).toContain("extension: ['pdf']")
    expect(source).toContain('wx.cloud.uploadFile')
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

  test('package scripts invoke uni through a cross-platform node wrapper', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const wrapperSource = read('scripts/uni-cli.mjs')

    expect(existsSync('scripts/uni-cli.mjs')).toBe(true)
    expect(packageJson.scripts['dev:mp-weixin']).toBe('node scripts/uni-cli.mjs -p mp-weixin')
    expect(packageJson.scripts['build:mp-weixin']).toBe('node scripts/uni-cli.mjs build -p mp-weixin')
    expect(wrapperSource).toContain("process.env.UNI_INPUT_DIR || '.'")
    expect(wrapperSource).toContain('@dcloudio')
    expect(wrapperSource).toContain('vite-plugin-uni')
    expect(wrapperSource).toContain('spawn')
    expect(wrapperSource).toContain('syncCloudfunctionsOutput')
    expect(wrapperSource).toContain('copyCloudfunctions')
    expect(wrapperSource).toContain('vendorCommonIntoFunctionPackages')
    expect(wrapperSource).toContain("require('./common")
    expect(wrapperSource).toContain('patchProjectConfig')
    expect(wrapperSource).toContain('cloudfunctionRoot')
    expect(wrapperSource).toContain("dist', 'build', 'mp-weixin', 'cloudfunctions")
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
})
