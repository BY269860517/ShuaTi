<script setup lang="ts">
import { computed } from 'vue'
import type { Candidate } from '@/common/types'
import { CANDIDATE_STATUS_TEXT } from '@/common/constants/status'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ candidate: Candidate }>()
const emit = defineEmits<{ edit: [id: string]; remove: [id: string] }>()
const canEdit = computed(() => props.candidate.status !== 'imported' && props.candidate.status !== 'importing')
const canRemove = computed(() => props.candidate.status !== 'imported' && props.candidate.status !== 'importing')

function statusType(status: Candidate['status']): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ready' || status === 'imported') return 'success'
  if (status === 'invalid') return 'danger'
  if (status === 'need_review' || status === 'importing') return 'warning'
  return 'neutral'
}

function handleEdit() {
  if (!canEdit.value) return
  emit('edit', props.candidate._id)
}

function handleRemove() {
  if (!canRemove.value) return
  emit('remove', props.candidate._id)
}
</script>

<template>
  <view class="candidate-card">
    <view class="candidate-card__header">
      <view class="candidate-card__heading">
        <text class="candidate-card__number">
          第{{ props.candidate.questionNo || '-' }}题
        </text>
        <StatusBadge
          :text="CANDIDATE_STATUS_TEXT[props.candidate.status]"
          :type="statusType(props.candidate.status)"
        />
      </view>
      <view v-if="canEdit" class="candidate-card__actions">
        <button
          class="candidate-card__edit"
          type="default"
          @click.stop="handleEdit"
        >
          编辑
        </button>
        <button
          v-if="canRemove"
          class="candidate-card__remove"
          type="default"
          @click.stop="handleRemove"
        >
          移除
        </button>
      </view>
      <text v-else-if="props.candidate.status === 'importing'" class="candidate-card__readonly">导入中</text>
      <text v-else class="candidate-card__imported">已导入</text>
    </view>

    <text class="candidate-card__stem">{{ props.candidate.stem }}</text>

    <view v-if="props.candidate.options.length" class="candidate-card__options">
      <view
        v-for="option in props.candidate.options"
        :key="option.key"
        class="candidate-card__option"
      >
        <text class="candidate-card__option-key">{{ option.key }}</text>
        <text class="candidate-card__option-text">{{ option.text }}</text>
      </view>
    </view>

    <view class="candidate-card__detail">
      <text class="candidate-card__detail-label">答案</text>
      <text class="candidate-card__detail-text">
        {{ props.candidate.answerKeys.join('、') || '-' }}
      </text>
    </view>

    <view v-if="props.candidate.explanation" class="candidate-card__detail">
      <text class="candidate-card__detail-label">解析</text>
      <text class="candidate-card__detail-text">{{ props.candidate.explanation }}</text>
    </view>

    <view v-if="props.candidate.validationErrors.length" class="candidate-card__errors">
      <text
        v-for="error in props.candidate.validationErrors"
        :key="error"
        class="candidate-card__error"
      >
        {{ error }}
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.candidate-card {
  padding: 24rpx;
  border-radius: 8rpx;
  background: $surface;
  border: 1rpx solid $border-color;
  box-shadow: $surface-shadow;
}

.candidate-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.candidate-card__heading {
  display: flex;
  flex: 1;
  min-width: 240rpx;
  align-items: center;
}

.candidate-card__number {
  margin-right: 16rpx;
  color: $text-primary;
  font-size: 28rpx;
  line-height: 40rpx;
  font-weight: 600;
}

.candidate-card__actions {
  flex-shrink: 0;
  display: flex;
  gap: 12rpx;
  margin-left: 16rpx;
}

.candidate-card__edit,
.candidate-card__remove {
  width: 104rpx;
  height: 60rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: $surface;
  border: 1rpx solid $brand-border;
  font-size: 26rpx;
  line-height: 60rpx;
}

.candidate-card__edit {
  color: $brand-primary;
}

.candidate-card__remove {
  color: $danger;
  border-color: $danger-border;
}

.candidate-card__readonly,
.candidate-card__imported {
  flex-shrink: 0;
  margin-left: 16rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 40rpx;
}

.candidate-card__stem {
  display: block;
  margin-top: 20rpx;
  color: $text-primary;
  font-size: 30rpx;
  line-height: 44rpx;
  word-break: break-word;
}

.candidate-card__options {
  margin-top: 20rpx;
}

.candidate-card__option {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
}

.candidate-card__option-key {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  border-radius: 8rpx;
  background: $surface-muted;
  color: $text-body;
  font-size: 26rpx;
  line-height: 48rpx;
  text-align: center;
  font-weight: 600;
}

.candidate-card__option-text {
  flex: 1;
  min-width: 0;
  margin-left: 16rpx;
  color: $text-body;
  font-size: 28rpx;
  line-height: 42rpx;
  word-break: break-word;
}

.candidate-card__detail {
  display: flex;
  align-items: flex-start;
  margin-top: 18rpx;
}

.candidate-card__detail-label {
  flex-shrink: 0;
  width: 72rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
}

.candidate-card__detail-text {
  flex: 1;
  min-width: 0;
  color: $text-body;
  font-size: 26rpx;
  line-height: 38rpx;
  word-break: break-word;
}

.candidate-card__errors {
  margin-top: 18rpx;
  padding: 16rpx;
  border-radius: 8rpx;
  background: $danger-soft;
  border: 1rpx solid $danger-border;
}

.candidate-card__error {
  display: block;
  color: $danger;
  font-size: 24rpx;
  line-height: 36rpx;
}
</style>
