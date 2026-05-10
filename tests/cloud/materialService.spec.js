const { createFakeDb } = require('./fakeDb')
const { sharedModule } = require('./sharedModules')

const { upsertUser } = sharedModule('services/userService')
const { createMaterial, deleteMaterial, getMaterialDetail, getMaterialForOwner, listMaterials } = sharedModule('services/materialService')

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

  it('includes distinct practiced question count per material for current user', async () => {
    const db = createFakeDb()
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: ownedFileId('user_a', 'a.pdf'), fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:01:00.000Z', input: { fileID: ownedFileId('user_a', 'b.pdf'), fileName: 'b.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await db.collection('questions').add({ data: { _id: 'q_a_1', ownerOpenid: 'user_a', materialId: 'materials_1' } })
    await db.collection('questions').add({ data: { _id: 'q_a_2', ownerOpenid: 'user_a', materialId: 'materials_1' } })
    await db.collection('questions').add({ data: { _id: 'q_b_1', ownerOpenid: 'user_a', materialId: 'materials_2' } })
    await db.collection('questions').add({ data: { _id: 'q_other', ownerOpenid: 'user_b', materialId: 'materials_1' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_1', ownerOpenid: 'user_a', sessionId: 'session_1', questionId: 'q_a_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:02:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_2', ownerOpenid: 'user_a', sessionId: 'session_2', questionId: 'q_a_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:03:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_3', ownerOpenid: 'user_a', sessionId: 'session_3', questionId: 'q_a_2', selectedKeys: ['B'], isCorrect: false, createdAt: '2026-04-26T00:04:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_4', ownerOpenid: 'user_a', sessionId: 'session_4', questionId: 'q_b_1', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:05:00.000Z' } })
    await db.collection('attempts').add({ data: { _id: 'attempt_5', ownerOpenid: 'user_b', sessionId: 'session_5', questionId: 'q_other', selectedKeys: ['A'], isCorrect: true, createdAt: '2026-04-26T00:06:00.000Z' } })

    const result = await listMaterials({ db, openid: 'user_a' })

    expect(result.map((material) => ({
      fileName: material.fileName,
      practicedQuestionCount: material.practicedQuestionCount,
    }))).toEqual([
      { fileName: 'b.pdf', practicedQuestionCount: 1 },
      { fileName: 'a.pdf', practicedQuestionCount: 2 },
    ])
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
  it('soft deletes an owned material and excludes it from material lists', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'delete.pdf'), fileName: 'delete.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    const deleted = await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:01:00.000Z',
    })
    const listed = await listMaterials({ db, openid: 'user_a' })

    expect(deleted).toMatchObject({
      _id: material._id,
      fileName: 'delete.pdf',
      deletedAt: '2026-05-01T00:01:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
    })
    expect(listed).toEqual([])
  })

  it('treats a deleted material as missing for detail and owner reads', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'hidden.pdf'), fileName: 'hidden.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:02:00.000Z',
    })

    await expect(getMaterialDetail({ db, openid: 'user_a', materialId: material._id })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })
    await expect(getMaterialForOwner({ db, openid: 'user_a', materialId: material._id })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })
  })

  it('does not allow deleting another users material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'private.pdf'), fileName: 'private.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    await expect(deleteMaterial({
      db,
      openid: 'user_b',
      materialId: material._id,
      now: '2026-05-01T00:03:00.000Z',
    })).rejects.toMatchObject({
      code: 'material_not_found',
      message: '资料不存在',
    })

    const listed = await listMaterials({ db, openid: 'user_a' })
    expect(listed).toHaveLength(1)
    expect(listed[0]._id).toBe(material._id)
  })

  it('returns an existing summary when deleting an already deleted material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:00:00.000Z',
      input: { fileID: ownedFileId('user_a', 'again.pdf'), fileName: 'again.pdf', fileSize: 1024, parseMode: 'inline_answer' },
    })

    const first = await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:05:00.000Z',
    })
    const second = await deleteMaterial({
      db,
      openid: 'user_a',
      materialId: material._id,
      now: '2026-05-01T00:06:00.000Z',
    })

    expect(second).toMatchObject({
      _id: material._id,
      deletedAt: first.deletedAt,
      updatedAt: first.updatedAt,
    })
  })

  it('requires material id and timestamp when deleting material', async () => {
    const db = createFakeDb()

    await expect(deleteMaterial({
      db,
      openid: 'user_a',
      now: '2026-05-01T00:04:00.000Z',
    })).rejects.toMatchObject({
      code: 'missing_material_id',
      message: '缺少资料 ID',
    })

    await expect(deleteMaterial({
      db,
      openid: 'user_a',
      materialId: 'material_a',
    })).rejects.toMatchObject({
      code: 'missing_timestamp',
      message: '缺少删除时间',
    })
  })
})
