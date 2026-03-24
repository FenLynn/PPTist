import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { useMainStore } from './main'
import { useSlidesStore } from './slides'
import type { PPTElement } from '@/types/slides'
import type { SlideTheme } from '@/types/slides'
import { createElementIdMap, createSlideIdMap, getElementRange } from '@/utils/element'
import {
  capturePresentationFromSlidesState,
  clonePresentationData,
  createBlankPresentationData,
  type PresentationDocumentData,
} from '@/utils/presentation'

export interface WorkspaceSnapshot {
  index: number
  slides: PresentationDocumentData['slides']
}

export interface WorkspaceDocument {
  id: string
  title: string
  data: PresentationDocumentData
  history: WorkspaceSnapshot[]
  historyCursor: number
  dirty: boolean
  storage: 'memory' | 'local' | 'cloud'
  filename: string
  lastSavedAt: string
}

interface WorkspaceState {
  docs: WorkspaceDocument[]
  activeDocId: string
  primaryDocId: string
  hydrating: boolean
}

function makeDocId() {
  return crypto.randomUUID()
}

function makeFilename(title: string) {
  const normalized = String(title || '未命名演示文稿').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
  return `${normalized || '未命名演示文稿'}.pptist`
}

function cloneHistory(history: WorkspaceSnapshot[]) {
  return JSON.parse(JSON.stringify(history)) as WorkspaceSnapshot[]
}

function makeInitialHistory(data: PresentationDocumentData) {
  return [{
    index: data.slideIndex,
    slides: clonePresentationData(data).slides,
  }]
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    docs: [],
    activeDocId: '',
    primaryDocId: '',
    hydrating: false,
  }),

  getters: {
    activeDoc(state) {
      return state.docs.find(doc => doc.id === state.activeDocId) || null
    },
    primaryDoc(state) {
      return state.docs.find(doc => doc.id === state.primaryDocId) || null
    },
  },

  actions: {
    ensureWorkspace() {
      if (this.docs.length) return
      const data = createBlankPresentationData()
      const doc: WorkspaceDocument = {
        id: makeDocId(),
        title: data.title,
        data,
        history: makeInitialHistory(data),
        historyCursor: 0,
        dirty: false,
        storage: 'memory',
        filename: makeFilename(data.title),
        lastSavedAt: '',
      }
      this.docs = [doc]
      this.activeDocId = doc.id
      this.primaryDocId = doc.id
    },

    initializeFromCurrentStores() {
      const slidesStore = useSlidesStore()
      const data = capturePresentationFromSlidesState(slidesStore.$state)
      const doc: WorkspaceDocument = {
        id: makeDocId(),
        title: data.title,
        data,
        history: makeInitialHistory(data),
        historyCursor: 0,
        dirty: false,
        storage: 'memory',
        filename: makeFilename(data.title),
        lastSavedAt: '',
      }
      this.docs = [doc]
      this.activeDocId = doc.id
      this.primaryDocId = doc.id
    },

    applyDocumentToStores(docId?: string) {
      const targetDocId = docId || this.activeDocId
      const doc = this.docs.find(item => item.id === targetDocId)
      if (!doc) return

      const slidesStore = useSlidesStore()
      const mainStore = useMainStore()
      this.hydrating = true
      slidesStore.setTheme(doc.data.theme as Partial<SlideTheme>)
      slidesStore.setSlides(clonePresentationData(doc.data).slides)
      slidesStore.setTitle(doc.data.title)
      slidesStore.setViewportSize(doc.data.viewportSize)
      slidesStore.setViewportRatio(doc.data.viewportRatio)
      slidesStore.updateSlideIndex(doc.data.slideIndex)
      mainStore.setActiveElementIdList([])
      mainStore.updateSelectedSlidesIndex([])
      mainStore.setHandleElementId('')
      this.hydrating = false
    },

    syncActiveFromStores(markDirty = true) {
      if (this.hydrating) return
      const doc = this.activeDoc
      if (!doc) return

      const slidesStore = useSlidesStore()
      const data = capturePresentationFromSlidesState(slidesStore.$state)
      doc.data = data
      doc.title = data.title
      if (!doc.lastSavedAt && doc.storage === 'memory') doc.filename = makeFilename(data.title)
      if (markDirty) doc.dirty = true
    },

    updateActiveMeta(patch: Partial<Pick<WorkspaceDocument, 'storage' | 'filename' | 'lastSavedAt' | 'dirty'>>) {
      const doc = this.activeDoc
      if (!doc) return
      Object.assign(doc, patch)
    },

    addEmptyDocument() {
      this.syncActiveFromStores(false)
      const data = createBlankPresentationData(`未命名演示文稿 ${this.docs.length + 1}`)
      const doc: WorkspaceDocument = {
        id: makeDocId(),
        title: data.title,
        data,
        history: makeInitialHistory(data),
        historyCursor: 0,
        dirty: false,
        storage: 'memory',
        filename: makeFilename(data.title),
        lastSavedAt: '',
      }
      this.docs.push(doc)
      this.activeDocId = doc.id
      if (!this.primaryDocId) this.primaryDocId = doc.id
      this.applyDocumentToStores(doc.id)
    },

    openDocument(data: PresentationDocumentData, options?: Partial<Pick<WorkspaceDocument, 'storage' | 'filename' | 'lastSavedAt' | 'dirty'>>) {
      this.syncActiveFromStores(false)
      const cloned = clonePresentationData(data)
      const doc: WorkspaceDocument = {
        id: makeDocId(),
        title: cloned.title,
        data: cloned,
        history: makeInitialHistory(cloned),
        historyCursor: 0,
        dirty: options?.dirty ?? false,
        storage: options?.storage || 'memory',
        filename: options?.filename || makeFilename(cloned.title),
        lastSavedAt: options?.lastSavedAt || '',
      }
      this.docs.push(doc)
      this.activeDocId = doc.id
      if (!this.primaryDocId) this.primaryDocId = doc.id
      this.applyDocumentToStores(doc.id)
      return doc.id
    },

    setPrimaryDocument(docId: string) {
      const doc = this.docs.find(item => item.id === docId)
      if (!doc) return
      this.primaryDocId = docId
    },

    replaceActiveDocument(data: PresentationDocumentData, options?: Partial<Pick<WorkspaceDocument, 'storage' | 'filename' | 'lastSavedAt' | 'dirty'>>) {
      const doc = this.activeDoc
      if (!doc) {
        return this.openDocument(data, options)
      }

      const cloned = clonePresentationData(data)
      doc.title = cloned.title
      doc.data = cloned
      doc.history = makeInitialHistory(cloned)
      doc.historyCursor = 0
      doc.dirty = options?.dirty ?? false
      doc.storage = options?.storage || doc.storage
      doc.filename = options?.filename || makeFilename(cloned.title)
      doc.lastSavedAt = options?.lastSavedAt || doc.lastSavedAt
      this.applyDocumentToStores(doc.id)
      return doc.id
    },

    activateDocument(docId: string) {
      if (docId === this.activeDocId) return
      this.syncActiveFromStores(false)
      this.activeDocId = docId
      this.applyDocumentToStores(docId)
    },

    closeDocument(docId: string) {
      if (this.docs.length === 1) {
        this.addEmptyDocument()
        const onlyDoc = this.docs.find(doc => doc.id === docId)
        if (onlyDoc) this.docs = this.docs.filter(doc => doc.id !== onlyDoc.id)
      } else {
        const currentIndex = this.docs.findIndex(doc => doc.id === docId)
        const wasActive = docId === this.activeDocId
        this.docs = this.docs.filter(doc => doc.id !== docId)
        if (wasActive) {
          const fallback = this.docs[Math.max(0, currentIndex - 1)] || this.docs[0]
          this.activeDocId = fallback.id
          this.applyDocumentToStores(fallback.id)
        }
      }

      if (docId === this.primaryDocId) {
        this.primaryDocId = this.docs[0]?.id || ''
      }
    },

    initActiveHistory() {
      const doc = this.activeDoc
      if (!doc) return
      const slidesStore = useSlidesStore()
      const data = capturePresentationFromSlidesState(slidesStore.$state)
      doc.history = makeInitialHistory(data)
      doc.historyCursor = 0
      doc.data = data
    },

    addActiveSnapshot() {
      const doc = this.activeDoc
      if (!doc) return
      const slidesStore = useSlidesStore()
      const data = capturePresentationFromSlidesState(slidesStore.$state)
      const history = cloneHistory(doc.history)
      const nextSnapshot: WorkspaceSnapshot = {
        index: data.slideIndex,
        slides: clonePresentationData(data).slides,
      }

      let trimmed = history.slice(0, doc.historyCursor + 1)
      trimmed.push(nextSnapshot)
      if (trimmed.length > 20) {
        trimmed = trimmed.slice(trimmed.length - 20)
      }

      doc.history = trimmed
      doc.historyCursor = trimmed.length - 1
      doc.data = data
      doc.title = data.title
      doc.dirty = true
    },

    restoreActiveSnapshot(cursor: number) {
      const doc = this.activeDoc
      if (!doc) return
      const snapshot = doc.history[cursor]
      if (!snapshot) return
      doc.historyCursor = cursor
      doc.data = {
        ...doc.data,
        slideIndex: Math.min(snapshot.index, Math.max(snapshot.slides.length - 1, 0)),
        slides: JSON.parse(JSON.stringify(snapshot.slides)),
      }
      doc.dirty = true
      this.applyDocumentToStores(doc.id)
    },

    appendSlidesToDocument(docId: string, slides: PresentationDocumentData['slides']) {
      const doc = this.docs.find(item => item.id === docId)
      if (!doc || !slides.length) return 0

      const sourceSlides = JSON.parse(JSON.stringify(slides)) as PresentationDocumentData['slides']
      const slideIdMap = createSlideIdMap(sourceSlides)
      const newSlides = sourceSlides.map(slide => {
        const { groupIdMap, elIdMap } = createElementIdMap(slide.elements)

        for (const element of slide.elements) {
          element.id = elIdMap[element.id]
          if (element.groupId) element.groupId = groupIdMap[element.groupId]

          if (element.link && element.link.type === 'slide') {
            if (slideIdMap[element.link.target]) element.link.target = slideIdMap[element.link.target]
            else delete element.link
          }
        }

        if (slide.animations) {
          for (const animation of slide.animations) {
            animation.id = nanoid(10)
            animation.elId = elIdMap[animation.elId]
          }
        }

        return {
          ...slide,
          id: slideIdMap[slide.id],
        }
      })

      doc.data.slides = [...doc.data.slides, ...newSlides]
      doc.history = [...doc.history.slice(0, doc.historyCursor + 1), {
        index: doc.data.slideIndex,
        slides: JSON.parse(JSON.stringify(doc.data.slides)),
      }]
      if (doc.history.length > 20) doc.history = doc.history.slice(doc.history.length - 20)
      doc.historyCursor = doc.history.length - 1
      doc.dirty = true

      if (doc.id === this.activeDocId) this.applyDocumentToStores(doc.id)
      return newSlides.length
    },

    appendElementsToDocument(docId: string, elements: PPTElement[]) {
      const doc = this.docs.find(item => item.id === docId)
      if (!doc || !elements.length) return 0

      const targetIndex = Math.min(doc.data.slideIndex, Math.max(doc.data.slides.length - 1, 0))
      const targetSlide = doc.data.slides[targetIndex]
      if (!targetSlide) return 0

      const sourceElements = JSON.parse(JSON.stringify(elements)) as PPTElement[]
      const { groupIdMap, elIdMap } = createElementIdMap(sourceElements)

      const firstElement = sourceElements[0]
      let offset = 0
      let lastSameElement: PPTElement | undefined

      do {
        lastSameElement = targetSlide.elements.find(element => {
          if (element.type !== firstElement.type) return false

          const { minX: oldMinX, maxX: oldMaxX, minY: oldMinY, maxY: oldMaxY } = getElementRange(element)
          const { minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY } = getElementRange({
            ...firstElement,
            left: firstElement.left + offset,
            top: firstElement.top + offset,
          })

          return oldMinX === newMinX && oldMaxX === newMaxX && oldMinY === newMinY && oldMaxY === newMaxY
        })

        if (lastSameElement) offset += 10
      } while (lastSameElement)

      const appendedElements = sourceElements.map(element => {
        const nextElement = {
          ...element,
          id: elIdMap[element.id],
          left: element.left + offset,
          top: element.top + offset,
        }

        if (nextElement.groupId) nextElement.groupId = groupIdMap[nextElement.groupId]
        return nextElement
      })

      targetSlide.elements = [...targetSlide.elements, ...appendedElements]
      doc.history = [...doc.history.slice(0, doc.historyCursor + 1), {
        index: doc.data.slideIndex,
        slides: JSON.parse(JSON.stringify(doc.data.slides)),
      }]
      if (doc.history.length > 20) doc.history = doc.history.slice(doc.history.length - 20)
      doc.historyCursor = doc.history.length - 1
      doc.dirty = true

      if (doc.id === this.activeDocId) this.applyDocumentToStores(doc.id)
      return appendedElements.length
    },
  },
})