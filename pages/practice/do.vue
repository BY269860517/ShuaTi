<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { AnswerSubmitResult, PracticeSession, SafeQuestion } from '@/common/types'
import {
  advanceToNext,
  afterGradingIntent,
  buttonIntent,
  canSubmit,
  createPracticeFlowData,
  currentQuestionId as getCurrentQuestionId,
  gradingResult as getGradingResult,
  recordGradingResult,
  resetPracticeFlow,
  selectAnswer,
  selectedKeys as getSelectedKeys,
} from '@/common/practiceFlow'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import QuestionCard from '@/components/QuestionCard.vue'

const sessionId = ref('')
const session = ref<PracticeSession | null>(null)
const questions = ref<SafeQuestion[]>([])
const flow = reactive(createPracticeFlowData())
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const totalCount = computed(() => questions.value.length)
const currentQuestion = computed(() => questions.value[flow.currentIndex] || null)
const currentQuestionId = computed(() => getCurrentQuestionId(flow))
const currentSelectedKeys = computed(() => getSelectedKeys(flow))
const currentGradingResult = computed(() => getGradingResult(flow))
const hasSelection = computed(() => currentSelectedKeys.value.length > 0)
const canSubmitCurrent = computed(() => canSubmit(flow, submitting.value))
const submitButtonText = computed(() => {
  const intent = buttonIntent(flow, submitting.value)
  if (intent === 'submitting') return '提交中'
  if (intent === 'result') return '查看结果'
  if (intent === 'next') return '下一题'
  return '提交答案'
})

onLoad((options) => {
  sessionId.value = String(options?.sessionId || '')
  loadPractice()
})

async function loadPractice() {
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
    questions.value = result.questions
    resetPracticeFlow(flow, result.questions.map((question) => question._id))
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '练习加载失败'
  } finally {
    loading.value = false
  }
}

function saveAnswer(keys: string[]) {
  const questionId = currentQuestionId.value
  if (!questionId || submitting.value) return
  selectAnswer(flow, questionId, keys)
}

async function submitCurrentAnswer() {
  const questionId = currentQuestionId.value
  if (!sessionId.value || !questionId || !canSubmitCurrent.value) return

  const selectedKeys = currentSelectedKeys.value
  if (selectedKeys.length === 0) {
    errorMessage.value = '请先选择答案'
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const result = await api.answerSubmit({ sessionId: sessionId.value, questionId, selectedKeys })
    recordGradingResult(flow, result)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '答案提交失败，请重试'
  } finally {
    submitting.value = false
  }
}

function goNext() {
  if (!currentGradingResult.value) {
    submitCurrentAnswer()
    return
  }

  if (afterGradingIntent(flow) === 'result') {
    uni.redirectTo({ url: `/pages/practice/result?sessionId=${sessionId.value}` })
    return
  }

  advanceToNext(flow)
  errorMessage.value = ''
}

function formatAnswerKeys(gradingResult: AnswerSubmitResult): string {
  return gradingResult.answerKeys.join('、')
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !didLoad" text="正在加载练习" />
    <ErrorState v-else-if="errorMessage && !questions.length" :message="errorMessage" @retry="loadPractice" />
    <EmptyState
      v-else-if="didLoad && !questions.length"
      title="本次练习暂无题目"
      description="请返回练习设置页重新创建。"
    />

    <view v-else-if="currentQuestion" class="content">
      <QuestionCard
        :question="currentQuestion"
        :selected-keys="currentSelectedKeys"
        :index="flow.currentIndex + 1"
        :total="totalCount"
        :disabled="Boolean(currentGradingResult)"
        @answer="saveAnswer"
      />

      <view v-if="currentGradingResult" class="grading" :class="{ 'grading--correct': currentGradingResult.isCorrect }">
        <text class="grading__title">{{ currentGradingResult.isCorrect ? '回答正确' : '回答错误' }}</text>
        <text class="grading__line">正确答案：{{ formatAnswerKeys(currentGradingResult) }}</text>
        <text v-if="currentGradingResult.explanation" class="grading__explanation">
          {{ currentGradingResult.explanation }}
        </text>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="submitCurrentAnswer" />
    </view>

    <view v-if="currentQuestion" class="bottom-actions">
      <button
        class="bottom-actions__button"
        type="default"
        :loading="submitting"
        :disabled="submitting || (!currentGradingResult && !hasSelection)"
        @click="goNext"
      >
        {{ submitButtonText }}
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

.grading {
  padding: 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid #f2c3c3;
  background: #fdecec;
}

.grading--correct {
  border-color: #a7d8b8;
  background: #edf8f1;
}

.grading__title {
  display: block;
  color: #202938;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 600;
}

.grading__line,
.grading__explanation {
  display: block;
  margin-top: 12rpx;
  color: #364152;
  font-size: 28rpx;
  line-height: 40rpx;
  word-break: break-word;
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
