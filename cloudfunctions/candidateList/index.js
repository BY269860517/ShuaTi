const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listCandidates } = require('../common/services/candidateService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const candidates = await listCandidates({ db, openid, materialId: event.materialId })
    return ok({ candidates })
  } catch (error) {
    return toErrorResponse(error)
  }
}
