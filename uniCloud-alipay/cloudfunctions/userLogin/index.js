function requireShared(path) {
  try {
    return require(`shuati-shared/${path}`)
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
    return require(`../common/shuati-shared/${path}`)
  }
}

const { createDbCompat } = requireShared('db')
const { ok, toErrorResponse, assertRequired } = requireShared('response')
const { upsertUser } = requireShared('services/userService')

async function handleUserLogin({ event = {}, db, now, loginByWeixin }) {
  assertRequired(event.code, 'missing_login_code', '缺少登录凭证')

  const loginResult = await loginByWeixin({ code: event.code })
  if (loginResult.code && loginResult.code !== 0) {
    const error = new Error(loginResult.msg || loginResult.message || '登录失败')
    error.code = loginResult.code
    throw error
  }

  const uid = loginResult.uid
  assertRequired(uid, 'missing_uid', '登录结果缺少用户 ID')

  const user = await upsertUser({ db, openid: uid, now })
  return {
    token: loginResult.token || '',
    tokenExpired: loginResult.tokenExpired || loginResult.token_expired || 0,
    user: {
      ...user,
      uid,
      openid: uid,
    },
  }
}

exports.main = async (event = {}) => {
  const uniID = require('uni-id')
  const db = createDbCompat(uniCloud.database())
  const now = new Date().toISOString()
  try {
    const data = await handleUserLogin({
      event,
      db,
      now,
      loginByWeixin: (params) => uniID.loginByWeixin(params),
    })
    return ok(data)
  } catch (error) {
    return toErrorResponse(error)
  }
}

module.exports.handleUserLogin = handleUserLogin
