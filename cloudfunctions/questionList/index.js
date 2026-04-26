const cloud = require('wx-server-sdk')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { listQuestions } = require('../common/services/practiceService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const questions = await listQuestions({ db, openid, materialId: event.materialId })
    return ok({ questions })
  } catch (error) {
    return toErrorResponse(error)
  }
}
