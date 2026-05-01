const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listWrongQuestions } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const wrongQuestions = await listWrongQuestions({
      db,
      openid: uid,
      materialId: event.materialId,
      status: event.status,
    })
    return ok({ wrongQuestions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
