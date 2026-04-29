function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function getTrustedContextUid(context = {}) {
  return (context.auth && context.auth.uid) ||
    (context.AUTH && context.AUTH.uid) ||
    context.uid ||
    ''
}

function getEventToken(event = {}) {
  return event._uniToken ||
    event.uniToken ||
    event.uniIdToken ||
    event.uni_id_token ||
    ''
}

async function defaultCheckToken(token, context = {}) {
  const uniIdCommon = require('uni-id-common')
  const uniID = uniIdCommon.createInstance({ context })
  const result = await uniID.checkToken(token)
  if (result && result.errCode) {
    const error = createError('unauthorized', result.errMsg || result.message || '登录已失效')
    error.detail = result
    throw error
  }
  return result
}

async function requireUidFromEvent({ event = {}, context = {}, checkToken = defaultCheckToken } = {}) {
  const trustedUid = getTrustedContextUid(context)
  if (trustedUid) return { uid: trustedUid }

  const token = getEventToken(event)
  if (!token) throw createError('unauthorized', '缺少用户身份')

  const result = await checkToken(token, context)
  const uid = result && result.uid
  if (!uid) throw createError('unauthorized', '用户身份无效')

  return {
    uid,
    token: result.token || '',
    tokenExpired: result.tokenExpired || 0,
    role: Array.isArray(result.role) ? result.role : [],
    permission: Array.isArray(result.permission) ? result.permission : [],
  }
}

module.exports = {
  getEventToken,
  requireUidFromEvent,
}
