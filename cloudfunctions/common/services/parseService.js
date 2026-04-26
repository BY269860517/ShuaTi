const { parseQuestions } = require('../parser')
const { assertRequired } = require('../response')
const { getMaterialDetail, getMaterialForOwner } = require('./materialService')

const ACTIVE_JOB_STATUSES = new Set(['pending', 'running', 'done'])

function countStatuses(candidates) {
  return {
    readyCandidateCount: candidates.filter((item) => item.status === 'ready').length,
    needReviewCandidateCount: candidates.filter((item) => item.status === 'need_review').length,
    invalidCandidateCount: candidates.filter((item) => item.status === 'invalid').length,
  }
}

function getJobTimestamp(job) {
  return job.updatedAt || job.createdAt || ''
}

function sortNewestJobs(jobs) {
  return [...jobs].sort((left, right) => {
    const leftTime = getJobTimestamp(left)
    const rightTime = getJobTimestamp(right)
    if (leftTime !== rightTime) return leftTime > rightTime ? -1 : 1
    return String(left._id || '') > String(right._id || '') ? -1 : 1
  })
}

function selectActiveJob(jobs) {
  return sortNewestJobs(jobs).find((job) => ACTIVE_JOB_STATUSES.has(job.status)) || null
}

function selectStatusJob(jobs) {
  const sorted = sortNewestJobs(jobs)
  return sorted.find((job) => ACTIVE_JOB_STATUSES.has(job.status)) || sorted[0] || null
}

function createParseJobId(materialId) {
  return `parse_job_${materialId}`
}

function createMaterialPageId(jobId, pageNo) {
  return `material_page_${jobId}_${pageNo}`
}

function createParseCandidateId(jobId, index) {
  return `parse_candidate_${jobId}_${index}`
}

function createLockToken(jobId, now) {
  return `${jobId}_${now}`
}

async function addOrUpdateById(collection, data) {
  try {
    await collection.add({ data })
  } catch (error) {
    if (error.code !== 'duplicate_key') throw error
    await collection.doc(data._id).update({ data })
  }
}

async function resetParseJob({ db, job, material, now }) {
  const data = {
    status: 'pending',
    lockUntil: '',
    lockToken: '',
    startedAt: '',
    finishedAt: '',
    errorMessage: '',
    stats: {},
    updatedAt: now,
  }
  await db.collection('parse_jobs').doc(job._id).update({ data })
  await db.collection('materials').doc(material._id).update({
    data: { status: 'parsing', errorMessage: '', updatedAt: now },
  })
  return { ...job, ...data }
}

async function startParse({ db, openid, materialId, now }) {
  const material = await getMaterialDetail({ db, openid, materialId })
  const existing = await db.collection('parse_jobs').where({ materialId, ownerOpenid: openid }).get()
  const active = selectActiveJob(existing.data)
  if (active) return active
  const reusable = existing.data.find((job) => job._id === createParseJobId(materialId)) || selectStatusJob(existing.data)
  if (reusable) {
    return resetParseJob({ db, job: reusable, material, now })
  }

  const data = {
    _id: createParseJobId(materialId),
    materialId,
    ownerOpenid: openid,
    status: 'pending',
    lockUntil: '',
    startedAt: '',
    finishedAt: '',
    errorMessage: '',
    stats: {},
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.collection('parse_jobs').add({ data })
  } catch (error) {
    if (error.code !== 'duplicate_key') throw error
    const raced = await db.collection('parse_jobs').where({ _id: data._id, ownerOpenid: openid }).get()
    const job = raced.data[0]
    if (job && ACTIVE_JOB_STATUSES.has(job.status)) return job
    if (job) return resetParseJob({ db, job, material, now })
    throw error
  }
  await db.collection('materials').doc(material._id).update({ data: { status: 'parsing', updatedAt: now } })
  return data
}

async function getJobForUser({ db, openid, jobId }) {
  assertRequired(jobId, 'missing_job_id', '缺少解析任务 ID')

  const result = await db.collection('parse_jobs').where({ _id: jobId, ownerOpenid: openid }).get()
  const job = result.data[0]
  if (!job) {
    const error = new Error('解析任务不存在')
    error.code = 'parse_job_not_found'
    throw error
  }
  return job
}

async function runParseJob({ db, openid, jobId, now, extractText }) {
  const job = await getJobForUser({ db, openid, jobId })
  if (job.status === 'done') return job
  if (job.status === 'running' && job.lockUntil && job.lockUntil > now) {
    return job
  }

  const lockToken = createLockToken(job._id, now)
  const lockUntil = new Date(Date.parse(now) + 5 * 60 * 1000).toISOString()
  const claim = await db.collection('parse_jobs').where({
    _id: job._id,
    ownerOpenid: openid,
    status: job.status,
    updatedAt: job.updatedAt,
  }).update({
    data: {
      status: 'running',
      lockToken,
      lockUntil,
      startedAt: job.startedAt || now,
      updatedAt: now,
    },
  })
  if (claim.stats.updated !== 1) {
    return getJobForUser({ db, openid, jobId })
  }

  const lockedJob = await getJobForUser({ db, openid, jobId })
  if (lockedJob.lockToken !== lockToken) {
    return lockedJob
  }

  let material = null
  try {
    material = await getMaterialForOwner({ db, openid, materialId: job.materialId })
    const text = await extractText(material)
    if (!text || !text.trim()) throw new Error('PDF 无可解析文本')

    await addOrUpdateById(db.collection('material_pages'), {
      _id: createMaterialPageId(job._id, 1),
      jobId: job._id,
      materialId: material._id,
      ownerOpenid: openid,
      pageNo: 1,
      text,
      createdAt: now,
    })

    const candidates = parseQuestions({ text, mode: material.parseMode })
    for (const [index, candidate] of candidates.entries()) {
      await addOrUpdateById(db.collection('parse_candidates'), {
        _id: createParseCandidateId(job._id, index),
        ...candidate,
        jobId: job._id,
        materialId: material._id,
        ownerOpenid: openid,
        importedQuestionId: '',
        createdAt: now,
        updatedAt: now,
      })
    }

    const stats = countStatuses(candidates)
    const materialStatus = candidates.length > 0 ? 'reviewing' : 'failed'
    const errorMessage = candidates.length > 0 ? '' : '未解析出题目'
    const finalJob = await getJobForUser({ db, openid, jobId })
    if (finalJob.status === 'done' || finalJob.lockToken !== lockToken) {
      return finalJob
    }

    const finish = await db.collection('parse_jobs').where({ _id: job._id, ownerOpenid: openid, lockToken }).update({
      data: {
        status: candidates.length > 0 ? 'done' : 'failed',
        finishedAt: now,
        lockUntil: '',
        lockToken: '',
        stats,
        errorMessage,
        updatedAt: now,
      },
    })
    if (finish.stats.updated !== 1) {
      return getJobForUser({ db, openid, jobId })
    }

    await db.collection('materials').doc(material._id).update({
      data: {
        status: materialStatus,
        questionCount: candidates.length,
        ...stats,
        errorMessage,
        updatedAt: now,
      },
    })

    return { ...job, status: candidates.length > 0 ? 'done' : 'failed', stats, errorMessage }
  } catch (error) {
    const currentJob = await getJobForUser({ db, openid, jobId })
    if (currentJob.status === 'done' || currentJob.lockToken !== lockToken) {
      throw error
    }
    await db.collection('parse_jobs').where({ _id: job._id, ownerOpenid: openid, lockToken }).update({
      data: { status: 'failed', finishedAt: now, lockUntil: '', lockToken: '', errorMessage: error.message, updatedAt: now },
    })
    if (material) {
      await db.collection('materials').doc(material._id).update({
        data: { status: 'failed', errorMessage: error.message, updatedAt: now },
      })
    }
    throw error
  }
}

async function getParseStatus({ db, openid, materialId }) {
  const material = await getMaterialDetail({ db, openid, materialId })
  const jobs = await db.collection('parse_jobs').where({ materialId, ownerOpenid: openid }).get()
  return { material, job: selectStatusJob(jobs.data) }
}

module.exports = {
  getParseStatus,
  runParseJob,
  startParse,
}
