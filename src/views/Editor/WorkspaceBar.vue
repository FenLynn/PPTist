<template>
  <div class="workspace-bar">
    <div class="actions">
      <div class="action primary" @click="createTab">新建</div>
      <FileInput class="action" accept=".ppt,.pptx,.pptist,.json" @change="openLocalFiles">打开本地</FileInput>
      <div class="action" @click="saveLocalFile">保存本地</div>
      <div class="action" @click="saveCurrentAsTemplate">存模板</div>
      <div class="action" @click="saveCurrentAsMaster">存母版</div>
      <div class="action" @click="saveCacheSnapshot">保存缓存</div>
      <div class="action" @click="openCloudManager('load')">云端</div>
      <div class="action" @click="openCloudManager('save')">保存云端</div>
      <div class="action" :class="{ disabled: isPrimaryActive }" @click="setPrimaryDoc">设为主稿</div>
      <div class="action" :class="{ disabled: !canSendElements }" @click="sendElementsToPrimary">送对象</div>
      <div class="action" :class="{ disabled: !canSendSlides }" @click="sendSlidesToPrimary">送页面</div>
      <div class="action" :class="{ disabled: !primaryDoc || isPrimaryActive }" @click="goPrimaryDoc">去主稿</div>
      <div class="doc-title-box">
        <span class="doc-title-label">当前稿件</span>
        <input
          v-model="titleInput"
          class="doc-title-input"
          type="text"
          maxlength="120"
          @blur="commitTitleUpdate"
          @keydown.enter.prevent="commitTitleUpdate"
        />
      </div>
    </div>

    <Modal :visible="cloudVisible" :width="680" @closed="closeCloudManager">
      <div class="cloud-modal">
        <div class="cloud-toolbar">
          <div class="cloud-title-wrap">
            <div class="cloud-title">云端演示文稿</div>
            <div class="cloud-subtitle">{{ cloudMode === 'save' ? '上方输入文件名，下方查看列表并按需覆盖。' : '上方可输入目标文件名，下方单击选中，双击直接打开。' }}</div>
          </div>
          <div class="cloud-actions">
            <div class="toolbar-btn" @click="refreshCloudFiles">刷新</div>
            <div class="toolbar-btn primary" @click="saveCloudFileAction">保存当前</div>
          </div>
        </div>

        <div class="cloud-form">
          <div class="cloud-label">文件名</div>
          <input
            v-model="cloudFilename"
            class="cloud-input"
            type="text"
            maxlength="180"
            placeholder="例如：项目汇报.pptist"
            @keydown.enter.prevent="cloudMode === 'save' ? saveCloudFileAction() : loadCloudDocument()"
          />
        </div>

        <div class="cloud-meta">
          <span>单击选中文件，双击直接打开。</span>
          <span v-if="cloudFiles.length">共 {{ cloudFiles.length }} 个云端文件</span>
        </div>

        <div class="cloud-list" v-if="cloudFiles.length">
          <button
            v-for="filename in cloudFiles"
            :key="filename"
            class="cloud-item"
            :class="{ active: cloudSelectedFile === filename }"
            type="button"
            @click="selectCloudFile(filename)"
            @dblclick="loadCloudDocument(filename)"
          >
            <span class="name">{{ filename }}</span>
            <span class="cloud-tag" v-if="filename === cloudCurrentFile">当前</span>
          </button>
        </div>
        <div class="cloud-empty" v-else-if="!loadingCloud">云端还没有文件</div>
        <div class="cloud-empty" v-else>正在加载...</div>

        <div class="cloud-footer">
          <div class="toolbar-btn" @click="closeCloudManager">关闭</div>
          <div class="toolbar-btn danger" :class="{ disabled: !cloudSelectedFile }" @click="removeCloudDocument(cloudSelectedFile)">删除选中</div>
          <div class="toolbar-btn" :class="{ disabled: !resolveCloudFilename() }" @click="loadCloudDocument()">打开选中</div>
          <div class="toolbar-btn primary" :class="{ disabled: !resolveCloudFilename() }" @click="saveCloudFileAction">保存到云端</div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { saveAs } from 'file-saver'
import { useMainStore, useSlidesStore, useWorkspaceStore } from '@/store'
import { LOCALSTORAGE_KEY_LIGHT_CACHE } from '@/configs/storage'
import { deleteCloudFile, listCloudFiles, loadCloudFile, saveCloudFile } from '@/services/pptist'
import message from '@/utils/message'
import {
  createDesignAssetCover,
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
const cloudMode = ref<'load' | 'save'>('load')
const cloudFilename = ref('')
const cloudSelectedFile = ref('')
const titleInput = ref('')

const isPrimaryActive = computed(() => !!activeDoc.value && activeDoc.value.id === primaryDocId.value)
const canSendElements = computed(() => !!primaryDoc.value && !isPrimaryActive.value && mainStore.activeElementIdList.length > 0)
const canSendSlides = computed(() => !!primaryDoc.value && !isPrimaryActive.value)

const normalizeCloudFilename = (filename: string) => {
  const safeName = String(filename || '').trim() || `${activeDoc.value?.title || '未命名演示文稿'}.pptist`
  return safeName.endsWith('.pptist') ? safeName : `${safeName}.pptist`
}

const currentFilename = computed(() => {
  const doc = activeDoc.value
  return normalizeCloudFilename(doc?.filename || `${doc?.title || '未命名演示文稿'}.pptist`)
})

const cloudCurrentFile = computed(() => {
  const doc = activeDoc.value
  if (!doc?.filename) return ''
  return normalizeCloudFilename(doc.filename)
})

watch(activeDoc, doc => {
  titleInput.value = doc?.title || '未命名演示文稿'
  cloudFilename.value = cloudCurrentFile.value || currentFilename.value
  if (cloudCurrentFile.value && cloudFiles.value.includes(cloudCurrentFile.value)) {
    cloudSelectedFile.value = cloudCurrentFile.value
  }
}, { immediate: true })

const resolveCloudFilename = () => {
  const filename = String(cloudFilename.value || cloudSelectedFile.value || '').trim()
  return filename ? normalizeCloudFilename(filename) : ''
}

const createTab = () => {
  workspaceStore.addEmptyDocument()
}

const getAssetTimestamp = () => new Date().toISOString()

const saveCurrentAsTemplate = () => {
  if (!activeDoc.value) return

  const createdAt = getAssetTimestamp()
  slidesStore.upsertDesignTemplate({
    id: `template_${crypto.randomUUID()}`,
    name: `${activeDoc.value.title || '未命名演示文稿'} 模板`,
    cover: createDesignAssetCover(slidesStore.theme, activeDoc.value.title || '模板', 'template'),
    origin: '当前工作区',
    createdAt,
    updatedAt: createdAt,
    theme: JSON.parse(JSON.stringify(slidesStore.theme)),
    slides: JSON.parse(JSON.stringify(slidesStore.slides)),
  })
  workspaceStore.syncActiveFromStores(true)
  message.success('当前稿件已保存到模板库')
}

const saveCurrentAsMaster = () => {
  if (!activeDoc.value) return

  const createdAt = getAssetTimestamp()
  slidesStore.upsertDesignMaster({
    id: `master_${crypto.randomUUID()}`,
    name: `${activeDoc.value.title || '未命名演示文稿'} 母版`,
    cover: createDesignAssetCover(slidesStore.theme, activeDoc.value.title || '母版', 'master'),
    origin: '当前工作区',
    createdAt,
    updatedAt: createdAt,
    theme: JSON.parse(JSON.stringify(slidesStore.theme)),
    background: slidesStore.currentSlide?.background ? JSON.parse(JSON.stringify(slidesStore.currentSlide.background)) : undefined,
  })
  workspaceStore.syncActiveFromStores(true)
  message.success('当前主题已保存到母版库')
}

const commitTitleUpdate = () => {
  const nextTitle = String(titleInput.value || '').trim() || '未命名演示文稿'
  titleInput.value = nextTitle
  slidesStore.setTitle(nextTitle)
  workspaceStore.syncActiveFromStores(true)
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

const saveCacheSnapshot = () => {
  const doc = activeDoc.value
  if (!doc) return
  workspaceStore.syncActiveFromStores(false)
  try {
    localStorage.setItem(LOCALSTORAGE_KEY_LIGHT_CACHE, JSON.stringify({
      filename: currentFilename.value,
      title: doc.title,
      savedAt: new Date().toISOString(),
      content: serializePresentationAsPptist(workspaceStore.activeDoc!.data),
    }))
    message.success('已写入本地缓存')
  } catch (error) {
    message.error((error as Error).message || '写入本地缓存失败')
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
    cloudFiles.value = (await listCloudFiles()).slice().sort((left, right) => left.localeCompare(right, 'zh-CN'))
    if (cloudSelectedFile.value && !cloudFiles.value.includes(cloudSelectedFile.value)) {
      cloudSelectedFile.value = ''
    }
    if (!cloudSelectedFile.value && cloudCurrentFile.value && cloudFiles.value.includes(cloudCurrentFile.value)) {
      cloudSelectedFile.value = cloudCurrentFile.value
    }
  } catch (error) {
    message.error((error as Error).message || '读取云端文件列表失败')
  } finally {
    loadingCloud.value = false
  }
}

const openCloudManager = async (mode: 'load' | 'save' = 'load') => {
  cloudMode.value = mode
  cloudFilename.value = cloudCurrentFile.value || currentFilename.value
  cloudVisible.value = true
  await refreshCloudFiles()
}

const closeCloudManager = () => {
  cloudVisible.value = false
}

const selectCloudFile = (filename: string) => {
  cloudSelectedFile.value = filename
  cloudFilename.value = filename
}

const loadCloudDocument = async (filename?: string) => {
  try {
    const target = String(filename || resolveCloudFilename() || '').trim()
    if (!target) return
    const result = await loadCloudFile(target)
    const data = parsePresentationFromPptist(result.content)
    workspaceStore.openDocument(data, {
      storage: 'cloud',
      filename: target,
      dirty: false,
      lastSavedAt: new Date().toISOString(),
    })
    cloudSelectedFile.value = target
    cloudFilename.value = target
    cloudVisible.value = false
    message.success('已从云端打开')
  } catch (error) {
    message.error((error as Error).message || '打开云端文件失败')
  }
}

const saveCloudFileAction = async () => {
  const doc = activeDoc.value
  if (!doc) return
  if (!cloudVisible.value) {
    await openCloudManager('save')
    return
  }

  workspaceStore.syncActiveFromStores(false)
  const filename = resolveCloudFilename()
  if (!filename) return

  try {
    const content = serializePresentationAsPptist(workspaceStore.activeDoc!.data)

    try {
      await saveCloudFile({
        filename,
        overwrite: doc.storage === 'cloud' && filename === cloudCurrentFile.value,
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
    cloudSelectedFile.value = filename
    cloudFilename.value = filename
    await refreshCloudFiles()
    message.success('已保存到云端')
  } catch (error) {
    message.error((error as Error).message || '保存云端文件失败')
  }
}

const removeCloudDocument = async (filename?: string) => {
  const target = String(filename || cloudSelectedFile.value || '').trim()
  if (!target) return
  if (!window.confirm(`确认删除 ${target} 吗？`)) return
  try {
    await deleteCloudFile(target)
    if (cloudSelectedFile.value === target) cloudSelectedFile.value = ''
    if (cloudFilename.value === target) cloudFilename.value = cloudCurrentFile.value || currentFilename.value
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
  width: 100%;
}

.action,
.toolbar-btn {
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

.doc-title-box {
  margin-left: 6px;
  width: 260px;
  min-width: 0;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid #2d6cdf;
  border-radius: 6px;
  background: linear-gradient(180deg, #f5f9ff 0%, #eaf2ff 100%);
  box-shadow: inset 0 0 0 1px rgba(45, 108, 223, 0.18);
}

.doc-title-label {
  flex-shrink: 0;
  font-size: 12px;
  color: #1d4fa8;
  font-weight: 600;
}

.doc-title-input {
  min-width: 0;
  flex: 1;
  height: 20px;
  border: 0;
  outline: none;
  background: transparent;
  color: #1d4fa8;
  font-size: 12px;
}

.cloud-modal {
  padding: 8px 0;
}

.cloud-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cloud-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cloud-title {
  font-size: 14px;
  font-weight: 600;
}

.cloud-subtitle {
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}

.cloud-actions,
.cloud-footer {
  display: flex;
  gap: 8px;
}

.cloud-form {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.cloud-label {
  color: #667085;
  font-size: 12px;
}

.cloud-input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid $borderColor;
  border-radius: 6px;
  outline: none;

  &:focus {
    border-color: #2d6cdf;
    box-shadow: 0 0 0 2px rgba(45, 108, 223, 0.12);
  }
}

.cloud-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #667085;
  font-size: 12px;
}

.cloud-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 280px;
  max-height: 360px;
  overflow: auto;
  padding: 4px;
  border: 1px solid $borderColor;
  border-radius: 8px;
  background: #fafafa;
}

.cloud-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid $borderColor;
  border-radius: $borderRadius;
  background: #fff;
  cursor: pointer;
  text-align: left;

  &.active {
    border-color: #2d6cdf;
    background: #eef4ff;
  }
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(45, 108, 223, 0.12);
  color: #2d6cdf;
  font-size: 12px;
}

.cloud-empty {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
}

.cloud-footer {
  justify-content: flex-end;
  margin-top: 12px;
}
</style>