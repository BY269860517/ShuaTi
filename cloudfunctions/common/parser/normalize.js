function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeAnswer(raw, options) {
  const value = String(raw || '').replace(/\s/g, '').toUpperCase()
  const judgeMap = {
    正确: 'A',
    对: 'A',
    '√': 'A',
    错误: 'B',
    错: 'B',
    '×': 'B',
  }
  const mapped = judgeMap[value] || value
  const optionKeys = new Set((options || []).map((option) => option.key))
  return mapped
    .split('')
    .filter((key, index, arr) => /^[A-H]$/.test(key) && arr.indexOf(key) === index)
    .filter((key) => optionKeys.size === 0 || optionKeys.has(key))
}

function inferType(options, answerKeys) {
  const optionText = options.map((option) => option.text).join('')
  if (/正确|错误|对|错/.test(optionText) && options.length <= 2) {
    return 'judge'
  }
  return answerKeys.length > 1 ? 'multiple' : 'single'
}

module.exports = {
  inferType,
  normalizeAnswer,
  normalizeText,
}
