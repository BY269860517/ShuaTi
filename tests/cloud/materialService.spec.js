const { createFakeDb } = require('./fakeDb')
const { upsertUser } = require('../../cloudfunctions/common/services/userService')
const { createMaterial, getMaterialDetail, listMaterials } = require('../../cloudfunctions/common/services/materialService')

describe('material services', () => {
  it('creates user from server openid', async () => {
    const db = createFakeDb()
    const result = await upsertUser({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z' })

    expect(result.openid).toBe('user_a')
    expect(result.created).toBe(true)
  })

  it('creates material with owner from server openid', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: 'cloud://env/materials/user_a/demo.pdf',
        fileName: 'demo.pdf',
        fileSize: 1024,
        parseMode: 'inline_answer',
        ownerOpenid: 'forged_user',
      },
    })

    expect(material.ownerOpenid).toBe('user_a')
    expect(material.status).toBe('uploaded')
    expect(material.parseMode).toBe('inline_answer')
  })

  it('lists only current user materials', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'a', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_b', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'b', fileName: 'b.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
  })

  it('blocks detail access for other users', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'a', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    await expect(getMaterialDetail({ db, openid: 'user_b', materialId: material._id })).rejects.toThrow('资料不存在')
  })
})
