const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { answerSubmit } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const result = await answerSubmit({
      db,
      openid,
      sessionId: event.sessionId,
      questionId: event.questionId,
      selectedKeys: event.selectedKeys || [],
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
