const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { updateCandidate } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidate = await updateCandidate({
      db,
      openid: uid,
      candidateId: event.candidateId,
      input: event.candidate || {},
      now,
    })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
