import type {
  AnswerSubmitResult,
  Candidate,
  CreatedMaterial,
  Material,
  ParseJob,
  ParseMode,
  PracticeDetail,
  PracticeCountMode,
  PracticeOrderMode,
  PracticeQuestionTypeFilter,
  PracticeScope,
  PracticeSession,
  SafeQuestion,
  UserInfo,
  WrongQuestionItem,
  WrongQuestionStatus,
} from '../types'

interface UniCloudRuntime {
  callFunction<T = unknown>(options: { name: string; data?: object }): Promise<{ result?: T }>
}

interface UniRuntime {
  login(options: {
    provider: 'weixin'
    success: (result: { code?: string }) => void
    fail: (error: unknown) => void
  }): void
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
}

interface LoginData {
  token?: string
  tokenExpired?: number
  user: UserInfo
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
  count?: number
  countMode?: PracticeCountMode
  orderMode?: PracticeOrderMode
  scope?: PracticeScope
  questionType?: PracticeQuestionTypeFilter
}

export interface WrongListInput {
  status?: WrongQuestionStatus
  materialId?: string
}

export interface WrongPracticeCreateInput {
  materialId?: string
  count: number
}

export interface AnswerSubmitInput {
  sessionId: string
  questionId: string
  selectedKeys: string[]
}

export async function callFunction<T>(name: string, data: object = {}): Promise<T> {
  const requestData = name === 'userLogin' ? data : attachToken(data)
  const response = await getUniCloudRuntime().callFunction({ name, data: requestData }) as CloudFunctionResult<T>
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

function getUniCloudRuntime(): UniCloudRuntime {
  const runtime = typeof uniCloud !== 'undefined'
    ? uniCloud as UniCloudRuntime
    : (globalThis as { uniCloud?: UniCloudRuntime }).uniCloud
  if (!runtime?.callFunction) throwCloudError('missing_unicloud', 'uniCloud runtime is unavailable')
  return runtime
}

function getUniRuntime(): UniRuntime {
  const runtime = typeof uni !== 'undefined'
    ? uni as UniRuntime
    : (globalThis as { uni?: UniRuntime }).uni
  if (!runtime?.login) throwCloudError('missing_uni', 'uni runtime is unavailable')
  return runtime
}

function getStoredToken(): string {
  try {
    const token = getUniRuntime().getStorageSync('uni_id_token')
    return typeof token === 'string' ? token : ''
  } catch (_) {
    return ''
  }
}

function attachToken(data: object): object {
  const token = getStoredToken()
  if (!token) return data
  return { ...data, _uniToken: token, uniToken: token }
}

function storeLoginData(data: LoginData): void {
  if (!data?.token) return
  const runtime = getUniRuntime()
  runtime.setStorageSync('uni_id_token', data.token)
  if (data.tokenExpired) {
    runtime.setStorageSync('uni_id_token_expired', data.tokenExpired)
  }
}

function loginByWeixin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    getUniRuntime().login({
      provider: 'weixin',
      success(result) {
        const code = result?.code
        if (!code) {
          reject(Object.assign(new Error('missing weixin login code'), { code: 'missing_login_code' }))
          return
        }
        resolve({ code })
      },
      fail: reject,
    })
  })
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
  userLogin: async () => {
    const { code } = await loginByWeixin()
    const data = await callFunction<LoginData>('userLogin', { code })
    storeLoginData(data)
    return { user: data.user }
  },
  materialCreate: (data: MaterialCreateInput) => callFunction<{ material: CreatedMaterial }>('materialCreate', data),
  materialList: () => callFunction<{ materials: Material[] }>('materialList'),
  materialDetail: (materialId: string) => callFunction<{ material: Material }>('materialDetail', { materialId }),
  materialDelete: (materialId: string) => callFunction<{ material: Material }>('materialDelete', { materialId }),
  parseStart: (materialId: string) => callFunction<{ job: ParseJob }>('parseStart', { materialId }),
  parseRunner: (jobId: string) => callFunction<{ job: ParseJob }>('parseRunner', { jobId }),
  parseStatus: (materialId: string) => callFunction<{ material: Material; job: ParseJob | null }>('parseStatus', { materialId }),
  candidateList: (materialId: string) => callFunction<{ candidates: Candidate[] }>('candidateList', { materialId }),
  candidateDetail: (candidateId: string) => callFunction<{ candidate: Candidate }>('candidateDetail', { candidateId }),
  candidateUpdate: (candidateId: string, candidate: CandidateUpdateInput) =>
    callFunction<{ candidate: Candidate }>('candidateUpdate', { candidateId, candidate }),
  candidateDelete: (candidateId: string) => callFunction<{ candidate: Candidate }>('candidateDelete', { candidateId }),
  importConfirm: (materialId: string) => callFunction<{ importedCount: number; skippedCount: number }>('importConfirm', { materialId }),
  questionList: (materialId?: string) => callFunction<{ questions: SafeQuestion[] }>('questionList', { materialId }),
  practiceCreate: (data: PracticeCreateInput) => callFunction<{ session: PracticeSession }>('practiceCreate', data),
  wrongList: (data: WrongListInput = {}) =>
    callFunction<{ wrongQuestions: WrongQuestionItem[] }>('wrongList', data),
  wrongPracticeCreate: (data: WrongPracticeCreateInput) =>
    callFunction<{ session: PracticeSession }>('wrongPracticeCreate', data),
  wrongMarkMastered: (wrongQuestionId: string) =>
    callFunction<{ wrongQuestion: WrongQuestionItem }>('wrongMarkMastered', { wrongQuestionId }),
  practiceDetail: (sessionId: string) => callFunction<PracticeDetail>('practiceDetail', { sessionId }),
  answerSubmit: (data: AnswerSubmitInput) => callFunction<AnswerSubmitResult>('answerSubmit', data),
}
