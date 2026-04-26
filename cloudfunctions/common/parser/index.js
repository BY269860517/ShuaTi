const { inferType, normalizeAnswer, normalizeText } = require('./normalize')
const { validateCandidate } = require('./validate')

function splitQuestionBlocks(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  return normalized
    .split(/\n(?=\s*\d+[.、．]\s*)/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function extractQuestionNo(block) {
  const match = block.match(/^\s*(\d+)[.、．]\s*/)
  return match ? match[1] : ''
}

function extractAnswer(block) {
  const match = block.match(/(?:答案|正确答案|参考答案)\s*[:：]?\s*([A-Ha-h正确错误对错√×]+)/)
  return match ? match[1] : ''
}

function extractExplanation(block) {
  const match = block.match(/解析\s*[:：]\s*([\s\S]*)$/)
  return match ? normalizeText(match[1]) : ''
}

function stripAnswerAndExplanation(block) {
  return block
    .replace(/(?:答案|正确答案|参考答案)\s*[:：]?\s*[A-Ha-h正确错误对错√×]+[\s\S]*$/m, '')
    .replace(/解析\s*[:：][\s\S]*$/m, '')
    .trim()
}

function parseOptions(lines) {
  const options = []
  const stemLines = []
  let currentOption = null

  lines.forEach((line) => {
    const optionMatch = line.match(/^\s*([A-Ha-h])[.、．]\s*(.+)$/)
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
    stem: stemLines.join(' ').replace(/^\d+[.、．]\s*/, '').trim(),
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

function extractAnswerSection(text) {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:参考答案|答案)[\s\S]*$/)
  if (!match) {
    return { questionText: text, answerMap: new Map() }
  }

  const answerSection = match[0]
  const questionText = normalized.slice(0, normalized.indexOf(answerSection)).trim()
  const answerMap = new Map()
  const answerRegex = /(\d+)\s*[.、:：]\s*([A-Ha-h正确错误对错√×]+)/g
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
