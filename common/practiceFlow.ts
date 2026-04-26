import type { AnswerSubmitResult } from './types'

export type PracticeButtonIntent = 'submit' | 'submitting' | 'next' | 'result'
export type PracticeAfterGradingIntent = 'submit' | 'next' | 'result'

export interface PracticeFlowData {
  questionIds: string[]
  currentIndex: number
  selectedByQuestionId: Record<string, string[]>
  gradingResults: Record<string, AnswerSubmitResult>
}

export function createPracticeFlowData(questionIds: string[] = []): PracticeFlowData {
  return {
    questionIds,
    currentIndex: 0,
    selectedByQuestionId: {},
    gradingResults: {},
  }
}

export function resetPracticeFlow(flow: PracticeFlowData, questionIds: string[]) {
  flow.questionIds = questionIds
  flow.currentIndex = 0
  flow.selectedByQuestionId = {}
  flow.gradingResults = {}
}

export function currentQuestionId(flow: PracticeFlowData): string {
  return flow.questionIds[flow.currentIndex] || ''
}

export function isLastQuestion(flow: PracticeFlowData): boolean {
  return flow.currentIndex >= Math.max(flow.questionIds.length - 1, 0)
}

export function selectedKeys(flow: PracticeFlowData, questionId = currentQuestionId(flow)): string[] {
  if (!questionId) return []
  return flow.selectedByQuestionId[questionId] || []
}

export function gradingResult(
  flow: PracticeFlowData,
  questionId = currentQuestionId(flow),
): AnswerSubmitResult | null {
  if (!questionId) return null
  return flow.gradingResults[questionId] || null
}

export function selectAnswer(flow: PracticeFlowData, questionId: string, keys: string[]): boolean {
  if (!questionId || gradingResult(flow, questionId)) return false
  flow.selectedByQuestionId[questionId] = keys
  return true
}

export function recordGradingResult(flow: PracticeFlowData, result: AnswerSubmitResult) {
  flow.gradingResults[result.questionId] = result
}

export function canSubmit(flow: PracticeFlowData, submitting = false): boolean {
  if (submitting) return false
  const questionId = currentQuestionId(flow)
  return Boolean(questionId && selectedKeys(flow, questionId).length > 0 && !gradingResult(flow, questionId))
}

export function buttonIntent(flow: PracticeFlowData, submitting = false): PracticeButtonIntent {
  if (submitting) return 'submitting'
  const result = gradingResult(flow)
  if (result) return isLastQuestion(flow) ? 'result' : 'next'
  return 'submit'
}

export function afterGradingIntent(flow: PracticeFlowData): PracticeAfterGradingIntent {
  if (!gradingResult(flow)) return 'submit'
  return isLastQuestion(flow) ? 'result' : 'next'
}

export function advanceToNext(flow: PracticeFlowData): boolean {
  if (isLastQuestion(flow)) return false
  flow.currentIndex += 1
  return true
}

export function createPracticeFlowState(questionIds: string[] = []) {
  const flow = createPracticeFlowData(questionIds)

  return {
    flow,
    currentQuestionId: () => currentQuestionId(flow),
    selectedKeys: (questionId?: string) => selectedKeys(flow, questionId),
    gradingResult: (questionId?: string) => gradingResult(flow, questionId),
    isLastQuestion: () => isLastQuestion(flow),
    canSubmit: (submitting = false) => canSubmit(flow, submitting),
    buttonIntent: (submitting = false) => buttonIntent(flow, submitting),
    afterGradingIntent: () => afterGradingIntent(flow),
    selectAnswer: (questionId: string, keys: string[]) => selectAnswer(flow, questionId, keys),
    recordGradingResult: (result: AnswerSubmitResult) => recordGradingResult(flow, result),
    advanceToNext: () => advanceToNext(flow),
    reset: (questionIds: string[]) => resetPracticeFlow(flow, questionIds),
  }
}
