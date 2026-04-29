const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { getCandidateDetail } = require('shuati-shared/services/candidateService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const candidate = await getCandidateDetail({ db, openid: uid, candidateId: event.candidateId })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
