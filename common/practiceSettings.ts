import type { PracticeCountMode } from './types'

interface ResolvePracticeCountInput {
  countMode: PracticeCountMode
  selectedFixedCount: number
  customCountInput: string
  filteredQuestionCount: number
}

export function normalizeCustomCountInput(value: unknown): string {
  const rawValue = String(value ?? '').trim()
  if (!/^\d+$/.test(rawValue)) return ''

  const normalizedValue = rawValue.replace(/^0+/, '')
  return normalizedValue || '0'
}

export function resolvePracticeCount({
  countMode,
  selectedFixedCount,
  customCountInput,
  filteredQuestionCount,
}: ResolvePracticeCountInput): number {
  if (countMode === 'all') return Math.max(filteredQuestionCount, 1)
  if (countMode === 'custom') return Math.max(Number(customCountInput) || 1, 1)
  return Math.max(selectedFixedCount || 1, 1)
}

export function getPracticeCreateErrorMessage(error: unknown): string {
  if (error instanceof Error && (error as { code?: string }).code === 'practice_no_unattempted_questions') {
    return '当前筛选条件下没有未练习题目'
  }
  return error instanceof Error ? error.message : '练习创建失败，请重试'
}
