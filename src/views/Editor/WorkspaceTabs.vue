<template>
  <div class="workspace-tabs">
    <div
      v-for="doc in orderedDocs"
      :key="doc.id"
      class="tab"
      :class="{
        'is-active': doc.id === activeDocId,
        'is-primary': doc.id === primaryDocId,
      }"
      @click="activateTab(doc.id)"
    >
      <span v-if="doc.id === primaryDocId" class="tab-marker" aria-hidden="true"></span>
      <span class="tab-title">{{ doc.title }}</span>
      <span v-if="doc.dirty" class="tab-dirty" aria-hidden="true"></span>
      <span class="tab-close" @click.stop="closeTab(doc.id)">×</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkspaceStore } from '@/store'

const workspaceStore = useWorkspaceStore()
const { docs, activeDocId, primaryDocId } = storeToRefs(workspaceStore)

const orderedDocs = computed(() => {
  return [...docs.value].sort((left, right) => {
    if (left.id === primaryDocId.value) return -1
    if (right.id === primaryDocId.value) return 1
    return 0
  })
})

const activateTab = (docId: string) => {
  workspaceStore.activateDocument(docId)
}

const closeTab = (docId: string) => {
  const doc = docs.value.find(item => item.id === docId)
  if (!doc) return
  if (doc.dirty && !window.confirm(`"${doc.title}" 有未保存修改，仍然关闭吗？`)) return
  if (doc.id === primaryDocId.value && docs.value.length > 1 && !window.confirm(`"${doc.title}" 当前是主稿，关闭后会自动切换主稿，仍然继续吗？`)) return
  workspaceStore.closeDocument(docId)
}
</script>

<style lang="scss" scoped>
.workspace-tabs {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding-left: 8px;
}

.tab {
  min-width: 0;
  max-width: 200px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #d5dae3;
  border-radius: 6px;
  background: #eef1f5;
  color: #667085;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  cursor: pointer;

  &.is-primary {
    border-color: #f0b429;
    background: #fff7e0;
    color: #8a6116;
  }

  &.is-active {
    border-color: #2d6cdf;
    background: #eef4ff;
    color: #1d4fa8;
    box-shadow: inset 0 0 0 1px rgba(45, 108, 223, 0.2);
  }

  &.is-primary.is-active {
    background: linear-gradient(180deg, #fff7df 0%, #edf4ff 100%);
    border-color: #2d6cdf;
  }
}

.tab-marker {
  width: 8px;
  height: 8px;
  background: #f0b429;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.tab-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.tab-dirty {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.75;
  flex-shrink: 0;
}

.tab-close {
  font-size: 14px;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
  flex-shrink: 0;
}
</style>