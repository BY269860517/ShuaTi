const { assertRequired } = require('../response')
const { listCandidates } = require('./candidateService')

function createQuestionId(candidateId) {
  return `question_${candidateId}`
}

function createImportClaimToken(candidate, now) {
  return `import_${candidate._id}_${candidate.updatedAt}_${now}`
}

function createCandidateConflict() {
  const error = new Error('候选题导入状态冲突，请刷新后重试')
  error.code = 'candidate_conflict'
  return error
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
      importClaimToken: createImportClaimToken(candidate, now),
      importSourceUpdatedAt: candidate.updatedAt,
      updatedAt: now,
    },
  })
}

async function markClaimedCandidateImported({ db, openid, materialId, candidate, questionId, importClaimToken, now }) {
  return db.collection('parse_candidates').where({
    _id: candidate._id,
    ownerOpenid: openid,
    materialId,
    status: 'importing',
    importedQuestionId: '',
    importClaimToken,
    importSourceUpdatedAt: candidate.updatedAt,
    updatedAt: now,
  }).update({
    data: {
      importedQuestionId: questionId,
      status: 'imported',
      importClaimToken: '',
      importSourceUpdatedAt: '',
      updatedAt: now,
    },
  })
}

async function rollbackImportClaim({ db, openid, materialId, candidate, importClaimToken, now }) {
  return db.collection('parse_candidates').where({
    _id: candidate._id,
    ownerOpenid: openid,
    materialId,
    status: 'importing',
    importedQuestionId: '',
    importClaimToken,
    importSourceUpdatedAt: candidate.updatedAt,
    updatedAt: now,
  }).update({
    data: {
      status: 'ready',
      importClaimToken: '',
      importSourceUpdatedAt: '',
      updatedAt: now,
    },
  })
}

async function recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now }) {
  const questionId = createQuestionId(candidate._id)
  const existing = await db.collection('questions').where({
    _id: questionId,
    ownerOpenid: openid,
    materialId,
    candidateId: candidate._id,
    sourceCandidateUpdatedAt: candidate.updatedAt,
  }).get()
  if (!existing.data[0]) return false

  const linked = await markClaimedCandidateImported({ db, openid, materialId, candidate, questionId, importClaimToken, now })
  return linked.stats.updated === 1
}

async function confirmImport({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少导入时间')

  const candidates = await listCandidates({ db, openid, materialId })
  const ready = candidates.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId)
  let importedCount = 0

  for (const candidate of ready) {
    const importClaimToken = createImportClaimToken(candidate, now)
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
      sourceCandidateUpdatedAt: candidate.updatedAt,
      importClaimToken,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await db.collection('questions').add({ data: questionData })
    } catch (error) {
      if (error.code !== 'duplicate_key') {
        await rollbackImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
        throw error
      }
      const recovered = await recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now })
      if (recovered) {
        importedCount += 1
        continue
      }
      await rollbackImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
      throw createCandidateConflict()
    }

    const imported = await markClaimedCandidateImported({ db, openid, materialId, candidate, questionId, importClaimToken, now })
    if (imported.stats.updated !== 1) {
      await rollbackImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
      throw createCandidateConflict()
    }
    importedCount += 1
  }

  return { importedCount, skippedCount: candidates.length - importedCount }
}

module.exports = {
  confirmImport,
  createQuestionId,
}
