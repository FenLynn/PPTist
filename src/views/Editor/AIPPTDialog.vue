<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AIPPT</span>
      <span class="subtite" v-if="step === 'template'">从下方挑选合适的模板生成PPT，或<span class="local" v-tooltip="'上传.pptist格式模板文件'" @click="uploadLocalTemplate()">使用本地模板生成</span></span>
      <span class="subtite" v-else-if="step === 'outline'">确认下方内容大纲（点击编辑内容，右键添加/删除大纲项），开始选择模板</span>
      <span class="subtite" v-else>在下方输入您的PPT主题，并适当补充信息，如行业、岗位、学科、用途等</span>
    </div>
    
    <template v-if="step === 'setup'">
      <Input class="input" 
        ref="inputRef"
        v-model:value="keyword" 
        :maxlength="50" 
        placeholder="请输入PPT主题，如：大学生职业生涯规划" 
        @enter="createOutline()"
      >
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <div class="submit" type="primary" @click="createOutline()"><i-icon-park-outline:send class="icon" /> AI 生成</div>
        </template>
      </Input>
      <div class="recommends">
        <div class="recommend" v-for="(item, index) in recommends" :key="index" @click="setKeyword(item)">{{ item }}</div>
      </div>
      <div class="setup-actions">
        <FileInput class="setup-action" accept=".md,.markdown,.txt,.json,.smm,.mm" @change="files => importOutlineFile(files)">
          <span>导入 Markdown / 导图</span>
        </FileInput>
        <div class="setup-action" @click="openOutlineDraft">直接编辑大纲</div>
      </div>
      <div class="configs">
        <div class="config-item">
          <div class="label">语言：</div>
          <Select 
            class="config-content"
            style="width: 80px;"
            v-model:value="language"
            :options="[
              { label: '中文', value: '中文' },
              { label: '英文', value: 'English' },
              { label: '日文', value: '日本語' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">风格：</div>
          <Select 
            class="config-content"
            style="width: 80px;"
            v-model:value="style"
            :options="[
              { label: '通用', value: '通用' },
              { label: '学术风', value: '学术风' },
              { label: '职场风', value: '职场风' },
              { label: '教育风', value: '教育风' },
              { label: '营销风', value: '营销风' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">模型：</div>
          <Select 
            class="config-content"
            style="width: 190px;"
            v-model:value="aiModel"
            :options="aiModels"
          />
        </div>
        <div class="config-item">
          <div class="label">配图：</div>
          <Select 
            class="config-content"
            style="width: 100px;"
            v-model:value="img"
            :options="[
              { label: '无', value: '' },
              { label: '模拟测试', value: 'test' },
              { label: 'AI搜图', value: 'ai-search', disabled: true },
              { label: 'AI生图', value: 'ai-create', disabled: true },
            ]"
          />
        </div>
      </div>
      <div class="configs" v-if="!isEmptySlide">
        <div class="config-item">
          <Checkbox v-model:value="overwrite">覆盖已有幻灯片</Checkbox>
        </div>
      </div>
    </template>
    <div class="preview" v-if="step === 'outline'">
      <pre ref="outlineRef" v-if="outlineCreating">{{ outline }}</pre>
       <div class="outline-view" v-else>
         <OutlineEditor v-model:value="outline" />
       </div>
      <div class="btns" v-if="!outlineCreating">
        <Button class="btn" type="primary" @click="step = 'template'">选择模板</Button>
        <Button class="btn" @click="outline = ''; step = 'setup'">返回重新生成</Button>
      </div>
    </div>
    <div class="select-template" v-if="step === 'template'">
      <div class="templates">
        <div class="template" 
          :class="{ 'selected': selectedTemplate === template.id }" 
          v-for="template in availableTemplates" 
          :key="template.id" 
          @click="selectedTemplate = template.id"
        >
          <img :src="template.cover" :alt="template.name">
          <div class="template-meta">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-origin">{{ template.origin || '预置模板' }}</div>
          </div>
        </div>
      </div>
      <div class="btns">
        <Button class="btn" type="primary" @click="createPPT()">生成</Button>
        <Button class="btn" @click="step = 'outline'">返回大纲</Button>
      </div>
    </div>

    <FullscreenSpin :loading="loading" tip="AI生成中，请耐心等待 ..." />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { jsonrepair } from 'jsonrepair'
import api from '@/services'
import useAIPPT from '@/hooks/useAIPPT'
import useSlideHandler from '@/hooks/useSlideHandler'
import type { AIPPTSlide } from '@/types/AIPPT'
import type { Slide, SlideTheme } from '@/types/slides'
import message from '@/utils/message'
import { decrypt } from '@/utils/crypto'
import { useMainStore, useSlidesStore } from '@/store'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import Checkbox from '@/components/Checkbox.vue'
import FileInput from '@/components/FileInput.vue'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { templates, designAssets } = storeToRefs(slidesStore)
const { aiModel, aiModels } = storeToRefs(mainStore)

const { resetSlides, isEmptySlide } = useSlideHandler()
const { AIPPT, presetImgPool, getMdContent } = useAIPPT()

const language = ref('中文')
const style = ref('通用')
const img = ref('')
const keyword = ref('')
const outline = ref('')
const selectedTemplate = ref('template_1')
const loading = ref(false)
const outlineCreating = ref(false)
const overwrite = ref(true)
const step = ref<'setup' | 'outline' | 'template'>('setup')
const outlineRef = useTemplateRef<HTMLElement>('outlineRef')
const inputRef = useTemplateRef<InstanceType<typeof Input>>('inputRef')

const recommends = ref([
  '2025科技前沿动态',
  '大数据如何改变世界',
  '餐饮市场调查与研究',
  'AIGC在教育领域的应用',
  '社交媒体与品牌营销',
  '5G技术如何改变我们的生活',
  '年度工作总结与展望',
  '区块链技术及其应用',
  '大学生职业生涯规划',
  '公司年会策划方案',
]) 

const availableTemplates = computed(() => {
  const customTemplates = designAssets.value.templates.map(item => ({
    id: item.id,
    cover: item.cover,
    name: item.name,
    origin: item.origin || '当前工作区',
  }))
  return [...customTemplates, ...templates.value]
})

onMounted(() => {
  setTimeout(() => {
    inputRef.value!.focus()
  }, 500)
})

const setKeyword = (value: string) => {
  keyword.value = value
  inputRef.value!.focus()
}

const createOutline = async () => {
  if (!keyword.value) return message.error('请先输入PPT主题')

  loading.value = true
  outlineCreating.value = true
  
  const stream = await api.AIPPT_Outline({
    content: keyword.value,
    language: language.value,
    model: aiModel.value,
  })
  if ('error' in stream) {
    loading.value = false
    outlineCreating.value = false
    return message.error(String(stream.error || '大纲生成失败'))
  }
  if (typeof stream === 'object' && stream.state === -1) {
    loading.value = false
    return message.error('该模型API的并发数过高，请更换其他模型重试')
  }

  loading.value = false
  step.value = 'outline'

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        outline.value = getMdContent(outline.value)
        outline.value = outline.value.replace(/<!--[\s\S]*?-->/g, '')
        outlineCreating.value = false
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      outline.value += chunk

      if (outlineRef.value) {
        outlineRef.value.scrollTop = outlineRef.value.scrollHeight + 20
      }

      readStream()
    })
  }
  readStream()
}

const normalizeOutlineMarkdown = (markdown: string) => {
  const cleaned = getMdContent(markdown).replace(/<!--[\s\S]*?-->/g, '')
  return cleaned.trim()
}

const extractMindmapMarkdown = (payload: unknown, level = 1): string[] => {
  if (!payload) return []

  if (Array.isArray(payload)) {
    return payload.flatMap(item => extractMindmapMarkdown(item, level))
  }

  if (typeof payload !== 'object') {
    const text = String(payload).trim()
    return text ? [`${'#'.repeat(Math.min(level, 3))} ${text}`] : []
  }

  const node = payload as Record<string, any>
  const title = String(node.text || node.title || node.topic || node.label || node.name || node.content || '').trim()
  const childSource = node.root ? [node.root] : (node.children || node.topics || node.nodes || node.items || [])
  const children = Array.isArray(childSource) ? childSource : []

  const lines: string[] = []
  if (title) {
    if (level <= 3) lines.push(`${'#'.repeat(level)} ${title}`)
    else lines.push(`${'  '.repeat(level - 4)}- ${title}`)
  }
  for (const child of children) {
    lines.push(...extractMindmapMarkdown(child, title ? level + 1 : level))
  }
  return lines
}

const parseImportedOutline = (text: string, filename = '') => {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const isJsonLike = /\.(json|smm|mm)$/i.test(filename) || /^[\[{]/.test(trimmed)
  if (isJsonLike) {
    const payload = JSON.parse(trimmed)
    return extractMindmapMarkdown(payload).join('\n').trim()
  }
  return normalizeOutlineMarkdown(trimmed)
}

const importOutlineFile = async (files: FileList) => {
  const file = files[0]
  if (!file) return

  try {
    const text = await file.text()
    const nextOutline = parseImportedOutline(text, file.name)
    if (!nextOutline) return message.error('导入内容为空，无法生成大纲')

    outline.value = nextOutline
    keyword.value = file.name.replace(/\.[^.]+$/, '')
    outlineCreating.value = false
    step.value = 'outline'
    message.success('已导入大纲，可继续编辑并生成 PPT')
  }
  catch {
    message.error('导入失败，请确认文件为 Markdown 或导图 JSON')
  }
}

const openOutlineDraft = () => {
  if (!outline.value.trim()) {
    const title = keyword.value.trim() || '新建主题'
    outline.value = `# ${title}\n## 第一部分\n- 核心要点\n## 第二部分\n- 核心要点`
  }
  step.value = 'outline'
}

const createPPT = async (template?: { slides: Slide[], theme: SlideTheme }) => {
  loading.value = true
  mainStore.setAIPPTDialogState('running')
  message.loading('演示文稿生成中，请稍等 ...', { duration: 0 })

  if (overwrite.value) resetSlides()

  const stream = await api.AIPPT({
    content: outline.value,
    language: language.value,
    style: style.value,
    model: aiModel.value,
  })
  if ('error' in stream) {
    loading.value = false
    message.closeAll()
    mainStore.setAIPPTDialogState(true)
    return message.error(String(stream.error || '演示文稿生成失败'))
  }
  if (typeof stream === 'object' && stream.state === -1) {
    loading.value = false
    message.closeAll()
    mainStore.setAIPPTDialogState(true)
    return message.error('该模型API的并发数过高，请更换其他模型重试')
  }

  if (img.value === 'test') {
    const imgs = await api.getMockData('imgs')
    presetImgPool(imgs)
  }

  let templateData = template
  if (!templateData) {
    const customTemplate = designAssets.value.templates.find(item => item.id === selectedTemplate.value)
    if (customTemplate) {
      templateData = {
        slides: JSON.parse(JSON.stringify(customTemplate.slides)),
        theme: JSON.parse(JSON.stringify(customTemplate.theme)),
      }
      slidesStore.setActiveDesignTemplate(customTemplate.id)
    }
    else templateData = await api.getMockData(selectedTemplate.value)
  }
  const templateSlides: Slide[] = templateData!.slides
  const templateTheme: SlideTheme = templateData!.theme

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        loading.value = false
        message.closeAll()
        mainStore.setAIPPTDialogState(false)
        slidesStore.setTheme(templateTheme)
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split(/\n+/)

      for (const line of lines) {
        if (line) processChunk(line)
      }

      readStream()
    })
  }

  const processChunk = (chunk: string) => {
    try {
      const text = chunk.replace('```jsonl', '').replace('```json', '').replace('```', '').trim()
      if (text) {
        const slide: AIPPTSlide = JSON.parse(jsonrepair(text))
        AIPPT(templateSlides, [slide])
      }
    }
    catch (err) {
      // eslint-disable-next-line
      console.error(err)
    }
  }
  readStream()
}

const uploadLocalTemplate = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pptist'
  input.click()
  input.addEventListener('change', e => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        try {
          const { slides, theme } = JSON.parse(decrypt(reader.result as string))
          createPPT({ slides, theme })
        }
        catch {
          message.error('上传的模板文件数据异常，请重新上传或使用预置模板')
        }
      })
      reader.readAsText(file)
    }
  })
}
</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 12px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtite {
    color: #888;
    font-size: 12px;

    .local {
      color: $themeColor;
      text-decoration: underline;
      cursor: pointer;
    }
  }
}
.preview {
  pre {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .outline-view {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}

.setup-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.setup-action {
  height: 34px;
  padding: 0 12px;
  border: 1px dashed #d0d7e2;
  border-radius: $borderRadius;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4d5b6c;
  cursor: pointer;
  background: #fafcff;

  &:hover {
    border-color: #9cb7d7;
    background: #f3f8ff;
  }
}

.select-template {
  .templates {
    max-height: 450px;
    overflow: auto;
    display: flex;
    margin-bottom: 10px;
    padding-right: 5px;
    @include flex-grid-layout();
  
    .template {
      border: 2px solid $borderColor;
      border-radius: $borderRadius;
      @include flex-grid-layout-children(2, 49%);

      &.selected {
        border-color: $themeColor;
      }
  
      img {
        width: 100%;
        min-height: 175px;
      }

      .template-meta {
        padding: 8px 10px 10px;
      }

      .template-name {
        font-size: 12px;
        font-weight: 600;
        color: #2f3742;
      }

      .template-origin {
        margin-top: 4px;
        font-size: 12px;
        color: #8691a0;
      }
    }
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.recommends {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;

  .recommend {
    font-size: 12px;
    background-color: #f1f1f1;
    border-radius: $borderRadius;
    padding: 3px 5px;
    margin-right: 5px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      color: $themeColor;
    }
  }
}
.configs {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;

  .config-item {
    font-size: 13px;
    display: flex;
    align-items: center;
  }
}
.count {
  font-size: 12px;
  color: #999;
  margin-right: 10px;
}
.submit {
  height: 20px;
  font-size: 12px;
  background-color: $themeColor;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    background-color: $themeHoverColor;
  }

  .icon {
    font-size: 15px;
    margin-right: 3px;
  }
}

@media screen and (width <= 800px) {
  .configs {
    margin-top: 15px;
    display: flex;
    flex-direction: column;

    .config-item {
      margin-top: 8px;

      .label {
        flex-shrink: 0;
      }

      .config-content {
        width: 100% !important;
      }
    }
  }
  .select-template {
    .templates {
      padding-right: 0;
  
      .template {
        img {
          min-height: 60px;
        }
      }
    }
  }
}

@media screen and (width <= 380px) {
  .preview {
    pre {
      max-height: 400px;
    }
    .outline-view {
      max-height: 400px;
    }
  }
  .select-template {
    .templates {
      max-height: 400px;
    }
  }
}
</style>