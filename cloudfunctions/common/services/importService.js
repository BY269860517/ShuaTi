const { assertRequired } = require('../response')
const { listCandidates } = require('./candidateService')

function createQuestionId(candidateId) {
  return `question_${candidateId}`
}

async function markCandidateImported({ db, candidateId, questionId, now }) {
  await db.collection('parse_candidates').doc(candidateId).update({
    data: {
      importedQuestionId: questionId,
      status: 'imported',
      updatedAt: now,
    },
  })
}

async function recoverDuplicateQuestion({ db, openid, materialId, candidateId, now }) {
  const questionId = createQuestionId(candidateId)
  const existing = await db.collection('questions').where({
    _id: questionId,
    ownerOpenid: openid,
    materialId,
    candidateId,
  }).get()
  if (!existing.data[0]) return false

  await markCandidateImported({ db, candidateId, questionId, now })
  return true
}

async function confirmImport({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少导入时间')

  const candidates = await listCandidates({ db, openid, materialId })
  const ready = candidates.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId)
  let importedCount = 0

  for (const candidate of ready) {
    const questionId = createQuestionId(candidate._id)
    const questionData = {
      _id: questionId,
      ownerOpenid: openid,
      materialId,
      candidateId: candidate._id,
      type: candidate.type,
      stem: candidate.stem,
      options: candidate.options,
      answerKeys: candidate.answerKeys,
      explanation: candidate.explanation || '',
      sourcePageNo: candidate.sourcePageNo || null,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await db.collection('questions').add({ data: questionData })
    } catch (error) {
      if (error.code !== 'duplicate_key') throw error
      const recovered = await recoverDuplicateQuestion({ db, openid, materialId, candidateId: candidate._id, now })
      if (recovered) continue
      throw error
    }

    await markCandidateImported({ db, candidateId: candidate._id, questionId, now })
    importedCount += 1
  }

  return { importedCount, skippedCount: candidates.length - importedCount }
}

module.exports = {
  confirmImport,
  createQuestionId,
}
