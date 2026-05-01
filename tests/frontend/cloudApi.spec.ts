import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, callFunction, type CloudFunctionError } from '../../common/api/cloud'

declare global {
  // eslint-disable-next-line no-var
  var uniCloud: {
    callFunction: ReturnType<typeof vi.fn>
  } | undefined

  // eslint-disable-next-line no-var
  var uni: {
    login: ReturnType<typeof vi.fn>
    getStorageSync: ReturnType<typeof vi.fn>
    setStorageSync: ReturnType<typeof vi.fn>
  } | undefined
}

describe('frontend cloud api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.uniCloud
    delete globalThis.uni
  })

  test('returns data for standard successful cloud responses', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({ result: { ok: true, data: { value: 1 } } })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(callFunction<{ value: number }>('demo', { id: '1' })).resolves.toEqual({ value: 1 })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'demo',
      data: { id: '1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })

  test('calls userLogin with a WeChat login code and stores returned token', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          token: 'token_next',
          tokenExpired: 1770000000000,
          user: {
            _id: 'uid_a',
            openid: 'uid_a',
            uid: 'uid_a',
            createdAt: '2026-04-29T00:00:00.000Z',
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn((options) => options.success({ code: 'wx_code_a' })),
      getStorageSync: vi.fn().mockReturnValue(''),
      setStorageSync: vi.fn(),
    }

    await expect(api.userLogin()).resolves.toMatchObject({
      user: { _id: 'uid_a', openid: 'uid_a', uid: 'uid_a' },
    })
    expect(callFunctionMock).toHaveBeenCalledWith({ name: 'userLogin', data: { code: 'wx_code_a' } })
    expect(globalThis.uni.setStorageSync).toHaveBeenCalledWith('uni_id_token', 'token_next')
    expect(globalThis.uni.setStorageSync).toHaveBeenCalledWith('uni_id_token_expired', 1770000000000)
  })

  test('throws backend error message and code for standard failures', async () => {
    globalThis.uniCloud = {
      callFunction: vi.fn().mockResolvedValue({
        result: { ok: false, error: { code: 'missing_id', message: '缺少 ID' } },
      }),
    }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '缺少 ID',
      code: 'missing_id',
    } satisfies Partial<CloudFunctionError>)
  })

  test('does not treat truthy non-boolean ok as success', async () => {
    globalThis.uniCloud = { callFunction: vi.fn().mockResolvedValue({ result: { ok: 1, data: { value: 1 } } }) }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '云函数响应格式错误',
      code: 'invalid_response',
    } satisfies Partial<CloudFunctionError>)
  })

  test('throws invalid response error when result is missing', async () => {
    globalThis.uniCloud = { callFunction: vi.fn().mockResolvedValue({}) }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '云函数响应格式错误',
      code: 'invalid_response',
    } satisfies Partial<CloudFunctionError>)
  })

  test('parseRunner calls cloud function with job id and returns job data', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          job: {
            _id: 'job_1',
            materialId: 'material_1',
            status: 'done',
            errorMessage: '',
            stats: { candidateCount: 3 },
          },
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue(''),
      setStorageSync: vi.fn(),
    }

    await expect(api.parseRunner('job_1')).resolves.toMatchObject({
      job: {
        _id: 'job_1',
        status: 'done',
      },
    })
    expect(callFunctionMock).toHaveBeenCalledWith({ name: 'parseRunner', data: { jobId: 'job_1' } })
  })

  test('materialDelete calls cloud function with material id and auth tokens', async () => {
    const material = {
      _id: 'material_1',
      fileName: 'demo.pdf',
      fileSize: 1024,
      status: 'failed',
      parseMode: 'inline_answer',
      questionCount: 0,
      readyCandidateCount: 0,
      needReviewCandidateCount: 0,
      invalidCandidateCount: 0,
      errorMessage: '解析失败',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
      deletedAt: '2026-05-01T00:01:00.000Z',
    }
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: { material },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.materialDelete('material_1')).resolves.toEqual({ material })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'materialDelete',
      data: { materialId: 'material_1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })

  test('candidateDelete calls cloud function with candidate id and auth tokens', async () => {
    const candidate = {
      _id: 'candidate_1',
      materialId: 'material_1',
      type: 'single',
      stem: '测试题',
      options: [],
      answerKeys: [],
      explanation: '',
      status: 'invalid',
      validationErrors: ['missing_options'],
      importedQuestionId: '',
      deletedAt: '2026-05-01T00:00:00.000Z',
    }
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: { ok: true, data: { candidate } },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.candidateDelete('candidate_1')).resolves.toEqual({ candidate })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'candidateDelete',
      data: { candidateId: 'candidate_1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })

  test('wrongList calls cloud function with filters and auth tokens', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          wrongQuestions: [],
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.wrongList({ status: 'active', materialId: 'material_1' })).resolves.toEqual({
      wrongQuestions: [],
    })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'wrongList',
      data: { status: 'active', materialId: 'material_1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })

  test('wrongPracticeCreate calls cloud function with count and returns wrong mode session', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          session: {
            _id: 'session_1',
            materialId: '',
            mode: 'wrong',
            questionIds: [],
            status: 'active',
            totalCount: 10,
            correctCount: 0,
            startedAt: '2026-04-30T00:00:00.000Z',
            submittedAt: '',
            createdAt: '2026-04-30T00:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.wrongPracticeCreate({ count: 10 })).resolves.toMatchObject({
      session: { mode: 'wrong' },
    })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'wrongPracticeCreate',
      data: { count: 10, _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })

  test('practiceCreate sends enhanced setup options', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          session: {
            _id: 'session_1',
            materialId: 'material_1',
            questionIds: [],
            status: 'active',
            totalCount: 5,
            correctCount: 0,
            countMode: 'custom',
            requestedCount: 3,
            orderMode: 'random',
            scope: 'unattempted',
            questionType: 'multiple',
            startedAt: '2026-05-01T00:00:00.000Z',
            submittedAt: '',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.practiceCreate({
      materialId: 'material_1',
      count: 3,
      countMode: 'custom',
      orderMode: 'random',
      scope: 'unattempted',
      questionType: 'multiple',
    })).resolves.toMatchObject({
      session: {
        countMode: 'custom',
        orderMode: 'random',
        scope: 'unattempted',
        questionType: 'multiple',
      },
    })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'practiceCreate',
      data: {
        materialId: 'material_1',
        count: 3,
        countMode: 'custom',
        orderMode: 'random',
        scope: 'unattempted',
        questionType: 'multiple',
        _uniToken: 'token_a',
        uniToken: 'token_a',
      },
    })
  })

  test('wrongMarkMastered calls cloud function with wrong question id and returns wrong question', async () => {
    const wrongQuestion = {
      _id: 'wrong_1',
      questionId: 'questions_1',
      materialId: 'material_1',
      status: 'mastered',
      wrongCount: 2,
      correctStreak: 3,
      lastWrongAt: '2026-04-30T00:00:00.000Z',
      masteredAt: '2026-04-30T01:00:00.000Z',
      question: {
        _id: 'questions_1',
        materialId: 'material_1',
        type: 'single',
        stem: '题干',
        options: [{ key: 'A', text: '选项 A' }],
      },
    }
    const callFunctionMock = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        data: {
          wrongQuestion,
        },
      },
    })
    globalThis.uniCloud = { callFunction: callFunctionMock }
    globalThis.uni = {
      login: vi.fn(),
      getStorageSync: vi.fn().mockReturnValue('token_a'),
      setStorageSync: vi.fn(),
    }

    await expect(api.wrongMarkMastered('wrong_1')).resolves.toEqual({ wrongQuestion })
    expect(callFunctionMock).toHaveBeenCalledWith({
      name: 'wrongMarkMastered',
      data: { wrongQuestionId: 'wrong_1', _uniToken: 'token_a', uniToken: 'token_a' },
    })
  })
})
