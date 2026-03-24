import { defineStore } from 'pinia'
import { useMainStore } from './main'
import { useWorkspaceStore } from './workspace'

export interface ScreenState {
  placeholder: boolean
}

export const useSnapshotStore = defineStore('snapshot', {
  state: (): ScreenState => ({
    placeholder: true,
  }),

  getters: {
    canUndo() {
      const workspaceStore = useWorkspaceStore()
      return !!workspaceStore.activeDoc && workspaceStore.activeDoc.historyCursor > 0
    },
    canRedo() {
      const workspaceStore = useWorkspaceStore()
      if (!workspaceStore.activeDoc) return false
      return workspaceStore.activeDoc.historyCursor < workspaceStore.activeDoc.history.length - 1
    },
  },

  actions: {
    async initSnapshotDatabase() {
      const workspaceStore = useWorkspaceStore()
      workspaceStore.initActiveHistory()
    },
  
    async addSnapshot() {
      const workspaceStore = useWorkspaceStore()
      workspaceStore.addActiveSnapshot()
    },
  
    async unDo() {
      const workspaceStore = useWorkspaceStore()
      const mainStore = useMainStore()
      const doc = workspaceStore.activeDoc
      if (!doc || doc.historyCursor <= 0) return

      workspaceStore.restoreActiveSnapshot(doc.historyCursor - 1)
      mainStore.setActiveElementIdList([])
    },
  
    async reDo() {
      const workspaceStore = useWorkspaceStore()
      const mainStore = useMainStore()
      const doc = workspaceStore.activeDoc
      if (!doc || doc.historyCursor >= doc.history.length - 1) return

      workspaceStore.restoreActiveSnapshot(doc.historyCursor + 1)
      mainStore.setActiveElementIdList([])
    },
  },
})