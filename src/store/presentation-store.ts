import { create } from 'zustand'

export type SceneType = 'image' | 'video' | 'web' | 'text' | 'pptx-slide'

export interface Scene {
  id: string
  type: SceneType
  name: string
  // For image/video/pptx-slide: data URL or object URL
  src?: string
  // For web: URL
  url?: string
  // For text: content + style
  content?: string
  fontSize?: number
  fontColor?: string
  bgColor?: string
  textAlign?: 'left' | 'center' | 'right'
  // For PPTX slides - extracted as images
  pptxFileId?: string
  slideIndex?: number
  // Thumbnail
  thumbnail?: string
  // Duration for video (in seconds)
  duration?: number
  // Order
  order: number
}

export interface TextOverlay {
  id: string
  text: string
  visible: boolean
  fontSize: number
  fontColor: string
  bgColor: string
  position: 'top' | 'bottom' | 'center'
}

interface PresentationState {
  scenes: Scene[]
  currentSceneIndex: number
  isLive: boolean
  outputWindowRef: Window | null
  textOverlays: TextOverlay[]
  blackScreen: boolean

  // Actions
  addScene: (scene: Omit<Scene, 'id' | 'order'>) => void
  removeScene: (id: string) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  setCurrentSceneIndex: (index: number) => void
  goNext: () => void
  goPrev: () => void
  goLive: () => void
  stopLive: () => void
  setOutputWindowRef: (win: Window | null) => void
  addTextOverlay: (overlay: Omit<TextOverlay, 'id'>) => void
  removeTextOverlay: (id: string) => void
  toggleTextOverlay: (id: string) => void
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void
  toggleBlackScreen: () => void
}

let sceneIdCounter = 0
let overlayIdCounter = 0

export const usePresentationStore = create<PresentationState>((set, get) => ({
  scenes: [],
  currentSceneIndex: -1,
  isLive: false,
  outputWindowRef: null,
  textOverlays: [],
  blackScreen: false,

  addScene: (scene) => {
    const id = `scene-${++sceneIdCounter}-${Date.now()}`
    const order = get().scenes.length
    set((state) => ({
      scenes: [...state.scenes, { ...scene, id, order }],
      currentSceneIndex: state.currentSceneIndex === -1 ? 0 : state.currentSceneIndex,
    }))
  },

  removeScene: (id) => {
    set((state) => {
      const newScenes = state.scenes
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i }))
      let newIndex = state.currentSceneIndex
      const removedIndex = state.scenes.findIndex((s) => s.id === id)
      if (removedIndex === state.currentSceneIndex) {
        newIndex = Math.min(newIndex, newScenes.length - 1)
      } else if (removedIndex < state.currentSceneIndex) {
        newIndex = state.currentSceneIndex - 1
      }
      if (newIndex < 0) newIndex = newScenes.length > 0 ? 0 : -1
      return { scenes: newScenes, currentSceneIndex: newIndex }
    })
  },

  updateScene: (id, updates) => {
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
  },

  reorderScenes: (fromIndex, toIndex) => {
    set((state) => {
      const newScenes = [...state.scenes]
      const [moved] = newScenes.splice(fromIndex, 1)
      newScenes.splice(toIndex, 0, moved)
      const reordered = newScenes.map((s, i) => ({ ...s, order: i }))
      const currentId = state.scenes[state.currentSceneIndex]?.id
      const newIndex = reordered.findIndex((s) => s.id === currentId)
      return { scenes: reordered, currentSceneIndex: newIndex }
    })
  },

  setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),

  goNext: () =>
    set((state) => {
      const next = Math.min(state.currentSceneIndex + 1, state.scenes.length - 1)
      return { currentSceneIndex: next }
    }),

  goPrev: () =>
    set((state) => {
      const prev = Math.max(state.currentSceneIndex - 1, 0)
      return { currentSceneIndex: prev }
    }),

  goLive: () => set({ isLive: true }),

  stopLive: () => set({ isLive: false }),

  setOutputWindowRef: (win) => set({ outputWindowRef: win }),

  addTextOverlay: (overlay) => {
    const id = `overlay-${++overlayIdCounter}-${Date.now()}`
    set((state) => ({
      textOverlays: [...state.textOverlays, { ...overlay, id }],
    }))
  },

  removeTextOverlay: (id) =>
    set((state) => ({
      textOverlays: state.textOverlays.filter((o) => o.id !== id),
    })),

  toggleTextOverlay: (id) =>
    set((state) => ({
      textOverlays: state.textOverlays.map((o) =>
        o.id === id ? { ...o, visible: !o.visible } : o
      ),
    })),

  updateTextOverlay: (id, updates) =>
    set((state) => ({
      textOverlays: state.textOverlays.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    })),

  toggleBlackScreen: () => set((state) => ({ blackScreen: !state.blackScreen })),
}))
