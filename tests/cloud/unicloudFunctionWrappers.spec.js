const path = require('node:path')
const { existsSync, readFileSync } = require('node:fs')

const functions = [
  'materialCreate',
  'materialList',
  'materialDetail',
  'parseStart',
  'parseRunner',
  'parseStatus',
  'candidateList',
  'candidateDetail',
  'candidateUpdate',
  'importConfirm',
  'questionList',
  'practiceCreate',
  'practiceDetail',
  'answerSubmit',
]

describe('uniCloud function wrappers', () => {
  for (const name of functions) {
    it(`${name} has an ordinary cloud function entry`, () => {
      const filePath = path.join('uniCloud-alipay', 'cloudfunctions', name, 'index.js')
      expect(existsSync(filePath)).toBe(true)
      const source = readFileSync(filePath, 'utf8')
      expect(source).toContain('exports.main')
      expect(source).toContain('requireUidFromEvent')
      expect(source).toContain('createDbCompat')
      expect(source).not.toContain('wx-server-sdk')
      expect(source).not.toContain('cloud.getWXContext')
    })
  }

  it('parseRunner declares pdf-parse without wx-server-sdk', () => {
    const packageJson = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/parseRunner/package.json', 'utf8'))
    expect(packageJson.dependencies['pdf-parse']).toBe('latest')
    expect(packageJson.dependencies['wx-server-sdk']).toBeUndefined()
  })
})
