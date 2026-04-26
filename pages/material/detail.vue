<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { Material, ParseJob } from '@/common/types'
import { MATERIAL_STATUS_TEXT } from '@/common/constants/status'
import { formatDate, formatFileSize } from '@/common/format'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const materialId = ref('')
const material = ref<Material | null>(null)
const job = ref<ParseJob | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const pageActive = ref(false)
let pollingTimer: ReturnType<typeof setInterval> | null = null
let statusRefreshInFlight = false
const runnerTriggeredJobIds = new Set<string>()

const hasReviewCandidates = computed(() => {
  const item = material.value
  if (!item) return false
  return item.readyCandidateCount + item.needReviewCandidateCount + item.invalidCandidateCount > 0
})

const canPractice = computed(() => {
  const item = material.value
  if (!item) return false
  return item.status === 'ready' || item.questionCount > 0
})

const failedMessage = computed(() => {
  if (material.value?.status === 'failed') return material.value.errorMessage || '解析失败'
  if (job.value?.status === 'failed') return job.value.errorMessage || '解析失败'
  return ''
})

onLoad((options) => {
  pageActive.value = true
  materialId.value = String(options?.materialId || '')
  loadDetail()
})

onShow(() => {
  pageActive.value = true
  syncPolling()
})

onHide(() => {
  pageActive.value = false
  clearPolling()
})

onUnload(() => {
  pageActive.value = false
  clearPolling()
})

async function loadDetail() {
  if (!materialId.value) {
    errorMessage.value = '缺少资料 ID'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const detailResult = await api.materialDetail(materialId.value)
    material.value = detailResult.material
    const statusResult = await api.parseStatus(materialId.value)
    material.value = statusResult.material
    job.value = statusResult.job
    if (!pageActive.value) return
    syncPolling()
    triggerParseRunnerIfNeeded()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '资料加载失败'
  } finally {
    loading.value = false
  }
}

async function refreshParseStatus() {
  if (!materialId.value || !pageActive.value || statusRefreshInFlight) return

  statusRefreshInFlight = true

  try {
    const statusResult = await api.parseStatus(materialId.value)
    if (!pageActive.value) return
    material.value = statusResult.material
    job.value = statusResult.job
    triggerParseRunnerIfNeeded()
    syncPolling()
  } catch (error) {
    if (!pageActive.value) return
    errorMessage.value = error instanceof Error ? error.message : '解析状态刷新失败'
    clearPolling()
  } finally {
    statusRefreshInFlight = false
  }
}

async function triggerParseRunnerIfNeeded() {
  const currentMaterial = material.value
  const currentJob = job.value
  if (!pageActive.value || currentMaterial?.status !== 'parsing' || !currentJob) return
  if (currentJob.status === 'done' || currentJob.status === 'failed') return
  if (runnerTriggeredJobIds.has(currentJob._id)) return

  runnerTriggeredJobIds.add(currentJob._id)

  try {
    const runnerResult = await api.parseRunner(currentJob._id)
    if (!pageActive.value) return
    job.value = runnerResult.job
    await refreshParseStatus()
  } catch (error) {
    if (!pageActive.value) return
    errorMessage.value = error instanceof Error ? error.message : '解析任务启动失败'
  }
}

function syncPolling() {
  if (!pageActive.value) {
    clearPolling()
    return
  }

  if (material.value?.status === 'parsing') {
    startPolling()
  } else {
    clearPolling()
  }
}

function startPolling() {
  if (!pageActive.value || pollingTimer) return
  pollingTimer = setInterval(() => {
    refreshParseStatus()
  }, 3000)
}

function clearPolling() {
  if (!pollingTimer) return
  clearInterval(pollingTimer)
  pollingTimer = null
}

function statusType(status: Material['status']): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ready') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'parsing' || status === 'reviewing') return 'warning'
  return 'neutral'
}

function goReview() {
  if (!material.value) return
  uni.navigateTo({ url: `/pages/import/review?materialId=${material.value._id}` })
}

function goPracticeSetup() {
  if (!material.value) return
  uni.navigateTo({ url: `/pages/practice/setup?materialId=${material.value._id}` })
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !material" text="正在加载资料" />
    <ErrorState v-else-if="errorMessage && !material" :message="errorMessage" @retry="loadDetail" />

    <view v-else-if="material" class="content">
      <view class="summary">
        <view class="summary__header">
          <text class="summary__title">{{ material.fileName }}</text>
          <StatusBadge :text="MATERIAL_STATUS_TEXT[material.status]" :type="statusType(material.status)" />
        </view>
        <view class="summary__meta">
          <text class="summary__meta-text">{{ formatFileSize(material.fileSize) }}</text>
          <text class="summary__meta-dot">·</text>
          <text class="summary__meta-text">{{ formatDate(material.updatedAt || material.createdAt) }}</text>
        </view>
      </view>

      <view class="stats">
        <view class="stat">
          <text class="stat__value">{{ material.readyCandidateCount }}</text>
          <text class="stat__label">可导入</text>
        </view>
        <view class="stat">
          <text class="stat__value">{{ material.needReviewCandidateCount }}</text>
          <text class="stat__label">需确认</text>
        </view>
        <view class="stat">
          <text class="stat__value">{{ material.invalidCandidateCount }}</text>
          <text class="stat__label">不可导入</text>
        </view>
      </view>

      <view v-if="material.status === 'parsing'" class="notice notice--warning">
        <text class="notice__text">正在解析 PDF，页面会自动刷新状态。</text>
      </view>

      <view v-if="failedMessage" class="notice notice--danger">
        <text class="notice__text">{{ failedMessage }}</text>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="loadDetail" />

      <view class="actions">
        <button
          v-if="hasReviewCandidates"
          class="actions__button actions__button--primary"
          type="default"
          @click="goReview"
        >
          审核候选题
        </button>
        <button
          v-if="canPractice"
          class="actions__button"
          type="default"
          @click="goPracticeSetup"
        >
          练习设置
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: #f6f7f9;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.summary,
.stats,
.notice {
  padding: 24rpx;
  border: 1rpx solid #dce3ec;
  border-radius: 8rpx;
  background: #ffffff;
}

.summary__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.summary__title {
  flex: 1;
  min-width: 0;
  margin-right: 20rpx;
  color: #202938;
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 600;
  word-break: break-all;
}

.summary__meta {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.summary__meta-text,
.summary__meta-dot {
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
}

.summary__meta-dot {
  padding: 0 12rpx;
}

.stats {
  display: flex;
}

.stat {
  flex: 1;
  min-width: 0;
}

.stat__value {
  display: block;
  color: #202938;
  font-size: 38rpx;
  line-height: 48rpx;
  font-weight: 600;
}

.stat__label {
  display: block;
  margin-top: 6rpx;
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
}

.notice--warning {
  background: #fffaf0;
  border-color: #efd49c;
}

.notice--danger {
  background: #fdecec;
  border-color: #f2c3c3;
}

.notice__text {
  color: #364152;
  font-size: 28rpx;
  line-height: 40rpx;
  word-break: break-word;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #ffffff;
  color: #1f5f8b;
  border: 1rpx solid #b8c7d8;
  font-size: 30rpx;
  line-height: 80rpx;
}

.actions__button--primary {
  background: #1f5f8b;
  color: #ffffff;
  border-color: #1f5f8b;
}
</style>
