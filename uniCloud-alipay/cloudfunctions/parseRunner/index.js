const pdfParse = require('pdf-parse')
const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { runParseJob } = require('shuati-shared/services/parseService')

exports.main = async (event = {}, context = {}) => {
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const { uid } = await requireUidFromEvent({ event, context })
    const job = await runParseJob({
      db,
      openid: uid,
      jobId: event.jobId,
      now,
      extractText: async (material) => {
        const file = await uniCloud.downloadFile({ fileID: material.fileID })
        const parsed = await pdfParse(file.fileContent)
        return parsed.text || ''
      },
    })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}
