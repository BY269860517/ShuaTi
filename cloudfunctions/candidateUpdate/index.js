const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { updateCandidate } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidate = await updateCandidate({
      db,
      openid,
      candidateId: event.candidateId,
      now,
      input: event.candidate || {},
    })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
