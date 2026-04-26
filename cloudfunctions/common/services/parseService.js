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

async function startParse({ db, openid, materialId, now }) {
  const material = await getMaterialDetail({ db, openid, materialId })
  const existing = await db.collection('parse_jobs').where({ materialId, ownerOpenid: openid }).get()
  const active = selectActiveJob(existing.data)
  if (active) return active

  const data = {
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

  const created = await db.collection('parse_jobs').add({ data })
  await db.collection('materials').doc(material._id).update({ data: { status: 'parsing', updatedAt: now } })
  return { _id: created._id, ...data }
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

  await db.collection('parse_jobs').doc(job._id).update({
    data: {
      status: 'running',
      lockUntil: new Date(Date.parse(now) + 5 * 60 * 1000).toISOString(),
      startedAt: job.startedAt || now,
      updatedAt: now,
    },
  })

  try {
    const material = await getMaterialForOwner({ db, openid, materialId: job.materialId })
    const text = await extractText(material)
    if (!text || !text.trim()) throw new Error('PDF 无可解析文本')

    await db.collection('material_pages').add({
      data: {
        materialId: material._id,
        ownerOpenid: openid,
        pageNo: 1,
        text,
        createdAt: now,
      },
    })

    const candidates = parseQuestions({ text, mode: material.parseMode })
    for (const candidate of candidates) {
      await db.collection('parse_candidates').add({
        data: {
          ...candidate,
          materialId: material._id,
          ownerOpenid: openid,
          importedQuestionId: '',
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    const stats = countStatuses(candidates)
    const materialStatus = candidates.length > 0 ? 'reviewing' : 'failed'
    const errorMessage = candidates.length > 0 ? '' : '未解析出题目'
    await db.collection('materials').doc(material._id).update({
      data: {
        status: materialStatus,
        questionCount: candidates.length,
        ...stats,
        errorMessage,
        updatedAt: now,
      },
    })
    await db.collection('parse_jobs').doc(job._id).update({
      data: {
        status: candidates.length > 0 ? 'done' : 'failed',
        finishedAt: now,
        lockUntil: '',
        stats,
        errorMessage,
        updatedAt: now,
      },
    })

    return { ...job, status: candidates.length > 0 ? 'done' : 'failed', stats, errorMessage }
  } catch (error) {
    await db.collection('parse_jobs').doc(job._id).update({
      data: { status: 'failed', finishedAt: now, lockUntil: '', errorMessage: error.message, updatedAt: now },
    })
    await db.collection('materials').doc(job.materialId).update({
      data: { status: 'failed', errorMessage: error.message, updatedAt: now },
    })
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
