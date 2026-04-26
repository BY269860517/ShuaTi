<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { SafeQuestion } from '@/common/types'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const countOptions = [5, 10, 20]

const materialId = ref('')
const questions = ref<SafeQuestion[]>([])
const selectedCount = ref(10)
const loading = ref(false)
const creating = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const questionCount = computed(() => questions.value.length)
const hasQuestions = computed(() => questionCount.value > 0)
const startButtonText = computed(() => (creating.value ? '正在创建练习' : '开始练习'))

onLoad((options) => {
  materialId.value = String(options?.materialId || '')
  loadQuestions()
})

async function loadQuestions() {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await api.questionList(materialId.value || undefined)
    questions.value = result.questions
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '题目数量加载失败'
  } finally {
    loading.value = false
  }
}

function selectCount(count: number) {
  if (creating.value) return
  selectedCount.value = count
}

async function createPractice() {
  if (creating.value || !hasQuestions.value) return

  creating.value = true
  errorMessage.value = ''

  try {
    const result = await api.practiceCreate({ materialId: materialId.value || undefined, count: selectedCount.value })
    uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '练习创建失败，请重试'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !didLoad" text="正在加载题目" />
    <ErrorState v-else-if="errorMessage && !didLoad" :message="errorMessage" @retry="loadQuestions" />
    <EmptyState
      v-else-if="didLoad && !hasQuestions"
      title="暂无可练习题目"
      description="请先导入题目，或返回资料页确认题目已导入。"
      action-text="重试"
      @action="loadQuestions"
    />

    <view v-else class="content">
      <view class="summary">
        <text class="summary__label">可练习题目</text>
        <text class="summary__value">{{ questionCount }}</text>
        <text class="summary__hint">选择本次练习题量，系统会按当前题库创建练习。</text>
      </view>

      <view class="section">
        <text class="section__title">题量</text>
        <view class="count-options">
          <button
            v-for="count in countOptions"
            :key="count"
            class="count-options__item"
            :class="{ 'count-options__item--active': selectedCount === count }"
            type="default"
            :disabled="creating"
            @click="selectCount(count)"
          >
            {{ count }}
          </button>
        </view>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="createPractice" />
    </view>

    <view v-if="hasQuestions" class="bottom-actions">
      <button
        class="bottom-actions__button"
        type="default"
        :loading="creating"
        :disabled="creating"
        @click="createPractice"
      >
        {{ startButtonText }}
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
  gap: 24rpx;
}

.summary,
.section {
  padding: 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid #dce3ec;
  background: #ffffff;
}

.summary__label,
.section__title {
  display: block;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.summary__value {
  display: block;
  margin-top: 8rpx;
  color: #202938;
  font-size: 56rpx;
  line-height: 68rpx;
  font-weight: 600;
}

.summary__hint {
  display: block;
  margin-top: 12rpx;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
  word-break: break-word;
}

.count-options {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}

.count-options__item {
  flex: 1;
  min-width: 0;
  height: 76rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #b8c7d8;
  background: #ffffff;
  color: #1f5f8b;
  font-size: 30rpx;
  line-height: 76rpx;
}

.count-options__item--active {
  border-color: #1f5f8b;
  background: #1f5f8b;
  color: #ffffff;
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
