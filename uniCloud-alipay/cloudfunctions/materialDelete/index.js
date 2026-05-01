const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { deleteMaterial } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const now = new Date().toISOString()
    const material = await deleteMaterial({ db, openid: uid, materialId: event.materialId, now })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
