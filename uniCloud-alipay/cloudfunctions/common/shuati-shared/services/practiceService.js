const { assertRequired } = require('../response')
const { getMaterialForOwner } = require('./materialService')
const { recordWrongQuestionResult } = require('./wrongService')

function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function hideAnswer(question) {
  const { answerKeys, explanation, ...safeQuestion } = question
  return safeQuestion
}

function normalizeSelected(keys) {
  return Array.from(new Set((keys || []).map((key) => String(key).toUpperCase()))).sort()
}

function sameKeys(a, b) {
  return normalizeSelected(a).join('|') === normalizeSelected(b).join('|')
}

function questionQuery(openid, materialId) {
  return materialId ? { ownerOpenid: openid, materialId } : { ownerOpenid: openid }
}

function createAttemptId(sessionId, questionId) {
  return `attempt_${sessionId}_${questionId}`
}

async function assertMaterialReadyForPractice({ db, openid, materialId }) {
  if (!materialId) return

  const material = await getMaterialForOwner({ db, openid, materialId })
  if (material.status === 'ready' && Number(material.questionCount || 0) > 0) return
  throw createError('practice_not_ready', '题目尚未完成导入')
}

async function listQuestions({ db, openid, materialId }) {
  await assertMaterialReadyForPractice({ db, openid, materialId })

  const result = await db.collection('questions').where(questionQuery(openid, materialId)).get()
  return result.data.map(hideAnswer)
}

async function createPractice({ db, openid, materialId, count, now }) {
  assertRequired(now, 'missing_timestamp', '缺少创建时间')

  await assertMaterialReadyForPractice({ db, openid, materialId })

  const result = await db.collection('questions').where(questionQuery(openid, materialId)).get()
  const limit = Math.max(1, Number(count || 10))
  const selected = result.data.slice(0, limit)
  if (selected.length === 0) throw createError('practice_no_questions', '没有可练习题目')

  const data = {
    ownerOpenid: openid,
    materialId: materialId || '',
    mode: 'material',
    questionIds: selected.map((question) => question._id),
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

async function getPracticeSession({ db, openid, sessionId }) {
  assertRequired(sessionId, 'missing_session_id', '缺少练习 ID')

  const result = await db.collection('practice_sessions').where({ _id: sessionId, ownerOpenid: openid }).get()
  const session = result.data[0]
  if (!session) throw createError('practice_not_found', '练习不存在')
  return session
}

async function getPracticeDetail({ db, openid, sessionId }) {
  const session = await getPracticeSession({ db, openid, sessionId })
  const questions = []
  for (const questionId of session.questionIds) {
    const result = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
    if (result.data[0]) questions.push(hideAnswer(result.data[0]))
  }

  return { session, questions }
}

async function upsertAttempt({ db, openid, sessionId, questionId, selectedKeys, isCorrect, now }) {
  const attempts = db.collection('attempts')
  const attemptId = createAttemptId(sessionId, questionId)
  const data = {
    _id: attemptId,
    ownerOpenid: openid,
    sessionId,
    questionId,
    selectedKeys,
    isCorrect,
    createdAt: now,
    updatedAt: now,
  }
  const existing = await attempts.where({ _id: attemptId, ownerOpenid: openid }).get()
  if (existing.data[0]) {
    return { attempt: existing.data[0], created: false }
  }

  try {
    const created = await attempts.add({ data })
    return { attempt: { ...data, _id: created._id }, created: true }
  } catch (error) {
    if (error.code !== 'duplicate_key') throw error
    const raced = await attempts.where({ _id: attemptId, ownerOpenid: openid }).get()
    return { attempt: raced.data[0] || data, created: false }
  }
}

async function answerSubmit({ db, openid, sessionId, questionId, selectedKeys, now }) {
  assertRequired(now, 'missing_timestamp', '缺少提交时间')
  assertRequired(questionId, 'missing_question_id', '缺少题目 ID')

  const session = await getPracticeSession({ db, openid, sessionId })
  if (!session.questionIds.includes(questionId)) throw createError('question_not_in_practice', '题目不属于本次练习')

  const questionResult = await db.collection('questions').where({ _id: questionId, ownerOpenid: openid }).get()
  const question = questionResult.data[0]
  if (!question) throw createError('question_not_found', '题目不存在')

  const normalizedSelected = normalizeSelected(selectedKeys)
  const isCorrect = sameKeys(normalizedSelected, question.answerKeys)
  const { attempt } = await upsertAttempt({
    db,
    openid,
    sessionId,
    questionId,
    selectedKeys: normalizedSelected,
    isCorrect,
    now,
  })
  await recordWrongQuestionResult({
    db,
    openid,
    questionId,
    isCorrect: attempt.isCorrect,
    now,
    attemptId: attempt._id,
  })

  const attempts = await db.collection('attempts').where({ ownerOpenid: openid, sessionId }).get()
  const correctCount = attempts.data.filter((attempt) => attempt.isCorrect).length
  const submitted = attempts.data.length >= session.totalCount
  const submittedAt = submitted ? (session.submittedAt || now) : ''
  await db.collection('practice_sessions').doc(sessionId).update({
    data: {
      correctCount,
      status: submitted ? 'submitted' : 'active',
      submittedAt,
      updatedAt: now,
    },
  })

  return {
    questionId,
    selectedKeys: attempt.selectedKeys,
    isCorrect: attempt.isCorrect,
    answerKeys: question.answerKeys,
    explanation: question.explanation || '',
  }
}

module.exports = {
  answerSubmit,
  createPractice,
  getPracticeDetail,
  listQuestions,
}
