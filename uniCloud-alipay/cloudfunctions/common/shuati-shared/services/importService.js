const { assertRequired } = require('../response')
const { listCandidateRecords } = require('./candidateService')

const IMPORT_CLAIM_TTL_MS = 5 * 60 * 1000

function encodeQuestionVersion(sourceCandidateUpdatedAt) {
  return String(sourceCandidateUpdatedAt || 'unknown').replace(/[^a-zA-Z0-9]/g, '')
}

function createQuestionId(candidateId, sourceCandidateUpdatedAt) {
  return `question_${candidateId}_${encodeQuestionVersion(sourceCandidateUpdatedAt)}`
}

function createImportClaimToken(candidate, now) {
  return `import_${candidate._id}_${candidate.updatedAt}_${now}`
}

function createImportClaimUntil(now) {
  return new Date(Date.parse(now) + IMPORT_CLAIM_TTL_MS).toISOString()
}

function createCandidateConflict() {
  const error = new Error('候选题导入状态冲突，请刷新后重试')
  error.code = 'candidate_conflict'
  return error
}

function countCandidateStatuses(candidates) {
  return {
    readyCandidateCount: candidates.filter((candidate) => candidate.status === 'ready').length,
    needReviewCandidateCount: candidates.filter((candidate) => candidate.status === 'need_review').length,
    invalidCandidateCount: candidates.filter((candidate) => candidate.status === 'invalid').length,
  }
}

async function updateMaterialAfterImport({ db, openid, materialId, candidates, now }) {
  const questions = await db.collection('questions').where({ ownerOpenid: openid, materialId }).get()
  const questionCount = questions.data.length
  const status = questionCount > 0 ? 'ready' : 'reviewing'

  await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).update({
    data: {
      status,
      questionCount,
      ...countCandidateStatuses(candidates),
      updatedAt: now,
    },
  })
}

async function findMatchingQuestion({ db, openid, materialId, candidateId, sourceCandidateUpdatedAt }) {
  const questionId = createQuestionId(candidateId, sourceCandidateUpdatedAt)
  const result = await db.collection('questions').where({
    _id: questionId,
    ownerOpenid: openid,
    materialId,
    candidateId,
    sourceCandidateUpdatedAt,
  }).get()
  return result.data[0] || null
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
      importClaimUntil: createImportClaimUntil(now),
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
      importClaimUntil: '',
      updatedAt: now,
    },
  })
}

async function markStaleClaimImported({ db, openid, materialId, candidate, questionId, now }) {
  return db.collection('parse_candidates').where({
    _id: candidate._id,
    ownerOpenid: openid,
    materialId,
    status: 'importing',
    importedQuestionId: '',
    importClaimToken: candidate.importClaimToken || '',
    importSourceUpdatedAt: candidate.importSourceUpdatedAt || '',
    updatedAt: candidate.updatedAt,
  }).update({
    data: {
      importedQuestionId: questionId,
      status: 'imported',
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
      updatedAt: now,
    },
  })
}

async function rollbackImportClaim({ db, openid, materialId, candidate, importClaimToken, now, restoreSourceUpdatedAt = false }) {
  return db.collection('parse_candidates').where({
    _id: candidate._id,
    ownerOpenid: openid,
    materialId,
    status: 'importing',
    importedQuestionId: '',
    importClaimToken,
    importSourceUpdatedAt: candidate.importSourceUpdatedAt || candidate.updatedAt,
    updatedAt: candidate.updatedAt,
  }).update({
    data: {
      status: 'ready',
      importClaimToken: '',
      importSourceUpdatedAt: '',
      importClaimUntil: '',
      updatedAt: restoreSourceUpdatedAt ? candidate.importSourceUpdatedAt : now,
    },
  })
}

async function rollbackCurrentImportClaim({ db, openid, materialId, candidate, importClaimToken, now }) {
  return rollbackImportClaim({
    db,
    openid,
    materialId,
    candidate: {
      ...candidate,
      importClaimToken,
      importSourceUpdatedAt: candidate.updatedAt,
      updatedAt: now,
    },
    importClaimToken,
    now,
  })
}

async function recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now }) {
  const question = await findMatchingQuestion({
    db,
    openid,
    materialId,
    candidateId: candidate._id,
    sourceCandidateUpdatedAt: candidate.updatedAt,
  })
  if (!question) return false

  const linked = await markClaimedCandidateImported({
    db,
    openid,
    materialId,
    candidate,
    questionId: question._id,
    importClaimToken,
    now,
  })
  return linked.stats.updated === 1
}

async function recoverStaleImportClaims({ db, openid, materialId, now }) {
  const candidates = await listCandidateRecords({ db, openid, materialId })
  let importedCount = 0

  for (const candidate of candidates) {
    if (candidate.status !== 'importing') continue
    if (candidate.importClaimUntil && candidate.importClaimUntil > now) continue

    const sourceCandidateUpdatedAt = candidate.importSourceUpdatedAt || candidate.updatedAt
    const question = await findMatchingQuestion({
      db,
      openid,
      materialId,
      candidateId: candidate._id,
      sourceCandidateUpdatedAt,
    })

    if (question) {
      const imported = await markStaleClaimImported({ db, openid, materialId, candidate, questionId: question._id, now })
      if (imported.stats.updated === 1) importedCount += 1
      continue
    }

    await rollbackImportClaim({
      db,
      openid,
      materialId,
      candidate,
      importClaimToken: candidate.importClaimToken || '',
      now,
      restoreSourceUpdatedAt: true,
    })
  }

  return { importedCount }
}

async function importReadyCandidate({ db, openid, materialId, candidate, now }) {
  const importClaimToken = createImportClaimToken(candidate, now)
  const claimed = await claimCandidateForImport({ db, openid, materialId, candidate, now })
  if (claimed.stats.updated !== 1) return 0

  const questionId = createQuestionId(candidate._id, candidate.updatedAt)
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
      await rollbackCurrentImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
      throw error
    }
    const recovered = await recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now })
    if (recovered) return 1
    await rollbackCurrentImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
    throw createCandidateConflict()
  }

  try {
    const imported = await markClaimedCandidateImported({ db, openid, materialId, candidate, questionId, importClaimToken, now })
    if (imported.stats.updated !== 1) {
      const recovered = await recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now })
      if (recovered) return 1
      await rollbackCurrentImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
      throw createCandidateConflict()
    }
  } catch (error) {
    try {
      const recovered = await recoverDuplicateQuestion({ db, openid, materialId, candidate, importClaimToken, now })
      if (recovered) return 1
      const question = await findMatchingQuestion({
        db,
        openid,
        materialId,
        candidateId: candidate._id,
        sourceCandidateUpdatedAt: candidate.updatedAt,
      })
      if (!question) await rollbackCurrentImportClaim({ db, openid, materialId, candidate, importClaimToken, now })
    } catch (_) {
      // Preserve the import claim for expiry-based recovery when immediate recovery cannot run.
    }
    throw error
  }

  return 1
}

async function confirmImport({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少导入时间')

  const recovered = await recoverStaleImportClaims({ db, openid, materialId, now })
  const candidates = await listCandidateRecords({ db, openid, materialId })
  const ready = candidates.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId)
  let importedCount = recovered.importedCount

  for (const candidate of ready) {
    importedCount += await importReadyCandidate({ db, openid, materialId, candidate, now })
  }

  const latestCandidates = await listCandidateRecords({ db, openid, materialId })
  await updateMaterialAfterImport({ db, openid, materialId, candidates: latestCandidates, now })

  return { importedCount, skippedCount: candidates.length - importedCount }
}

module.exports = {
  confirmImport,
  createQuestionId,
}
