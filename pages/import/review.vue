<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { Candidate, CandidateStatus } from '@/common/types'
import { CANDIDATE_STATUS_TEXT } from '@/common/constants/status'
import CandidateCard from '@/components/CandidateCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const statusOrder: CandidateStatus[] = ['need_review', 'invalid', 'ready', 'imported', 'importing']

const materialId = ref('')
const candidates = ref<Candidate[]>([])
const loading = ref(false)
const confirming = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const groupedCandidates = computed(() => {
  return statusOrder
    .map((status) => ({
      status,
      items: candidates.value.filter((candidate) => candidate.status === status),
    }))
    .filter((group) => group.items.length > 0)
})

const importableCount = computed(() => {
  return candidates.value.filter((candidate) => candidate.status === 'ready' && !candidate.importedQuestionId).length
})

const importButtonText = computed(() => {
  if (confirming.value) return '导入中'
  if (importableCount.value === 0) return '暂无可导入题目'
  return `确认导入（${importableCount.value}）`
})

onLoad((options) => {
  materialId.value = String(options?.materialId || '')
  loadCandidates()
})

onShow(() => {
  if (didLoad.value) {
    loadCandidates()
  }
})

async function loadCandidates() {
  if (!materialId.value) {
    errorMessage.value = '缺少资料 ID'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await api.candidateList(materialId.value)
    candidates.value = result.candidates
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '候选题加载失败'
  } finally {
    loading.value = false
  }
}

async function confirmImport() {
  if (!materialId.value || confirming.value || importableCount.value === 0) return

  confirming.value = true
  errorMessage.value = ''

  try {
    const result = await api.importConfirm(materialId.value)
    uni.showToast({
      title: `已导入 ${result.importedCount} 题`,
      icon: 'none',
    })
    await loadCandidates()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '导入失败，请重试'
  } finally {
    confirming.value = false
  }
}

function editCandidate(candidateId: string) {
  uni.navigateTo({ url: `/pages/import/edit?candidateId=${candidateId}&materialId=${materialId.value}` })
}

function statusType(status: CandidateStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ready' || status === 'imported') return 'success'
  if (status === 'invalid') return 'danger'
  if (status === 'need_review' || status === 'importing') return 'warning'
  return 'neutral'
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !candidates.length" text="正在加载候选题" />
    <ErrorState v-else-if="errorMessage && !candidates.length" :message="errorMessage" @retry="loadCandidates" />
    <EmptyState
      v-else-if="!candidates.length"
      title="暂无候选题"
      description="PDF 解析完成后，候选题会显示在这里。"
    />

    <view v-else class="groups">
      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="loadCandidates" />
      <view v-for="group in groupedCandidates" :key="group.status" class="group">
        <view class="group__header">
          <StatusBadge :text="CANDIDATE_STATUS_TEXT[group.status]" :type="statusType(group.status)" />
          <text class="group__count">{{ group.items.length }} 题</text>
        </view>
        <view class="group__list">
          <CandidateCard
            v-for="candidate in group.items"
            :key="candidate._id"
            :candidate="candidate"
            @edit="editCandidate"
          />
        </view>
      </view>
    </view>

    <view class="bottom-actions">
      <button
        class="bottom-actions__button"
        type="default"
        :loading="confirming"
        :disabled="confirming || !candidates.length || importableCount === 0"
        @click="confirmImport"
      >
        {{ importButtonText }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(128rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f6f7f9;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.group__count {
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.group__list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #dce3ec;
  box-sizing: border-box;
}

.bottom-actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #1f5f8b;
  color: #ffffff;
  font-size: 30rpx;
  line-height: 80rpx;
}
</style>
