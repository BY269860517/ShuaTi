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

  const normalizedOptions = normalizeOptions()
  const optionKeySet = new Set(normalizedOptions.map((option) => option.key))
  if (!normalizedOptions.length) {
    errorMessage.value = '至少保留一个完整选项'
    return false
  }

  if (optionKeySet.size !== normalizedOptions.length) {
    errorMessage.value = '选项标识不能重复'
    return false
  }

  const normalizedAnswers = normalizeAnswerKeys(answerKeys.value)
  if (!normalizedAnswers.length) {
    errorMessage.value = '答案不能为空'
    return false
  }

  if (normalizedAnswers.some((key) => !optionKeySet.has(key))) {
    errorMessage.value = '答案必须来自现有选项'
    return false
  }

  if (type.value !== 'multiple' && normalizedAnswers.length > 1) {
    errorMessage.value = '单选或判断题只能有一个答案'
    return false
  }

  errorMessage.value = ''
  return true
}

async function saveCandidate() {
  if (!validateForm() || saving.value) return

  saving.value = true

  try {
    const normalizedOptions = normalizeOptions()
    const normalizedAnswers = normalizeAnswerKeys(answerKeys.value)
    const candidatePayload: CandidateUpdateInput = {
      stem: stem.value.trim(),
      type: type.value,
      options: normalizedOptions,
      answerKeys: normalizedAnswers,
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

function normalizeOptions(): OptionItem[] {
  return options.value
    .map((option) => ({ key: option.key.trim().toUpperCase(), text: option.text.trim() }))
    .filter((option) => option.key && option.text)
}

function normalizeAnswerKeys(value: string | string[]): string[] {
  const rawValues = Array.isArray(value) ? value : value.split(/[,\s，、]+/)
  return Array.from(new Set(rawValues
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)))
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

    <view v-else class="content">
      <view class="form">
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

      </view>

      <view class="bottom-actions">
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
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(128rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: $background;
}

.content,
.form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.field {
  padding: 24rpx;
  border: 1rpx solid $border-color;
  border-radius: 8rpx;
  background: $surface;
  box-shadow: $surface-shadow;
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
  color: $text-primary;
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
  background: $surface;
  color: $brand-primary;
  border: 1rpx solid $brand-border;
  font-size: 26rpx;
  line-height: 60rpx;
}

.type-control {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.type-control__item {
  min-width: 148rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid $brand-border;
  border-radius: 8rpx;
  background: $surface;
  color: $brand-primary;
  font-size: 26rpx;
  line-height: 68rpx;
  font-weight: 600;
  white-space: nowrap;
}

.type-control__item--active {
  border-color: $brand-primary;
  background: $brand-primary;
  color: $surface;
}

.textarea,
.input {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid $border-color;
  border-radius: 8rpx;
  background: $surface;
  color: $text-primary;
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
  border: 1rpx solid $border-color;
  border-radius: 8rpx;
  color: $text-primary;
  font-size: 28rpx;
  line-height: 72rpx;
  text-align: center;
}

.option-row__text {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  box-sizing: border-box;
  border: 1rpx solid $border-color;
  border-radius: 8rpx;
  color: $text-primary;
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
  background: $surface;
  color: $danger;
  border: 1rpx solid $danger-border;
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
  background: $surface;
  color: $text-body;
  border: 1rpx solid $border-color;
  font-size: 28rpx;
  line-height: 64rpx;
}

.answer-list__item--active {
  background: $brand-primary;
  color: $surface;
  border-color: $brand-primary;
}

.save-button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid $brand-primary;
  background: $brand-primary;
  color: $surface;
  font-size: 30rpx;
  line-height: 80rpx;
}

.save-button[disabled] {
  border-color: $border-color;
  background: $surface-muted;
  color: $text-muted;
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
</style>
