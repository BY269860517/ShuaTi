import { describe, expect, test } from 'vitest'
import {
  getPracticeCreateErrorMessage,
  normalizeCustomCountInput,
  resolvePracticeCount,
} from '../../common/practiceSettings'

describe('practice settings helpers', () => {
  test('normalizes custom count input as a positive integer string only', () => {
    expect(normalizeCustomCountInput('1.5')).toBe('')
    expect(normalizeCustomCountInput('1e2')).toBe('')
    expect(normalizeCustomCountInput('0012')).toBe('12')
    expect(normalizeCustomCountInput('000')).toBe('0')
    expect(normalizeCustomCountInput('abc')).toBe('')
    expect(normalizeCustomCountInput('')).toBe('')
  })

  test('resolves custom count to at least one for empty or zero input', () => {
    expect(resolvePracticeCount({
      countMode: 'custom',
      selectedFixedCount: 10,
      customCountInput: '',
      filteredQuestionCount: 20,
    })).toBe(1)
    expect(resolvePracticeCount({
      countMode: 'custom',
      selectedFixedCount: 10,
      customCountInput: '0',
      filteredQuestionCount: 20,
    })).toBe(1)
  })

  test('resolves all count from filtered question count with a minimum of one', () => {
    expect(resolvePracticeCount({
      countMode: 'all',
      selectedFixedCount: 10,
      customCountInput: '5',
      filteredQuestionCount: 12,
    })).toBe(12)
    expect(resolvePracticeCount({
      countMode: 'all',
      selectedFixedCount: 10,
      customCountInput: '5',
      filteredQuestionCount: 0,
    })).toBe(1)
  })

  test('resolves fixed count with a minimum of one', () => {
    expect(resolvePracticeCount({
      countMode: 'fixed',
      selectedFixedCount: 0,
      customCountInput: '5',
      filteredQuestionCount: 20,
    })).toBe(1)
    expect(resolvePracticeCount({
      countMode: 'fixed',
      selectedFixedCount: Number.NaN,
      customCountInput: '5',
      filteredQuestionCount: 20,
    })).toBe(1)
  })

  test('maps no unattempted backend error to user-facing Chinese copy', () => {
    const error = Object.assign(new Error('no unattempted'), { code: 'practice_no_unattempted_questions' })

    expect(getPracticeCreateErrorMessage(error)).toBe('当前筛选条件下没有未练习题目')
    expect(getPracticeCreateErrorMessage(new Error('backend failed'))).toBe('backend failed')
    expect(getPracticeCreateErrorMessage('failed')).toBe('练习创建失败，请重试')
  })
})
