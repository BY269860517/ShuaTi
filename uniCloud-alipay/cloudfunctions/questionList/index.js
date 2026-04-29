const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { listQuestions } = require('shuati-shared/services/practiceService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const questions = await listQuestions({ db, openid: uid, materialId: event.materialId })
    return ok({ questions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
