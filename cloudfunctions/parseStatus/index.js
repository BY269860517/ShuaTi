const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { getParseStatus } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const status = await getParseStatus({ db, openid, materialId: event.materialId })
    return ok(status)
  } catch (error) {
    return toErrorResponse(error)
  }
}
