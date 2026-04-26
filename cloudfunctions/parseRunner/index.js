const cloud = require('wx-server-sdk')
const pdfParse = require('pdf-parse')
const { requireOpenid } = require('../common/auth')
const { ok, toErrorResponse } = require('../common/response')
const { runParseJob } = require('../common/services/parseService')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const db = cloud.database()
  const now = new Date().toISOString()
  try {
    const openid = requireOpenid(cloud.getWXContext())
    const job = await runParseJob({
      db,
      openid,
      jobId: event.jobId,
      now,
      extractText: async (material) => {
        const file = await cloud.downloadFile({ fileID: material.fileID })
        const parsed = await pdfParse(file.fileContent)
        return parsed.text || ''
      },
    })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
