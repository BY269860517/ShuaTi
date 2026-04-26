const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { createPractice } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const session = await createPractice({
      db,
      openid,
      materialId: event.materialId,
      count: event.count,
      now,
    })
    return ok({ session })
  } catch (error) {
    return toErrorResponse(error)
  }
}
