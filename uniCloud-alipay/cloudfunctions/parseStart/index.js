const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { startParse } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const job = await startParse({ db, openid: uid, materialId: event.materialId, now })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
