const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getMaterialDetail } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const material = await getMaterialDetail({ db, openid, materialId: event.materialId })
    return ok({ material })
  } catch (error) {
    return toErrorResponse(error)
  }
}
