<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '@/common/api/cloud'
import type { Material, UserInfo, WrongQuestionItem } from '@/common/types'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'

const user = ref<UserInfo | null>(null)
const materials = ref<Material[]>([])
const wrongQuestions = ref<WrongQuestionItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const didLoad = ref(false)

const materialCount = computed(() => materials.value.length)
const activeWrongCount = computed(() => wrongQuestions.value.length)
const userLabel = computed(() => user.value?.uid || user.value?.openid || '微信用户')

onLoad(loadProfile)

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''

  try {
    const loginResult = await api.userLogin()
    const materialResult = await api.materialList()
    const wrongResult = await api.wrongList({ status: 'active' })

    user.value = loginResult.user
    materials.value = materialResult.materials
    wrongQuestions.value = wrongResult.wrongQuestions
    didLoad.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '个人信息加载失败'
  } finally {
    loading.value = false
  }
}

function goMaterials() {
  uni.reLaunch({ url: '/pages/index/index' })
}

function goWrongBook() {
  uni.navigateTo({ url: '/pages/wrong/index' })
}
</script>

<template>
  <view class="page">
    <LoadingState v-if="loading && !didLoad" text="正在加载我的资料" />
    <ErrorState v-else-if="errorMessage && !didLoad" :message="errorMessage" @retry="loadProfile" />

    <view v-else class="content">
      <view class="header">
        <text class="header__title">我的资料</text>
        <text class="header__subtitle">{{ userLabel }}</text>
      </view>

      <ErrorState v-if="errorMessage" :message="errorMessage" @retry="loadProfile" />

      <view class="stats">
        <view class="stat">
          <text class="stat__label">资料</text>
          <text class="stat__value">{{ materialCount }}</text>
        </view>
        <view class="stat">
          <text class="stat__label">当前错题</text>
          <text class="stat__value">{{ activeWrongCount }}</text>
        </view>
      </view>

      <view class="actions">
        <button class="actions__button" type="default" @click="goMaterials">
          返回资料
        </button>
        <button class="actions__button actions__button--primary" type="default" @click="goWrongBook">
          查看错题
        </button>
      </view>
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

.content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.header {
  padding: 24rpx 0;
}

.header__title {
  display: block;
  color: $text-primary;
  font-size: 36rpx;
  line-height: 48rpx;
  font-weight: 600;
}

.header__subtitle {
  display: block;
  margin-top: 8rpx;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
  word-break: break-all;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.stat {
  padding: 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid $border-color;
  background: $surface;
  box-shadow: $surface-shadow;
}

.stat__label {
  display: block;
  color: $text-muted;
  font-size: 26rpx;
  line-height: 38rpx;
}

.stat__value {
  display: block;
  margin-top: 8rpx;
  color: $text-primary;
  font-size: 56rpx;
  line-height: 68rpx;
  font-weight: 600;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.actions__button {
  width: 100%;
  height: 80rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  border: 1rpx solid $brand-border;
  background: $surface;
  color: $brand-primary;
  font-size: 30rpx;
  line-height: 80rpx;
}

.actions__button--primary {
  border-color: $brand-primary;
  background: $brand-primary;
  color: $surface;
}
</style>
