const path = require('node:path')
const { existsSync, readFileSync } = require('node:fs')

const legacySdkPackage = ['wx', 'server', 'sdk'].join('-')
const legacyContextCall = ['cloud', 'getWXContext'].join('.')

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
      expect(source).not.toContain(legacySdkPackage)
      expect(source).not.toContain(legacyContextCall)
    })

    it(`${name} declares its shared module dependency for HBuilderX upload`, () => {
      const filePath = path.join('uniCloud-alipay', 'cloudfunctions', name, 'package.json')
      expect(existsSync(filePath)).toBe(true)
      const packageJson = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(packageJson.dependencies['shuati-shared']).toBe('file:../common/shuati-shared')
      expect(packageJson.dependencies[legacySdkPackage]).toBeUndefined()
    })
  }

  it('parseRunner declares pdf-parse without legacy sdk', () => {
    const packageJson = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/parseRunner/package.json', 'utf8'))
    expect(packageJson.dependencies['pdf-parse']).toBe('latest')
    expect(packageJson.dependencies[legacySdkPackage]).toBeUndefined()
  })

  it('userLogin declares uni-id common module dependency', () => {
    const packageJson = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/userLogin/package.json', 'utf8'))
    expect(packageJson.dependencies['uni-id']).toBe('file:../common/uni-id')
  })

  it('vendors old uni-id common modules required by loginByWeixin', () => {
    const configCenterPackage = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/common/uni-config-center/package.json', 'utf8'))
    const uniIdPackage = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/common/uni-id/package.json', 'utf8'))
    const bridgePackage = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/package.json', 'utf8'))

    expect(existsSync('uniCloud-alipay/cloudfunctions/common/uni-config-center/index.js')).toBe(true)
    expect(configCenterPackage.name).toBe('uni-config-center')
    expect(existsSync('uniCloud-alipay/cloudfunctions/common/uni-id/index.js')).toBe(true)
    expect(existsSync('uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/index.js')).toBe(true)
    expect(uniIdPackage.name).toBe('uni-id')
    expect(uniIdPackage.dependencies['uni-config-center']).toBe('file:../uni-config-center')
    expect(uniIdPackage.dependencies['uni-open-bridge-common']).toBe('file:../uni-open-bridge-common')
    expect(bridgePackage.name).toBe('uni-open-bridge-common')
    expect(bridgePackage.dependencies['uni-config-center']).toBe('file:../uni-config-center')
  })

  it('vendors uni-id-common required by token-authenticated business functions', () => {
    const sharedPackage = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/common/shuati-shared/package.json', 'utf8'))
    const uniIdCommonPackage = JSON.parse(readFileSync('uniCloud-alipay/cloudfunctions/common/uni-id-common/package.json', 'utf8'))

    expect(existsSync('uniCloud-alipay/cloudfunctions/common/uni-id-common/index.js')).toBe(true)
    expect(sharedPackage.dependencies['uni-id-common']).toBe('file:../uni-id-common')
    expect(uniIdCommonPackage.name).toBe('uni-id-common')
    expect(uniIdCommonPackage.dependencies['uni-config-center']).toBe('file:../uni-config-center')
  })
})
