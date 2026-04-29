const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { createMaterial } = require('shuati-shared/services/materialService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const material = await createMaterial({ db, openid: uid, now, input: event })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
