import type {
  AnswerSubmitResult,
  Candidate,
  CreatedMaterial,
  Material,
  ParseJob,
  ParseMode,
  PracticeDetail,
  PracticeSession,
  SafeQuestion,
  UserInfo,
} from '../types'

interface WxRuntime {
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
  const response = await getWxRuntime().cloud.callFunction({ name, data }) as CloudFunctionResult<T>
  const result = response.result

  if (!isCloudFunctionResponse(result)) {
    throwCloudError('invalid_response', '云函数响应格式错误')
  }

  if (result.ok === false) {
    const error = new Error(result?.error?.message || '请求失败') as CloudFunctionError
    error.code = result?.error?.code
    throw error
  }

  return result.data as T
}

function getWxRuntime(): WxRuntime {
  return (globalThis as { wx?: WxRuntime }).wx as WxRuntime
}

function isCloudFunctionResponse<T>(value: unknown): value is CloudFunctionResponse<T> {
  if (!value || typeof value !== 'object') return false
  return (value as { ok?: unknown }).ok === true || (value as { ok?: unknown }).ok === false
}

function throwCloudError(code: string, message: string): never {
  const error = new Error(message) as CloudFunctionError
  error.code = code
  throw error
}

export const api = {
  userLogin: () => callFunction<{ user: UserInfo }>('userLogin'),
  materialCreate: (data: MaterialCreateInput) => callFunction<{ material: CreatedMaterial }>('materialCreate', data),
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
