import { afterEach, describe, expect, test, vi } from 'vitest'
import { callFunction, type CloudFunctionError } from '../../common/api/cloud'

declare global {
  // eslint-disable-next-line no-var
  var wx: {
    cloud: {
      callFunction: ReturnType<typeof vi.fn>
    }
  } | undefined
}

describe('frontend cloud api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.wx
  })

  test('returns data for standard successful cloud responses', async () => {
    const callFunctionMock = vi.fn().mockResolvedValue({ result: { ok: true, data: { value: 1 } } })
    globalThis.wx = { cloud: { callFunction: callFunctionMock } }

    await expect(callFunction<{ value: number }>('demo', { id: '1' })).resolves.toEqual({ value: 1 })
    expect(callFunctionMock).toHaveBeenCalledWith({ name: 'demo', data: { id: '1' } })
  })

  test('throws backend error message and code for standard failures', async () => {
    globalThis.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: { ok: false, error: { code: 'missing_id', message: '缺少 ID' } },
        }),
      },
    }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '缺少 ID',
      code: 'missing_id',
    } satisfies Partial<CloudFunctionError>)
  })

  test('does not treat truthy non-boolean ok as success', async () => {
    globalThis.wx = { cloud: { callFunction: vi.fn().mockResolvedValue({ result: { ok: 1, data: { value: 1 } } }) } }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '云函数响应格式错误',
      code: 'invalid_response',
    } satisfies Partial<CloudFunctionError>)
  })

  test('throws invalid response error when result is missing', async () => {
    globalThis.wx = { cloud: { callFunction: vi.fn().mockResolvedValue({}) } }

    await expect(callFunction('demo')).rejects.toMatchObject({
      message: '云函数响应格式错误',
      code: 'invalid_response',
    } satisfies Partial<CloudFunctionError>)
  })
})
