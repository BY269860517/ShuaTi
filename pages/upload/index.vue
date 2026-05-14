<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/common/api/cloud'
import type { CreatedMaterial, ParseMode } from '@/common/types'
import { formatFileSize } from '@/common/format'
import ErrorState from '@/components/ErrorState.vue'

interface ChosenFile {
  name: string
  size: number
  path: string
}

type UploadResult = {
  fileID: string
}

interface ChooseMessageFileResult {
  tempFiles: ChosenFile[]
}

const parseMode = ref<ParseMode>('inline_answer')
const selectedFile = ref<ChosenFile | null>(null)
const uploading = ref(false)
const errorMessage = ref('')
const MAX_PDF_FILE_SIZE = 20 * 1024 * 1024
const MAX_PDF_FILE_SIZE_TEXT = '20MB'

const canSubmit = computed(() => Boolean(selectedFile.value) && !uploading.value)

function setParseMode(mode: ParseMode) {
  if (uploading.value) return
  parseMode.value = mode
}

async function choosePdf() {
  if (uploading.value) return

  errorMessage.value = ''

  try {
    const result = await chooseMessageFile()
    const file = result.tempFiles[0]
    if (!file) return

    const chosenFile = {
      name: file.name,
      size: file.size,
      path: file.path,
    }
    const validationError = validateSelectedFile(chosenFile)
    if (validationError) {
      selectedFile.value = null
      errorMessage.value = validationError
      return
    }

    selectedFile.value = chosenFile
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message && !message.includes('cancel')) {
      errorMessage.value = message
    }
  }
}

function chooseMessageFile(): Promise<ChooseMessageFileResult> {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: resolve,
      fail: reject,
    })
  })
}

function validateSelectedFile(file: ChosenFile): string {
  if (file.size > MAX_PDF_FILE_SIZE) {
    return `文件大小不能超过 ${MAX_PDF_FILE_SIZE_TEXT}，请重新选择较小的 PDF。`
  }

  return ''
}

async function submitUpload() {
  const file = selectedFile.value
  if (!file || uploading.value) return

  errorMessage.value = ''
  const validationError = validateSelectedFile(file)
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  uploading.value = true
  try {
    const loginResult = await api.userLogin()
    const uploadResult = await uniCloud.uploadFile({
      cloudPath: `materials/${loginResult.user.openid}/${Date.now()}-${sanitizeCloudFileName(file.name)}`,
      filePath: file.path,
    }) as UploadResult

    const createResult = await api.materialCreate({
      fileID: uploadResult.fileID,
      fileName: file.name,
      fileSize: file.size,
      parseMode: parseMode.value,
    })
    const material: CreatedMaterial = createResult.material

    const parseResult = await api.parseStart(material._id)
    await api.parseRunner(parseResult.job._id)
    uni.redirectTo({ url: `/pages/material/detail?materialId=${material._id}` })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '上传失败，请重试'
  } finally {
    uploading.value = false
  }
}

function sanitizeCloudFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const fallback = 'material.pdf'
  if (!trimmed) return fallback
  return trimmed.replace(/[\/\\?%#]+/g, '_') || fallback
}
</script>

<template>
  <view class="page">
    <view class="section">
      <text class="section__title">解析方式</text>
      <view class="mode-control">
        <button
          class="mode-control__item"
          :class="{ 'mode-control__item--active': parseMode === 'inline_answer' }"
          type="default"
          @click="setParseMode('inline_answer')"
        >
          题后答案
        </button>
        <button
          class="mode-control__item"
          :class="{ 'mode-control__item--active': parseMode === 'answer_at_end' }"
          type="default"
          @click="setParseMode('answer_at_end')"
        >
          末尾答案
        </button>
      </view>
    </view>

    <view class="section">
      <text class="section__title">PDF 文件</text>
      <button class="file-button" type="default" :disabled="uploading" @click="choosePdf">
        选择 PDF
      </button>

      <view v-if="selectedFile" class="file-info">
        <text class="file-info__name">{{ selectedFile.name }}</text>
        <text class="file-info__size">{{ formatFileSize(selectedFile.size) }}</text>
      </view>
      <text v-else class="hint">仅支持从微信聊天文件中选择一个 PDF。</text>
      <view class="upload-guidance">
        <text class="upload-guidance__item">文件大小不超过 {{ MAX_PDF_FILE_SIZE_TEXT }}。</text>
        <text class="upload-guidance__item">目前支持单选题、多选题、判断题。</text>
        <text class="upload-guidance__item">题目必须有选项和标准答案，缺少答案会进入待审核或不可用。</text>
      </view>
    </view>

    <ErrorState v-if="errorMessage" :message="errorMessage" retry-text="" />

    <view class="actions">
      <button
        class="actions__primary"
        type="default"
        :disabled="!canSubmit"
        :loading="uploading"
        @click="submitUpload"
      >
        {{ uploading ? '上传中' : '上传并解析' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: $background;
}

.section {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border: 1rpx solid $border-color;
  border-radius: 8rpx;
  background: $surface;
  box-shadow: $surface-shadow;
}

.section__title {
  display: block;
  margin-bottom: 20rpx;
  color: $text-primary;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 600;
}

.mode-control {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.mode-control__item {
  min-width: 148rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 8rpx;
  background: $surface;
  color: $brand-primary;
  border: 1rpx solid $brand-border;
  font-size: 28rpx;
  line-height: 68rpx;
  white-space: nowrap;
}

.mode-control__item--active {
  background: $brand-primary;
  color: $surface;
  border-color: $brand-primary;
  font-weight: 600;
}

.file-button,
.actions__primary {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  font-size: 30rpx;
  line-height: 80rpx;
}

.file-button {
  background: $surface;
  color: $brand-primary;
  border: 1rpx solid $brand-border;
}

.file-info {
  margin-top: 18rpx;
}

.file-info__name {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  line-height: 40rpx;
  word-break: break-all;
}

.file-info__size,
.hint {
  display: block;
  margin-top: 8rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
}

.upload-guidance {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid $brand-primary-soft-strong;
  border-radius: 8rpx;
  background: $brand-primary-soft;
}

.upload-guidance__item {
  display: block;
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 36rpx;
}

.upload-guidance__item + .upload-guidance__item {
  margin-top: 6rpx;
}

.actions {
  position: sticky;
  left: 0;
  right: 0;
  bottom: 0;
  margin-top: 20rpx;
  padding: 16rpx 0 calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
  background: $surface;
}

.actions__primary {
  border: 1rpx solid $brand-primary;
  background: $brand-primary;
  color: $surface;
}

.actions__primary[disabled] {
  border-color: $border-color;
  background: $surface-muted;
  color: $text-muted;
}
</style>
