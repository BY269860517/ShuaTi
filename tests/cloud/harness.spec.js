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

  it('updates one row by document id', async () => {
    const db = createFakeDb()
    const questions = db.collection('questions')
    const { _id } = await questions.add({
      data: {
        owner: 'user_a',
        status: 'draft',
      },
    })

    const update = await questions.doc(_id).update({
      data: {
        status: 'ready',
      },
    })
    const result = await questions.doc(_id).get()

    expect(update).toEqual({ stats: { updated: 1 } })
    expect(result.data[0].status).toBe('ready')
  })

  it('rejects duplicate caller-provided document ids', async () => {
    const db = createFakeDb()
    const users = db.collection('users')
    await users.add({ data: { _id: 'user_a', openid: 'user_a' } })

    await expect(users.add({ data: { _id: 'user_a', openid: 'user_a' } })).rejects.toMatchObject({
      code: 'duplicate_key',
    })
  })

  it('returns zero updated count for missing document id', async () => {
    const db = createFakeDb()
    const questions = db.collection('questions')

    const update = await questions.doc('missing').update({
      data: {
        status: 'ready',
      },
    })

    expect(update).toEqual({ stats: { updated: 0 } })
  })

  it('updates all rows matching a query', async () => {
    const db = createFakeDb()
    const questions = db.collection('questions')
    await questions.add({ data: { owner: 'user_a', status: 'draft' } })
    await questions.add({ data: { owner: 'user_a', status: 'draft' } })
    await questions.add({ data: { owner: 'user_b', status: 'draft' } })

    const update = await questions.where({ owner: 'user_a' }).update({
      data: {
        status: 'ready',
      },
    })
    const userA = await questions.where({ owner: 'user_a' }).get()
    const userB = await questions.where({ owner: 'user_b' }).get()

    expect(update).toEqual({ stats: { updated: 2 } })
    expect(userA.data.map((row) => row.status)).toEqual(['ready', 'ready'])
    expect(userB.data[0].status).toBe('draft')
  })

  it('returns clone-isolated rows from get', async () => {
    const db = createFakeDb()
    const questions = db.collection('questions')
    const { _id } = await questions.add({
      data: {
        owner: 'user_a',
        meta: {
          source: 'pdf',
        },
      },
    })

    const firstRead = await questions.doc(_id).get()
    firstRead.data[0].owner = 'mutated'
    firstRead.data[0].meta.source = 'manual'
    const secondRead = await questions.doc(_id).get()

    expect(secondRead.data[0]).toMatchObject({
      owner: 'user_a',
      meta: {
        source: 'pdf',
      },
    })
  })
})
