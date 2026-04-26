function validateCandidate(candidate) {
  const validationErrors = []

  if (!candidate.stem) {
    validationErrors.push('missing_stem')
  }

  if (!Array.isArray(candidate.options) || candidate.options.length === 0) {
    validationErrors.push('missing_options')
  }

  if (!Array.isArray(candidate.answerKeys) || candidate.answerKeys.length === 0) {
    validationErrors.push('missing_answer')
  }

  const optionKeys = new Set((candidate.options || []).map((option) => option.key))
  const invalidAnswer = (candidate.answerKeys || []).some((key) => !optionKeys.has(key))
  if (invalidAnswer) {
    validationErrors.push('answer_not_in_options')
  }

  let status = 'ready'
  if (validationErrors.includes('missing_stem') || validationErrors.includes('missing_options')) {
    status = 'invalid'
  } else if (validationErrors.length > 0) {
    status = 'need_review'
  }

  return {
    ...candidate,
    validationErrors,
    status,
  }
}

module.exports = {
  validateCandidate,
}
