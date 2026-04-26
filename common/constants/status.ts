import type { CandidateStatus, MaterialStatus } from '../types'

export const materialStatusText: Record<MaterialStatus, string> = {
  uploaded: '已上传',
  parsing: '解析中',
  reviewing: '待审核',
  ready: '可刷题',
  failed: '解析失败',
}

export const candidateStatusText: Record<CandidateStatus, string> = {
  ready: '可导入',
  need_review: '需确认',
  invalid: '不可导入',
  imported: '已导入',
  importing: '导入中',
}
