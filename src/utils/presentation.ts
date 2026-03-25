import { encrypt, decrypt } from '@/utils/crypto'
import {
  createEmptyPresentationDesignAssets,
  type Slide,
  type SlideTheme,
  type PresentationDesignAssets,
} from '@/types/slides'
import type { SlidesState } from '@/store/slides'

export interface PresentationDocumentData {
  title: string
  theme: SlideTheme
  slides: Slide[]
  slideIndex: number
  viewportSize: number
  viewportRatio: number
  designAssets: PresentationDesignAssets
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
  designAssets?: Partial<PresentationDesignAssets>
}

function normalizeDesignAssets(designAssets?: Partial<PresentationDesignAssets>): PresentationDesignAssets {
  return {
    ...createEmptyPresentationDesignAssets(),
    ...JSON.parse(JSON.stringify(designAssets || {})),
    templates: Array.isArray(designAssets?.templates) ? designAssets.templates : [],
    masters: Array.isArray(designAssets?.masters) ? designAssets.masters : [],
    activeTemplateId: String(designAssets?.activeTemplateId || ''),
    activeMasterId: String(designAssets?.activeMasterId || ''),
  }
}

export function createDesignAssetCover(theme: SlideTheme, title: string, kind: 'template' | 'master' = 'template') {
  const colors = [...theme.themeColors, theme.backgroundColor].slice(0, 4)
  const blocks = colors.map((color, index) => {
    return `<rect x="${18 + index * 34}" y="78" width="26" height="18" rx="5" fill="${color}" />`
  }).join('')
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.backgroundColor}" />
          <stop offset="100%" stop-color="${theme.themeColors[0] || theme.backgroundColor}" />
        </linearGradient>
      </defs>
      <rect width="240" height="140" rx="18" fill="url(#bg)" />
      <rect x="16" y="16" width="208" height="108" rx="14" fill="rgba(255,255,255,0.82)" />
      <text x="20" y="42" fill="${theme.fontColor}" font-size="14" font-family="${theme.fontName || 'Microsoft YaHei'}">${kind === 'master' ? '母版' : '模板'}</text>
      <text x="20" y="68" fill="${theme.fontColor}" font-size="18" font-weight="700" font-family="${theme.fontName || 'Microsoft YaHei'}">${String(title || '').slice(0, 18)}</text>
      ${blocks}
    </svg>
  `.trim()
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
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
    designAssets: createEmptyPresentationDesignAssets(),
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
    designAssets: state.designAssets,
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
    designAssets: normalizeDesignAssets(payload.designAssets),
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
    designAssets: data.designAssets,
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