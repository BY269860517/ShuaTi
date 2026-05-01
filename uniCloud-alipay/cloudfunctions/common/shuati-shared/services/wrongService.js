function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function createWrongQuestionId(questionId) {
  return `wrong_${questionId}`
}

function hideAnswer(question) {
  const { answerKeys, explanation, ...safeQuestion } = question
  return safeQuestion
}

function normalizePracticeCount(count) {
  const value = Number(count || 10)
  if (!Number.isFinite(value)) return 10
  return Math.max(1, value)
}

async function getQuestionForOwner({ db, openid, questionId }) {
  const result = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
  const question = result.data[0]
  if (!question) throw createError('question_not_found', '题目不存在')
  return question
}

async function getWrongQuestionForOwner({ db, openid, wrongQuestionId }) {
  const result = await db.collection('wrong_questions').where({ _id: wrongQuestionId, ownerOpenid: openid }).get()
  return result.data[0] || null
}

async function recordWrongQuestionResult({ db, openid, questionId, isCorrect, now, attemptId }) {
  const question = await getQuestionForOwner({ db, openid, questionId })
  const wrongQuestions = db.collection('wrong_questions')
  const wrongQuestionId = createWrongQuestionId(questionId)
  const existing = await getWrongQuestionForOwner({ db, openid, wrongQuestionId })

  if (!existing && isCorrect) return null
  if (attemptId && existing && existing.lastAttemptId === attemptId) return existing

  if (!existing) {
    const data = {
      _id: wrongQuestionId,
      ownerOpenid: openid,
      questionId,
      materialId: question.materialId || '',
      status: 'active',
      wrongCount: 1,
      correctStreak: 0,
      lastWrongAt: now,
      lastAttemptId: attemptId || '',
      masteredAt: '',
      ignoredAt: '',
      createdAt: now,
      updatedAt: now,
    }
    try {
      const created = await wrongQuestions.add({ data })
      return { ...data, _id: created._id }
    } catch (error) {
      if (error.code !== 'duplicate_key') throw error
      const raced = await getWrongQuestionForOwner({ db, openid, wrongQuestionId })
      if (raced) return raced
      throw error
    }
  }

  const nextData = isCorrect
    ? {
        correctStreak: Number(existing.correctStreak || 0) + 1,
        lastAttemptId: attemptId || '',
        updatedAt: now,
      }
    : {
        status: 'active',
        wrongCount: Number(existing.wrongCount || 0) + 1,
        correctStreak: 0,
        lastWrongAt: now,
        lastAttemptId: attemptId || '',
        masteredAt: '',
        updatedAt: now,
      }

  if (isCorrect && nextData.correctStreak >= 3) {
    nextData.status = 'mastered'
    nextData.masteredAt = existing.masteredAt || now
  }

  await wrongQuestions.doc(existing._id).update({ data: nextData })
  return { ...existing, ...nextData }
}

async function listWrongQuestions({ db, openid, materialId, status = 'active' }) {
  const query = { ownerOpenid: openid, status }
  if (materialId) query.materialId = materialId

  const result = await db.collection('wrong_questions').where(query).orderBy('lastWrongAt', 'desc').get()
  const rows = []
  for (const wrongQuestion of result.data) {
    const questionResult = await db.collection('questions').where({
      _id: wrongQuestion.questionId,
      ownerOpenid: openid,
    }).get()
    const question = questionResult.data[0]
    if (question) rows.push({ ...wrongQuestion, question: hideAnswer(question) })
  }
  return rows
}

async function createWrongPractice({ db, openid, materialId, count, now }) {
  const wrongQuestions = await listWrongQuestions({ db, openid, materialId, status: 'active' })
  const limit = normalizePracticeCount(count)
  const selected = wrongQuestions.slice(0, limit)
  if (selected.length === 0) throw createError('wrong_no_questions', '暂无可练习错题')

  const data = {
    ownerOpenid: openid,
    materialId: materialId || '',
    mode: 'wrong',
    questionIds: selected.map((wrongQuestion) => wrongQuestion.questionId),
    status: 'active',
    totalCount: selected.length,
    correctCount: 0,
    startedAt: now,
    submittedAt: '',
    createdAt: now,
    updatedAt: now,
  }
  const created = await db.collection('practice_sessions').add({ data })
  return { _id: created._id, ...data }
}

async function markWrongQuestionMastered({ db, openid, wrongQuestionId, now }) {
  const wrongQuestion = await getWrongQuestionForOwner({ db, openid, wrongQuestionId })
  if (!wrongQuestion) throw createError('wrong_not_found', '错题不存在')

  const data = {
    status: 'mastered',
    masteredAt: wrongQuestion.masteredAt || now,
    updatedAt: now,
  }
  await db.collection('wrong_questions').doc(wrongQuestion._id).update({ data })
  return { ...wrongQuestion, ...data }
}

module.exports = {
  createWrongPractice,
  listWrongQuestions,
  markWrongQuestionMastered,
  recordWrongQuestionResult,
}
