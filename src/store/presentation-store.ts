import { create } from 'zustand'

export type SceneType = 'image' | 'video' | 'web' | 'text' | 'pptx-slide'

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'flip'
  | 'flip-x'
  | 'rotate'
  | 'spin'
  | 'blur'
  | 'curtain-left'
  | 'curtain-right'
  | 'split-h'
  | 'split-v'
  | 'bounce'
  | 'elastic'
  | 'glitch'

export interface TransitionOption {
  value: TransitionType
  label: string
  description: string
  icon: string
  group: 'basic' | 'slide' | 'zoom' | 'wipe' | '3d' | 'special'
}

export const TRANSITION_GROUPS: { key: TransitionOption['group']; label: string }[] = [
  { key: 'basic', label: 'Cơ bản' },
  { key: 'slide', label: 'Trượt' },
  { key: 'zoom', label: 'Phóng/Thu' },
  { key: 'wipe', label: 'Wipe' },
  { key: '3d', label: '3D' },
  { key: 'special', label: 'Đặc biệt' },
]

export const TRANSITION_OPTIONS: TransitionOption[] = [
  // Basic
  { value: 'none', label: 'Không', description: 'Chuyển ngay lập tức', icon: '⏭️', group: 'basic' },
  { value: 'fade', label: 'Fade', description: 'Mờ dần / Xuất hiện dần', icon: '🌫️', group: 'basic' },
  { value: 'dissolve', label: 'Dissolve', description: 'Hoà tan chéo', icon: '💧', group: 'basic' },
  { value: 'blur', label: 'Blur', description: 'Mờ nhân rồi sắc lại', icon: '🔮', group: 'basic' },
  // Slide
  { value: 'slide-left', label: 'Trượt trái', description: 'Từ phải sang trái', icon: '⬅️', group: 'slide' },
  { value: 'slide-right', label: 'Trượt phải', description: 'Từ trái sang phải', icon: '➡️', group: 'slide' },
  { value: 'slide-up', label: 'Trượt lên', description: 'Từ dưới lên trên', icon: '⬆️', group: 'slide' },
  { value: 'slide-down', label: 'Trượt xuống', description: 'Từ trên xuống dưới', icon: '⬇️', group: 'slide' },
  // Zoom
  { value: 'zoom-in', label: 'Phóng to', description: 'Phóng to từ trung tâm', icon: '🔍', group: 'zoom' },
  { value: 'zoom-out', label: 'Thu nhỏ', description: 'Thu nhỏ vào trung tâm', icon: '🎯', group: 'zoom' },
  { value: 'elastic', label: 'Elastic', description: 'Co giãn đàn hồi', icon: '🧲', group: 'zoom' },
  { value: 'bounce', label: 'Bounce', description: 'Nảy vào', icon: '🏀', group: 'zoom' },
  // Wipe
  { value: 'wipe-left', label: 'Wipe trái', description: 'Kéo che từ phải sang trái', icon: '🧹', group: 'wipe' },
  { value: 'wipe-right', label: 'Wipe phải', description: 'Kéo che từ trái sang phải', icon: '🧹', group: 'wipe' },
  { value: 'wipe-up', label: 'Wipe lên', description: 'Kéo che từ dưới lên', icon: '⬆️', group: 'wipe' },
  { value: 'wipe-down', label: 'Wipe xuống', description: 'Kéo che từ trên xuống', icon: '⬇️', group: 'wipe' },
  { value: 'curtain-left', label: 'Rèm trái', description: 'Rèm kéo từ phải sang trái', icon: '🎭', group: 'wipe' },
  { value: 'curtain-right', label: 'Rèm phải', description: 'Rèm kéo từ trái sang phải', icon: '🎭', group: 'wipe' },
  { value: 'split-h', label: 'Tách ngang', description: 'Tách đôi theo chiều ngang', icon: '↔️', group: 'wipe' },
  { value: 'split-v', label: 'Tách dọc', description: 'Tách đôi theo chiều dọc', icon: '↕️', group: 'wipe' },
  // 3D
  { value: 'flip', label: 'Lật Y', description: 'Lật 3D quanh trục Y', icon: '🔄', group: '3d' },
  { value: 'flip-x', label: 'Lật X', description: 'Lật 3D quanh trục X', icon: '🔃', group: '3d' },
  { value: 'rotate', label: 'Xoay', description: 'Xoay chuyển cảnh', icon: '🌀', group: '3d' },
  { value: 'spin', label: 'Spin', description: 'Xoay 360°', icon: '💫', group: '3d' },
  // Special
  { value: 'glitch', label: 'Glitch', description: 'Hiệu ứng nhiễu kỹ thuật số', icon: '⚡', group: 'special' },
]

export const DEFAULT_TRANSITION_DURATION = 600 // ms

export interface Scene {
  id: string
  type: SceneType
  name: string
  src?: string
  url?: string
  content?: string
  fontSize?: number
  fontColor?: string
  bgColor?: string
  textAlign?: 'left' | 'center' | 'right'
  /** Groups PPTX slides from the same file */
  pptxFileId?: string
  /** Original PPTX filename for grouping in scene list */
  pptxFileName?: string
  slideIndex?: number
  thumbnail?: string
  duration?: number
  order: number
  /** Video trim start time in seconds */
  trimStart?: number
  /** Video trim end time in seconds */
  trimEnd?: number
  /** Per-slide transition override (falls back to global) */
  sceneTransitionType?: TransitionType
  /** Per-slide transition duration override */
  sceneTransitionDuration?: number
}

export interface TextOverlay {
  id: string
  text: string
  visible: boolean
  fontSize: number
  fontColor: string
  bgColor: string
  position: 'top' | 'bottom' | 'center'
  /** Animation type for this overlay */
  animation?: 'static' | 'scroll' | 'typewriter'
  /** Scroll speed in seconds (for scroll animation) */
  scrollDuration?: number
}

interface PresentationState {
  scenes: Scene[]
  /** Index of the scene currently being projected (ĐANG CHIẾU = screen 1) */
  currentSceneIndex: number
  /** Index of the scene queued as next (TIẾP THEO = screen 2). Separate from currentSceneIndex so clicking in list only changes the next preview. */
  nextSceneIndex: number
  isLive: boolean
  outputWindowRef: Window | null
  textOverlays: TextOverlay[]
  blackScreen: boolean
  // Transition
  transitionType: TransitionType
  transitionDuration: number
  // Video
  videoVolume: number
  videoMuted: boolean
  // Screen size
  screenSize: { width: number; height: number }
  // Selected scene for detail panel
  selectedSceneId: string | null
  setSelectedSceneId: (id: string | null) => void

  // Actions
  addScene: (scene: Omit<Scene, 'id' | 'order'>) => void
  removeScene: (id: string) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  setCurrentSceneIndex: (index: number) => void
  /** Set the next scene index (only changes the TIẾP THEO preview, not ĐANG CHIẾU) */
  setNextSceneIndex: (index: number) => void
  /** Select a scene as next preview (clicking in list) */
  selectAsNext: (index: number) => void
  /** Move nextSceneIndex to a new position (when editing number on a box) */
  moveNextToPosition: (newPosition: number) => void
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
  setTransitionType: (type: TransitionType) => void
  setTransitionDuration: (duration: number) => void
  setVideoVolume: (volume: number) => void
  setVideoMuted: (muted: boolean) => void
  setScreenSize: (size: { width: number; height: number }) => void
  saveProject: () => void
  loadProject: () => void
  clearAllScenes: () => void
}

let sceneIdCounter = 0
let overlayIdCounter = 0

export const usePresentationStore = create<PresentationState>((set, get) => ({
  scenes: [],
  currentSceneIndex: -1,
  nextSceneIndex: -1,
  isLive: false,
  outputWindowRef: null,
  textOverlays: [],
  blackScreen: false,
  transitionType: 'fade',
  transitionDuration: DEFAULT_TRANSITION_DURATION,
  videoVolume: 1,
  videoMuted: false,
  screenSize: { width: 1920, height: 1080 },
  selectedSceneId: null,
  setSelectedSceneId: (id) => set({ selectedSceneId: id }),

  addScene: (scene) => {
    const id = `scene-${++sceneIdCounter}-${Date.now()}`
    const order = get().scenes.length
    set((state) => {
      const newScenes = [...state.scenes, { ...scene, id, order }]
      return {
        scenes: newScenes,
        currentSceneIndex: state.currentSceneIndex === -1 ? 0 : state.currentSceneIndex,
        nextSceneIndex: state.nextSceneIndex === -1 ? (newScenes.length > 1 ? 1 : 0) : state.nextSceneIndex,
      }
    })
  },

  removeScene: (id) => {
    set((state) => {
      const newScenes = state.scenes
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i }))
      let newCurrentIndex = state.currentSceneIndex
      let newNextIndex = state.nextSceneIndex
      const removedIndex = state.scenes.findIndex((s) => s.id === id)
      if (removedIndex === state.currentSceneIndex) {
        newCurrentIndex = Math.min(newCurrentIndex, newScenes.length - 1)
      } else if (removedIndex < state.currentSceneIndex) {
        newCurrentIndex = state.currentSceneIndex - 1
      }
      if (removedIndex === state.nextSceneIndex) {
        newNextIndex = Math.min(newNextIndex, newScenes.length - 1)
      } else if (removedIndex < state.nextSceneIndex) {
        newNextIndex = state.nextSceneIndex - 1
      }
      if (newCurrentIndex < 0) newCurrentIndex = newScenes.length > 0 ? 0 : -1
      if (newNextIndex < 0) newNextIndex = newScenes.length > 0 ? 0 : -1
      // Ensure next !== current when possible
      if (newNextIndex === newCurrentIndex && newScenes.length > 1) {
        newNextIndex = Math.min(newCurrentIndex + 1, newScenes.length - 1)
      }
      return { scenes: newScenes, currentSceneIndex: newCurrentIndex, nextSceneIndex: newNextIndex }
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
      const nextId = state.scenes[state.nextSceneIndex]?.id
      const newIndex = reordered.findIndex((s) => s.id === currentId)
      const newNextIndex = reordered.findIndex((s) => s.id === nextId)
      return { scenes: reordered, currentSceneIndex: newIndex >= 0 ? newIndex : 0, nextSceneIndex: newNextIndex >= 0 ? newNextIndex : 0 }
    })
  },

  setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),

  setNextSceneIndex: (index) => set({ nextSceneIndex: index }),

  selectAsNext: (index) => {
    set({ nextSceneIndex: index })
  },

  moveNextToPosition: (newPosition) => {
    const state = get()
    const totalScenes = state.scenes.length
    if (newPosition < 0 || newPosition >= totalScenes) return
    // Reorder: move the scene at nextSceneIndex to newPosition
    if (state.nextSceneIndex !== newPosition) {
      const newScenes = [...state.scenes]
      const [moved] = newScenes.splice(state.nextSceneIndex, 1)
      newScenes.splice(newPosition, 0, moved)
      const reordered = newScenes.map((s, i) => ({ ...s, order: i }))
      // Update currentSceneIndex to follow the currently projecting scene
      const currentId = state.scenes[state.currentSceneIndex]?.id
      const newCurrentIndex = reordered.findIndex((s) => s.id === currentId)
      set({ scenes: reordered, nextSceneIndex: newPosition, currentSceneIndex: newCurrentIndex >= 0 ? newCurrentIndex : 0 })
    }
  },

  goNext: () =>
    set((state) => {
      if (state.scenes.length === 0) return { currentSceneIndex: -1, nextSceneIndex: -1 }
      // Move nextSceneIndex to currentSceneIndex (project the next scene)
      const newCurrent = state.nextSceneIndex >= 0 ? state.nextSceneIndex : Math.min(state.currentSceneIndex + 1, state.scenes.length - 1)
      // Advance nextSceneIndex to the scene after newCurrent
      let newNext = newCurrent + 1
      if (newNext >= state.scenes.length) newNext = newCurrent // stay if at end
      return { currentSceneIndex: newCurrent, nextSceneIndex: newNext }
    }),

  goPrev: () =>
    set((state) => {
      if (state.scenes.length === 0) return { currentSceneIndex: -1, nextSceneIndex: -1 }
      const prev = Math.max(state.currentSceneIndex - 1, 0)
      return { currentSceneIndex: prev, nextSceneIndex: state.currentSceneIndex > 0 ? state.currentSceneIndex : prev }
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

  setTransitionType: (type) => set({ transitionType: type }),

  setTransitionDuration: (duration) => set({ transitionDuration: duration }),

  setVideoVolume: (volume) => set({ videoVolume: volume }),

  setVideoMuted: (muted) => set({ videoMuted: muted }),

  setScreenSize: (size) => set({ screenSize: size }),

  saveProject: () => {
    const state = get()
    const projectData = {
      scenes: state.scenes.map((s) => ({
        ...s,
        // Only persist URL-based or data-URL sources, not blob URLs
        src: s.src?.startsWith('blob:') ? undefined : s.src,
        thumbnail: s.thumbnail?.startsWith('blob:') ? undefined : s.thumbnail,
      })),
      currentSceneIndex: state.currentSceneIndex,
      nextSceneIndex: state.nextSceneIndex,
      transitionType: state.transitionType,
      transitionDuration: state.transitionDuration,
      textOverlays: state.textOverlays,
      videoVolume: state.videoVolume,
      videoMuted: state.videoMuted,
      screenSize: state.screenSize,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem('showflow-project', JSON.stringify(projectData))
    } catch {
      console.error('Failed to save project')
    }
  },

  loadProject: () => {
    try {
      const data = localStorage.getItem('showflow-project')
      if (!data) return
      const project = JSON.parse(data)
      set({
        scenes: project.scenes || [],
        currentSceneIndex: project.currentSceneIndex ?? -1,
        nextSceneIndex: project.nextSceneIndex ?? (project.currentSceneIndex !== undefined ? Math.min(project.currentSceneIndex + 1, (project.scenes?.length || 1) - 1) : -1),
        transitionType: project.transitionType || 'fade',
        transitionDuration: project.transitionDuration || DEFAULT_TRANSITION_DURATION,
        textOverlays: project.textOverlays || [],
        videoVolume: project.videoVolume ?? 1,
        videoMuted: project.videoMuted ?? false,
        screenSize: project.screenSize || { width: 1920, height: 1080 },
      })
    } catch {
      console.error('Failed to load project')
    }
  },

  clearAllScenes: () => {
    set({ scenes: [], currentSceneIndex: -1, nextSceneIndex: -1, textOverlays: [] })
  },
}))
