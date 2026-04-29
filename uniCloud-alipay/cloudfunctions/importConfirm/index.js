const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { confirmImport } = require('shuati-shared/services/importService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const result = await confirmImport({ db, openid: uid, materialId: event.materialId, now })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
