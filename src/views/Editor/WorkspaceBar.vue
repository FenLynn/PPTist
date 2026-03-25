<template>
  <div class="workspace-bar">
    <div class="actions">
      <div class="action primary" @click="createTab">新建</div>
      <FileInput class="action" accept=".ppt,.pptx,.pptist,.json" @change="openLocalFiles">打开本地</FileInput>
      <div class="action" @click="saveLocalFile">保存本地</div>
      <div class="action" @click="openTemplateManager">模板库</div>
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

    <Modal :visible="templateVisible" :width="980" @closed="closeTemplateManager">
      <div class="template-modal">
        <div class="template-toolbar">
          <div>
            <div class="cloud-title">模板库</div>
            <div class="cloud-subtitle">一个模板就是一套完整 PPT：封面、目录、内页和常用版式都放在同一个模板文件里。</div>
          </div>
          <div class="cloud-actions">
            <div class="toolbar-btn" @click="refreshTemplateCloudFiles">刷新云端</div>
            <FileInput class="toolbar-btn" accept=".pptist" @change="importLocalTemplateFiles">导入本地模板</FileInput>
            <div class="toolbar-btn primary" @click="saveCurrentAsTemplate">保存当前为模板</div>
          </div>
        </div>

        <div class="template-grid">
          <section class="template-column">
            <div class="template-column-head">
              <strong>本地模板</strong>
              <span>{{ designAssets.templates.length }} 个</span>
            </div>
            <div class="template-list" v-if="designAssets.templates.length">
              <button
                v-for="item in designAssets.templates"
                :key="item.id"
                class="template-card"
                :class="{ active: templateSelectedLocalId === item.id }"
                type="button"
                @click="selectLocalTemplate(item.id)"
              >
                <img class="template-card-cover" :src="item.cover" :alt="item.name">
                <div class="template-card-copy">
                  <div class="template-card-title">{{ item.name }}</div>
                  <div class="template-card-meta">{{ item.origin || '当前工作区' }}</div>
                  <div class="template-card-summary">{{ item.slides.length }} 页 · {{ formatTemplateTime(item.updatedAt) }}</div>
                  <div class="template-card-tags">
                    <span class="cloud-tag" v-if="designAssets.activeTemplateId === item.id">默认</span>
                    <span class="cloud-tag" v-if="templateSelectedLocalId === item.id">已选中</span>
                  </div>
                </div>
              </button>
            </div>
            <div class="cloud-empty" v-else>还没有本地模板</div>

            <div class="template-actions-row">
              <div class="toolbar-btn primary" :class="{ disabled: !selectedLocalTemplate }" @click="applyTemplateToCurrent">应用到当前</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="createDocumentFromTemplate">基于模板新建</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="setDefaultTemplate">设默认</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="renameLocalTemplate">重命名</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="refreshLocalTemplateCover">刷新封面</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="exportLocalTemplate">导出本地</div>
              <div class="toolbar-btn" :class="{ disabled: !selectedLocalTemplate }" @click="uploadLocalTemplateToCloud">上传云端</div>
              <div class="toolbar-btn danger" :class="{ disabled: !selectedLocalTemplate }" @click="deleteLocalTemplate">删除</div>
            </div>
          </section>

          <section class="template-column">
            <div class="template-column-head">
              <strong>云端模板</strong>
              <span v-if="templateCloudFiles.length">{{ templateCloudFiles.length }} 个</span>
            </div>
            <div class="template-list" v-if="templateCloudFiles.length">
              <button
                v-for="filename in templateCloudFiles"
                :key="filename"
                class="template-cloud-item"
                :class="{ active: templateSelectedCloudFile === filename }"
                type="button"
                @click="selectTemplateCloudFile(filename)"
                @dblclick="importTemplateFromCloud(filename)"
              >
                <div class="template-cloud-copy">
                  <span class="name">{{ filename }}</span>
                </div>
              </button>
            </div>
            <div class="cloud-empty" v-else-if="!loadingTemplateCloud">云端模板目录为空</div>
            <div class="cloud-empty" v-else>正在读取云端模板...</div>

            <div class="template-actions-row">
              <div class="toolbar-btn" :class="{ disabled: !templateSelectedCloudFile }" @click="importTemplateFromCloud()">导入到本地库</div>
              <div class="toolbar-btn" :class="{ disabled: !templateSelectedCloudFile }" @click="renameCloudTemplate">重命名</div>
              <div class="toolbar-btn danger" :class="{ disabled: !templateSelectedCloudFile }" @click="deleteCloudTemplate">删除</div>
            </div>
          </section>
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
import { deleteCloudFile, deleteCloudFileByKind, listCloudFiles, loadCloudFile, renameCloudFile, saveCloudFile } from '@/services/pptist'
import message from '@/utils/message'
import {
  createBlankPresentationData,
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
const { designAssets } = storeToRefs(slidesStore)
const { parseJSONFileToDocument, parseSpecificFileToDocument, parsePPTXFileToDocument } = useImport()

const cloudVisible = ref(false)
const loadingCloud = ref(false)
const cloudFiles = ref<string[]>([])
const cloudMode = ref<'load' | 'save'>('load')
const cloudFilename = ref('')
const cloudSelectedFile = ref('')
const titleInput = ref('')
const templateVisible = ref(false)
const loadingTemplateCloud = ref(false)
const templateCloudFiles = ref<string[]>([])
const templateSelectedLocalId = ref('')
const templateSelectedCloudFile = ref('')

const isPrimaryActive = computed(() => !!activeDoc.value && activeDoc.value.id === primaryDocId.value)
const canSendElements = computed(() => !!primaryDoc.value && !isPrimaryActive.value && mainStore.activeElementIdList.length > 0)
const canSendSlides = computed(() => !!primaryDoc.value && !isPrimaryActive.value)
const selectedLocalTemplate = computed(() => slidesStore.designAssets.templates.find(item => item.id === templateSelectedLocalId.value) || null)

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

watch(() => slidesStore.designAssets.templates, templates => {
  if (!templates.length) {
    templateSelectedLocalId.value = ''
    return
  }
  if (!templateSelectedLocalId.value || !templates.some(item => item.id === templateSelectedLocalId.value)) {
    templateSelectedLocalId.value = slidesStore.designAssets.activeTemplateId || templates[0].id
  }
}, { immediate: true, deep: true })

const resolveCloudFilename = () => {
  const filename = String(cloudFilename.value || cloudSelectedFile.value || '').trim()
  return filename ? normalizeCloudFilename(filename) : ''
}

const createTab = () => {
  workspaceStore.addEmptyDocument()
}

const getAssetTimestamp = () => new Date().toISOString()

const formatTemplateTime = (value = '') => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚保存'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const buildTemplateDocument = (template: { name: string; slides: typeof slidesStore.slides; theme: typeof slidesStore.theme }) => {
  const data = createBlankPresentationData(template.name)
  return {
    ...data,
    title: template.name,
    theme: JSON.parse(JSON.stringify(template.theme)),
    slides: JSON.parse(JSON.stringify(template.slides)),
    slideIndex: 0,
  }
}

const updateLocalTemplates = (templates: typeof slidesStore.designAssets.templates, activeTemplateId = slidesStore.designAssets.activeTemplateId) => {
  slidesStore.setDesignAssets({ templates, activeTemplateId })
  workspaceStore.syncActiveFromStores(true)
}

const openTemplateManager = async () => {
  templateVisible.value = true
  templateSelectedLocalId.value = slidesStore.designAssets.activeTemplateId || slidesStore.designAssets.templates[0]?.id || ''
  await refreshTemplateCloudFiles()
}

const closeTemplateManager = () => {
  templateVisible.value = false
}

const selectLocalTemplate = (templateId: string) => {
  templateSelectedLocalId.value = templateId
}

const selectTemplateCloudFile = (filename: string) => {
  templateSelectedCloudFile.value = filename
}

const refreshTemplateCloudFiles = async () => {
  loadingTemplateCloud.value = true
  try {
    templateCloudFiles.value = (await listCloudFiles('template')).slice().sort((left, right) => left.localeCompare(right, 'zh-CN'))
    if (templateSelectedCloudFile.value && !templateCloudFiles.value.includes(templateSelectedCloudFile.value)) {
      templateSelectedCloudFile.value = ''
    }
  } catch (error) {
    message.error((error as Error).message || '读取云端模板失败')
  } finally {
    loadingTemplateCloud.value = false
  }
}

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

const setDefaultTemplate = () => {
  if (!selectedLocalTemplate.value) return
  slidesStore.setActiveDesignTemplate(selectedLocalTemplate.value.id)
  workspaceStore.syncActiveFromStores(true)
  message.success('已设为默认模板')
}

const applyTemplateToCurrent = () => {
  const template = selectedLocalTemplate.value
  const current = activeDoc.value
  if (!template || !current) return
  const confirmed = window.confirm(`应用模板会覆盖当前稿件内容，是否继续使用 ${template.name}？`)
  if (!confirmed) return
  workspaceStore.replaceActiveDocument(buildTemplateDocument(template), {
    storage: 'memory',
    dirty: true,
    filename: `${template.name}.pptist`,
    lastSavedAt: current.lastSavedAt,
  })
  slidesStore.setActiveDesignTemplate(template.id)
  workspaceStore.syncActiveFromStores(false)
  message.success('模板已应用到当前稿件')
}

const createDocumentFromTemplate = () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  workspaceStore.openDocument(buildTemplateDocument(template), {
    storage: 'memory',
    dirty: false,
    filename: `${template.name}.pptist`,
    lastSavedAt: '',
  })
  slidesStore.setActiveDesignTemplate(template.id)
  message.success('已基于模板新建稿件')
}

const renameLocalTemplate = () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  const nextName = window.prompt('输入新的模板名称', template.name)
  if (!nextName) return
  const name = nextName.trim()
  if (!name) return
  const templates = slidesStore.designAssets.templates.map(item => item.id === template.id ? {
    ...item,
    name,
    updatedAt: getAssetTimestamp(),
  } : item)
  updateLocalTemplates(templates)
  message.success('模板已重命名')
}

const refreshLocalTemplateCover = () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  const templates = slidesStore.designAssets.templates.map(item => item.id === template.id ? {
    ...item,
    cover: createDesignAssetCover(item.theme, item.name, 'template'),
    updatedAt: getAssetTimestamp(),
  } : item)
  updateLocalTemplates(templates)
  message.success('模板封面已刷新')
}

const deleteLocalTemplate = () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  if (!window.confirm(`确认删除模板 ${template.name} 吗？`)) return
  const templates = slidesStore.designAssets.templates.filter(item => item.id !== template.id)
  const nextDefault = slidesStore.designAssets.activeTemplateId === template.id ? (templates[0]?.id || '') : slidesStore.designAssets.activeTemplateId
  updateLocalTemplates(templates, nextDefault)
  templateSelectedLocalId.value = nextDefault
  message.success('模板已删除')
}

const exportLocalTemplate = () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  const blob = new Blob([serializePresentationAsPptist(buildTemplateDocument(template))], {
    type: 'text/plain;charset=utf-8',
  })
  saveAs(blob, `${template.name}.pptist`)
}

const uploadLocalTemplateToCloud = async () => {
  const template = selectedLocalTemplate.value
  if (!template) return
  const filename = `${template.name}.pptist`
  try {
    try {
      await saveCloudFile({
        filename,
        overwrite: false,
        content: serializePresentationAsPptist(buildTemplateDocument(template)),
        kind: 'template',
      })
    } catch (error) {
      if (!(error as Error).message.includes('File already exists')) throw error
      const confirmed = window.confirm(`云端模板目录已存在 ${filename}，是否覆盖？`)
      if (!confirmed) return
      await saveCloudFile({
        filename,
        overwrite: true,
        content: serializePresentationAsPptist(buildTemplateDocument(template)),
        kind: 'template',
      })
    }
    await refreshTemplateCloudFiles()
    message.success('模板已上传到云端')
  } catch (error) {
    message.error((error as Error).message || '上传云端模板失败')
  }
}

const importTemplateFromCloud = async (filename?: string) => {
  const target = String(filename || templateSelectedCloudFile.value || '').trim()
  if (!target) return
  try {
    const result = await loadCloudFile(target, 'template')
    const data = parsePresentationFromPptist(result.content)
    const createdAt = getAssetTimestamp()
    slidesStore.upsertDesignTemplate({
      id: `template_${crypto.randomUUID()}`,
      name: data.title || target.replace(/\.pptist$/i, ''),
      cover: createDesignAssetCover(data.theme, data.title || '模板', 'template'),
      origin: '云端模板目录',
      createdAt,
      updatedAt: createdAt,
      theme: JSON.parse(JSON.stringify(data.theme)),
      slides: JSON.parse(JSON.stringify(data.slides)),
    })
    workspaceStore.syncActiveFromStores(true)
    templateSelectedLocalId.value = slidesStore.designAssets.activeTemplateId
    message.success('已导入到本地模板库')
  } catch (error) {
    message.error((error as Error).message || '导入云端模板失败')
  }
}

const renameCloudTemplate = async () => {
  const target = templateSelectedCloudFile.value
  if (!target) return
  const nextName = window.prompt('输入新的云端模板名称', target.replace(/\.pptist$/i, ''))
  if (!nextName) return
  try {
    const nextFilename = `${nextName.trim()}.pptist`
    await renameCloudFile(target, nextFilename, 'template')
    templateSelectedCloudFile.value = nextFilename
    await refreshTemplateCloudFiles()
    message.success('云端模板已重命名')
  } catch (error) {
    message.error((error as Error).message || '重命名云端模板失败')
  }
}

const deleteCloudTemplate = async () => {
  const target = templateSelectedCloudFile.value
  if (!target) return
  if (!window.confirm(`确认删除云端模板 ${target} 吗？`)) return
  try {
    await deleteCloudFileByKind(target, 'template')
    templateSelectedCloudFile.value = ''
    await refreshTemplateCloudFiles()
    message.success('云端模板已删除')
  } catch (error) {
    message.error((error as Error).message || '删除云端模板失败')
  }
}

const importLocalTemplateFiles = async (files: FileList) => {
  const file = files?.[0]
  if (!file) return
  try {
    const data = parsePresentationFromPptist(await file.text())
    const createdAt = getAssetTimestamp()
    slidesStore.upsertDesignTemplate({
      id: `template_${crypto.randomUUID()}`,
      name: data.title || file.name.replace(/\.pptist$/i, ''),
      cover: createDesignAssetCover(data.theme, data.title || '模板', 'template'),
      origin: '本地导入',
      createdAt,
      updatedAt: createdAt,
      theme: JSON.parse(JSON.stringify(data.theme)),
      slides: JSON.parse(JSON.stringify(data.slides)),
    })
    workspaceStore.syncActiveFromStores(true)
    message.success('本地模板已导入')
  } catch (error) {
    message.error((error as Error).message || '导入本地模板失败')
  }
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

.template-modal {
  padding: 8px 0;
}

.template-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.template-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 280px);
  gap: 14px;
}

.template-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-column-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #667085;
}

.template-list {
  min-height: 320px;
  max-height: 420px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
  border: 1px solid $borderColor;
  border-radius: 8px;
  background: #fafafa;
}

.template-card,
.template-cloud-item {
  width: 100%;
  border: 1px solid $borderColor;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.template-card {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 12px;
  padding: 10px;
  text-align: left;

  &.active {
    border-color: #2d6cdf;
    background: #eef4ff;
  }
}

.template-card-cover {
  width: 160px;
  height: 96px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(45, 108, 223, 0.08);
}

.template-card-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.template-card-meta {
  font-size: 12px;
  color: #667085;
}

.template-card-summary {
  font-size: 12px;
  color: #98a2b3;
}

.template-card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.template-cloud-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-cloud-item {
  padding: 10px 12px;
  text-align: left;

  &.active {
    border-color: #2d6cdf;
    background: #eef4ff;
  }
}

.template-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-actions-row .toolbar-btn.primary {
  background: #eef4ff;
}
</style>