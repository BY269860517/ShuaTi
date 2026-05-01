<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { WrongQuestionItem } from '@/common/types'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const materialId = ref('')
const wrongQuestions = ref<WrongQuestionItem[]>([])
const loading = ref(false)
const creating = ref(false)
const markingId = ref('')
const errorMessage = ref('')
const didLoad = ref(false)

const hasWrongQuestions = computed(() => wrongQuestions.value.length > 0)
const practiceButtonText = computed(() => (creating.value ? '正在创建练习' : '练习错题'))

onLoad((options) => {
  materialId.value = String(options?.materialId || '')
  loadWrongQuestions()
})

async function loadWrongQuestions() {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await api.wrongList({ status: 'active', materialId: materialId.value || undefined })
    wrongQuestions.value = result.wrongQuestions
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '错题加载失败'
  } finally {
    loading.value = false
  }
}

async function startWrongPractice() {
  if (creating.value || !hasWrongQuestions.value) return

  creating.value = true
  errorMessage.value = ''

  try {
    const result = await api.wrongPracticeCreate({
      materialId: materialId.value || undefined,
      count: Math.min(10, wrongQuestions.value.length),
    })
    uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '错题练习创建失败'
  } finally {
    creating.value = false
  }
}

async function markMastered(wrongQuestionId: string) {
  if (markingId.value) return

  markingId.value = wrongQuestionId
  errorMessage.value = ''

  try {
    await api.wrongMarkMastered(wrongQuestionId)
    await loadWrongQuestions()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '标记失败'
  } finally {
    markingId.value = ''
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function questionTypeText(type: string) {
  if (type === 'multiple') return '多选'
  if (type === 'judge') return '判断'
  return '单选'
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !didLoad" text="正在加载错题" />
    <ErrorState v-else-if="errorMessage && !didLoad" :message="errorMessage" @retry="loadWrongQuestions" />
    <EmptyState
      v-else-if="didLoad && !hasWrongQuestions"
      title="暂无错题"
      description="答错的题会自动进入这里。"
      action-text="刷新"
      @action="loadWrongQuestions"
    />

    <view v-else class="content">
      <view class="header">
        <text class="header__title">错题</text>
        <text class="header__subtitle">当前 {{ wrongQuestions.length }} 题</text>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="loadWrongQuestions" />

      <view class="wrong-list">
        <view v-for="item in wrongQuestions" :key="item._id" class="wrong-item">
          <view class="wrong-item__meta">
            <text class="wrong-item__type">{{ questionTypeText(item.question.type) }}</text>
            <text class="wrong-item__date">上次答错 {{ formatDate(item.lastWrongAt) }}</text>
          </view>
          <text class="wrong-item__stem">{{ item.question.stem }}</text>
          <view class="wrong-item__stats">
            <text class="wrong-item__stat">错 {{ item.wrongCount }} 次</text>
            <text class="wrong-item__stat">连续正确 {{ item.correctStreak }} 次</text>
          </view>
          <button
            class="wrong-item__button"
            type="default"
            :loading="markingId === item._id"
            :disabled="Boolean(markingId)"
            @click="markMastered(item._id)"
          >
            标记已掌握
          </button>
        </view>
      </view>
    </view>

    <view v-if="hasWrongQuestions" class="bottom-actions">
      <button
        class="bottom-actions__button"
        type="default"
        :loading="creating"
        :disabled="creating"
        @click="startWrongPractice"
      >
        {{ practiceButtonText }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(128rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f6f7f9;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.header {
  padding: 24rpx 0 4rpx;
}

.header__title {
  display: block;
  color: #202938;
  font-size: 36rpx;
  line-height: 48rpx;
  font-weight: 600;
}

.header__subtitle {
  display: block;
  margin-top: 8rpx;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.wrong-item {
  padding: 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid #dce3ec;
  background: #ffffff;
}

.wrong-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.wrong-item__type {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #eef4fa;
  color: #1f5f8b;
  font-size: 24rpx;
  line-height: 34rpx;
}

.wrong-item__date {
  min-width: 0;
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
  text-align: right;
}

.wrong-item__stem {
  display: block;
  color: #202938;
  font-size: 30rpx;
  line-height: 44rpx;
  word-break: break-word;
}

.wrong-item__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.wrong-item__stat {
  color: #697586;
  font-size: 24rpx;
  line-height: 34rpx;
}

.wrong-item__button {
  width: 100%;
  height: 72rpx;
  margin: 22rpx 0 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #b8c7d8;
  background: #ffffff;
  color: #1f5f8b;
  font-size: 28rpx;
  line-height: 72rpx;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #dce3ec;
  background: #ffffff;
  box-sizing: border-box;
}

.bottom-actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #1f5f8b;
  color: #ffffff;
  font-size: 30rpx;
  line-height: 80rpx;
}
</style>
