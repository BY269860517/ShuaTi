<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import { AD_CONFIG } from '@/common/ad/config'
import type { Material } from '@/common/types'
import AppAd from '@/components/AppAd.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import MaterialCard from '@/components/MaterialCard.vue'

const materials = ref<Material[]>([])
const loading = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)
const deletedId = ref('')
const deleteErrorMessage = ref('')

const hasMaterials = computed(() => materials.value.length > 0)
const homeAdUnitId = computed(() => (AD_CONFIG.enabled ? AD_CONFIG.homeFeedUnitId : ''))

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
  deleteErrorMessage.value = ''

  try {
    await api.userLogin()
    const result = await api.materialList()
    materials.value = result.materials
    deleteErrorMessage.value = ''
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '资料加载失败'
  } finally {
    loading.value = false
  }
}

function deleteConfirmText(material: Material) {
  if (material.status === 'ready' && material.questionCount > 0) {
    return '删除后首页不再显示该资料。已生成的题目、历史练习和错题记录会保留，确认删除？'
  }
  if (material.status === 'parsing') {
    return '该资料可能仍在后台解析。删除后首页不再显示，后续可重新上传，确认删除？'
  }
  return '删除后首页不再显示该资料，后续可重新上传，确认删除？'
}

function showDeleteConfirm(material: Material): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '删除资料',
      content: deleteConfirmText(material),
      confirmText: '删除',
      confirmColor: '#d93025',
      cancelText: '取消',
      success(result) {
        resolve(Boolean(result.confirm))
      },
      fail() {
        resolve(false)
      },
    })
  })
}

async function confirmDeleteMaterial(materialId: string) {
  const material = materials.value.find((item) => item._id === materialId)
  if (!material || deletedId.value) return

  deletedId.value = material._id
  deleteErrorMessage.value = ''

  const confirmed = await showDeleteConfirm(material)
  if (!confirmed) {
    deletedId.value = ''
    return
  }

  try {
    await api.materialDelete(material._id)
    materials.value = materials.value.filter((item) => item._id !== material._id)
    uni.showToast({ title: '已删除资料', icon: 'none' })
  } catch (error) {
    deleteErrorMessage.value = error instanceof Error ? error.message : '删除失败，请重试'
    uni.showToast({ title: deleteErrorMessage.value, icon: 'none' })
  } finally {
    deletedId.value = ''
  }
}

function goUpload() {
  uni.navigateTo({ url: '/pages/upload/index' })
}

function goProfile() {
  uni.navigateTo({ url: '/pages/profile/index' })
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
      <view class="toolbar__actions">
        <button class="toolbar__secondary-button" type="default" @click="goProfile">我的</button>
        <button class="toolbar__button" type="default" @click="goUpload">上传 PDF</button>
      </view>
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
      <text v-if="deleteErrorMessage" class="material-list__delete-error">{{ deleteErrorMessage }}</text>
      <template v-for="(material, index) in materials" :key="material._id">
        <MaterialCard
          :material="material"
          :deleting="deletedId === material._id"
          @open="openMaterial"
          @delete="confirmDeleteMaterial"
        />
        <AppAd v-if="homeAdUnitId && index === 1" :unit-id="homeAdUnitId" />
      </template>
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

.toolbar__actions {
  flex-shrink: 0;
  display: flex;
  gap: 12rpx;
}

.toolbar__button {
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

.toolbar__secondary-button {
  width: 112rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid #b8c7d8;
  background: #ffffff;
  color: #1f5f8b;
  font-size: 28rpx;
  line-height: 72rpx;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.material-list__delete-error {
  display: block;
  padding: 16rpx 20rpx;
  border: 1rpx solid #f0c9c9;
  border-radius: 8rpx;
  background: #fff7f7;
  color: #9f2a2a;
  font-size: 26rpx;
  line-height: 36rpx;
}
</style>
