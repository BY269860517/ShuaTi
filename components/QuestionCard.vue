<script setup lang="ts">
import type { SafeQuestion } from '@/common/types'
import OptionList from './OptionList.vue'

const props = defineProps<{
  question: SafeQuestion
  selectedKeys: string[]
  index: number
  total: number
  disabled?: boolean
}>()

const emit = defineEmits<{ answer: [keys: string[]] }>()
</script>

<template>
  <view class="question-card">
    <view class="question-card__topline">
      <text class="question-card__progress">第 {{ props.index }} / {{ props.total }} 题</text>
      <text v-if="props.question.questionNo" class="question-card__number">
        题号 {{ props.question.questionNo }}
      </text>
    </view>

    <text class="question-card__stem">{{ props.question.stem }}</text>

    <OptionList
      class="question-card__options"
      :options="props.question.options"
      :model-value="props.selectedKeys"
      :mode="props.question.type"
      :disabled="props.disabled"
      @update:model-value="emit('answer', $event)"
    />
  </view>
</template>

<style scoped lang="scss">
.question-card {
  padding: 28rpx;
  border-radius: 8rpx;
  background: $surface;
  border: 1rpx solid $border-color;
  box-shadow: $surface-shadow;
}

.question-card__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.question-card__progress {
  color: $brand-primary;
  font-size: 26rpx;
  line-height: 36rpx;
  font-weight: 600;
}

.question-card__number {
  margin-left: 20rpx;
  color: $text-muted;
  font-size: 24rpx;
  line-height: 34rpx;
}

.question-card__stem {
  display: block;
  color: $text-primary;
  font-size: 32rpx;
  line-height: 48rpx;
  font-weight: 600;
  word-break: break-word;
}

.question-card__options {
  margin-top: 28rpx;
}
</style>
