import { describe, expect, test } from 'vitest'
import type { AnswerSubmitResult } from '../../common/types'
import { createPracticeFlowState } from '../../common/practiceFlow'

function grading(questionId: string, isCorrect = true): AnswerSubmitResult {
  return {
    questionId,
    selectedKeys: ['A'],
    isCorrect,
    answerKeys: ['A'],
    explanation: 'ok',
  }
}

describe('practice flow state', () => {
  test('allows submit after first answer selection', () => {
    const flow = createPracticeFlowState(['q1', 'q2'])

    expect(flow.canSubmit()).toBe(false)
    flow.selectAnswer('q1', ['A'])

    expect(flow.selectedKeys()).toEqual(['A'])
    expect(flow.canSubmit()).toBe(true)
    expect(flow.buttonIntent(false)).toBe('submit')
  })

  test('locks current answer after grading result is stored', () => {
    const flow = createPracticeFlowState(['q1', 'q2'])

    flow.selectAnswer('q1', ['A'])
    flow.recordGradingResult(grading('q1'))
    flow.selectAnswer('q1', ['B'])

    expect(flow.selectedKeys()).toEqual(['A'])
    expect(flow.gradingResult()).toMatchObject({ questionId: 'q1', isCorrect: true })
    expect(flow.canSubmit()).toBe(false)
  })

  test('returns next intent before final question and result intent on final question', () => {
    const flow = createPracticeFlowState(['q1', 'q2'])

    flow.selectAnswer('q1', ['A'])
    flow.recordGradingResult(grading('q1'))
    expect(flow.afterGradingIntent()).toBe('next')

    flow.advanceToNext()
    flow.selectAnswer('q2', ['B'])
    flow.recordGradingResult(grading('q2', false))
    expect(flow.afterGradingIntent()).toBe('result')
  })

  test('keeps the same question submittable when submit retry is needed', () => {
    const flow = createPracticeFlowState(['q1', 'q2'])

    flow.selectAnswer('q1', ['A'])

    expect(flow.canSubmit()).toBe(true)
    expect(flow.currentQuestionId()).toBe('q1')
    expect(flow.afterGradingIntent()).toBe('submit')
  })
})
