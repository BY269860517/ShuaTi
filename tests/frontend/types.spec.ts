import { describe, expect, test } from 'vitest'
import type {
  Candidate,
  PracticeCountMode,
  PracticeOrderMode,
  PracticeQuestionTypeFilter,
  PracticeScope,
  PracticeSession,
  SafeQuestion,
  WrongQuestionItem,
} from '../../common/types'

describe('frontend shared types', () => {
  test('question numbers match backend string values', () => {
    const candidate: Pick<Candidate, 'questionNo'> = { questionNo: '1' }
    const question: Pick<SafeQuestion, 'questionNo'> = { questionNo: '2' }

    expect(candidate.questionNo).toBe('1')
    expect(question.questionNo).toBe('2')
  })

  test('wrong question item exposes minimal review and practice metadata', () => {
    const item: WrongQuestionItem = {
      _id: 'wrong_questions_1',
      questionId: 'questions_1',
      materialId: 'material_1',
      status: 'active',
      wrongCount: 2,
      correctStreak: 1,
      lastWrongAt: '2026-04-30T00:00:00.000Z',
      masteredAt: '',
      question: {
        _id: 'questions_1',
        materialId: 'material_1',
        type: 'single',
        stem: '题干',
        options: [{ key: 'A', text: '选项 A' }],
      },
    }

    expect(item.status).toBe('active')
    expect(item.question.answerKeys).toBeUndefined()
  })

  test('practice session can identify wrong-practice mode', () => {
    const session: Pick<PracticeSession, 'mode' | 'materialId'> = {
      mode: 'wrong',
      materialId: '',
    }

    expect(session.mode).toBe('wrong')
  })

  test('practice session exposes setup choices', () => {
    const countMode: PracticeCountMode = 'custom'
    const orderMode: PracticeOrderMode = 'random'
    const scope: PracticeScope = 'unattempted'
    const questionType: PracticeQuestionTypeFilter = 'judge'
    const session: Pick<PracticeSession, 'countMode' | 'requestedCount' | 'orderMode' | 'scope' | 'questionType'> = {
      countMode,
      requestedCount: 8,
      orderMode,
      scope,
      questionType,
    }

    expect(session).toEqual({
      countMode: 'custom',
      requestedCount: 8,
      orderMode: 'random',
      scope: 'unattempted',
      questionType: 'judge',
    })
  })
})
