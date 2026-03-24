import { encrypt, decrypt } from '@/utils/crypto'
import type { Slide, SlideTheme } from '@/types/slides'
import type { SlidesState } from '@/store/slides'

export interface PresentationDocumentData {
  title: string
  theme: SlideTheme
  slides: Slide[]
  slideIndex: number
  viewportSize: number
  viewportRatio: number
}

interface PresentationFilePayload {
  title?: string
  width?: number
  height?: number
  theme?: SlideTheme
  slides?: Slide[]
  slideIndex?: number
  viewportSize?: number
  viewportRatio?: number
}

export function clonePresentationData(data: PresentationDocumentData): PresentationDocumentData {
  return JSON.parse(JSON.stringify(data))
}

export function createBlankPresentationData(title = '未命名演示文稿'): PresentationDocumentData {
  return {
    title,
    theme: {
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
      fontColor: '#333',
      fontName: '',
      backgroundColor: '#fff',
      shadow: {
        h: 3,
        v: 3,
        blur: 2,
        color: '#808080',
      },
      outline: {
        width: 2,
        color: '#525252',
        style: 'solid',
      },
    },
    slides: [{
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 10),
      elements: [],
      background: {
        type: 'solid',
        color: '#fff',
      },
    }],
    slideIndex: 0,
    viewportSize: 1000,
    viewportRatio: 0.5625,
  }
}

export function capturePresentationFromSlidesState(state: SlidesState): PresentationDocumentData {
  return clonePresentationData({
    title: state.title,
    theme: state.theme,
    slides: state.slides,
    slideIndex: state.slideIndex,
    viewportSize: state.viewportSize,
    viewportRatio: state.viewportRatio,
  })
}

export function normalizePresentationPayload(payload: PresentationFilePayload): PresentationDocumentData {
  const width = Number(payload.viewportSize || payload.width || 1000) || 1000
  const ratio = Number(payload.viewportRatio || ((payload.height && width) ? Number(payload.height) / width : 0.5625)) || 0.5625
  const base = createBlankPresentationData(String(payload.title || '未命名演示文稿'))

  return clonePresentationData({
    title: String(payload.title || base.title),
    theme: payload.theme || base.theme,
    slides: Array.isArray(payload.slides) && payload.slides.length ? payload.slides : base.slides,
    slideIndex: Math.max(0, Math.min(Number(payload.slideIndex || 0), (Array.isArray(payload.slides) && payload.slides.length ? payload.slides.length : base.slides.length) - 1)),
    viewportSize: width,
    viewportRatio: ratio,
  })
}

export function serializePresentationAsJSON(data: PresentationDocumentData) {
  return JSON.stringify({
    title: data.title,
    width: data.viewportSize,
    height: data.viewportSize * data.viewportRatio,
    viewportSize: data.viewportSize,
    viewportRatio: data.viewportRatio,
    slideIndex: data.slideIndex,
    theme: data.theme,
    slides: data.slides,
  })
}

export function serializePresentationAsPptist(data: PresentationDocumentData) {
  return encrypt(serializePresentationAsJSON(data))
}

export function parsePresentationFromJSON(text: string) {
  return normalizePresentationPayload(JSON.parse(text))
}

export function parsePresentationFromPptist(text: string) {
  return normalizePresentationPayload(JSON.parse(decrypt(text)))
}

export function parsePresentationFromObject(payload: Record<string, any>) {
  return normalizePresentationPayload(payload)
}