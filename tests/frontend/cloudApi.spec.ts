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
})
