<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import {
  getPracticeCreateErrorMessage,
  normalizeCustomCountInput,
  resolvePracticeCount,
} from '@/common/practiceSettings'
import type {
  PracticeCountMode,
  PracticeOrderMode,
  PracticeQuestionTypeFilter,
  PracticeScope,
  SafeQuestion,
} from '@/common/types'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const countOptions = [5, 10, 20]
const questionTypeOptions: Array<{ label: string; value: PracticeQuestionTypeFilter }> = [
  { label: '全部', value: 'all' },
  { label: '单选', value: 'single' },
  { label: '多选', value: 'multiple' },
  { label: '判断', value: 'judge' },
]

const materialId = ref('')
const questions = ref<SafeQuestion[]>([])
const selectedFixedCount = ref(10)
const countMode = ref<PracticeCountMode>('fixed')
const customCountInput = ref('10')
const orderMode = ref<PracticeOrderMode>('sequence')
const practiceScope = ref<PracticeScope>('all')
const questionType = ref<PracticeQuestionTypeFilter>('all')
const loading = ref(false)
const creating = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const questionCount = computed(() => questions.value.length)
const hasQuestions = computed(() => questionCount.value > 0)
const filteredQuestionCount = computed(() => {
  if (questionType.value === 'all') return questionCount.value
  return questions.value.filter((question) => question.type === questionType.value).length
})
const selectedPracticeCount = computed(() => {
  return resolvePracticeCount({
    countMode: countMode.value,
    selectedFixedCount: selectedFixedCount.value,
    customCountInput: customCountInput.value,
    filteredQuestionCount: filteredQuestionCount.value,
  })
})
const canCreatePractice = computed(() => !creating.value && filteredQuestionCount.value > 0)
const startButtonText = computed(() => (creating.value ? '正在创建练习' : '开始练习'))
const setupHint = computed(() => {
  const scopeLabel = practiceScope.value === 'all' ? '全部题目' : '未练习题目'
  const orderLabel = orderMode.value === 'sequence' ? '顺序' : '随机'
  if (practiceScope.value === 'unattempted') {
    return `${scopeLabel}，${orderLabel}出题，未练习数量会在创建时由云端确认。`
  }
  return `${scopeLabel}，${orderLabel}出题，系统会按当前设置创建练习。`
})

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
  selectedFixedCount.value = count
  countMode.value = 'fixed'
}

function selectAllCount() {
  if (creating.value) return
  countMode.value = 'all'
}

function selectCustomCount() {
  if (creating.value) return
  countMode.value = 'custom'
  if (!customCountInput.value) customCountInput.value = '1'
}

function sanitizeCustomCountInput(event: { detail?: { value?: string } } | string) {
  const rawValue = typeof event === 'string' ? event : event.detail?.value
  customCountInput.value = normalizeCustomCountInput(rawValue)
  countMode.value = 'custom'
}

async function createPractice() {
  if (!canCreatePractice.value) return

  creating.value = true
  errorMessage.value = ''

  try {
    const result = await api.practiceCreate({
      materialId: materialId.value || undefined,
      count: selectedPracticeCount.value,
      countMode: countMode.value,
      orderMode: orderMode.value,
      scope: practiceScope.value,
      questionType: questionType.value,
    })
    uni.redirectTo({ url: `/pages/practice/do?sessionId=${result.session._id}` })
  } catch (error) {
    errorMessage.value = getPracticeCreateErrorMessage(error)
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
        <text class="summary__value">{{ filteredQuestionCount }}</text>
        <text class="summary__hint">{{ setupHint }}</text>
      </view>

      <view class="section">
        <text class="section__title">题量</text>
        <view class="count-options">
          <button
            v-for="count in countOptions"
            :key="count"
            class="option-button"
            :class="{ 'option-button--active': countMode === 'fixed' && selectedFixedCount === count }"
            type="default"
            :disabled="creating"
            @click="selectCount(count)"
          >
            {{ count }}
          </button>
          <button
            class="option-button"
            :class="{ 'option-button--active': countMode === 'all' }"
            type="default"
            :disabled="creating"
            @click="selectAllCount"
          >
            全部练习
          </button>
          <button
            class="option-button"
            :class="{ 'option-button--active': countMode === 'custom' }"
            type="default"
            :disabled="creating"
            @click="selectCustomCount"
          >
            自定义
          </button>
        </view>
        <view v-if="countMode === 'custom'" class="custom-count">
          <input
            class="custom-count__input"
            type="number"
            :value="customCountInput"
            :disabled="creating"
            placeholder="输入题数"
            @input="sanitizeCustomCountInput"
          />
          <text class="custom-count__suffix">题</text>
        </view>
      </view>

      <view class="section">
        <text class="section__title">出题方式</text>
        <view class="option-row">
          <button
            class="option-button"
            :class="{ 'option-button--active': orderMode === 'sequence' }"
            type="default"
            :disabled="creating"
            @click="orderMode = 'sequence'"
          >
            顺序
          </button>
          <button
            class="option-button"
            :class="{ 'option-button--active': orderMode === 'random' }"
            type="default"
            :disabled="creating"
            @click="orderMode = 'random'"
          >
            随机
          </button>
        </view>
      </view>

      <view class="section">
        <text class="section__title">练习范围</text>
        <view class="option-row">
          <button
            class="option-button"
            :class="{ 'option-button--active': practiceScope === 'all' }"
            type="default"
            :disabled="creating"
            @click="practiceScope = 'all'"
          >
            全部题目
          </button>
          <button
            class="option-button"
            :class="{ 'option-button--active': practiceScope === 'unattempted' }"
            type="default"
            :disabled="creating"
            @click="practiceScope = 'unattempted'"
          >
            未练习题目
          </button>
        </view>
      </view>

      <view class="section">
        <text class="section__title">题型</text>
        <view class="option-row">
          <button
            v-for="option in questionTypeOptions"
            :key="option.value"
            class="option-button"
            :class="{ 'option-button--active': questionType === option.value }"
            type="default"
            :disabled="creating"
            @click="questionType = option.value"
          >
            {{ option.label }}
          </button>
        </view>
        <text v-if="filteredQuestionCount === 0" class="section__hint">当前题型暂无可练习题目</text>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="createPractice" />
    </view>

    <view v-if="hasQuestions" class="bottom-actions">
      <button
        class="bottom-actions__button"
        type="default"
        :loading="creating"
        :disabled="!canCreatePractice"
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
  background: $background;
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
  border: 1rpx solid $border-color;
  background: $surface;
  box-shadow: $surface-shadow;
}

.summary__label,
.section__title {
  display: block;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
}

.summary__value {
  display: block;
  margin-top: 8rpx;
  color: $text-primary;
  font-size: 56rpx;
  line-height: 68rpx;
  font-weight: 600;
}

.summary__hint,
.section__hint {
  display: block;
  margin-top: 12rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
  word-break: break-word;
}

.count-options,
.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.option-button {
  flex: 1 1 148rpx;
  min-width: 148rpx;
  height: 76rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 8rpx;
  border: 1rpx solid $brand-border;
  background: $surface;
  color: $brand-primary;
  font-size: 28rpx;
  line-height: 76rpx;
  white-space: nowrap;
}

.option-button--active {
  border-color: $brand-primary;
  background: $brand-primary;
  color: $surface;
}

.custom-count {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 18rpx;
}

.custom-count__input {
  flex: 1;
  min-width: 0;
  height: 76rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  border-radius: 8rpx;
  border: 1rpx solid $brand-border;
  background: $surface;
  color: $text-primary;
  font-size: 30rpx;
}

.custom-count__suffix {
  flex-shrink: 0;
  color: $text-muted;
  font-size: 28rpx;
  line-height: 40rpx;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
  background: $surface;
  box-sizing: border-box;
}

.bottom-actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: $brand-primary;
  color: $surface;
  font-size: 30rpx;
  line-height: 80rpx;
}
</style>
