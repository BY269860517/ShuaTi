const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { createWrongPractice } = require('shuati-shared/services/wrongService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const session = await createWrongPractice({
      db,
      openid: uid,
      materialId: event.materialId,
      count: event.count,
      now,
    })
    return ok({ session })
  } catch (error) {
    return toErrorResponse(error)
  }
}
