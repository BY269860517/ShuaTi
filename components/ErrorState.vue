<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    message: string
    retryText?: string
  }>(),
  {
    retryText: '重试',
  },
)

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <view class="error-state">
    <text class="error-state__message">{{ props.message }}</text>
    <button
      v-if="props.retryText"
      class="error-state__retry"
      type="default"
      @click="emit('retry')"
    >
      {{ props.retryText }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx;
  text-align: center;
}

.error-state__message {
  max-width: 600rpx;
  color: $danger;
  font-size: 28rpx;
  line-height: 40rpx;
}

.error-state__retry {
  min-width: 160rpx;
  height: 68rpx;
  margin-top: 24rpx;
  padding: 0 28rpx;
  border-radius: 8rpx;
  background: $surface;
  color: $brand-primary;
  border: 1rpx solid $brand-border;
  font-size: 28rpx;
  line-height: 68rpx;
}
</style>
