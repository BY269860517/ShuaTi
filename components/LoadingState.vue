<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text?: string
  }>(),
  {
    text: '加载中',
  },
)
</script>

<template>
  <view class="loading-state">
    <view class="loading-state__spinner"></view>
    <text class="loading-state__text">{{ props.text }}</text>
  </view>
</template>

<style scoped lang="scss">
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160rpx;
  padding: 32rpx;
  color: #596579;
}

.loading-state__spinner {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  border-radius: 50%;
  border: 4rpx solid #d9e1ec;
  border-top-color: #1f5f8b;
  animation: loading-rotate 900ms linear infinite;
}

.loading-state__text {
  font-size: 28rpx;
  line-height: 40rpx;
}

@keyframes loading-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
