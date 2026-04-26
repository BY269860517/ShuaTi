const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getPracticeDetail } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const detail = await getPracticeDetail({ db, openid, sessionId: event.sessionId })
    return ok(detail)
  } catch (error) {
    return toErrorResponse(error)
  }
}
