<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  actionText?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="empty-state">
    <view class="empty-state__mark"></view>
    <text class="empty-state__title">{{ props.title }}</text>
    <text v-if="props.description" class="empty-state__description">
      {{ props.description }}
    </text>
    <button
      v-if="props.actionText"
      class="empty-state__action"
      type="default"
      @click="emit('action')"
    >
      {{ props.actionText }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72rpx 32rpx;
  color: $text-secondary;
  text-align: center;
}

.empty-state__mark {
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 24rpx;
  border-radius: 8rpx;
  background: $surface-muted;
  border: 1rpx solid $border-soft;
}

.empty-state__title {
  color: $text-primary;
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 600;
}

.empty-state__description {
  max-width: 560rpx;
  margin-top: 12rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
}

.empty-state__action {
  min-width: 184rpx;
  height: 72rpx;
  margin-top: 28rpx;
  padding: 0 28rpx;
  border-radius: 8rpx;
  background: $brand-primary;
  color: $surface;
  font-size: 28rpx;
  line-height: 72rpx;
}
</style>
