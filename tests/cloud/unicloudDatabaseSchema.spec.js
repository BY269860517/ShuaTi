const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

const schemaNames = [
  'users',
  'materials',
  'parse_jobs',
  'material_pages',
  'parse_candidates',
  'questions',
  'practice_sessions',
  'attempts',
]

describe('uniCloud database schemas', () => {
  for (const name of schemaNames) {
    it(`${name} schema blocks direct client access`, () => {
      const filePath = path.join('uniCloud-alipay', 'database', `${name}.schema.json`)
      expect(existsSync(filePath)).toBe(true)
      const schema = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(schema.bsonType).toBe('object')
      expect(schema.permission).toEqual({
        read: false,
        create: false,
        update: false,
        delete: false,
      })
      expect(schema.properties).toBeTruthy()
    })
  }

  it('declares uni-id users index file', () => {
    const filePath = path.join('uniCloud-alipay', 'database', 'uni-id-users.index.json')
    expect(existsSync(filePath)).toBe(true)
    const index = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(Array.isArray(index.indexes)).toBe(true)
  })
})
