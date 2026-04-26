<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { PracticeSession } from '@/common/types'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const sessionId = ref('')
const session = ref<PracticeSession | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const correctCount = computed(() => {
  if (!session.value) return 0
  return session.value.correctCount
})
const totalCount = computed(() => {
  if (!session.value) return 0
  return session.value.totalCount
})
const retryUrl = computed(() => {
  if (session.value?.materialId) return `/pages/practice/setup?materialId=${session.value.materialId}`
  return '/pages/practice/setup'
})

onLoad((options) => {
  sessionId.value = String(options?.sessionId || '')
  loadResult()
})

async function loadResult() {
  if (!sessionId.value) {
    errorMessage.value = '缺少练习 ID'
    didLoad.value = true
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await api.practiceDetail(sessionId.value)
    session.value = result.session
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '练习结果加载失败'
  } finally {
    loading.value = false
  }
}

function goHome() {
  uni.reLaunch({ url: '/pages/index/index' })
}

function retryPractice() {
  uni.navigateTo({ url: retryUrl.value })
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !didLoad" text="正在加载结果" />
    <ErrorState v-else-if="errorMessage && !session" :message="errorMessage" @retry="loadResult" />

    <view v-else-if="session" class="content">
      <view class="result-card">
        <text class="result-card__label">本次正确</text>
        <view class="result-card__score">
          <text class="result-card__correct">{{ correctCount }}</text>
          <text class="result-card__total"> / {{ totalCount }}</text>
        </view>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="loadResult" />

      <view class="actions">
        <button class="actions__button actions__button--primary" type="default" @click="retryPractice">
          重练同一材料
        </button>
        <button class="actions__button" type="default" @click="goHome">
          回首页
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: #f6f7f9;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.result-card {
  padding: 32rpx 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid #dce3ec;
  background: #ffffff;
}

.result-card__label {
  display: block;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.result-card__score {
  display: flex;
  align-items: baseline;
  margin-top: 12rpx;
}

.result-card__correct {
  color: #202938;
  font-size: 64rpx;
  line-height: 76rpx;
  font-weight: 600;
}

.result-card__total {
  color: #697586;
  font-size: 34rpx;
  line-height: 44rpx;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #b8c7d8;
  background: #ffffff;
  color: #1f5f8b;
  font-size: 30rpx;
  line-height: 80rpx;
}

.actions__button--primary {
  border-color: #1f5f8b;
  background: #1f5f8b;
  color: #ffffff;
}
</style>
