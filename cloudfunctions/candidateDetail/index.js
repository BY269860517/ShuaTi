const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getCandidateDetail } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidate = await getCandidateDetail({ db, openid, candidateId: event.candidateId })
    return ok({ candidate })
  } catch (error) {
    return toErrorResponse(error)
  }
}
