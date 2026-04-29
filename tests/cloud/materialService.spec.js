const { createFakeDb } = require('./fakeDb')
const { sharedModule } = require('./sharedModules')

const { upsertUser } = sharedModule('services/userService')
const { createMaterial, getMaterialDetail, getMaterialForOwner, listMaterials } = sharedModule('services/materialService')

describe('material services', () => {
  function ownedFileId(openid, name = 'demo.pdf') {
    return `cloud://env/materials/${openid}/${name}`
  }

  it('creates user from server openid', async () => {
    const db = createFakeDb()
    const result = await upsertUser({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z' })

    expect(result._id).toBe('user_a')
    expect(result.openid).toBe('user_a')
    expect(result.created).toBe(true)
  })

  it('updates existing user login timestamp', async () => {
    const db = createFakeDb()
    await upsertUser({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z' })

    const result = await upsertUser({ db, openid: 'user_a', now: '2026-04-27T00:00:00.000Z' })

    expect(result._id).toBe('user_a')
    expect(result.created).toBe(false)
    expect(result.createdAt).toBe('2026-04-26T00:00:00.000Z')
    expect(result.updatedAt).toBe('2026-04-27T00:00:00.000Z')
  })

  it('recovers when user creation races with another first login', async () => {
    const db = createFakeDb()
    const users = db.collection('users')
    const originalCollection = db.collection
    db.collection = (name) => (name === 'users' ? users : originalCollection(name))
    users.add = async ({ data }) => {
      users._rows.push({
        ...structuredClone(data),
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
      })
      const error = new Error('duplicate key')
      error.code = 'duplicate_key'
      throw error
    }

    const result = await upsertUser({ db, openid: 'user_a', now: '2026-04-27T00:00:00.000Z' })
    const stored = await users.doc('user_a').get()

    expect(result).toMatchObject({
      _id: 'user_a',
      openid: 'user_a',
      created: false,
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    })
    expect(stored.data[0].updatedAt).toBe('2026-04-27T00:00:00.000Z')
  })

  it('creates material with owner from server openid', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: ownedFileId('user_a'),
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

  it('does not expose file id in create response but keeps it for backend owner reads', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: ownedFileId('user_a'),
        fileName: 'demo.pdf',
        fileSize: 1024,
        parseMode: 'inline_answer',
      },
    })

    const stored = await getMaterialForOwner({ db, openid: 'user_a', materialId: material._id })

    expect(material).not.toHaveProperty('fileID')
    expect(stored.fileID).toBe(ownedFileId('user_a'))
  })

  it('defaults invalid parse mode to inline answer', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: ownedFileId('user_a'),
        fileName: 'demo.pdf',
        fileSize: 1024,
        parseMode: 'forged_mode',
      },
    })

    expect(material.parseMode).toBe('inline_answer')
  })

  it('rejects file ids outside the current users upload path', async () => {
    const db = createFakeDb()

    await expect(createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: {
        fileID: ownedFileId('user_b'),
        fileName: 'forged.pdf',
        fileSize: 1024,
        parseMode: 'inline_answer',
      },
    })).rejects.toMatchObject({
      code: 'invalid_file_owner',
    })
  })

  it('rejects loose or ambiguous material file paths', async () => {
    const db = createFakeDb()
    const invalidFileIds = [
      'cloud://env/private/materials/user_a/demo.pdf',
      'cloud://env/materials/user_a/../demo.pdf',
      'cloud://env/materials/user_a/folder%2Fdemo.pdf',
      'cloud://env/materials/user_a/folder%5Cdemo.pdf',
      'cloud://env/materials/user_a/demo.pdf?token=1',
      'cloud://env/materials/user_a/demo.pdf#hash',
    ]

    for (const fileID of invalidFileIds) {
      await expect(createMaterial({
        db,
        openid: 'user_a',
        now: '2026-04-26T00:00:00.000Z',
        input: {
          fileID,
          fileName: 'demo.pdf',
          fileSize: 1024,
          parseMode: 'inline_answer',
        },
      })).rejects.toMatchObject({
        code: 'invalid_file_owner',
      })
    }
  })

  it('requires file id when creating material', async () => {
    const db = createFakeDb()

    await expect(createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: { fileName: 'demo.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })).rejects.toMatchObject({
      code: 'missing_file_id',
    })
  })

  it('requires file name when creating material', async () => {
    const db = createFakeDb()

    await expect(createMaterial({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:00.000Z',
      input: { fileID: 'cloud://env/materials/user_a/demo.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })).rejects.toMatchObject({
      code: 'missing_file_name',
    })
  })

  it('lists only current user materials', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'a.pdf'), fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_b', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_b', 'b.pdf'), fileName: 'b.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
  })

  it('lists current user materials newest first', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'old.pdf'), fileName: 'old.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_a', now: '2026-04-27T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'new.pdf'), fileName: 'new.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result.map((material) => material.fileName)).toEqual(['new.pdf', 'old.pdf'])
  })

  it('returns detail for the material owner', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'a.pdf'), fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const detail = await getMaterialDetail({ db, openid: 'user_a', materialId: material._id })

    expect(detail).toMatchObject({
      _id: material._id,
      ownerOpenid: 'user_a',
      fileName: 'a.pdf',
    })
  })

  it('blocks detail access for other users', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'a.pdf'), fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    try {
      await getMaterialDetail({ db, openid: 'user_b', materialId: material._id })
      throw new Error('expected getMaterialDetail to reject')
    } catch (error) {
      expect(error.code).toBe('material_not_found')
      expect(error.message).toBe('资料不存在')
    }
  })

  it('requires material id when getting detail', async () => {
    const db = createFakeDb()

    await expect(getMaterialDetail({ db, openid: 'user_a' })).rejects.toMatchObject({
      code: 'missing_material_id',
      message: '缺少资料 ID',
    })
  })
})
