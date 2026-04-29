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

const readSchema = (name) => {
  const filePath = path.join('uniCloud-alipay', 'database', `${name}.schema.json`)
  expect(existsSync(filePath)).toBe(true)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

const expectNumberOrNull = (property) => {
  expect(property).toBeTruthy()
  expect(Array.isArray(property.bsonType)).toBe(true)
  expect(property.bsonType).toContain('number')
  expect(property.bsonType).toContain('null')
}

describe('uniCloud database schemas', () => {
  for (const name of schemaNames) {
    it(`${name} schema blocks direct client access`, () => {
      const schema = readSchema(name)
      expect(schema.bsonType).toBe('object')
      expect(schema.permission).toEqual({
        read: false,
        create: false,
        update: false,
        delete: false,
        count: false,
      })
      expect(schema.properties).toBeTruthy()
    })
  }

  it('allows nullable source page numbers written by parse/import services', () => {
    const parseCandidates = readSchema('parse_candidates')
    const questions = readSchema('questions')
    expectNumberOrNull(parseCandidates.properties.sourcePageNo)
    expectNumberOrNull(questions.properties.sourcePageNo)
  })

  it('declares question import claim token written during imports', () => {
    const questions = readSchema('questions')
    expect(questions.properties.importClaimToken).toEqual({ bsonType: 'string' })
  })

  it('declares attempt updated timestamp written by services', () => {
    const attempts = readSchema('attempts')
    expect(attempts.properties.updatedAt).toEqual({ bsonType: 'string' })
  })

  it('declares uni-id users index file', () => {
    const filePath = path.join('uniCloud-alipay', 'database', 'uni-id-users.index.json')
    expect(existsSync(filePath)).toBe(true)
    const index = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(Array.isArray(index.indexes)).toBe(true)
  })
})
