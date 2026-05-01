const { createFakeDb } = require('./fakeDb')
const { sharedModule } = require('./sharedModules')
const {
  createWrongPractice,
  listWrongQuestions,
  markWrongQuestionMastered,
  recordWrongQuestionResult,
} = sharedModule('services/wrongService')

async function seedQuestion(db, overrides = {}) {
  const result = await db.collection('questions').add({
    data: {
      ownerOpenid: 'user_a',
      materialId: 'material_1',
      candidateId: 'candidate_1',
      type: 'single',
      stem: '题目',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answerKeys: ['A'],
      explanation: '解析',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
      ...overrides,
    },
  })
  return result._id
}

describe('wrong question service', () => {
  it('creates an active wrong question when answer is incorrect', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)

    const wrong = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    expect(wrong).toMatchObject({
      _id: `wrong_${questionId}`,
      ownerOpenid: 'user_a',
      questionId,
      materialId: 'material_1',
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastWrongAt: '2026-04-30T00:00:01.000Z',
      masteredAt: '',
      ignoredAt: '',
      createdAt: '2026-04-30T00:00:01.000Z',
      updatedAt: '2026-04-30T00:00:01.000Z',
    })
  })

  it('updates the same record for repeated wrong results', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    const wrong = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:02.000Z',
    })
    const records = await db.collection('wrong_questions').where({ ownerOpenid: 'user_a', questionId }).get()

    expect(records.data).toHaveLength(1)
    expect(wrong).toMatchObject({
      _id: `wrong_${questionId}`,
      status: 'active',
      wrongCount: 2,
      correctStreak: 0,
      lastWrongAt: '2026-04-30T00:00:02.000Z',
      updatedAt: '2026-04-30T00:00:02.000Z',
    })
  })

  it('does not increment wrong count twice for the same attempt id', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
      attemptId: 'attempt_1',
    })

    const wrong = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:02.000Z',
      attemptId: 'attempt_1',
    })

    expect(wrong).toMatchObject({
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastAttemptId: 'attempt_1',
      lastWrongAt: '2026-04-30T00:00:01.000Z',
    })
  })

  it('does not increment correct streak twice for the same attempt id', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
      attemptId: 'attempt_wrong',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: true,
      now: '2026-04-30T00:00:02.000Z',
      attemptId: 'attempt_correct',
    })

    const wrong = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: true,
      now: '2026-04-30T00:00:03.000Z',
      attemptId: 'attempt_correct',
    })

    expect(wrong).toMatchObject({
      status: 'active',
      wrongCount: 1,
      correctStreak: 1,
      lastAttemptId: 'attempt_correct',
      updatedAt: '2026-04-30T00:00:02.000Z',
    })
  })

  it('marks wrong question mastered after three correct results', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: true,
      now: '2026-04-30T00:00:02.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: true,
      now: '2026-04-30T00:00:03.000Z',
    })
    const mastered = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: true,
      now: '2026-04-30T00:00:04.000Z',
    })

    expect(mastered).toMatchObject({
      status: 'mastered',
      correctStreak: 3,
      masteredAt: '2026-04-30T00:00:04.000Z',
      updatedAt: '2026-04-30T00:00:04.000Z',
    })
  })

  it('reactivates a mastered wrong question after a later wrong answer', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })
    await markWrongQuestionMastered({
      db,
      openid: 'user_a',
      wrongQuestionId: `wrong_${questionId}`,
      now: '2026-04-30T00:00:02.000Z',
    })

    const reactivated = await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:03.000Z',
    })

    expect(reactivated).toMatchObject({
      status: 'active',
      wrongCount: 2,
      correctStreak: 0,
      lastWrongAt: '2026-04-30T00:00:03.000Z',
      masteredAt: '',
      updatedAt: '2026-04-30T00:00:03.000Z',
    })
  })

  it('recovers from duplicate first wrong question creation races', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)

    const results = await Promise.all([
      recordWrongQuestionResult({
        db,
        openid: 'user_a',
        questionId,
        isCorrect: false,
        now: '2026-04-30T00:00:01.000Z',
      }),
      recordWrongQuestionResult({
        db,
        openid: 'user_a',
        questionId,
        isCorrect: false,
        now: '2026-04-30T00:00:01.000Z',
      }),
    ])
    const records = await db.collection('wrong_questions').where({ ownerOpenid: 'user_a', questionId }).get()

    expect(results.map((wrongQuestion) => wrongQuestion._id)).toEqual([`wrong_${questionId}`, `wrong_${questionId}`])
    expect(records.data).toHaveLength(1)
    expect(records.data[0].wrongCount).toBe(1)
  })

  it('lists only current user active wrong questions and hides nested answers', async () => {
    const db = createFakeDb()
    const ownQuestionId = await seedQuestion(db, { stem: '当前用户错题' })
    const otherQuestionId = await seedQuestion(db, { ownerOpenid: 'user_b', stem: '其他用户错题' })
    const masteredQuestionId = await seedQuestion(db, { stem: '已掌握错题' })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: ownQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:03.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_b',
      questionId: otherQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:04.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: masteredQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })
    await markWrongQuestionMastered({
      db,
      openid: 'user_a',
      wrongQuestionId: `wrong_${masteredQuestionId}`,
      now: '2026-04-30T00:00:02.000Z',
    })

    const wrongQuestions = await listWrongQuestions({ db, openid: 'user_a' })

    expect(wrongQuestions).toHaveLength(1)
    expect(wrongQuestions[0].questionId).toBe(ownQuestionId)
    expect(wrongQuestions[0].question).toMatchObject({ stem: '当前用户错题' })
    expect(wrongQuestions[0].question.answerKeys).toBeUndefined()
    expect(wrongQuestions[0].question.explanation).toBeUndefined()
  })

  it('creates a wrong practice session from active wrong questions', async () => {
    const db = createFakeDb()
    const firstQuestionId = await seedQuestion(db, { stem: '题目 1' })
    const secondQuestionId = await seedQuestion(db, { stem: '题目 2' })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: firstQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: secondQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:02.000Z',
    })

    const session = await createWrongPractice({
      db,
      openid: 'user_a',
      count: 1,
      now: '2026-04-30T00:00:03.000Z',
    })

    expect(session).toMatchObject({
      ownerOpenid: 'user_a',
      materialId: '',
      mode: 'wrong',
      questionIds: [secondQuestionId],
      status: 'active',
      totalCount: 1,
      correctCount: 0,
      startedAt: '2026-04-30T00:00:03.000Z',
      submittedAt: '',
      createdAt: '2026-04-30T00:00:03.000Z',
      updatedAt: '2026-04-30T00:00:03.000Z',
    })
  })

  it('defaults invalid wrong practice count to 10', async () => {
    const db = createFakeDb()
    const firstQuestionId = await seedQuestion(db, { stem: '棰樼洰 1' })
    const secondQuestionId = await seedQuestion(db, { stem: '棰樼洰 2' })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: firstQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId: secondQuestionId,
      isCorrect: false,
      now: '2026-04-30T00:00:02.000Z',
    })

    const session = await createWrongPractice({
      db,
      openid: 'user_a',
      count: 'abc',
      now: '2026-04-30T00:00:03.000Z',
    })

    expect(session).toMatchObject({
      mode: 'wrong',
      questionIds: [secondQuestionId, firstQuestionId],
      totalCount: 2,
      correctCount: 0,
      status: 'active',
    })
  })

  it('throws when creating wrong practice without active questions', async () => {
    const db = createFakeDb()

    await expect(createWrongPractice({
      db,
      openid: 'user_a',
      now: '2026-04-30T00:00:01.000Z',
    })).rejects.toMatchObject({ code: 'wrong_no_questions', message: '暂无可练习错题' })
  })

  it('marks an owned wrong question mastered', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    const mastered = await markWrongQuestionMastered({
      db,
      openid: 'user_a',
      wrongQuestionId: `wrong_${questionId}`,
      now: '2026-04-30T00:00:02.000Z',
    })

    expect(mastered).toMatchObject({
      _id: `wrong_${questionId}`,
      ownerOpenid: 'user_a',
      status: 'mastered',
      masteredAt: '2026-04-30T00:00:02.000Z',
      updatedAt: '2026-04-30T00:00:02.000Z',
    })
  })

  it('throws question_not_found when recording another user question', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db, { ownerOpenid: 'user_b' })

    await expect(recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })).rejects.toMatchObject({ code: 'question_not_found' })
  })

  it('throws wrong_not_found when non-owner marks mastered', async () => {
    const db = createFakeDb()
    const questionId = await seedQuestion(db)
    await recordWrongQuestionResult({
      db,
      openid: 'user_a',
      questionId,
      isCorrect: false,
      now: '2026-04-30T00:00:01.000Z',
    })

    await expect(markWrongQuestionMastered({
      db,
      openid: 'user_b',
      wrongQuestionId: `wrong_${questionId}`,
      now: '2026-04-30T00:00:02.000Z',
    })).rejects.toMatchObject({ code: 'wrong_not_found' })
  })
})
