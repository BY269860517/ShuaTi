function requireOpenid(context) {
  const openid = context && context.OPENID
  if (!openid) {
    const error = new Error('缺少用户身份')
    error.code = 'unauthorized'
    throw error
  }
  return openid
}

module.exports = {
  requireOpenid,
}
