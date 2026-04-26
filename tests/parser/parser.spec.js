const { parseQuestions } = require('../../cloudfunctions/common/parser')

describe('parseQuestions inline_answer', () => {
  it('parses a single choice question with inline answer', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '1. 下列说法正确的是（ ）\nA. 选项一\nB. 选项二\n答案：A\n解析：基础概念题',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      questionNo: '1',
      type: 'single',
      stem: '下列说法正确的是（ ）',
      answerKeys: ['A'],
      explanation: '基础概念题',
      status: 'ready',
    })
    expect(result[0].options).toEqual([
      { key: 'A', text: '选项一' },
      { key: 'B', text: '选项二' },
    ])
  })

  it('parses a multiple choice question', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '2. 多选题\nA. 甲\nB. 乙\nC. 丙\n答案：AC',
    })

    expect(result[0].type).toBe('multiple')
    expect(result[0].answerKeys).toEqual(['A', 'C'])
    expect(result[0].status).toBe('ready')
  })

  it('parses a judge question', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '3. 水在标准大气压下 100 摄氏度沸腾。\nA. 正确\nB. 错误\n答案：正确',
    })

    expect(result[0].type).toBe('judge')
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[0].status).toBe('ready')
  })

  it('marks a question without answer as need_review', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '4. 没有答案的题\nA. 甲\nB. 乙',
    })

    expect(result[0].status).toBe('need_review')
    expect(result[0].validationErrors).toContain('missing_answer')
  })

  it('marks a block without options as invalid', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '5. 只有题干\n答案：A',
    })

    expect(result[0].status).toBe('invalid')
    expect(result[0].validationErrors).toContain('missing_options')
  })

  it('parses multi-select answers with common separators', () => {
    const cases = [
      ['答案：A、C', ['A', 'C']],
      ['答案：A C', ['A', 'C']],
      ['答案：A,C', ['A', 'C']],
    ]

    cases.forEach(([answerLine, expected]) => {
      const result = parseQuestions({
        mode: 'inline_answer',
        text: `6. 多选题\nA. 甲\nB. 乙\nC. 丙\n${answerLine}`,
      })

      expect(result[0].answerKeys).toEqual(expected)
      expect(result[0].type).toBe('multiple')
      expect(result[0].status).toBe('ready')
    })
  })

  it('parses common option marker layouts', () => {
    const cases = [
      ['7. 题干\n(A) 甲\n(B) 乙\n答案：A', [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]],
      ['7. 题干\nA) 甲\nB) 乙\n答案：A', [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]],
      ['7. 题干\nA：甲\nB：乙\n答案：A', [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]],
    ]

    cases.forEach(([text, expectedOptions]) => {
      const result = parseQuestions({ mode: 'inline_answer', text })

      expect(result[0].stem).toBe('题干')
      expect(result[0].options).toEqual(expectedOptions)
      expect(result[0].answerKeys).toEqual(['A'])
      expect(result[0].status).toBe('ready')
    })
  })

  it('parses same-line extracted options', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '8. 题干 A.甲 B.乙 答案：A',
    })

    expect(result[0].stem).toBe('题干')
    expect(result[0].options).toEqual([
      { key: 'A', text: '甲' },
      { key: 'B', text: '乙' },
    ])
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[0].status).toBe('ready')
  })

  it('keeps invalid answer references for validation', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '9. 无效答案题\nA. 甲\nB. 乙\nC. 丙\n答案：D',
    })

    expect(result[0].answerKeys).toEqual(['D'])
    expect(result[0].status).toBe('need_review')
    expect(result[0].validationErrors).toContain('answer_not_in_options')
    expect(result[0].validationErrors).not.toContain('missing_answer')
  })

  it('does not infer judge from incidental correct or wrong wording', () => {
    const result = parseQuestions({
      mode: 'inline_answer',
      text: '10. 选择表述\nA. 正确使用工具\nB. 错误使用工具\n答案：A',
    })

    expect(result[0].type).toBe('single')
  })
})

describe('parseQuestions answer_at_end', () => {
  it('matches answers from the answer section', () => {
    const result = parseQuestions({
      mode: 'answer_at_end',
      text: '1. 第一题\nA. 甲\nB. 乙\n\n2. 第二题\nA. 甲\nB. 乙\nC. 丙\n\n参考答案\n1.A\n2.BC',
    })

    expect(result).toHaveLength(2)
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[0].type).toBe('single')
    expect(result[1].answerKeys).toEqual(['B', 'C'])
    expect(result[1].type).toBe('multiple')
  })

  it('does not treat casual answer wording in a stem as the final answer section', () => {
    const result = parseQuestions({
      mode: 'answer_at_end',
      text: '1. 请选择正确答案\nA. 甲\nB. 乙\n\n2. 第二题\nA. 甲\nB. 乙\n\n参考答案\n1.A\n2.B',
    })

    expect(result).toHaveLength(2)
    expect(result[0].stem).toBe('请选择正确答案')
    expect(result[0].answerKeys).toEqual(['A'])
    expect(result[1].answerKeys).toEqual(['B'])
  })

  it('parses separated multi-select answers in the final answer section', () => {
    const result = parseQuestions({
      mode: 'answer_at_end',
      text: '1. 第一题\nA. 甲\nB. 乙\n\n2. 第二题\nA. 甲\nB. 乙\nC. 丙\n\n参考答案\n1.A\n2. B、C',
    })

    expect(result[1].answerKeys).toEqual(['B', 'C'])
    expect(result[1].type).toBe('multiple')
  })
})
