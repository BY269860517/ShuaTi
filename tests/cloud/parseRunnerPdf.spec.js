const { readFileSync } = require('node:fs')

const { extractPdfText } = require('../../uniCloud-alipay/cloudfunctions/parseRunner')

describe('parseRunner PDF text extraction', () => {
  it('does not load pdf-parse at module initialization time', () => {
    const source = readFileSync('uniCloud-alipay/cloudfunctions/parseRunner/index.js', 'utf8')

    expect(source).not.toContain("const pdfParse = require('pdf-parse')")
  })

  it('supports the legacy pdf-parse function export', async () => {
    const text = await extractPdfText(Buffer.from('pdf'), async () => ({ text: 'legacy text' }))

    expect(text).toBe('legacy text')
  })

  it('supports the pdf-parse PDFParse class export', async () => {
    let destroyed = false
    class FakePDFParse {
      constructor(options) {
        this.options = options
      }

      async getText() {
        expect(Buffer.isBuffer(this.options.data)).toBe(true)
        return { text: 'class text' }
      }

      async destroy() {
        destroyed = true
      }
    }

    const text = await extractPdfText(Buffer.from('pdf'), { PDFParse: FakePDFParse })

    expect(text).toBe('class text')
    expect(destroyed).toBe(true)
  })
})
