const { assertRequired } = require('../response')
const { listCandidates } = require('./candidateService')

function createQuestionId(candidateId) {
  return `question_${candidateId}`
}

async function claimCandidateForImport({ db, openid, materialId, candidate, now }) {
  return db.collection('parse_candidates').where({
    _id: candidate._id,
    ownerOpenid: openid,
    materialId,
    status: 'ready',
    importedQuestionId: '',
    updatedAt: candidate.updatedAt,
  }).update({
    data: {
      status: 'importing',
      updatedAt: now,
    },
  })
}

async function markClaimedCandidateImported({ db, openid, materialId, candidateId, questionId, now }) {
  return db.collection('parse_candidates').where({
    _id: candidateId,
    ownerOpenid: openid,
    materialId,
    status: 'importing',
    importedQuestionId: '',
    updatedAt: now,
  }).update({
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

  const linked = await markClaimedCandidateImported({ db, openid, materialId, candidateId, questionId, now })
  return linked.stats.updated === 1
}

async function confirmImport({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少导入时间')

  const candidates = await listCandidates({ db, openid, materialId })
  const ready = candidates.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId)
  let importedCount = 0

  for (const candidate of ready) {
    const claimed = await claimCandidateForImport({ db, openid, materialId, candidate, now })
    if (claimed.stats.updated !== 1) continue

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

    const imported = await markClaimedCandidateImported({ db, openid, materialId, candidateId: candidate._id, questionId, now })
    if (imported.stats.updated !== 1) {
      const error = new Error('候选题导入状态冲突，请刷新后重试')
      error.code = 'candidate_conflict'
      throw error
    }
    importedCount += 1
  }

  return { importedCount, skippedCount: candidates.length - importedCount }
}

module.exports = {
  confirmImport,
  createQuestionId,
}
