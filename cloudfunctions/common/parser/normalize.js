function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeAnswer(raw, options) {
  const value = String(raw || '').trim().replace(/\s/g, '').toUpperCase()
  const judgeMap = {
    正确: 'A',
    对: 'A',
    '√': 'A',
    错误: 'B',
    错: 'B',
    '×': 'B',
    姝ｇ: 'A',
    '姝ｇ‘': 'A',
    瀵: 'A',
    '瀵?': 'A',
    '鈭?': 'A',
    閿: 'B',
    '閿?': 'B',
    閿欒: 'B',
    '閿欒': 'B',
    脳: 'B',
  }
  const mapped = judgeMap[value] || value
  return mapped
    .split('')
    .filter((key, index, arr) => /^[A-H]$/.test(key) && arr.indexOf(key) === index)
}

function inferType(options, answerKeys) {
  const optionTexts = options.map((option) => option.text.trim())
  const judgePairs = [
    ['正确', '错误'],
    ['对', '错'],
    ['姝ｇ‘', '閿欒'],
    ['瀵?', '閿?'],
  ]
  const isJudge = options.length === 2 && judgePairs.some(([truthy, falsy]) => {
    return optionTexts.includes(truthy) && optionTexts.includes(falsy)
  })

  if (isJudge) {
    return 'judge'
  }
  return answerKeys.length > 1 ? 'multiple' : 'single'
}

module.exports = {
  inferType,
  normalizeAnswer,
  normalizeText,
}
