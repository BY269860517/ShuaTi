const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { startParse } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const job = await startParse({ db, openid, materialId: event.materialId, now })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
