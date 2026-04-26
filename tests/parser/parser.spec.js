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
})
