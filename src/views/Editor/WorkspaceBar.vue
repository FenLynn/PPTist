<template>
  <div class="workspace-bar">
    <div class="actions">
      <div class="action primary" @click="createTab">新建</div>
      <FileInput class="action" accept=".ppt,.pptx,.pptist,.json" @change="openLocalFiles">打开本地</FileInput>
      <div class="action" @click="saveLocalFile">保存本地</div>
      <div class="action" @click="openCloudManager">云端</div>
      <div class="action" @click="saveCloudFileAction">保存云端</div>
      <div class="action" :class="{ disabled: isPrimaryActive }" @click="setPrimaryDoc">设为主稿</div>
      <div class="action" :class="{ disabled: !canSendElements }" @click="sendElementsToPrimary">送对象</div>
      <div class="action" :class="{ disabled: !canSendSlides }" @click="sendSlidesToPrimary">送页面</div>
      <div class="action" :class="{ disabled: !primaryDoc || isPrimaryActive }" @click="goPrimaryDoc">去主稿</div>
    </div>

    <Modal :visible="cloudVisible" :width="680" @closed="closeCloudManager">
      <div class="cloud-modal">
        <div class="cloud-toolbar">
          <div class="cloud-title">云端演示文稿</div>
          <div class="cloud-actions">
            <div class="toolbar-btn" @click="refreshCloudFiles">刷新</div>
            <div class="toolbar-btn primary" @click="saveCloudFileAction">保存当前</div>
          </div>
        </div>

        <div class="cloud-list" v-if="cloudFiles.length">
          <div class="cloud-item" v-for="filename in cloudFiles" :key="filename">
            <div class="name">{{ filename }}</div>
            <div class="item-actions">
              <div class="item-btn" @click="loadCloudDocument(filename)">打开</div>
              <div class="item-btn danger" @click="removeCloudDocument(filename)">删除</div>
            </div>
          </div>
        </div>
        <div class="cloud-empty" v-else-if="!loadingCloud">云端还没有文件</div>
        <div class="cloud-empty" v-else>正在加载...</div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { saveAs } from 'file-saver'
import { useMainStore, useSlidesStore, useWorkspaceStore } from '@/store'
import { deleteCloudFile, listCloudFiles, loadCloudFile, saveCloudFile } from '@/services/pptist'
import message from '@/utils/message'
import {
  parsePresentationFromPptist,
  serializePresentationAsPptist,
} from '@/utils/presentation'
import useImport from '@/hooks/useImport'

import Modal from '@/components/Modal.vue'
import FileInput from '@/components/FileInput.vue'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const workspaceStore = useWorkspaceStore()
const { activeDoc, primaryDoc, primaryDocId } = storeToRefs(workspaceStore)
const { parseJSONFileToDocument, parseSpecificFileToDocument, parsePPTXFileToDocument } = useImport()

const cloudVisible = ref(false)
const loadingCloud = ref(false)
const cloudFiles = ref<string[]>([])

const isPrimaryActive = computed(() => !!activeDoc.value && activeDoc.value.id === primaryDocId.value)
const canSendElements = computed(() => !!primaryDoc.value && !isPrimaryActive.value && mainStore.activeElementIdList.length > 0)
const canSendSlides = computed(() => !!primaryDoc.value && !isPrimaryActive.value)

const currentFilename = computed(() => {
  const doc = activeDoc.value
  return doc?.filename || `${doc?.title || '未命名演示文稿'}.pptist`
})

const createTab = () => {
  workspaceStore.addEmptyDocument()
}

const setPrimaryDoc = () => {
  if (!activeDoc.value) return
  workspaceStore.setPrimaryDocument(activeDoc.value.id)
  message.success('已设为主稿')
}

const goPrimaryDoc = () => {
  if (!primaryDoc.value || primaryDoc.value.id === activeDoc.value?.id) return
  workspaceStore.activateDocument(primaryDoc.value.id)
}

const sendSlidesToPrimary = () => {
  if (!activeDoc.value || !primaryDoc.value) return
  if (activeDoc.value.id === primaryDoc.value.id) {
    message.warning('当前已经是主稿')
    return
  }

  const selectedIndexes = new Set([...mainStore.selectedSlidesIndex, slidesStore.slideIndex])
  const selectedSlides = slidesStore.slides.filter((item, index) => selectedIndexes.has(index))
  if (!selectedSlides.length) {
    message.warning('没有可发送的页面')
    return
  }

  const inserted = workspaceStore.appendSlidesToDocument(primaryDoc.value.id, selectedSlides)
  if (inserted > 0) message.success(`已发送 ${inserted} 页到主稿`)
}

const sendElementsToPrimary = () => {
  if (!activeDoc.value || !primaryDoc.value) return
  if (activeDoc.value.id === primaryDoc.value.id) {
    message.warning('当前已经是主稿')
    return
  }

  if (!mainStore.activeElementList.length) {
    message.warning('请先选择要发送的对象')
    return
  }

  const inserted = workspaceStore.appendElementsToDocument(primaryDoc.value.id, mainStore.activeElementList)
  if (inserted > 0) message.success(`已发送 ${inserted} 个对象到主稿当前页`)
}

const openLocalFiles = async (files: FileList) => {
  try {
    for (const file of Array.from(files)) {
      let data

      if (/\.pptist$/i.test(file.name)) data = await parseSpecificFileToDocument(file)
      else if (/\.json$/i.test(file.name)) data = await parseJSONFileToDocument(file)
      else if (/\.pptx$/i.test(file.name)) data = await parsePPTXFileToDocument(file, { fixedViewport: true })
      else if (/\.ppt$/i.test(file.name)) {
        message.warning('暂不支持直接解析旧版 .ppt，请先另存为 .pptx 再打开')
        continue
      }
      else {
        message.warning(`暂不支持打开 ${file.name}`)
        continue
      }

      workspaceStore.openDocument(data, {
        storage: /\.pptx$/i.test(file.name) ? 'memory' : 'local',
        filename: /\.pptx$/i.test(file.name) ? `${file.name.replace(/\.pptx$/i, '')}.pptist` : file.name,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    message.error((error as Error).message || '无法打开本地文件')
  }
}

const saveLocalFile = () => {
  const doc = activeDoc.value
  if (!doc) return
  workspaceStore.syncActiveFromStores(false)
  const blob = new Blob([serializePresentationAsPptist(workspaceStore.activeDoc!.data)], {
    type: 'text/plain;charset=utf-8',
  })
  saveAs(blob, currentFilename.value)
  workspaceStore.updateActiveMeta({
    storage: 'local',
    filename: currentFilename.value,
    dirty: false,
    lastSavedAt: new Date().toISOString(),
  })
  message.success('已保存到本地')
}

const refreshCloudFiles = async () => {
  loadingCloud.value = true
  try {
    cloudFiles.value = await listCloudFiles()
  } catch (error) {
    message.error((error as Error).message || '读取云端文件列表失败')
  } finally {
    loadingCloud.value = false
  }
}

const openCloudManager = async () => {
  cloudVisible.value = true
  await refreshCloudFiles()
}

const closeCloudManager = () => {
  cloudVisible.value = false
}

const loadCloudDocument = async (filename: string) => {
  try {
    const result = await loadCloudFile(filename)
    const data = parsePresentationFromPptist(result.content)
    workspaceStore.openDocument(data, {
      storage: 'cloud',
      filename,
      dirty: false,
      lastSavedAt: new Date().toISOString(),
    })
    cloudVisible.value = false
    message.success('已从云端打开')
  } catch (error) {
    message.error((error as Error).message || '打开云端文件失败')
  }
}

const saveCloudFileAction = async () => {
  const doc = activeDoc.value
  if (!doc) return
  workspaceStore.syncActiveFromStores(false)
  let filename = doc.storage === 'cloud' && doc.filename ? doc.filename : currentFilename.value
  if (!filename.endsWith('.pptist')) filename = `${filename}.pptist`

  if (doc.storage !== 'cloud') {
    const input = window.prompt('请输入云端文件名', filename)
    if (!input) return
    filename = input.endsWith('.pptist') ? input : `${input}.pptist`
  }

  try {
    const content = serializePresentationAsPptist(workspaceStore.activeDoc!.data)

    try {
      await saveCloudFile({
        filename,
        overwrite: doc.storage === 'cloud',
        content,
      })
    } catch (error) {
      if (!(error as Error).message.includes('File already exists')) throw error
      const confirmed = window.confirm(`云端已存在 ${filename}，是否覆盖？`)
      if (!confirmed) return
      await saveCloudFile({
        filename,
        overwrite: true,
        content,
      })
    }

    workspaceStore.updateActiveMeta({
      storage: 'cloud',
      filename,
      dirty: false,
      lastSavedAt: new Date().toISOString(),
    })
    if (cloudVisible.value) await refreshCloudFiles()
    message.success('已保存到云端')
  } catch (error) {
    message.error((error as Error).message || '保存云端文件失败')
  }
}

const removeCloudDocument = async (filename: string) => {
  if (!window.confirm(`确认删除 ${filename} 吗？`)) return
  try {
    await deleteCloudFile(filename)
    await refreshCloudFiles()
    message.success('已删除云端文件')
  } catch (error) {
    message.error((error as Error).message || '删除云端文件失败')
  }
}
</script>

<style lang="scss" scoped>
.workspace-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 10px;
  border-bottom: 1px solid $borderColor;
  background: #f7f8fa;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
}

.action,
.toolbar-btn,
.item-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: $borderRadius;
  border: 1px solid $borderColor;
  background: #fff;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: #f0f4ff;
  }

  &.primary {
    border-color: #2d6cdf;
    color: #2d6cdf;
  }

  &.danger {
    color: #b42318;
    border-color: #f1b4aa;
  }

  &.disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }
}

.cloud-modal {
  padding: 8px 0;
}

.cloud-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cloud-title {
  font-size: 14px;
  font-weight: 600;
}

.cloud-actions,
.item-actions {
  display: flex;
  gap: 8px;
}

.cloud-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}

.cloud-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid $borderColor;
  border-radius: $borderRadius;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-empty {
  padding: 24px 0;
  text-align: center;
  color: #777;
}
</style>