const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { upsertUser } = require('../common/services/userService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const user = await upsertUser({ db, openid, now })
    return ok({ user })
  } catch (error) {
    return toErrorResponse(error)
  }
}
