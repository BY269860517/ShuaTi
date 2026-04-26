const { assertRequired } = require('../response')

const VALID_PARSE_MODES = new Set(['inline_answer', 'answer_at_end'])

function summarizeMaterial(material) {
  return {
    _id: material._id,
    fileName: material.fileName,
    fileSize: material.fileSize,
    status: material.status,
    parseMode: material.parseMode,
    questionCount: material.questionCount || 0,
    readyCandidateCount: material.readyCandidateCount || 0,
    needReviewCandidateCount: material.needReviewCandidateCount || 0,
    invalidCandidateCount: material.invalidCandidateCount || 0,
    errorMessage: material.errorMessage || '',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    ownerOpenid: material.ownerOpenid,
  }
}

async function createMaterial({ db, openid, now, input }) {
  assertRequired(input.fileID, 'missing_file_id', '缺少 PDF 文件')
  assertRequired(input.fileName, 'missing_file_name', '缺少文件名')

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
  }

  const created = await db.collection('materials').add({ data })
  return { _id: created._id, ...data }
}

async function listMaterials({ db, openid }) {
  const result = await db.collection('materials').where({ ownerOpenid: openid }).orderBy('createdAt', 'desc').get()
  return result.data.map(summarizeMaterial)
}

async function getMaterialForOwner({ db, openid, materialId }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')

  const result = await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).get()
  const material = result.data[0]
  if (!material) {
    const error = new Error('资料不存在')
    error.code = 'material_not_found'
    throw error
  }
  return material
}

async function getMaterialDetail({ db, openid, materialId }) {
  assertRequired(materialId, 'missing_material_id', '缺少资料 ID')

  const result = await db.collection('materials').where({ _id: materialId, ownerOpenid: openid }).get()
  const material = result.data[0]
  if (!material) {
    const error = new Error('资料不存在')
    error.code = 'material_not_found'
    throw error
  }
  return summarizeMaterial(material)
}

module.exports = {
  createMaterial,
  getMaterialDetail,
  getMaterialForOwner,
  listMaterials,
}
