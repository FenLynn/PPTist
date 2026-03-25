import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import type { PPTImageElement, PPTTextElement } from '@/types/slides'

export default () => {
  const mainStore = useMainStore()
  const { elementStylePainter, handleElement } = storeToRefs(mainStore)

  const toggleElementStylePainter = (keep = false) => {
    const element = handleElement.value as PPTTextElement | PPTImageElement | null

    if (elementStylePainter.value) {
      mainStore.setElementStylePainter(null)
      return
    }

    if (!element || (element.type !== 'text' && element.type !== 'image')) return

    if (element.type === 'text') {
      mainStore.setElementStylePainter({
        keep,
        sourceElementId: element.id,
        targetType: 'text',
        width: element.width,
        height: element.height,
        fill: element.fill,
        outline: element.outline,
        opacity: element.opacity,
        shadow: element.shadow,
      })
      return
    }

    mainStore.setElementStylePainter({
      keep,
      sourceElementId: element.id,
      targetType: 'image',
      width: element.width,
      height: element.height,
      outline: element.outline,
      shadow: element.shadow,
      filters: element.filters,
      radius: element.radius,
      flipH: element.flipH,
      flipV: element.flipV,
      colorMask: element.colorMask,
    })
  }

  return {
    toggleElementStylePainter,
  }
}