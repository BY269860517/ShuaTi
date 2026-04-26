const { requireOpenid } = require('../../cloudfunctions/common/auth')
const { toErrorResponse } = require('../../cloudfunctions/common/response')
const { createFakeDb } = require('./fakeDb')

describe('cloud service harness', () => {
  it('returns openid from context', () => {
    expect(requireOpenid({ OPENID: 'user_a' })).toBe('user_a')
  })

  it('throws unauthorized error when openid is missing', () => {
    expect(() => requireOpenid({})).toThrow('缺少用户身份')

    try {
      requireOpenid({})
    } catch (error) {
      expect(error.code).toBe('unauthorized')
    }
  })

  it('uses UTF-8 default internal error response', () => {
    expect(toErrorResponse(new Error())).toEqual({
      ok: false,
      error: {
        code: 'internal_error',
        message: '服务异常',
      },
    })
  })

  it('adds and queries rows by field', async () => {
    const db = createFakeDb()
    const questions = db.collection('questions')

    const result = await questions.add({
      data: {
        owner: 'user_a',
        stem: '题干',
      },
    })
    const query = await questions.where({ owner: 'user_a' }).get()

    expect(result).toEqual({ _id: 'questions_1' })
    expect(query.data).toEqual([
      {
        _id: 'questions_1',
        owner: 'user_a',
        stem: '题干',
      },
    ])
  })
})
