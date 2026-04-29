const { createFakeDb } = require('./fakeDb')
const { handleUserLogin } = require('../../uniCloud-alipay/cloudfunctions/userLogin/index')

describe('uniCloud userLogin function', () => {
  it('exchanges code for uid and returns compatibility user shape', async () => {
    const db = createFakeDb()
    const result = await handleUserLogin({
      event: { code: 'wx_code_a' },
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async ({ code }) => {
        expect(code).toBe('wx_code_a')
        return { uid: 'uid_a', token: 'token_a', tokenExpired: 1770000000000 }
      },
    })

    expect(result).toMatchObject({
      token: 'token_a',
      tokenExpired: 1770000000000,
      user: {
        _id: 'uid_a',
        uid: 'uid_a',
        openid: 'uid_a',
        created: true,
      },
    })
  })

  it('rejects missing login code', async () => {
    const db = createFakeDb()
    await expect(handleUserLogin({
      event: {},
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async () => ({ uid: 'never' }),
    })).rejects.toMatchObject({ code: 'missing_login_code' })
  })

  it('preserves uni-id errCode and errMsg failures', async () => {
    const db = createFakeDb()
    await expect(handleUserLogin({
      event: { code: 'bad_wx_code' },
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async () => ({ errCode: 40013, errMsg: 'invalid appid' }),
    })).rejects.toMatchObject({
      code: 40013,
      message: 'invalid appid',
    })
  })

  it('treats string zero login code as success', async () => {
    const db = createFakeDb()
    const result = await handleUserLogin({
      event: { code: 'wx_code_string_zero' },
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async () => ({ code: '0', uid: 'uid_string_zero' }),
    })

    expect(result.user).toMatchObject({
      _id: 'uid_string_zero',
      uid: 'uid_string_zero',
      openid: 'uid_string_zero',
    })
  })

  it('rejects login results without uid', async () => {
    const db = createFakeDb()
    await expect(handleUserLogin({
      event: { code: 'wx_code_without_uid' },
      db,
      now: '2026-04-29T00:00:00.000Z',
      loginByWeixin: async () => ({ code: 0, token: 'token_without_uid' }),
    })).rejects.toMatchObject({ code: 'missing_uid' })
  })
})
