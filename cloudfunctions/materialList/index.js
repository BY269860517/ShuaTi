const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listMaterials } = require('../common/services/materialService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const materials = await listMaterials({ db, openid })
    return ok({ materials })
  } catch (error) {
    return toErrorResponse(error)
  }
}
