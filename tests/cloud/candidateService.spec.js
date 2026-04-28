const { createFakeDb } = require('./fakeDb')
const { updateCandidate, listCandidates, getCandidateDetail } = require('../../cloudfunctions/common/services/candidateService')
const { confirmImport, createQuestionId } = require('../../cloudfunctions/common/services/importService')

async function seedCandidate(db, overrides = {}) {
  const result = await db.collection('parse_candidates').add({
    data: {
      materialId: 'material_1',
      ownerOpenid: 'user_a',
      questionNo: '1',
      type: 'single',
      stem: '题目',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answerKeys: ['A'],
      explanation: '',
      status: 'ready',
      importedQuestionId: '',
      validationErrors: [],
      sourceText: 'source',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

async function seedMaterial(db, overrides = {}) {
  const result = await db.collection('materials').add({
    data: {
      _id: 'material_1',
      ownerOpenid: 'user_a',
      fileName: 'demo.pdf',
      fileSize: 1024,
      status: 'reviewing',
      parseMode: 'inline_answer',
      questionCount: 1,
      readyCandidateCount: 1,
      needReviewCandidateCount: 0,
      invalidCandidateCount: 0,
      errorMessage: '',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

describe('candidate service', () => {
  it('lists only current user candidates for a material', async () => {
    const db = createFakeDb()
    await seedCandidate(db)
    await seedCandidate(db, { ownerOpenid: 'user_b' })

    const result = await listCandidates({ db, openid: 'user_a', materialId: 'material_1' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
  })

  it('does not leak import claim metadata in list or detail responses', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'secret-token',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      importClaimUntil: '2026-04-26T00:05:00.000Z',
    })

    const list = await listCandidates({ db, openid: 'user_a', materialId: 'material_1' })
    const detail = await getCandidateDetail({ db, openid: 'user_a', candidateId })

    expect(list[0].status).toBe('importing')
    expect(detail.status).toBe('importing')
    for (const candidate of [list[0], detail]) {
      expect(candidate.importClaimToken).toBeUndefined()
      expect(candidate.importSourceUpdatedAt).toBeUndefined()
      expect(candidate.importClaimUntil).toBeUndefined()
    }
  })

  it('validates edited candidate and marks it ready', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, { status: 'need_review', answerKeys: [] })

    const result = await updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })

    expect(result.status).toBe('ready')
    expect(result.answerKeys).toEqual(['B'])
  })

  it('blocks editing another users candidate', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)

    await expect(updateCandidate({
      db,
      openid: 'user_b',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_not_found' })
  })

  it('returns localized messages with candidate edit errors', async () => {
    const db = createFakeDb()
    const importedId = await seedCandidate(db, { status: 'imported', importedQuestionId: 'question_1' })
    const importingId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'claim_1',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
    })

    await expect(updateCandidate({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'missing_candidate_id', message: '缺少候选题 ID' })
    await expect(updateCandidate({
      db,
      openid: 'user_b',
      candidateId: importedId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_not_found', message: '候选题不存在' })
    await expect(updateCandidate({
      db,
      openid: 'user_a',
      candidateId: importedId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_imported', message: '已导入题目不能编辑' })
    await expect(updateCandidate({
      db,
      openid: 'user_a',
      candidateId: importingId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_importing', message: '候选题正在导入，稍后再试' })
  })

  it('blocks editing an already imported candidate', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, { status: 'imported', importedQuestionId: 'question_1' })

    await expect(updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_imported' })
  })

  it('blocks editing a candidate while it is importing', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'claim_1',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
    })

    await expect(updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_importing' })
  })

  it('validates intentionally cleared answers', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)

    const result = await updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: [] },
    })

    expect(result.status).toBe('need_review')
    expect(result.validationErrors).toContain('missing_answer')
    expect(result.answerKeys).toEqual([])
  })

  it('validates intentionally cleared options', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)

    const result = await updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { options: [] },
    })

    expect(result.status).toBe('invalid')
    expect(result.validationErrors).toContain('missing_options')
    expect(result.options).toEqual([])
  })

  it('returns useful codes for missing required ids', async () => {
    const db = createFakeDb()

    await expect(updateCandidate({
      db,
      openid: 'user_a',
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'missing_candidate_id' })

    await expect(listCandidates({ db, openid: 'user_a' })).rejects.toMatchObject({ code: 'missing_material_id', message: '缺少资料 ID' })
    await expect(confirmImport({ db, openid: 'user_a', now: '2026-04-26T00:00:10.000Z' })).rejects.toMatchObject({ code: 'missing_material_id', message: '缺少资料 ID' })
  })

  it('does not let an edit read before import revert an imported candidate', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const candidates = db.collection('parse_candidates')
    const originalCollection = db.collection
    const originalDoc = candidates.doc
    const originalWhere = candidates.where
    db.collection = (name) => (name === 'parse_candidates' ? candidates : originalCollection(name))
    candidates.doc = (id) => {
      const base = originalDoc(id)
      return {
        ...base,
        async update({ data }) {
          if (id === candidateId && data.answerKeys) {
            await base.update({
              data: {
                status: 'imported',
                importedQuestionId: `question_${candidateId}`,
                updatedAt: '2026-04-26T00:00:09.000Z',
              },
            })
          }
          return base.update({ data })
        },
      }
    }
    candidates.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === candidateId && query.ownerOpenid === 'user_a' && query.status === 'ready') {
        return {
          ...base,
          async update({ data }) {
            await originalDoc(candidateId).update({
              data: {
                status: 'imported',
                importedQuestionId: `question_${candidateId}`,
                updatedAt: '2026-04-26T00:00:09.000Z',
              },
            })
            return base.update({ data })
          },
        }
      }
      return base
    }

    await expect(updateCandidate({
      db,
      openid: 'user_a',
      candidateId,
      now: '2026-04-26T00:00:10.000Z',
      input: { answerKeys: ['B'] },
    })).rejects.toMatchObject({ code: 'candidate_imported' })

    const stored = await originalDoc(candidateId).get()
    expect(stored.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: `question_${candidateId}`,
      answerKeys: ['A'],
    })
  })

  it('imports ready candidates once', async () => {
    const db = createFakeDb()
    await seedCandidate(db)

    const first = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const second = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:11.000Z' })

    expect(first.importedCount).toBe(1)
    expect(second.importedCount).toBe(0)
  })

  it('marks the material ready and counts imported questions after import', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 0 })
    await seedCandidate(db)

    await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })

    const material = await db.collection('materials').doc('material_1').get()
    expect(material.data[0]).toMatchObject({
      status: 'ready',
      questionCount: 1,
      readyCandidateCount: 0,
      needReviewCandidateCount: 0,
      invalidCandidateCount: 0,
      updatedAt: '2026-04-26T00:00:10.000Z',
    })
  })

  it('does not import stale ready data if candidate changes before claim', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const candidates = db.collection('parse_candidates')
    const originalCollection = db.collection
    const originalDoc = candidates.doc
    const originalWhere = candidates.where
    db.collection = (name) => (name === 'parse_candidates' ? candidates : originalCollection(name))
    candidates.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === candidateId && query.ownerOpenid === 'user_a' && query.status === 'ready') {
        return {
          ...base,
          async update({ data }) {
            await originalDoc(candidateId).update({
              data: {
                status: 'need_review',
                answerKeys: [],
                validationErrors: ['missing_answer'],
                updatedAt: '2026-04-26T00:00:09.000Z',
              },
            })
            return base.update({ data })
          },
        }
      }
      return base
    }

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const stored = await originalDoc(candidateId).get()
    const questions = await db.collection('questions').where({ candidateId }).get()

    expect(result.importedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(stored.data[0]).toMatchObject({
      status: 'need_review',
      importedQuestionId: '',
      answerKeys: [],
    })
    expect(questions.data).toHaveLength(0)
  })

  it('recovers when duplicate deterministic question id is already imported', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    await db.collection('questions').add({
      data: {
        _id: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
        ownerOpenid: 'user_a',
        materialId: 'material_1',
        candidateId,
        type: 'single',
        stem: '题目',
        options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
        answerKeys: ['A'],
        explanation: '',
        sourcePageNo: null,
        sourceCandidateUpdatedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-26T00:00:09.000Z',
        updatedAt: '2026-04-26T00:00:09.000Z',
      },
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const candidates = await db.collection('parse_candidates').where({ ownerOpenid: 'user_a', materialId: 'material_1' }).get()
    const questions = await db.collection('questions').where({ ownerOpenid: 'user_a', materialId: 'material_1' }).get()

    expect(result.importedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(candidates.data[0]).toMatchObject({
      importedQuestionId: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      status: 'imported',
    })
    expect(questions.data).toHaveLength(1)
  })

  it('recovers when deterministic question insert races with another importer', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const questions = db.collection('questions')
    const originalCollection = db.collection
    const originalAdd = questions.add
    db.collection = (name) => (name === 'questions' ? questions : originalCollection(name))
    questions.add = async ({ data }) => {
      await originalAdd({ data: { ...data, createdAt: '2026-04-26T00:00:09.000Z', updatedAt: '2026-04-26T00:00:09.000Z' } })
      const error = new Error('duplicate key')
      error.code = 'duplicate_key'
      throw error
    }

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const candidates = await db.collection('parse_candidates').where({ ownerOpenid: 'user_a', materialId: 'material_1' }).get()
    const storedQuestions = await questions.where({ candidateId }).get()

    expect(result.importedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(candidates.data[0]).toMatchObject({
      importedQuestionId: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      status: 'imported',
    })
    expect(storedQuestions.data).toHaveLength(1)
  })

  it('recovers expired importing claim to imported when matching question exists', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'expired-token',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      importClaimUntil: '2026-04-26T00:04:59.000Z',
      updatedAt: '2026-04-26T00:00:10.000Z',
    })
    const questionId = createQuestionId(candidateId, '2026-04-26T00:00:00.000Z')
    await db.collection('questions').add({
      data: {
        _id: questionId,
        ownerOpenid: 'user_a',
        materialId: 'material_1',
        candidateId,
        type: 'single',
        stem: '题目',
        options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
        answerKeys: ['A'],
        explanation: '',
        sourcePageNo: null,
        sourceCandidateUpdatedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-26T00:00:09.000Z',
        updatedAt: '2026-04-26T00:00:09.000Z',
      },
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:05:00.000Z' })
    const candidate = await db.collection('parse_candidates').doc(candidateId).get()

    expect(result.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: questionId,
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
  })

  it('recovers expired importing claim without a question and imports it in the same run', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'expired-token',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      importClaimUntil: '2026-04-26T00:04:59.000Z',
      updatedAt: '2026-04-26T00:00:10.000Z',
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:05:00.000Z' })
    const candidate = await db.collection('parse_candidates').doc(candidateId).get()
    const questions = await db.collection('questions').where({ candidateId }).get()

    expect(result.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
    expect(questions.data).toHaveLength(1)
  })

  it('recovers legacy importing claim without an expiry and imports it in the same run', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'legacy-token',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:10.000Z',
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:05:00.000Z' })
    const candidate = await db.collection('parse_candidates').doc(candidateId).get()
    const questions = await db.collection('questions').where({ candidateId }).get()

    expect(result.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
    expect(questions.data).toHaveLength(1)
  })

  it('recovers legacy importing claim without an expiry to imported when matching question exists', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      status: 'importing',
      importClaimToken: 'legacy-token',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:10.000Z',
    })
    const questionId = createQuestionId(candidateId, '2026-04-26T00:00:00.000Z')
    await db.collection('questions').add({
      data: {
        _id: questionId,
        ownerOpenid: 'user_a',
        materialId: 'material_1',
        candidateId,
        type: 'single',
        stem: '题目',
        options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
        answerKeys: ['A'],
        explanation: '',
        sourcePageNo: null,
        sourceCandidateUpdatedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-26T00:00:09.000Z',
        updatedAt: '2026-04-26T00:00:09.000Z',
      },
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:05:00.000Z' })
    const candidate = await db.collection('parse_candidates').doc(candidateId).get()

    expect(result.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: questionId,
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
  })

  it('rolls back an import claim when question creation fails', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const questions = db.collection('questions')
    const originalCollection = db.collection
    db.collection = (name) => (name === 'questions' ? questions : originalCollection(name))
    questions.add = async () => {
      const error = new Error('database unavailable')
      error.code = 'db_unavailable'
      throw error
    }

    await expect(confirmImport({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      now: '2026-04-26T00:00:10.000Z',
    })).rejects.toMatchObject({ code: 'db_unavailable' })

    const candidate = await db.collection('parse_candidates').doc(candidateId).get()
    expect(candidate.data[0]).toMatchObject({
      status: 'ready',
      importedQuestionId: '',
      importClaimToken: '',
      importSourceUpdatedAt: '',
    })
  })

  it('rolls back an import claim when final imported mark conflicts', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const candidates = db.collection('parse_candidates')
    const originalCollection = db.collection
    const originalWhere = candidates.where
    db.collection = (name) => (name === 'parse_candidates' ? candidates : originalCollection(name))
    candidates.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === candidateId && query.status === 'importing' && query.importedQuestionId === '') {
        return {
          ...base,
          async update({ data }) {
            if (data.status === 'imported') return { stats: { updated: 0 } }
            return base.update({ data })
          },
        }
      }
      return base
    }

    await expect(confirmImport({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      now: '2026-04-26T00:00:10.000Z',
    })).rejects.toMatchObject({ code: 'candidate_conflict' })

    const candidate = await db.collection('parse_candidates').doc(candidateId).get()
    const questions = await db.collection('questions').where({ candidateId }).get()
    expect(candidate.data[0]).toMatchObject({
      status: 'ready',
      importedQuestionId: '',
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
    expect(questions.data).toHaveLength(1)
  })

  it('recovers after final imported mark throws and the claim later expires', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db)
    const candidates = db.collection('parse_candidates')
    const originalCollection = db.collection
    const originalWhere = candidates.where
    let blockImportedMarks = true
    db.collection = (name) => (name === 'parse_candidates' ? candidates : originalCollection(name))
    candidates.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === candidateId && query.status === 'importing' && query.importedQuestionId === '') {
        return {
          ...base,
          async update({ data }) {
            if (data.status === 'imported' && blockImportedMarks) {
              const error = new Error('transient update failure')
              error.code = 'transient_update_failure'
              throw error
            }
            return base.update({ data })
          },
        }
      }
      return base
    }

    await expect(confirmImport({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      now: '2026-04-26T00:00:10.000Z',
    })).rejects.toMatchObject({ code: 'transient_update_failure' })

    const stuck = await db.collection('parse_candidates').doc(candidateId).get()
    expect(stuck.data[0]).toMatchObject({
      status: 'importing',
      importSourceUpdatedAt: '2026-04-26T00:00:00.000Z',
      importClaimUntil: '2026-04-26T00:05:10.000Z',
    })

    blockImportedMarks = false
    const recovered = await confirmImport({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      now: '2026-04-26T00:05:10.000Z',
    })
    const candidate = await db.collection('parse_candidates').doc(candidateId).get()

    expect(recovered.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
    })
  })

  it('imports edited candidate as a new version when older-version orphan question exists', async () => {
    const db = createFakeDb()
    const candidateId = await seedCandidate(db, {
      stem: 'new stem',
      updatedAt: '2026-04-26T00:00:20.000Z',
    })
    await db.collection('questions').add({
      data: {
        _id: createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
        ownerOpenid: 'user_a',
        materialId: 'material_1',
        candidateId,
        type: 'single',
        stem: 'old stem',
        options: [{ key: 'A', text: 'old' }],
        answerKeys: ['A'],
        explanation: '',
        sourcePageNo: null,
        sourceCandidateUpdatedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-26T00:00:09.000Z',
        updatedAt: '2026-04-26T00:00:09.000Z',
      },
    })

    const result = await confirmImport({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      now: '2026-04-26T00:00:30.000Z',
    })

    const candidate = await db.collection('parse_candidates').doc(candidateId).get()
    const questions = await db.collection('questions').where({ candidateId }).get()
    const newQuestionId = createQuestionId(candidateId, '2026-04-26T00:00:20.000Z')
    expect(result.importedCount).toBe(1)
    expect(candidate.data[0]).toMatchObject({
      status: 'imported',
      importedQuestionId: newQuestionId,
      importClaimToken: '',
      importSourceUpdatedAt: '',
    })
    expect(questions.data).toHaveLength(2)
    expect(questions.data.map((question) => question._id).sort()).toEqual([
      createQuestionId(candidateId, '2026-04-26T00:00:00.000Z'),
      newQuestionId,
    ].sort())
  })
})
