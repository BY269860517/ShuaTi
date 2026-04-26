const { createFakeDb } = require('./fakeDb')
const { updateCandidate, listCandidates } = require('../../cloudfunctions/common/services/candidateService')
const { confirmImport } = require('../../cloudfunctions/common/services/importService')

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

describe('candidate service', () => {
  it('lists only current user candidates for a material', async () => {
    const db = createFakeDb()
    await seedCandidate(db)
    await seedCandidate(db, { ownerOpenid: 'user_b' })

    const result = await listCandidates({ db, openid: 'user_a', materialId: 'material_1' })

    expect(result).toHaveLength(1)
    expect(result[0].ownerOpenid).toBe('user_a')
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

    await expect(listCandidates({ db, openid: 'user_a' })).rejects.toMatchObject({ code: 'missing_material_id' })
    await expect(confirmImport({ db, openid: 'user_a', now: '2026-04-26T00:00:10.000Z' })).rejects.toMatchObject({ code: 'missing_material_id' })
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
        _id: `question_${candidateId}`,
        ownerOpenid: 'user_a',
        materialId: 'material_1',
        candidateId,
        type: 'single',
        stem: '题目',
        options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
        answerKeys: ['A'],
        explanation: '',
        sourcePageNo: null,
        createdAt: '2026-04-26T00:00:09.000Z',
        updatedAt: '2026-04-26T00:00:09.000Z',
      },
    })

    const result = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const candidates = await db.collection('parse_candidates').where({ ownerOpenid: 'user_a', materialId: 'material_1' }).get()
    const questions = await db.collection('questions').where({ ownerOpenid: 'user_a', materialId: 'material_1' }).get()

    expect(result.importedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(candidates.data[0]).toMatchObject({
      importedQuestionId: `question_${candidateId}`,
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

    expect(result.importedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(candidates.data[0]).toMatchObject({
      importedQuestionId: `question_${candidateId}`,
      status: 'imported',
    })
    expect(storedQuestions.data).toHaveLength(1)
  })
})
