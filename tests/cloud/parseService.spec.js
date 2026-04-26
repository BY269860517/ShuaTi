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

  it('recovers when concurrent starts create the same active parse job', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const parseJobs = db.collection('parse_jobs')
    const originalCollection = db.collection
    db.collection = (name) => (name === 'parse_jobs' ? parseJobs : originalCollection(name))
    parseJobs.add = async ({ data }) => {
      parseJobs._rows.push(structuredClone({ _id: data._id, ...data }))
      const error = new Error('duplicate key')
      error.code = 'duplicate_key'
      throw error
    }

    const result = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    expect(result).toMatchObject({
      _id: `parse_job_${material._id}`,
      materialId: material._id,
      ownerOpenid: 'user_a',
      status: 'pending',
    })
  })

  it('resets a failed deterministic parse job when starting again', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    await db.collection('parse_jobs').doc(job._id).update({
      data: {
        status: 'failed',
        lockUntil: '',
        lockToken: '',
        finishedAt: '2026-04-26T00:00:02.000Z',
        errorMessage: 'old failure',
        updatedAt: '2026-04-26T00:00:02.000Z',
      },
    })
    await db.collection('materials').doc(material._id).update({
      data: { status: 'failed', errorMessage: 'old failure', updatedAt: '2026-04-26T00:00:02.000Z' },
    })

    const restarted = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:03.000Z' })
    const storedMaterial = await db.collection('materials').doc(material._id).get()

    expect(restarted).toMatchObject({
      _id: job._id,
      status: 'pending',
      errorMessage: '',
      updatedAt: '2026-04-26T00:00:03.000Z',
    })
    expect(storedMaterial.data[0]).toMatchObject({
      status: 'parsing',
      updatedAt: '2026-04-26T00:00:03.000Z',
    })
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

  it('replaces prior partial parse output for the same job on retry', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    await db.collection('material_pages').add({
      data: {
        _id: `material_page_${job._id}_1`,
        jobId: job._id,
        materialId: material._id,
        ownerOpenid: 'user_a',
        pageNo: 1,
        text: 'stale',
        createdAt: '2026-04-26T00:00:01.500Z',
      },
    })
    await db.collection('parse_candidates').add({
      data: {
        _id: `parse_candidate_${job._id}_0`,
        jobId: job._id,
        materialId: material._id,
        ownerOpenid: 'user_a',
        questionNo: 'stale',
        status: 'invalid',
        createdAt: '2026-04-26T00:00:01.500Z',
        updatedAt: '2026-04-26T00:00:01.500Z',
      },
    })

    await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => '1. 棰樼洰\nA. 鐢瞈nB. 涔橽n绛旀锛欰',
    })

    const pages = await db.collection('material_pages').where({ materialId: material._id, ownerOpenid: 'user_a' }).get()
    const candidates = await db.collection('parse_candidates').where({ materialId: material._id, ownerOpenid: 'user_a' }).get()
    expect(pages.data).toHaveLength(1)
    expect(pages.data[0]).toMatchObject({ _id: `material_page_${job._id}_1`, jobId: job._id, text: '1. 棰樼洰\nA. 鐢瞈nB. 涔橽n绛旀锛欰' })
    expect(candidates.data).toHaveLength(1)
    expect(candidates.data[0]).toMatchObject({ _id: `parse_candidate_${job._id}_0`, jobId: job._id, questionNo: '1' })
  })

  it('passes the original material file id to extractText', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'cloud://env/materials/user_a/a.pdf', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async (inputMaterial) => {
        expect(inputMaterial.fileID).toBe('cloud://env/materials/user_a/a.pdf')
        return '1. 棰樼洰\nA. 鐢瞈nB. 涔橽n绛旀锛欰'
      },
    })
  })

  it('returns the newer active parse job over an older failed job', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    await db.collection('parse_jobs').add({
      data: {
        materialId: material._id,
        ownerOpenid: 'user_a',
        status: 'failed',
        createdAt: '2026-04-26T00:00:01.000Z',
        updatedAt: '2026-04-26T00:00:01.000Z',
      },
    })
    const newer = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:02.000Z' })

    const status = await getParseStatus({ db, openid: 'user_a', materialId: material._id })

    expect(status.job._id).toBe(newer._id)
    expect(status.job.status).toBe('pending')
  })

  it('returns existing result when job is already done', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:02.000Z', extractText: async () => '1. 题目\nA. 甲\nB. 乙\n答案：A' })
    const second = await runParseJob({ db, openid: 'user_a', jobId: job._id, now: '2026-04-26T00:00:03.000Z', extractText: async () => { throw new Error('should not run') } })

    expect(second.status).toBe('done')
  })

  it('does not extract text while a running job has a future lock', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    await db.collection('parse_jobs').doc(job._id).update({
      data: { status: 'running', lockUntil: '2026-04-26T00:10:00.000Z', updatedAt: '2026-04-26T00:00:02.000Z' },
    })

    const result = await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:03.000Z',
      extractText: async () => {
        throw new Error('should not extract while locked')
      },
    })

    expect(result.status).toBe('running')
  })

  it('does not extract text when conditional lock claim misses', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    const parseJobs = db.collection('parse_jobs')
    const originalCollection = db.collection
    const originalWhere = parseJobs.where
    db.collection = (name) => (name === 'parse_jobs' ? parseJobs : originalCollection(name))
    parseJobs.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === job._id && query.ownerOpenid === 'user_a' && query.status === 'pending' && query.updatedAt === '2026-04-26T00:00:01.000Z') {
        return {
          ...base,
          async update() {
            await parseJobs.doc(job._id).update({
              data: {
                status: 'running',
                lockToken: 'other-runner',
                lockUntil: '2026-04-26T00:10:00.000Z',
                updatedAt: '2026-04-26T00:00:01.500Z',
              },
            })
            return { stats: { updated: 0 } }
          },
        }
      }
      return base
    }

    const result = await runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => {
        throw new Error('should not extract after CAS miss')
      },
    })

    expect(result).toMatchObject({
      _id: job._id,
      status: 'running',
      lockToken: 'other-runner',
    })
  })

  it('does not let a stale failing runner overwrite done job and reviewing material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await expect(runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => {
        await db.collection('parse_jobs').doc(job._id).update({
          data: {
            status: 'done',
            lockToken: 'other-runner',
            lockUntil: '',
            finishedAt: '2026-04-26T00:00:02.500Z',
            errorMessage: '',
            updatedAt: '2026-04-26T00:00:02.500Z',
          },
        })
        await db.collection('materials').doc(material._id).update({
          data: { status: 'reviewing', errorMessage: '', updatedAt: '2026-04-26T00:00:02.500Z' },
        })
        throw new Error('stale runner failed')
      },
    })).rejects.toThrow('stale runner failed')

    const storedJob = await db.collection('parse_jobs').doc(job._id).get()
    const storedMaterial = await db.collection('materials').doc(material._id).get()
    expect(storedJob.data[0].status).toBe('done')
    expect(storedJob.data[0].errorMessage).toBe('')
    expect(storedMaterial.data[0].status).toBe('reviewing')
    expect(storedMaterial.data[0].errorMessage).toBe('')
  })

  it('does not update material when guarded failure finalization misses', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    const parseJobs = db.collection('parse_jobs')
    const originalCollection = db.collection
    const originalWhere = parseJobs.where
    const lockToken = `${job._id}_2026-04-26T00:00:02.000Z`
    db.collection = (name) => (name === 'parse_jobs' ? parseJobs : originalCollection(name))
    parseJobs.where = (query) => {
      const base = originalWhere(query)
      if (query && query._id === job._id && query.ownerOpenid === 'user_a' && query.lockToken === lockToken) {
        return {
          ...base,
          async update() {
            await parseJobs.doc(job._id).update({
              data: {
                status: 'done',
                lockToken: '',
                lockUntil: '',
                finishedAt: '2026-04-26T00:00:02.500Z',
                errorMessage: '',
                updatedAt: '2026-04-26T00:00:02.500Z',
              },
            })
            await db.collection('materials').doc(material._id).update({
              data: { status: 'reviewing', errorMessage: '', updatedAt: '2026-04-26T00:00:02.500Z' },
            })
            return { stats: { updated: 0 } }
          },
        }
      }
      return base
    }

    await expect(runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => {
        throw new Error('late failure')
      },
    })).rejects.toThrow('late failure')

    const storedJob = await db.collection('parse_jobs').doc(job._id).get()
    const storedMaterial = await db.collection('materials').doc(material._id).get()
    expect(storedJob.data[0].status).toBe('done')
    expect(storedJob.data[0].errorMessage).toBe('')
    expect(storedMaterial.data[0].status).toBe('reviewing')
    expect(storedMaterial.data[0].errorMessage).toBe('')
  })

  it('blocks running another users parse job', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })

    await expect(runParseJob({
      db,
      openid: 'user_b',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => {
        throw new Error('should not run')
      },
    })).rejects.toMatchObject({ code: 'parse_job_not_found' })
  })

  it('blocks parse status for another users material', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })

    await expect(getParseStatus({ db, openid: 'user_b', materialId: material._id })).rejects.toMatchObject({ code: 'material_not_found' })
  })

  it('does not update a material after a job loses material ownership', async () => {
    const db = createFakeDb()
    const material = await createMaterial({ db, openid: 'user_a', now: '2026-04-26T00:00:00.000Z', input: { fileID: 'file', fileName: 'a.pdf', fileSize: 1, parseMode: 'inline_answer' } })
    const job = await startParse({ db, openid: 'user_a', materialId: material._id, now: '2026-04-26T00:00:01.000Z' })
    await db.collection('materials').doc(material._id).update({ data: { ownerOpenid: 'user_b' } })

    await expect(runParseJob({
      db,
      openid: 'user_a',
      jobId: job._id,
      now: '2026-04-26T00:00:02.000Z',
      extractText: async () => {
        throw new Error('should not run')
      },
    })).rejects.toMatchObject({ code: 'material_not_found' })
    const stored = await db.collection('materials').doc(material._id).get()
    expect(stored.data[0].status).toBe('parsing')
    expect(stored.data[0].errorMessage).toBe('')
  })
})
