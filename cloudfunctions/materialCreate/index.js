const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { createMaterial } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const material = await createMaterial({ db, openid, now, input: event })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
