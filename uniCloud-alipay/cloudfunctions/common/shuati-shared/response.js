function ok(data = {}) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function assertRequired(value, code, message) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(message)
    error.code = code
    throw error
  }
}

function toErrorResponse(error) {
  return fail(error.code || 'internal_error', error.message || '服务异常')
}

module.exports = {
  assertRequired,
  fail,
  ok,
  toErrorResponse,
}
