<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, type CandidateUpdateInput } from '@/common/api/cloud'
import type { Candidate, OptionItem, QuestionType } from '@/common/types'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: 'single', label: '单选' },
  { value: 'multiple', label: '多选' },
  { value: 'judge', label: '判断' },
]

const candidateId = ref('')
const materialId = ref('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const stem = ref('')
const type = ref<QuestionType>('single')
const options = ref<OptionItem[]>([])
const answerKeys = ref<string[]>([])
const explanation = ref('')

const answerText = computed({
  get: () => answerKeys.value.join('、'),
  set: (value: string) => {
    answerKeys.value = normalizeAnswerKeys(value)
  },
})

onLoad((options) => {
  candidateId.value = String(options?.candidateId || '')
  materialId.value = String(options?.materialId || '')
  loadCandidate()
})

async function loadCandidate() {
  if (!candidateId.value) {
    errorMessage.value = '缺少候选题 ID'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await api.candidateDetail(candidateId.value)
    fillForm(result.candidate)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '候选题加载失败'
  } finally {
    loading.value = false
  }
}

function fillForm(candidate: Candidate) {
  stem.value = candidate.stem
  type.value = candidate.type
  options.value = candidate.options.map((option) => ({ ...option }))
  answerKeys.value = [...candidate.answerKeys]
  explanation.value = candidate.explanation
}

function setQuestionType(value: QuestionType) {
  type.value = value
}

function updateOptionKey(index: number, value: string) {
  options.value[index].key = value.trim().toUpperCase()
}

function updateOptionText(index: number, value: string) {
  options.value[index].text = value
}

function addOption() {
  options.value.push({
    key: nextOptionKey(),
    text: '',
  })
}

function removeOption(index: number) {
  const [removed] = options.value.splice(index, 1)
  if (removed) {
    answerKeys.value = answerKeys.value.filter((key) => key !== removed.key)
  }
}

function toggleAnswer(key: string) {
  if (!key) return

  if (type.value === 'single' || type.value === 'judge') {
    answerKeys.value = [key]
    return
  }

  if (answerKeys.value.includes(key)) {
    answerKeys.value = answerKeys.value.filter((item) => item !== key)
  } else {
    answerKeys.value = [...answerKeys.value, key]
  }
}

function validateForm(): boolean {
  if (!stem.value.trim()) {
    errorMessage.value = '题干不能为空'
    return false
  }

  const validOptions = options.value.filter((option) => option.key.trim() && option.text.trim())
  if (!validOptions.length) {
    errorMessage.value = '至少保留一个完整选项'
    return false
  }

  if (!answerKeys.value.length) {
    errorMessage.value = '答案不能为空'
    return false
  }

  errorMessage.value = ''
  return true
}

async function saveCandidate() {
  if (!validateForm() || saving.value) return

  saving.value = true

  try {
    const candidatePayload: CandidateUpdateInput = {
      stem: stem.value.trim(),
      type: type.value,
      options: options.value
        .map((option) => ({ key: option.key.trim().toUpperCase(), text: option.text.trim() }))
        .filter((option) => option.key && option.text),
      answerKeys: answerKeys.value,
      explanation: explanation.value.trim(),
    }

    await api.candidateUpdate(candidateId.value, candidatePayload)
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else if (materialId.value) {
      uni.redirectTo({ url: `/pages/import/review?materialId=${materialId.value}` })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

function normalizeAnswerKeys(value: string): string[] {
  return value
    .split(/[,\s，、]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

function nextOptionKey(): string {
  const usedKeys = new Set(options.value.map((option) => option.key))
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return letters.find((letter) => !usedKeys.has(letter)) || String(options.value.length + 1)
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading" text="正在加载候选题" />

    <view v-else class="form">
      <ErrorState v-if="errorMessage" :message="errorMessage" retry-text="" />

      <view class="field">
        <text class="field__label">题型</text>
        <view class="type-control">
          <button
            v-for="item in questionTypes"
            :key="item.value"
            class="type-control__item"
            :class="{ 'type-control__item--active': type === item.value }"
            type="default"
            @click="setQuestionType(item.value)"
          >
            {{ item.label }}
          </button>
        </view>
      </view>

      <view class="field">
        <text class="field__label">题干</text>
        <textarea
          class="textarea"
          :value="stem"
          maxlength="-1"
          auto-height
          placeholder="请输入题干"
          @input="stem = String($event.detail.value)"
        />
      </view>

      <view class="field">
        <view class="field__row">
          <text class="field__label">选项</text>
          <button class="field__small-button" type="default" @click="addOption">添加</button>
        </view>

        <view class="option-list">
          <view v-for="(option, index) in options" :key="index" class="option-row">
            <input
              class="option-row__key"
              :value="option.key"
              maxlength="4"
              @input="updateOptionKey(index, String($event.detail.value))"
            />
            <input
              class="option-row__text"
              :value="option.text"
              placeholder="选项内容"
              @input="updateOptionText(index, String($event.detail.value))"
            />
            <button class="option-row__remove" type="default" @click="removeOption(index)">删</button>
          </view>
        </view>
      </view>

      <view class="field">
        <text class="field__label">答案</text>
        <view class="answer-list">
          <button
            v-for="option in options"
            :key="option.key"
            class="answer-list__item"
            :class="{ 'answer-list__item--active': answerKeys.includes(option.key) }"
            type="default"
            @click="toggleAnswer(option.key)"
          >
            {{ option.key || '-' }}
          </button>
        </view>
        <input
          class="input"
          :value="answerText"
          placeholder="也可输入答案，如 A、B"
          @input="answerText = String($event.detail.value)"
        />
      </view>

      <view class="field">
        <text class="field__label">解析</text>
        <textarea
          class="textarea"
          :value="explanation"
          maxlength="-1"
          auto-height
          placeholder="请输入解析"
          @input="explanation = String($event.detail.value)"
        />
      </view>

      <button
        class="save-button"
        type="default"
        :loading="saving"
        :disabled="saving"
        @click="saveCandidate"
      >
        {{ saving ? '保存中' : '保存' }}
      </button>
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

.form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.field {
  padding: 24rpx;
  border: 1rpx solid #dce3ec;
  border-radius: 8rpx;
  background: #ffffff;
}

.field__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.field__label {
  display: block;
  margin-bottom: 16rpx;
  color: #202938;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 600;
}

.field__row .field__label {
  margin-bottom: 0;
}

.field__small-button {
  width: 112rpx;
  height: 60rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #ffffff;
  color: #1f5f8b;
  border: 1rpx solid #b8c7d8;
  font-size: 26rpx;
  line-height: 60rpx;
}

.type-control {
  display: flex;
  padding: 4rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  background: #eef2f7;
}

.type-control__item {
  flex: 1;
  height: 64rpx;
  margin: 0;
  padding: 0 8rpx;
  border: 0;
  border-radius: 6rpx;
  background: transparent;
  color: #475467;
  font-size: 26rpx;
  line-height: 64rpx;
}

.type-control__item--active {
  background: #ffffff;
  color: #1f5f8b;
  font-weight: 600;
}

.textarea,
.input {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  background: #ffffff;
  color: #202938;
  font-size: 28rpx;
  line-height: 40rpx;
}

.textarea {
  min-height: 160rpx;
  padding: 18rpx;
}

.input {
  height: 72rpx;
  padding: 0 18rpx;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.option-row__key {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  box-sizing: border-box;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  color: #202938;
  font-size: 28rpx;
  line-height: 72rpx;
  text-align: center;
}

.option-row__text {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  box-sizing: border-box;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  color: #202938;
  font-size: 28rpx;
  line-height: 72rpx;
  padding: 0 16rpx;
}

.option-row__remove {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #ffffff;
  color: #9a2f2f;
  border: 1rpx solid #f2c3c3;
  font-size: 26rpx;
  line-height: 72rpx;
}

.answer-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.answer-list__item {
  width: 72rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #ffffff;
  color: #364152;
  border: 1rpx solid #cbd5e1;
  font-size: 28rpx;
  line-height: 64rpx;
}

.answer-list__item--active {
  background: #1f5f8b;
  color: #ffffff;
  border-color: #1f5f8b;
}

.save-button {
  width: 100%;
  height: 80rpx;
  margin: 0 0 24rpx;
  padding: 0;
  border-radius: 8rpx;
  background: #1f5f8b;
  color: #ffffff;
  font-size: 30rpx;
  line-height: 80rpx;
}
</style>
