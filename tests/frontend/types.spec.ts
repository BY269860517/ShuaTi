import { describe, expect, test } from 'vitest'
import type { Candidate, SafeQuestion } from '../../common/types'

describe('frontend shared types', () => {
  test('question numbers match backend string values', () => {
    const candidate: Pick<Candidate, 'questionNo'> = { questionNo: '1' }
    const question: Pick<SafeQuestion, 'questionNo'> = { questionNo: '2' }

    expect(candidate.questionNo).toBe('1')
    expect(question.questionNo).toBe('2')
  })
})
