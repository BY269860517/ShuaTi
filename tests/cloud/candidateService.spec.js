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

  it('imports ready candidates once', async () => {
    const db = createFakeDb()
    await seedCandidate(db)

    const first = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:10.000Z' })
    const second = await confirmImport({ db, openid: 'user_a', materialId: 'material_1', now: '2026-04-26T00:00:11.000Z' })

    expect(first.importedCount).toBe(1)
    expect(second.importedCount).toBe(0)
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
})
