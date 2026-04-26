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

    selectedFile.value = {
      name: file.name,
      size: file.size,
      path: file.path,
    }
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

async function submitUpload() {
  const file = selectedFile.value
  if (!file || uploading.value) return

  uploading.value = true
  errorMessage.value = ''

  try {
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: `materials/${Date.now()}-${sanitizeCloudFileName(file.name)}`,
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
  background: #f6f7f9;
}

.section {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border: 1rpx solid #dce3ec;
  border-radius: 8rpx;
  background: #ffffff;
}

.section__title {
  display: block;
  margin-bottom: 20rpx;
  color: #202938;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 600;
}

.mode-control {
  display: flex;
  padding: 4rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  background: #eef2f7;
}

.mode-control__item {
  flex: 1;
  height: 68rpx;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 6rpx;
  background: transparent;
  color: #475467;
  border: 0;
  font-size: 28rpx;
  line-height: 68rpx;
}

.mode-control__item--active {
  background: #ffffff;
  color: #1f5f8b;
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
  background: #ffffff;
  color: #1f5f8b;
  border: 1rpx solid #b8c7d8;
}

.file-info {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eef2f7;
}

.file-info__name {
  display: block;
  color: #202938;
  font-size: 28rpx;
  line-height: 40rpx;
  word-break: break-all;
}

.file-info__size,
.hint {
  display: block;
  margin-top: 8rpx;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.actions {
  padding-top: 12rpx;
}

.actions__primary {
  background: #1f5f8b;
  color: #ffffff;
}
</style>
