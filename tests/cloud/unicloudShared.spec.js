const { beforeEach, describe, expect, it, mock } = require('bun:test')

let checkTokenResult
const checkTokenCalls = []

mock.module('uni-id-common', () => ({
  createInstance({ context }) {
    checkTokenCalls.push(['createInstance', context])
    return {
      checkToken(token) {
        checkTokenCalls.push(['checkToken', token])
        return Promise.resolve(checkTokenResult)
      },
    }
  },
}))

const { requireUidFromEvent } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/auth')
const { createDbCompat } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/db')
const { toErrorResponse } = require('../../uniCloud-alipay/cloudfunctions/common/shuati-shared/response')

describe('uniCloud shared helpers', () => {
  beforeEach(() => {
    checkTokenResult = undefined
    checkTokenCalls.length = 0
  })

  it('resolves uid from trusted context auth before event tokens', async () => {
    const result = await requireUidFromEvent({
      event: { _uniToken: 'ignored' },
      context: { auth: { uid: 'uid_from_context' } },
      checkToken: async () => {
        throw new Error('should not check token when context has uid')
      },
    })

    expect(result.uid).toBe('uid_from_context')
  })

  it('verifies uid from event token', async () => {
    const result = await requireUidFromEvent({
      event: { _uniToken: 'token_a' },
      context: {},
      checkToken: async (token) => {
        expect(token).toBe('token_a')
        return { uid: 'uid_from_token' }
      },
    })

    expect(result.uid).toBe('uid_from_token')
  })

  it('verifies uid with default uni-id-common token checker', async () => {
    checkTokenResult = {
      uid: 'uid_from_default_checker',
      token: 'refreshed_token',
      tokenExpired: 123,
      role: ['student'],
      permission: ['practice.read'],
    }

    const result = await requireUidFromEvent({
      event: { uniToken: 'token_default' },
      context: { requestId: 'ctx_a' },
    })

    expect(result).toEqual({
      uid: 'uid_from_default_checker',
      token: 'refreshed_token',
      tokenExpired: 123,
      role: ['student'],
      permission: ['practice.read'],
    })
    expect(checkTokenCalls).toEqual([
      ['createInstance', { requestId: 'ctx_a' }],
      ['checkToken', 'token_default'],
    ])
  })

  it('converts default uni-id-common errCode result to unauthorized', async () => {
    checkTokenResult = {
      errCode: 30203,
      errMsg: 'token expired',
    }

    await expect(requireUidFromEvent({
      event: { uniToken: 'expired_token' },
      context: {},
    })).rejects.toMatchObject({
      code: 'unauthorized',
      message: 'token expired',
      detail: checkTokenResult,
    })
  })

  it('converts default uni-id-common token result without uid to unauthorized', async () => {
    checkTokenResult = {
      token: 'token_without_uid',
    }

    await expect(requireUidFromEvent({
      event: { uniToken: 'token_without_uid' },
      context: {},
    })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects missing token with unauthorized code', async () => {
    await expect(requireUidFromEvent({
      event: {},
      context: {},
      checkToken: async () => ({ uid: 'never' }),
    })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('adapts WeChat-style add and update calls to uniCloud database calls', async () => {
    const calls = []
    const nativeDb = {
      collection(name) {
        calls.push(['collection', name])
        return {
          add(data) {
            calls.push(['add', data])
            return Promise.resolve({ id: 'row_1' })
          },
          doc(id) {
            calls.push(['doc', id])
            return {
              update(data) {
                calls.push(['doc.update', data])
                return Promise.resolve({ updated: 1 })
              },
              get() {
                return Promise.resolve({ data: [] })
              },
            }
          },
          where(query) {
            calls.push(['where', query])
            return {
              update(data) {
                calls.push(['where.update', data])
                return Promise.resolve({ updated: 2 })
              },
              get() {
                return Promise.resolve({ data: [] })
              },
              orderBy() {
                return this
              },
            }
          },
        }
      },
    }

    const db = createDbCompat(nativeDb)
    await expect(db.collection('materials').add({ data: { fileName: 'a.pdf' } })).resolves.toEqual({ _id: 'row_1', id: 'row_1' })
    await expect(db.collection('materials').doc('row_1').update({ data: { status: 'ready' } })).resolves.toMatchObject({
      updated: 1,
      stats: { updated: 1 },
    })
    await expect(db.collection('materials').where({ ownerOpenid: 'uid_a' }).update({ data: { status: 'ready' } })).resolves.toMatchObject({
      updated: 2,
      stats: { updated: 2 },
    })
    expect(calls).toContainEqual(['add', { fileName: 'a.pdf' }])
    expect(calls).toContainEqual(['doc.update', { status: 'ready' }])
    expect(calls).toContainEqual(['where.update', { status: 'ready' }])
  })

  it('uses UTF-8 default internal error response', () => {
    expect(toErrorResponse(new Error()).error.message).toBe('服务异常')
  })
})
