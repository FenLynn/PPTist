<template>
  <template v-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else  loading :mask="false" />
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore, useWorkspaceStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB, LOCALSTORAGE_KEY_LIGHT_CACHE } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import { parsePresentationFromPptist } from '@/utils/presentation'
import api from '@/services'

import Editor from './views/Editor/index.vue'
import Screen from './views/Screen/index.vue'
import Mobile from './views/Mobile/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'

const _isPC = isPC()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const screenStore = useScreenStore()
const workspaceStore = useWorkspaceStore()
const { databaseId } = storeToRefs(mainStore)
const { slides } = storeToRefs(slidesStore)
const { screening } = storeToRefs(screenStore)

const isAudienceMode = new URLSearchParams(window.location.search).get('mode') === 'audience'
const hostBridge = new URLSearchParams(window.location.search).get('hostBridge')

function normalizeBridgeModels(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw
    .map(item => {
      const value = String((item as { id?: string }).id || '').trim()
      if (!value || value.startsWith('@cf/')) return null
      const name = String((item as { name?: string }).name || '').trim() || value
      const provider = String((item as { provider?: string }).provider || '').trim()
      return {
        value,
        label: provider ? `${name} (${provider})` : name,
      }
    })
    .filter((item): item is { value: string; label: string } => !!item)
}

function handleBridgeMessage(event: MessageEvent) {
  if (hostBridge !== 'dashboard') return
  const data = event.data as {
    channel?: string
    type?: string
    payload?: {
      aiModels?: unknown
      aiModel?: string
      outline?: string
      title?: string
      source?: string
    }
  }
  if (data?.channel !== 'sci-pptist-bridge') return

  if (data.type === 'dashboard:ai-models') {
    const models = normalizeBridgeModels(data.payload?.aiModels)
    if (models.length) mainStore.applyAIModelSettings(models, String(data.payload?.aiModel || ''))
    return
  }

  if (data.type === 'dashboard:outline-import') {
    const outline = String(data.payload?.outline || '').trim()
    if (!outline) return
    mainStore.setAIPPTBridgePayload({
      outline,
      title: String(data.payload?.title || '').trim(),
      source: String(data.payload?.source || 'dashboard'),
    })
    mainStore.setAIPPTDialogState(true)
  }
}

function restoreLightCache() {
  const raw = localStorage.getItem(LOCALSTORAGE_KEY_LIGHT_CACHE)
  if (!raw) return false

  try {
    const payload = JSON.parse(raw) as { content?: string; filename?: string; savedAt?: string }
    if (!payload?.content) return false

    const data = parsePresentationFromPptist(payload.content)
    slidesStore.setTheme(data.theme)
    slidesStore.setSlides(data.slides)
    slidesStore.setTitle(data.title)
    slidesStore.setViewportSize(data.viewportSize)
    slidesStore.setViewportRatio(data.viewportRatio)
    slidesStore.updateSlideIndex(data.slideIndex)
    workspaceStore.initializeFromCurrentStores()
    workspaceStore.updateActiveMeta({
      storage: 'memory',
      filename: payload.filename || `${data.title}.pptist`,
      dirty: false,
      lastSavedAt: payload.savedAt || '',
    })
    return true
  } catch (error) {
    console.warn('Failed to restore PPTist light cache:', error)
    localStorage.removeItem(LOCALSTORAGE_KEY_LIGHT_CACHE)
    return false
  }
}

if (import.meta.env.MODE !== 'development') {
  window.onbeforeunload = () => false
}

onMounted(async () => {
  window.addEventListener('message', handleBridgeMessage)
  mainStore.initializeAIModelSettings(window.location.search)

  if (isAudienceMode) {
    slidesStore.setSlides([{
      id: nanoid(10),
      elements: [],
    }])
    workspaceStore.initializeFromCurrentStores()
    screenStore.setScreening(true)
  }
  else {
    const restored = restoreLightCache()
    if (!restored) {
      const slides = await api.getMockData('slides')
      slidesStore.setSlides(slides)
      workspaceStore.initializeFromCurrentStores()
    }

    await deleteDiscardedDB()
    snapshotStore.initSnapshotDatabase()
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handleBridgeMessage)
})

watch(() => slidesStore.$state, () => {
  workspaceStore.syncActiveFromStores(true)
}, { deep: true })

// 应用注销时向 localStorage 中记录下本次 indexedDB 的数据库ID，用于之后清除数据库
window.addEventListener('beforeunload', () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
})
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>