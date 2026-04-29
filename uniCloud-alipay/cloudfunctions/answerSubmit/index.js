const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { answerSubmit } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const result = await answerSubmit({
      db,
      openid: uid,
      sessionId: event.sessionId,
      questionId: event.questionId,
      selectedKeys: event.selectedKeys,
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
