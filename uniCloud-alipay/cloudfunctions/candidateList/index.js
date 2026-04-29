const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listCandidates } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidates = await listCandidates({ db, openid: uid, materialId: event.materialId })
    return ok({ candidates })
  } catch (error) {
    return toErrorResponse(error)
  }
}
