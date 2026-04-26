const { inferType, normalizeAnswer, normalizeText } = require('./normalize')
const { validateCandidate } = require('./validate')

const QUESTION_MARKER = '[.、．]'
const ANSWER_LABELS = ['答案', '正确答案', '参考答案', '绛旀', '姝ｇ‘绛旀', '鍙傝€冪瓟妗']
const EXPLANATION_LABELS = ['解析', '瑙ｆ瀽']

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function labelPattern(labels) {
  return labels.map(escapeRegExp).join('|')
}

function splitQuestionBlocks(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const questionStart = new RegExp(`\\n(?=\\s*\\d+${QUESTION_MARKER}\\s*)`, 'g')
  return normalized
    .split(questionStart)
    .map((block) => block.trim())
    .filter(Boolean)
}

function extractQuestionNo(block) {
  const match = block.match(new RegExp(`^\\s*(\\d+)${QUESTION_MARKER}\\s*`))
  return match ? match[1] : ''
}

function extractAnswer(block) {
  const answerRegex = new RegExp(
    `(?:${labelPattern(ANSWER_LABELS)})\\s*[:：锛]\\s*([A-Ha-h正确错误对错√×姝ｇ‘閿欒瀵归敊鈭毭梋\\s,，、]+)`,
  )
  const match = block.match(answerRegex)
  return match ? match[1] : ''
}

function extractExplanation(block) {
  const explanationRegex = new RegExp(`(?:${labelPattern(EXPLANATION_LABELS)})\\s*[:：锛]\\s*([\\s\\S]*)$`)
  const match = block.match(explanationRegex)
  return match ? normalizeText(match[1]) : ''
}

function stripAnswerAndExplanation(block) {
  const answerRegex = new RegExp(
    `(?:${labelPattern(ANSWER_LABELS)})\\s*[:：锛]\\s*[A-Ha-h正确错误对错√×姝ｇ‘閿欒瀵归敊鈭毭梋\\s,，、]+[\\s\\S]*$`,
    'm',
  )
  const explanationRegex = new RegExp(`(?:${labelPattern(EXPLANATION_LABELS)})\\s*[:：锛][\\s\\S]*$`, 'm')
  return block
    .replace(answerRegex, '')
    .replace(explanationRegex, '')
    .trim()
}

function splitInlineOptions(line) {
  const optionMarker = /(\(?[A-Ha-h]\)?\s*(?:[.、．):：])\s*)/g
  const parts = []
  let lastIndex = 0
  let match = optionMarker.exec(line)

  while (match) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index).trim())
    }
    const nextIndex = optionMarker.lastIndex
    const nextMatch = optionMarker.exec(line)
    const optionTextEnd = nextMatch ? nextMatch.index : line.length
    parts.push(`${match[1]}${line.slice(nextIndex, optionTextEnd).trim()}`.trim())
    lastIndex = optionTextEnd
    match = nextMatch
  }

  if (lastIndex === 0) {
    return [line]
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex).trim())
  }

  return parts.filter(Boolean)
}

function expandInlineOptions(lines) {
  return lines.flatMap((line) => splitInlineOptions(line))
}

function parseOptions(lines) {
  const options = []
  const stemLines = []
  let currentOption = null
  const expandedLines = expandInlineOptions(lines)

  expandedLines.forEach((line) => {
    const optionMatch = line.match(/^\s*\(?([A-Ha-h])\)?\s*(?:[.、．):：])\s*(.+)$/)
    if (optionMatch) {
      currentOption = {
        key: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim(),
      }
      options.push(currentOption)
      return
    }

    if (currentOption) {
      currentOption.text = `${currentOption.text} ${line.trim()}`.trim()
    } else {
      stemLines.push(line.trim())
    }
  })

  return {
    stem: stemLines.join(' ').replace(new RegExp(`^\\d+${QUESTION_MARKER}\\s*`), '').trim(),
    options,
  }
}

function parseBlock(block, answerMap) {
  const questionNo = extractQuestionNo(block)
  const rawAnswer = answerMap?.get(questionNo) || extractAnswer(block)
  const explanation = extractExplanation(block)
  const contentBlock = stripAnswerAndExplanation(block)
  const lines = contentBlock.split('\n').map((line) => line.trim()).filter(Boolean)
  const { stem, options } = parseOptions(lines)
  const answerKeys = normalizeAnswer(rawAnswer, options)
  const type = inferType(options, answerKeys)

  return validateCandidate({
    questionNo,
    type,
    stem,
    options,
    answerKeys,
    explanation,
    sourceText: block,
    sourcePageNo: null,
  })
}

function findAnswerSectionStart(lines) {
  const headingRegex = new RegExp(`^\\s*(?:${labelPattern(ANSWER_LABELS)})\\s*[:：锛]?\\s*$`)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (headingRegex.test(lines[index]) && index >= Math.floor(lines.length / 2)) {
      return index
    }
  }
  return -1
}

function extractAnswerSection(text) {
  const normalized = normalizeText(text)
  const lines = normalized.split('\n')
  const headingIndex = findAnswerSectionStart(lines)
  if (headingIndex === -1) {
    return { questionText: text, answerMap: new Map() }
  }

  const questionText = lines.slice(0, headingIndex).join('\n').trim()
  const answerSection = lines.slice(headingIndex + 1).join('\n')
  const answerMap = new Map()
  const answerRegex = /(\d+)\s*[.、:：]\s*([A-Ha-h正确错误对错√×姝ｇ‘閿欒瀵归敊鈭毭梋\s,，、]+)/g
  let answerMatch = answerRegex.exec(answerSection)

  while (answerMatch) {
    answerMap.set(answerMatch[1], answerMatch[2])
    answerMatch = answerRegex.exec(answerSection)
  }

  return { questionText, answerMap }
}

function parseQuestions({ text, mode }) {
  if (mode !== 'inline_answer' && mode !== 'answer_at_end') {
    throw new Error(`Unsupported parse mode: ${mode}`)
  }

  if (mode === 'answer_at_end') {
    const { questionText, answerMap } = extractAnswerSection(text)
    return splitQuestionBlocks(questionText).map((block) => parseBlock(block, answerMap))
  }

  return splitQuestionBlocks(text).map((block) => parseBlock(block))
}

module.exports = {
  parseQuestions,
}
