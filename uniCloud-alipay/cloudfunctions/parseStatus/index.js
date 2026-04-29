const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getParseStatus } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const data = await getParseStatus({ db, openid: uid, materialId: event.materialId })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}
