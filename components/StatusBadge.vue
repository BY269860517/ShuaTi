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
  display: inline-block;
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 40rpx;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge--neutral {
  color: #3f4a5a;
  background: #eef2f7;
  border: 1rpx solid #d8e0ea;
}

.status-badge--success {
  color: #16643f;
  background: #e9f7ef;
  border: 1rpx solid #bfe6cf;
}

.status-badge--warning {
  color: #7a4b08;
  background: #fff5df;
  border: 1rpx solid #efd49c;
}

.status-badge--danger {
  color: #9a2f2f;
  background: #fdecec;
  border: 1rpx solid #f2c3c3;
}
</style>
