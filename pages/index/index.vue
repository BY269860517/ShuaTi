<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { Material } from '@/common/types'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import MaterialCard from '@/components/MaterialCard.vue'

const materials = ref<Material[]>([])
const loading = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const hasMaterials = computed(() => materials.value.length > 0)

onLoad(() => {
  loadMaterials()
})

onShow(() => {
  if (didLoad.value) {
    loadMaterials()
  }
})

async function loadMaterials() {
  loading.value = true
  errorMessage.value = ''

  try {
    await api.userLogin()
    const result = await api.materialList()
    materials.value = result.materials
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '资料加载失败'
  } finally {
    loading.value = false
  }
}

function goUpload() {
  uni.navigateTo({ url: '/pages/upload/index' })
}

function openMaterial(materialId: string) {
  uni.navigateTo({ url: `/pages/material/detail?materialId=${materialId}` })
}
</script>

<template>
  <view class="page">
    <view class="toolbar">
      <view class="toolbar__text">
        <text class="toolbar__title">我的资料</text>
        <text class="toolbar__subtitle">上传 PDF 后审核解析出的候选题，再进入练习。</text>
      </view>
      <button class="toolbar__button" type="default" @click="goUpload">上传 PDF</button>
    </view>

    <LoadingState v-if="loading && !hasMaterials" text="正在加载资料" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="loadMaterials" />
    <EmptyState
      v-else-if="!hasMaterials"
      title="暂无资料"
      description="从微信聊天文件选择 PDF，解析后可审核并导入题目。"
      action-text="上传 PDF"
      @action="goUpload"
    />

    <view v-else class="material-list">
      <MaterialCard
        v-for="material in materials"
        :key="material._id"
        :material="material"
        @open="openMaterial"
      />
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

.toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 24rpx 0;
}

.toolbar__text {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

.toolbar__title {
  display: block;
  color: #202938;
  font-size: 36rpx;
  line-height: 48rpx;
  font-weight: 600;
}

.toolbar__subtitle {
  display: block;
  margin-top: 8rpx;
  color: #697586;
  font-size: 26rpx;
  line-height: 38rpx;
}

.toolbar__button {
  flex-shrink: 0;
  width: 176rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #1f5f8b;
  color: #ffffff;
  font-size: 28rpx;
  line-height: 72rpx;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
