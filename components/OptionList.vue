<script setup lang="ts">
import type { OptionItem } from '@/common/types'

const props = defineProps<{
  options: OptionItem[]
  modelValue: string[]
  mode: 'single' | 'multiple' | 'judge'
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

function isSelected(key: string): boolean {
  return props.modelValue.includes(key)
}

function selectOption(key: string) {
  if (props.disabled) return

  if (props.mode === 'multiple') {
    const next = isSelected(key)
      ? props.modelValue.filter((selectedKey) => selectedKey !== key)
      : [...props.modelValue, key]
    emit('update:modelValue', next)
    return
  }

  emit('update:modelValue', [key])
}
</script>

<template>
  <view class="option-list" :class="{ 'option-list--disabled': props.disabled }">
    <view
      v-for="option in props.options"
      :key="option.key"
      class="option-list__item"
      :class="{ 'option-list__item--selected': isSelected(option.key) }"
      hover-class="option-list__item--hover"
      @click="selectOption(option.key)"
    >
      <text class="option-list__key">{{ option.key }}</text>
      <text class="option-list__text">{{ option.text }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.option-list {
  display: flex;
  flex-direction: column;
}

.option-list--disabled {
  opacity: 0.72;
}

.option-list__item {
  display: flex;
  align-items: flex-start;
  min-height: 88rpx;
  margin-bottom: 16rpx;
  padding: 20rpx;
  border-radius: 8rpx;
  background: $surface;
  border: 1rpx solid $border-color;
}

.option-list__item--hover {
  background: $surface-hover;
}

.option-list__item--selected {
  background: $brand-primary-soft;
  border-color: $brand-border-strong;
}

.option-list__key {
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

.option-list__item--selected .option-list__key {
  background: $brand-primary;
  color: $surface;
}

.option-list__text {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
  color: $text-primary;
  font-size: 30rpx;
  line-height: 44rpx;
  word-break: break-word;
}
</style>
