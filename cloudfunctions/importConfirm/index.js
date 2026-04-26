const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { confirmImport } = require('../common/services/importService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const result = await confirmImport({
      db,
      openid,
      materialId: event.materialId,
      now,
    })
    return ok(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
