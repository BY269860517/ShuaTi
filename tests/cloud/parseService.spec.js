const { createFakeDb } = require('./fakeDb')
const { createMaterial } = require('../../cloudfunctions/common/services/materialService')
const { getParseStatus, runParseJob, startParse } = require('../../cloudfunctions/common/services/parseService')

describe('parse service', () => {
  it('creates one parse job for a material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    const first = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    const second = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:02.000Z' })

    expect(first._id).toBe(second._id)
    expect(second.status).toBe('pending')
  })

  it('runs parser and stores candidates', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    const result = await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => '1. 题目\nA. 甲\nB. 乙\n答案：A',
    })

    expect(result.status).toBe('done')
    expect(result.stats.readyCandidateCount).toBe(1)
    const status = await getParseStatus({ db, openid: 'user_a', materialId: material._id })
    expect(status.job.status).toBe('done')
    expect(status.material.readyCandidateCount).toBe(1)
  })

  it('returns existing result when job is already done', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:02.000Z', extractText: async () => '1. 题目\nA. 甲\nB. 乙\n答案：A' })
    const second = await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:03.000Z', extractText: async () => { throw new Error('should not run') } })

    expect(second.status).toBe('done')
  })
})
