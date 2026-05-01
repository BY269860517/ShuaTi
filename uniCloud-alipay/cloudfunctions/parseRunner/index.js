const { createDbCompat } = require('shuati-shared/db')
const { requireUidFromEvent } = require('shuati-shared/auth')
const { ok, toErrorResponse } = require('shuati-shared/response')
const { runParseJob } = require('shuati-shared/services/parseService')

function loadPdfParser() {
  return require('pdf-parse')
}

async function extractPdfText(fileContent, parserModule = loadPdfParser()) {
  if (typeof parserModule === 'function') {
    const parsed = await parserModule(fileContent)
    return parsed.text || ''
  }

  if (typeof parserModule?.PDFParse === 'function') {
    const parser = new parserModule.PDFParse({ data: fileContent })
    try {
      const parsed = await parser.getText()
      return parsed.text || ''
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy()
      }
    }
  }

  const error = new Error('Unsupported pdf-parse module export')
  error.code = 'unsupported_pdf_parse_export'
  throw error
}

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
        return extractPdfText(file.fileContent)
      },
    })
    return ok({ job })
  } catch (error) {
    return toErrorResponse(error)
  }
}

module.exports.extractPdfText = extractPdfText
