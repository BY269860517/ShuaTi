const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { deleteCandidate } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidate = await deleteCandidate({
      db,
      openid: uid,
      candidateId: event.candidateId,
      now,
    })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
