const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { markWrongQuestionMastered } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const wrongQuestion = await markWrongQuestionMastered({
      db,
      openid: uid,
      wrongQuestionId: event.wrongQuestionId,
      now,
    })
    return ok({ wrongQuestion })
  } catch (error) {
    return toErrorResponse(error)
  }
}
