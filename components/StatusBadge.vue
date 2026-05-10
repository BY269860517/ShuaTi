<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string
    type?: 'neutral' | 'success' | 'warning' | 'danger'
  }>(),
  {
    type: 'neutral',
  },
)
</script>

<template>
  <text class="status-badge" :class="`status-badge--${props.type}`">
    {{ props.text }}
  </text>
</template>

<style scoped lang="scss">
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56rpx;
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 40rpx;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge--neutral {
  color: $text-secondary;
  background: $surface-muted;
  border: 1rpx solid $border-color;
}

.status-badge--success {
  color: $brand-success-deep;
  background: $brand-success-soft;
  border: 1rpx solid $brand-success-border;
}

.status-badge--warning {
  color: $warning;
  background: $warning-soft;
  border: 1rpx solid $warning-border;
}

.status-badge--danger {
  color: $danger;
  background: $danger-soft;
  border: 1rpx solid $danger-border;
}
</style>
