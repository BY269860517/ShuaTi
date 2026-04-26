export type ParseMode = 'inline_answer' | 'answer_at_end'

export type MaterialStatus = 'uploaded' | 'parsing' | 'reviewing' | 'ready' | 'failed'

export type CandidateStatus = 'ready' | 'need_review' | 'invalid' | 'imported' | 'importing'

export type QuestionType = 'single' | 'multiple' | 'judge'

export type PracticeSessionStatus = 'active' | 'submitted'

export type ParseJobStatus = 'pending' | 'running' | 'finalizing' | 'done' | 'failed'

export interface OptionItem {
  key: string
  text: string
}

export interface UserInfo {
  _id: string
  openid: string
  createdAt: string
  updatedAt: string
  created?: boolean
}

export interface Material {
  _id: string
  fileName: string
  fileSize: number
  status: MaterialStatus
  parseMode: ParseMode
  questionCount: number
  readyCandidateCount: number
  needReviewCandidateCount: number
  invalidCandidateCount: number
  errorMessage: string
  createdAt: string
  updatedAt: string
  ownerOpenid?: string
}

export type CreatedMaterial = Material

export interface Candidate {
  _id: string
  materialId: string
  questionNo?: string
  type: QuestionType
  stem: string
  options: OptionItem[]
  answerKeys: string[]
  explanation: string
  status: CandidateStatus
  validationErrors: string[]
  importedQuestionId: string
  jobId?: string
  ownerOpenid?: string
  sourcePageNo?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface SafeQuestion {
  _id: string
  materialId: string
  candidateId?: string
  type: QuestionType
  stem: string
  options: OptionItem[]
  questionNo?: string
  ownerOpenid?: string
  sourcePageNo?: number | null
  sourceCandidateUpdatedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface PracticeSession {
  _id: string
  materialId: string
  questionIds: string[]
  status: PracticeSessionStatus
  totalCount: number
  correctCount: number
  startedAt: string
  submittedAt: string
  createdAt: string
  updatedAt: string
  ownerOpenid?: string
}

export interface ParseJob {
  _id: string
  materialId: string
  status: ParseJobStatus
  errorMessage: string
  stats: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
  startedAt?: string
  finishedAt?: string
  ownerOpenid?: string
}

export interface PracticeDetail {
  session: PracticeSession
  questions: SafeQuestion[]
}

export interface AnswerResult {
  questionId: string
  selectedKeys: string[]
  isCorrect: boolean
  answerKeys: string[]
  explanation: string
}

export type AnswerSubmitResult = AnswerResult

export interface CloudError {
  code?: string
  message?: string
}
