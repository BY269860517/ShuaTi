const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getPracticeDetail } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const data = await getPracticeDetail({ db, openid: uid, sessionId: event.sessionId })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}
