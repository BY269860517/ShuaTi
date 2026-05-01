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

  it('creates all sequence practice ordered by question number and stores settings', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q10', candidateId: 'candidate_10', questionNo: '10' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'sequence',
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q2', 'q10'])
    expect(session).toMatchObject({
      countMode: 'all',
      orderMode: 'sequence',
      scope: 'all',
      questionType: 'all',
    })
  })

  it('keeps legacy count calls on fixed sequence all settings', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', candidateId: 'candidate_3', questionNo: '3' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      count: 2,
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q2'])
    expect(session).toMatchObject({
      countMode: 'fixed',
      requestedCount: 2,
      orderMode: 'sequence',
      scope: 'all',
      questionType: 'all',
    })
  })

  it('creates custom practice using requestedCount for selection and session settings', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', candidateId: 'candidate_3', questionNo: '3' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'custom',
      requestedCount: 2,
      count: 3,
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q2'])
    expect(session.requestedCount).toBe(2)
    expect(session.countMode).toBe('custom')
  })

  it('falls back to ten when count inputs are invalid', async () => {
    const countDb = createFakeDb()
    await seedMaterial(countDb, { questionCount: 2 })
    await seedQuestion(countDb, { _id: 'count_q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(countDb, { _id: 'count_q2', candidateId: 'candidate_2', questionNo: '2' })

    const countSession = await createPractice({
      db: countDb,
      openid: 'user_a',
      materialId: 'material_1',
      count: 'abc',
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(countSession.requestedCount).toBe(10)
    expect(countSession.totalCount).toBe(2)

    const requestedDb = createFakeDb()
    await seedMaterial(requestedDb, { questionCount: 2 })
    await seedQuestion(requestedDb, { _id: 'requested_q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(requestedDb, { _id: 'requested_q2', candidateId: 'candidate_2', questionNo: '2' })

    const requestedSession = await createPractice({
      db: requestedDb,
      openid: 'user_a',
      materialId: 'material_1',
      requestedCount: 'bad',
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(requestedSession.requestedCount).toBe(10)
    expect(requestedSession.totalCount).toBe(2)
  })

  it('falls back to count when requestedCount is invalid', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', candidateId: 'candidate_3', questionNo: '3' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      requestedCount: 'bad',
      count: 2,
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.requestedCount).toBe(2)
    expect(session.questionIds).toEqual(['q1', 'q2'])
  })

  it('orders sequence practice with stable non-numeric question number tie breakers', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 4 })
    await seedQuestion(db, {
      _id: 'q_x_later',
      candidateId: 'candidate_1',
      questionNo: 'X',
      createdAt: '2026-04-26T00:00:03.000Z',
    })
    await seedQuestion(db, {
      _id: 'q_a',
      candidateId: 'candidate_2',
      questionNo: 'A',
      createdAt: '2026-04-26T00:00:02.000Z',
    })
    await seedQuestion(db, {
      _id: 'q_x_b',
      candidateId: 'candidate_3',
      questionNo: 'X',
      createdAt: '2026-04-26T00:00:01.000Z',
    })
    await seedQuestion(db, {
      _id: 'q_x_a',
      candidateId: 'candidate_4',
      questionNo: 'X',
      createdAt: '2026-04-26T00:00:01.000Z',
    })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'sequence',
      now: '2026-04-26T00:00:04.000Z',
    })

    expect(session.questionIds).toEqual(['q_a', 'q_x_a', 'q_x_b', 'q_x_later'])
  })

  it('creates custom practice filtered by multiple question type', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'single_1', candidateId: 'candidate_1', questionNo: '1', type: 'single' })
    await seedQuestion(db, { _id: 'multiple_1', candidateId: 'candidate_2', questionNo: '2', type: 'multiple' })
    await seedQuestion(db, { _id: 'multiple_2', candidateId: 'candidate_3', questionNo: '3', type: 'multiple' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      questionType: 'multiple',
      countMode: 'custom',
      count: 1,
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['multiple_1'])
    expect(session.requestedCount).toBe(1)
    expect(session.questionType).toBe('multiple')
    expect(session.countMode).toBe('custom')
  })

  it('creates unattempted practice excluding attempted questions', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', candidateId: 'candidate_3', questionNo: '3' })
    await db.collection('attempts').add({
      data: {
        _id: 'attempt_old_q2',
        ownerOpenid: 'user_a',
        sessionId: 'old_session',
        questionId: 'q2',
        selectedKeys: ['A'],
        isCorrect: true,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      scope: 'unattempted',
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q3'])
    expect(session.scope).toBe('unattempted')
  })

  it('does not exclude unattempted questions attempted only by another user', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 2 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await db.collection('attempts').add({
      data: {
        _id: 'attempt_other_q1',
        ownerOpenid: 'user_b',
        sessionId: 'other_session',
        questionId: 'q1',
        selectedKeys: ['A'],
        isCorrect: true,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      scope: 'unattempted',
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q1', 'q2'])
  })

  it('creates random practice with injectable random function', async () => {
    const db = createFakeDb()
    await seedMaterial(db, { questionCount: 3 })
    await seedQuestion(db, { _id: 'q1', candidateId: 'candidate_1', questionNo: '1' })
    await seedQuestion(db, { _id: 'q2', candidateId: 'candidate_2', questionNo: '2' })
    await seedQuestion(db, { _id: 'q3', candidateId: 'candidate_3', questionNo: '3' })

    const session = await createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      countMode: 'all',
      orderMode: 'random',
      random: () => 0,
      now: '2026-04-26T00:00:01.000Z',
    })

    expect(session.questionIds).toEqual(['q2', 'q3', 'q1'])
  })

  it('throws a specific error when unattempted practice has no remaining questions', async () => {
    const db = createFakeDb()
    await seedMaterial(db)
    await seedQuestion(db, { _id: 'q1' })
    await db.collection('attempts').add({
      data: {
        _id: 'attempt_old_q1',
        ownerOpenid: 'user_a',
        sessionId: 'old_session',
        questionId: 'q1',
        selectedKeys: ['A'],
        isCorrect: true,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    })

    await expect(createPractice({
      db,
      openid: 'user_a',
      materialId: 'material_1',
      scope: 'unattempted',
      now: '2026-04-26T00:00:01.000Z',
    })).rejects.toMatchObject({
      code: 'practice_no_unattempted_questions',
      message: '没有未练习题目',
    })
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
