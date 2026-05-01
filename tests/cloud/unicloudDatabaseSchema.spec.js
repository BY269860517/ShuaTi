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

  it('declares question numbers as strings written by parser and import services', () => {
    const parseCandidates = readSchema('parse_candidates')
    const questions = readSchema('questions')
    expect(parseCandidates.properties.questionNo).toEqual({ bsonType: 'string' })
    expect(questions.properties.questionNo).toEqual({ bsonType: 'string' })
  })

  it('declares question import claim token written during imports', () => {
    const questions = readSchema('questions')
    expect(questions.properties.importClaimToken).toEqual({ bsonType: 'string' })
  })

  it('declares attempt updated timestamp written by services', () => {
    const attempts = readSchema('attempts')
    expect(attempts.properties.updatedAt).toEqual({ bsonType: 'string' })
  })

  it('allows materials to be soft deleted with deletedAt', () => {
    const materials = readSchema('materials')

    expect(materials.properties.deletedAt).toEqual({ bsonType: 'string' })
    expect(materials.required).not.toContain('deletedAt')
  })

  it('declares wrong questions schema for server-only access', () => {
    const schema = JSON.parse(readFileSync('uniCloud-alipay/database/wrong_questions.schema.json', 'utf8'))

    expect(schema.required).toEqual(expect.arrayContaining([
      'ownerOpenid',
      'questionId',
      'materialId',
      'status',
      'wrongCount',
      'correctStreak',
      'lastWrongAt',
      'createdAt',
      'updatedAt',
    ]))
    expect(schema.permission).toMatchObject({
      read: false,
      create: false,
      update: false,
      delete: false,
      count: false,
    })
    expect(schema.properties.status).toMatchObject({ bsonType: 'string' })
  })

  it('allows practice sessions to record wrong-practice mode', () => {
    const schema = JSON.parse(readFileSync('uniCloud-alipay/database/practice_sessions.schema.json', 'utf8'))

    expect(schema.properties.mode).toMatchObject({ bsonType: 'string' })
    expect(schema.required).not.toContain('mode')
  })

  it('declares uni-id users index file', () => {
    const filePath = path.join('uniCloud-alipay', 'database', 'uni-id-users.index.json')
    expect(existsSync(filePath)).toBe(true)
    const index = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(Array.isArray(index.indexes)).toBe(true)
  })
})
