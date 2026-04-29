const { validateCandidate } = require('../parser/validate')
const { assertRequired } = require('../response')

function redactCandidate(candidate) {
  const {
    importClaimToken,
    importClaimUntil,
    importSourceUpdatedAt,
    ...publicCandidate
  } = candidate
  return publicCandidate
}

async function listCandidateRecords({ db, openid, materialId }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')

  const result = await db.collection('parse_candidates').where({ ownerOpenid: openid, materialId }).get()
  return result.data
}

async function listCandidates({ db, openid, materialId }) {
  const candidates = await listCandidateRecords({ db, openid, materialId })
  return candidates.map(redactCandidate)
}

async function getCandidateRecord({ db, openid, candidateId }) {
  assertRequired(candidateId, 'missing_candidate_id', '缺少候选题 ID')

  const result = await db.collection('parse_candidates').where({ ownerOpenid: openid, _id: candidateId }).get()
  const candidate = result.data[0]
  if (!candidate) {
    const error = new Error('候选题不存在')
    error.code = 'candidate_not_found'
    throw error
  }
  return candidate
}

async function getCandidateDetail({ db, openid, candidateId }) {
  return redactCandidate(await getCandidateRecord({ db, openid, candidateId }))
}

async function updateCandidate({ db, openid, candidateId, now, input = {} }) {
  assertRequired(now, 'missing_timestamp', '缺少更新时间')

  const existing = await getCandidateRecord({ db, openid, candidateId })
  if (existing.status === 'imported') {
    const error = new Error('已导入题目不能编辑')
    error.code = 'candidate_imported'
    throw error
  }

  if (existing.status === 'importing') {
    const error = new Error('候选题正在导入，稍后再试')
    error.code = 'candidate_importing'
    throw error
  }

  const merged = validateCandidate({
    ...existing,
    type: input.type || existing.type,
    stem: input.stem ?? existing.stem,
    options: input.options || existing.options,
    answerKeys: input.answerKeys || existing.answerKeys,
    explanation: input.explanation ?? existing.explanation,
  })

  const data = {
    type: merged.type,
    stem: merged.stem,
    options: merged.options,
    answerKeys: merged.answerKeys,
    explanation: merged.explanation,
    validationErrors: merged.validationErrors,
    status: merged.status,
    updatedAt: now,
  }
  const updated = await db.collection('parse_candidates').where({
    _id: candidateId,
    ownerOpenid: openid,
    status: existing.status,
    updatedAt: existing.updatedAt,
  }).update({ data })
  if (updated.stats.updated !== 1) {
    const current = await getCandidateRecord({ db, openid, candidateId })
    if (current.status === 'imported') {
      const error = new Error('已导入题目不能编辑')
      error.code = 'candidate_imported'
      throw error
    }
    const error = new Error('候选题状态已变化，请刷新后重试')
    error.code = 'candidate_conflict'
    throw error
  }
  return { ...existing, ...data }
}

module.exports = {
  getCandidateDetail,
  getCandidateRecord,
  listCandidateRecords,
  listCandidates,
  updateCandidate,
}
