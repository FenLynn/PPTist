<template>
  <div v-if="availableModes.length" class="unified-format-painter">
    <div class="heading">
      <span class="title">格式刷</span>
      <span class="status" v-if="activeMode">{{ activeStatus }}</span>
    </div>

    <div class="row">
      <ButtonGroup passive style="width: 100%;">
        <CheckboxButton
          first
          style="flex: 1;"
          :checked="!!activeMode"
          :title="buttonTitle"
          @click="togglePreferredMode()"
          @dblclick="togglePreferredMode(true)"
        ><i-icon-park-outline:format-brush /> {{ buttonLabel }}</CheckboxButton>
        <Popover trigger="click" placement="bottom-end" style="width: 38px;">
          <template #content>
            <div class="menu-list">
              <div
                v-for="item in availableModes"
                :key="item.value"
                class="menu-item"
                :class="{ active: activeMode === item.value }"
                @click="toggleMode(item.value)"
                @dblclick="toggleMode(item.value, true)"
              >
                <span>{{ item.label }}</span>
                <span class="mode-tag" v-if="activeMode === item.value">{{ activeKeep ? '连续' : '单次' }}</span>
              </div>
              <div class="menu-item danger" v-if="activeMode" @click="clearPainters()">关闭格式刷</div>
              <div class="menu-tip">单击刷一次，双击连续使用</div>
            </div>
          </template>
          <Button last class="switch-btn"><i-icon-park-outline:down /></Button>
        </Popover>
      </ButtonGroup>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import useElementStylePainter from '@/hooks/useElementStylePainter'
import useShapeFormatPainter from '@/hooks/useShapeFormatPainter'
import useTextFormatPainter from '@/hooks/useTextFormatPainter'

import Button from '@/components/Button.vue'
import ButtonGroup from '@/components/ButtonGroup.vue'
import CheckboxButton from '@/components/CheckboxButton.vue'
import Popover from '@/components/Popover.vue'

type PainterMode = 'text' | 'style' | 'shape'

const mainStore = useMainStore()
const { handleElement, textFormatPainter, shapeFormatPainter, elementStylePainter } = storeToRefs(mainStore)
const { toggleTextFormatPainter } = useTextFormatPainter()
const { toggleShapeFormatPainter } = useShapeFormatPainter()
const { toggleElementStylePainter } = useElementStylePainter()

const textSupported = computed(() => {
  const element = handleElement.value
  return !!element && (element.type === 'text' || (element.type === 'shape' && !!element.text?.content))
})

const shapeSupported = computed(() => {
  const element = handleElement.value
  return !!element && element.type === 'shape'
})

const elementStyleSupported = computed(() => {
  const element = handleElement.value
  return !!element && (element.type === 'text' || element.type === 'image')
})

const availableModes = computed(() => {
  const result: { label: string; value: PainterMode }[] = []
  if (textSupported.value) result.push({ label: '文本格式刷', value: 'text' })
  if (elementStyleSupported.value) result.push({ label: '元素样式刷', value: 'style' })
  if (shapeSupported.value) result.push({ label: '形状格式刷', value: 'shape' })
  return result
})

const preferredMode = computed<PainterMode | null>(() => {
  if (elementStyleSupported.value) return 'style'
  if (shapeSupported.value) return 'shape'
  if (textSupported.value) return 'text'
  return null
})

const activeMode = computed<PainterMode | ''>(() => {
  if (elementStylePainter.value) return 'style'
  if (shapeFormatPainter.value) return 'shape'
  if (textFormatPainter.value) return 'text'
  return ''
})

const activeKeep = computed(() => {
  if (elementStylePainter.value) return !!elementStylePainter.value.keep
  if (shapeFormatPainter.value) return !!shapeFormatPainter.value.keep
  if (textFormatPainter.value) return !!textFormatPainter.value.keep
  return false
})

const buttonLabel = computed(() => {
  const target = availableModes.value.find(item => item.value === preferredMode.value)
  return target?.label || '格式刷'
})

const buttonTitle = computed(() => availableModes.value.length > 1 ? '当前默认按形状样式刷取，可从下拉菜单切换文本格式刷' : '单击刷一次，双击连续使用')

const activeStatus = computed(() => {
  const target = availableModes.value.find(item => item.value === activeMode.value)
  return target ? `${target.label}${activeKeep.value ? '已锁定' : '已开启'}` : ''
})

const clearPainters = () => {
  mainStore.setTextFormatPainter(null)
  mainStore.setShapeFormatPainter(null)
  mainStore.setElementStylePainter(null)
}

const toggleMode = (mode: PainterMode, keep = false) => {
  if (mode === 'text') {
    if (!textSupported.value) return
    if (shapeFormatPainter.value) mainStore.setShapeFormatPainter(null)
    if (elementStylePainter.value) mainStore.setElementStylePainter(null)
    toggleTextFormatPainter(keep)
    return
  }

  if (mode === 'style') {
    if (!elementStyleSupported.value) return
    if (shapeFormatPainter.value) mainStore.setShapeFormatPainter(null)
    if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
    toggleElementStylePainter(keep)
    return
  }

  if (!shapeSupported.value) return
  if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
  if (elementStylePainter.value) mainStore.setElementStylePainter(null)
  toggleShapeFormatPainter(keep)
}

const togglePreferredMode = (keep = false) => {
  if (!preferredMode.value) return
  toggleMode(preferredMode.value, keep)
}

</script>

<style lang="scss" scoped>
.unified-format-painter {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid #ececec;
  border-radius: $borderRadius;
  background: linear-gradient(180deg, #fafcff, #f6f8fb);
}

.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.status {
  font-size: 12px;
  color: #5f6b7a;
}

.row {
  display: flex;
  align-items: center;
}

.switch-btn {
  width: 38px;
  padding: 0;
}

.menu-list {
  min-width: 180px;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;

  &:hover,
  &.active {
    background-color: #f3f6fb;
  }

  &.danger {
    color: #c85050;
  }
}

.mode-tag {
  color: #6c7a89;
}

.menu-tip {
  padding: 7px 10px 2px;
  font-size: 12px;
  color: #8c94a1;
}
</style>