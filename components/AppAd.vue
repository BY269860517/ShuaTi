<script setup lang="ts">
defineProps<{
  unitId: string
}>()

function handleError(error: unknown) {
  console.log('ad error', error)
}
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="unitId" class="app-ad">
    <ad class="app-ad__unit" :unit-id="unitId" :ad-intervals="60" @error="handleError" />
  </view>
  <!-- #endif -->
</template>

<style scoped lang="scss">
.app-ad {
  overflow: hidden;
  border-radius: 8rpx;
  background: #ffffff;
}

.app-ad__unit {
  width: 100%;
}
</style>
