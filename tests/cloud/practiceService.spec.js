const { createFakeDb } = require('./fakeDb')
const { sharedModule } = require('./sharedModules')
const {
  answerSubmit,
  createPractice,
  getPracticeDetail,
  listQuestions,
} = sharedModule('services/practiceService')

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
      status: 'ready',
      parseMode: 'inline_answer',
      questionCount: 1,
      readyCandidateCount: 0,
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

describe('practice service', () => {
  it('lists only current user questions', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    await seedQuestion(db, { ownerOpenid: 'user_b' })

    const questions = await listQuestions({ db, openid: 'user_a', materialId: 'material_1' })

    expect(questions).toHaveLength(1)
    expect(questions[0].answerKeys).toBeUndefined()
    expect(questions[0].explanation).toBeUndefined()
  })

  it('creates practice session and hides answers and explanations in detail', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })
    const detail = await getPracticeDetail({ db, openid: 'user_a', sessionId: session._id })

    expect(detail.questions).toHaveLength(1)
    expect(detail.questions[0].answerKeys).toBeUndefined()
    expect(detail.questions[0].explanation).toBeUndefined()
  })

  it('grades answer on backend and stores attempt', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })

    const result = await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['A'],
      now: '2026-04-26T00:00:02.000Z',
    })

    expect(result.isCorrect).toBe(true)
    expect(result.answerKeys).toEqual(['A'])
    expect(result.explanation).toBe('解析')
  })

  it('keeps the original attempt when the same practice answer is resubmitted', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['B'],
      now: '2026-04-26T00:00:02.000Z',
    })
    const result = await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['A'],
      now: '2026-04-26T00:00:03.000Z',
    })

    const attempts = await db.collection('attempts').where({ ownerOpenid: 'user_a', sessionId: session._id }).get()
    const updatedSession = await db.collection('practice_sessions').doc(session._id).get()
    expect(result.isCorrect).toBe(false)
    expect(result.selectedKeys).toEqual(['B'])
    expect(attempts.data).toHaveLength(1)
    expect(attempts.data[0]).toMatchObject({ selectedKeys: ['B'], isCorrect: false })
    expect(updatedSession.data[0].correctCount).toBe(0)
  })

  it('creates a wrong question when an answer is incorrect', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-30T00:00:01.000Z',
    })

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['B'],
      now: '2026-04-30T00:00:02.000Z',
    })

    const wrongRows = await db.collection('wrong_questions').where({
      ownerOpenid: 'user_a',
      questionId: session.questionIds[0],
    }).get()
    expect(wrongRows.data).toHaveLength(1)
    expect(wrongRows.data[0]).toMatchObject({
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
    })
  })

  it('does not increment wrong count when the same practice answer is resubmitted', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-30T00:00:01.000Z',
    })

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['B'],
      now: '2026-04-30T00:00:02.000Z',
    })
    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['B'],
      now: '2026-04-30T00:00:03.000Z',
    })

    const wrongRows = await db.collection('wrong_questions').where({
      ownerOpenid: 'user_a',
      questionId: session.questionIds[0],
    }).get()
    expect(wrongRows.data).toHaveLength(1)
    expect(wrongRows.data[0]).toMatchObject({
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastAttemptId: `attempt_${session._id}_${session.questionIds[0]}`,
    })
  })

  it('records wrong tracking when retrying after an attempt was saved without a wrong record', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-30T00:00:01.000Z',
    })
    const questionId = session.questionIds[0]
    const attemptId = `attempt_${session._id}_${questionId}`
    await db.collection('attempts').add({
      data: {
        _id: attemptId,
        ownerOpenid: 'user_a',
        sessionId: session._id,
        questionId,
        selectedKeys: ['B'],
        isCorrect: false,
        createdAt: '2026-04-30T00:00:02.000Z',
        updatedAt: '2026-04-30T00:00:02.000Z',
      },
    })

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId,
      selectedKeys: ['B'],
      now: '2026-04-30T00:00:03.000Z',
    })

    const wrongRows = await db.collection('wrong_questions').where({
      ownerOpenid: 'user_a',
      questionId,
    }).get()
    expect(wrongRows.data).toHaveLength(1)
    expect(wrongRows.data[0]).toMatchObject({
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastAttemptId: attemptId,
    })
  })

  it('marks a wrong question mastered after three later correct practice submissions', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const firstSession = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-30T00:00:01.000Z',
    })
    const questionId = firstSession.questionIds[0]

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: firstSession._id,
      questionId,
      selectedKeys: ['B'],
      now: '2026-04-30T00:00:02.000Z',
    })

    const correctAttempts = [
      ['2026-04-30T00:00:03.000Z', '2026-04-30T00:00:04.000Z'],
      ['2026-04-30T00:00:05.000Z', '2026-04-30T00:00:06.000Z'],
      ['2026-04-30T00:00:07.000Z', '2026-04-30T00:00:08.000Z'],
    ]
    for (const [startedAt, submittedAt] of correctAttempts) {
      const session = await createPractice({
        db,
        openid: 'user_a',
        materialId: 'material_1',
        count: 5,
        now: startedAt,
      })
      await answerSubmit({
        db,
        openid: 'user_a',
        sessionId: session._id,
        questionId,
        selectedKeys: ['A'],
        now: submittedAt,
      })
    }

    const wrongRows = await db.collection('wrong_questions').where({
      ownerOpenid: 'user_a',
      questionId,
    }).get()
    expect(wrongRows.data).toHaveLength(1)
    expect(wrongRows.data[0]).toMatchObject({
      status: 'mastered',
      wrongCount: 1,
      correctStreak: 3,
      masteredAt: '2026-04-30T00:00:08.000Z',
    })
  })

  it('keeps one attempt when the same answer is submitted concurrently', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db)
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })

    await Promise.all([
      answerSubmit({
        db,
        openid: 'user_a',
        sessionId: session._id,
        questionId: session.questionIds[0],
        selectedKeys: ['A'],
        now: '2026-04-26T00:00:02.000Z',
      }),
      answerSubmit({
        db,
        openid: 'user_a',
        sessionId: session._id,
        questionId: session.questionIds[0],
        selectedKeys: ['A'],
        now: '2026-04-26T00:00:02.000Z',
      }),
    ])

    const attempts = await db.collection('attempts').where({ ownerOpenid: 'user_a', sessionId: session._id }).get()
    const updatedSession = await db.collection('practice_sessions').doc(session._id).get()
    expect(attempts.data).toHaveLength(1)
    expect(updatedSession.data[0].correctCount).toBe(1)
  })

  it('preserves submittedAt and score after a completed practice is resubmitted', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 2 })
    await seedQuestion(db, { candidateId: 'candidate_1', answerKeys: ['A'] })
    await seedQuestion(db, { candidateId: 'candidate_2', stem: '题目 2', answerKeys: ['B'] })
    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })

    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['A'],
      now: '2026-04-26T00:00:02.000Z',
    })
    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[1],
      selectedKeys: ['B'],
      now: '2026-04-26T00:00:03.000Z',
    })
    await answerSubmit({
      db,
      openid: 'user_a',
      sessionId: session._id,
      questionId: session.questionIds[0],
      selectedKeys: ['B'],
      now: '2026-04-26T00:00:04.000Z',
    })

    const updatedSession = await db.collection('practice_sessions').doc(session._id).get()
    expect(updatedSession.data[0]).toMatchObject({
      correctCount: 2,
      status: 'submitted',
      submittedAt: '2026-04-26T00:00:03.000Z',
    })
  })

  it('returns coded localized errors for invalid practice operations', async () => {
    const db = createFakeDb()
    await seedMaterial(db)

    await expect(createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })).rejects.toMatchObject({ code: 'practice_no_questions', message: '没有可练习题目' })

    await expect(getPracticeDetail({ db, openid: 'user_a' }))
      .rejects.toMatchObject({ code: 'missing_session_id', message: '缺少练习 ID' })
  })

  it('blocks question listing and practice creation for a material that is not ready', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { status: 'reviewing', questionCount: 1 })
    await seedQuestion(db)

    await expect(listQuestions({
      db,
      openid: 'user_a',
      materialId: 'material_1',
    })).rejects.toMatchObject({ code: 'practice_not_ready' })

    await expect(createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 5,
      now: '2026-04-26T00:00:01.000Z',
    })).rejects.toMatchObject({ code: 'practice_not_ready' })
  })
})
