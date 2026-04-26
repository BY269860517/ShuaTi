import type {
  AnswerSubmitResult,
  Candidate,
  Material,
  ParseJob,
  ParseMode,
  PracticeDetail,
  PracticeSession,
  SafeQuestion,
  UserInfo,
} from '../types'

declare const wx: {
  cloud: {
    callFunction<T = unknown>(options: { name: string; data?: object }): Promise<{ result?: T }>
  }
}

interface CloudFunctionResponse<T> {
  ok?: boolean
  data?: T
  error?: {
    code?: string
    message?: string
  }
}

interface CloudFunctionResult<T> {
  result?: CloudFunctionResponse<T>
}

export interface CloudFunctionError extends Error {
  code?: string
}

export interface MaterialCreateInput {
  fileID: string
  fileName: string
  fileSize: number
  parseMode: ParseMode
}

export type CandidateUpdateInput = Partial<Pick<Candidate, 'type' | 'stem' | 'options' | 'answerKeys' | 'explanation'>>

export interface PracticeCreateInput {
  materialId?: string
  count: number
}

export interface AnswerSubmitInput {
  sessionId: string
  questionId: string
  selectedKeys: string[]
}

export async function callFunction<T>(name: string, data: object = {}): Promise<T> {
  const response = await wx.cloud.callFunction({ name, data }) as CloudFunctionResult<T>
  const result = response.result

  if (!result?.ok) {
    const error = new Error(result?.error?.message || '请求失败') as CloudFunctionError
    error.code = result?.error?.code
    throw error
  }

  return result.data as T
}

export const api = {
  userLogin: () => callFunction<{ user: UserInfo }>('userLogin'),
  materialCreate: (data: MaterialCreateInput) => callFunction<{ material: Material }>('materialCreate', data),
  materialList: () => callFunction<{ materials: Material[] }>('materialList'),
  materialDetail: (materialId: string) => callFunction<{ material: Material }>('materialDetail', { materialId }),
  parseStart: (materialId: string) => callFunction<{ job: ParseJob }>('parseStart', { materialId }),
  parseStatus: (materialId: string) => callFunction<{ material: Material; job: ParseJob | null }>('parseStatus', { materialId }),
  candidateList: (materialId: string) => callFunction<{ candidates: Candidate[] }>('candidateList', { materialId }),
  candidateDetail: (candidateId: string) => callFunction<{ candidate: Candidate }>('candidateDetail', { candidateId }),
  candidateUpdate: (candidateId: string, candidate: CandidateUpdateInput) =>
    callFunction<{ candidate: Candidate }>('candidateUpdate', { candidateId, candidate }),
  importConfirm: (materialId: string) => callFunction<{ importedCount: number; skippedCount: number }>('importConfirm', { materialId }),
  questionList: (materialId?: string) => callFunction<{ questions: SafeQuestion[] }>('questionList', { materialId }),
  practiceCreate: (data: PracticeCreateInput) => callFunction<{ session: PracticeSession }>('practiceCreate', data),
  practiceDetail: (sessionId: string) => callFunction<PracticeDetail>('practiceDetail', { sessionId }),
  answerSubmit: (data: AnswerSubmitInput) => callFunction<AnswerSubmitResult>('answerSubmit', data),
}
