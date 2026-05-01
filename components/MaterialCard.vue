<script setup lang="ts">
import type { Material } from '@/common/types'
import { MATERIAL_STATUS_TEXT } from '@/common/constants/status'
import { formatDate, formatFileSize } from '@/common/format'
import StatusBadge from './StatusBadge.vue'

const props = withDefaults(defineProps<{ material: Material; deleting?: boolean }>(), {
  deleting: false,
})
const emit = defineEmits<{ open: [id: string]; delete: [id: string] }>()

function statusType(status: Material['status']): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ready') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'parsing' || status === 'reviewing') return 'warning'
  return 'neutral'
}

function requestDelete() {
  if (props.deleting) return
  emit('delete', props.material._id)
}
</script>

<template>
  <view class="material-card" hover-class="material-card--hover" @click="emit('open', props.material._id)">
    <view class="material-card__header">
      <text class="material-card__title">{{ props.material.fileName }}</text>
      <view class="material-card__actions">
        <StatusBadge
          :text="MATERIAL_STATUS_TEXT[props.material.status]"
          :type="statusType(props.material.status)"
        />
        <button
          class="material-card__delete"
          type="default"
          :disabled="props.deleting"
          @click.stop="requestDelete"
        >
          {{ props.deleting ? '删除中' : '删除' }}
        </button>
      </view>
    </view>

    <view class="material-card__stats">
      <view class="material-card__stat">
        <text class="material-card__stat-value">{{ props.material.questionCount }}</text>
        <text class="material-card__stat-label">题目</text>
      </view>
      <view class="material-card__stat">
        <text class="material-card__stat-value">{{ props.material.readyCandidateCount }}</text>
        <text class="material-card__stat-label">可导入</text>
      </view>
      <view class="material-card__stat">
        <text class="material-card__stat-value">{{ props.material.needReviewCandidateCount }}</text>
        <text class="material-card__stat-label">待确认</text>
      </view>
      <view class="material-card__stat">
        <text class="material-card__stat-value">{{ props.material.invalidCandidateCount }}</text>
        <text class="material-card__stat-label">不可用</text>
      </view>
    </view>

    <view class="material-card__meta">
      <text class="material-card__meta-text">{{ formatFileSize(props.material.fileSize) }}</text>
      <text class="material-card__meta-dot">·</text>
      <text class="material-card__meta-text">{{ formatDate(props.material.updatedAt || props.material.createdAt) }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.material-card {
  padding: 24rpx;
  border-radius: 8rpx;
  background: #ffffff;
  border: 1rpx solid #dce3ec;
}

.material-card--hover {
  background: #f8fafc;
}

.material-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.material-card__title {
  flex: 1;
  min-width: 0;
  margin-right: 20rpx;
  color: #202938;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 600;
  word-break: break-all;
}

.material-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.material-card__delete {
  width: 96rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #d6dde8;
  background: #ffffff;
  color: #9f2a2a;
  font-size: 24rpx;
  line-height: 52rpx;
}

.material-card__delete[disabled] {
  color: #a4acb9;
  background: #f2f4f7;
}

.material-card__stats {
  display: flex;
  margin-top: 24rpx;
}

.material-card__stat {
  flex: 1;
  min-width: 0;
}

.material-card__stat-value {
  display: block;
  color: #202938;
  font-size: 32rpx;
  line-height: 42rpx;
  font-weight: 600;
}

.material-card__stat-label {
  display: block;
  margin-top: 4rpx;
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
}

.material-card__meta {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.material-card__meta-text,
.material-card__meta-dot {
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
}

.material-card__meta-dot {
  padding: 0 12rpx;
}
</style>
