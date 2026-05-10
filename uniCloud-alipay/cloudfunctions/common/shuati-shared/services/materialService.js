const { assertRequired } = require('../response')

const VALID_PARSE_MODES = new Set(['inline_answer', 'answer_at_end'])

function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function getOwnedStoragePath(fileID) {
  const value = String(fileID || '')
  if (!value || /%2f|%5c/i.test(value) || value.includes('?') || value.includes('#') || value.includes('\\')) {
    return ''
  }

  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch (_) {
    return ''
  }

  if (decoded.includes('\\')) return ''
  if (decoded.startsWith('materials/')) return decoded

  const cloudPrefix = 'cloud://'
  if (!decoded.startsWith(cloudPrefix)) return ''

  const objectPathStart = decoded.indexOf('/', cloudPrefix.length)
  if (objectPathStart === -1) return ''
  return decoded.slice(objectPathStart + 1)
}

function assertFileBelongsToOwner(fileID, openid) {
  const storagePath = getOwnedStoragePath(fileID)
  const parts = storagePath.split('/')
  const hasValidPathParts = parts.length > 2 && parts.every(Boolean) && !parts.includes('.') && !parts.includes('..')
  if (parts[0] === 'materials' && parts[1] === openid && hasValidPathParts) return
  throw createError('invalid_file_owner', 'PDF 文件不属于当前用户')
}

function isMaterialDeleted(material) {
  return Boolean(material && material.deletedAt)
}

function createMaterialNotFoundError() {
  return createError('material_not_found', '资料不存在')
}

function summarizeMaterial(material, practicedQuestionCount = 0) {
  return {
    _id: material._id,
    fileName: material.fileName,
    fileSize: material.fileSize,
    status: material.status,
    parseMode: material.parseMode,
    questionCount: material.questionCount || 0,
    practicedQuestionCount,
    readyCandidateCount: material.readyCandidateCount || 0,
    needReviewCandidateCount: material.needReviewCandidateCount || 0,
    invalidCandidateCount: material.invalidCandidateCount || 0,
    errorMessage: material.errorMessage || '',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    deletedAt: material.deletedAt || '',
    ownerOpenid: material.ownerOpenid,
  }
}

async function getPracticedQuestionCountsByMaterial({ db, openid }) {
  const attempts = await db.collection('attempts').where({ ownerOpenid: openid }).get()
  const attemptedQuestionIds = [...new Set(attempts.data.map((attempt) => attempt.questionId).filter(Boolean))]
  if (attemptedQuestionIds.length === 0) return new Map()

  const questions = await db.collection('questions').where({ ownerOpenid: openid }).get()
  const attemptedQuestionIdsSet = new Set(attemptedQuestionIds)
  const materialQuestionIds = new Map()

  for (const question of questions.data) {
    if (!attemptedQuestionIdsSet.has(question._id) || !question.materialId) continue
    if (!materialQuestionIds.has(question.materialId)) materialQuestionIds.set(question.materialId, new Set())
    materialQuestionIds.get(question.materialId).add(question._id)
  }

  const counts = new Map()
  for (const [materialId, questionIds] of materialQuestionIds.entries()) {
    counts.set(materialId, questionIds.size)
  }
  return counts
}

async function createMaterial({ db, openid, now, input }) {
  assertRequired(input.fileID, 'missing_file_id', '缺少 PDF 文件')
  assertRequired(input.fileName, 'missing_file_name', '缺少文件名')

  assertFileBelongsToOwner(input.fileID, openid)

  const parseMode = VALID_PARSE_MODES.has(input.parseMode) ? input.parseMode : 'inline_answer'
  const data = {
    ownerOpenid: openid,
    fileID: input.fileID,
    fileName: input.fileName,
    fileSize: Number(input.fileSize || 0),
    status: 'uploaded',
    parseMode,
    questionCount: 0,
    readyCandidateCount: 0,
    needReviewCandidateCount: 0,
    invalidCandidateCount: 0,
    errorMessage: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  }

  const created = await db.collection('materials').add({ data })
  return summarizeMaterial({ _id: created._id, ...data })
}

async function listMaterials({ db, openid }) {
  const result = await db.collection('materials').where({ ownerOpenid: openid }).orderBy('createdAt', 'desc').get()
  const practicedCounts = await getPracticedQuestionCountsByMaterial({ db, openid })
  return result.data
    .filter((material) => !isMaterialDeleted(material))
    .map((material) => summarizeMaterial(material, practicedCounts.get(material._id) || 0))
}

async function findMaterialForOwner({ db, openid, materialId, includeDeleted = false }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')

  const result = await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).get()
  const material = result.data[0]
  if (!material || (!includeDeleted && isMaterialDeleted(material))) {
    throw createMaterialNotFoundError()
  }
  return material
}

async function getMaterialForOwner({ db, openid, materialId, includeDeleted = false }) {
  return findMaterialForOwner({ db, openid, materialId, includeDeleted })
}

async function getMaterialDetail({ db, openid, materialId }) {
  const material = await findMaterialForOwner({ db, openid, materialId })
  return summarizeMaterial(material)
}

async function deleteMaterial({ db, openid, materialId, now }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')
  assertRequired(now, 'missing_timestamp', '缺少删除时间')

  const material = await findMaterialForOwner({ db, openid, materialId, includeDeleted: true })
  if (isMaterialDeleted(material)) return summarizeMaterial(material)

  const data = {
    deletedAt: now,
    updatedAt: now,
  }
  await db.collection('materials').doc(material._id).update({ data })
  return summarizeMaterial({ ...material, ...data })
}

module.exports = {
  createMaterial,
  deleteMaterial,
  getMaterialDetail,
  getMaterialForOwner,
  listMaterials,
}
