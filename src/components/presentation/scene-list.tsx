'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType, Scene, SceneType } from '@/store/presentation-store'
import { parsePptx } from '@/lib/pptx-parser'
import { setVideoPaused, isVideoPaused } from './media-renderer'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Trash2,
  Image as ImageIcon,
  Video,
  Globe,
  Type,
  Presentation,
  Eye,
  EyeOff,
  Plus,
  Bell,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Square,
  Play,
  Pause,
  Upload,
  Trash,
  FileBox,
  Scissors,
  MoveUp,
  MoveDown,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MonitorUp,
  Maximize2,
  GripVertical,
  Settings,
  Save,
  FolderOpen,
  Volume2,
  VolumeX,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddSceneDialog } from './add-scene-dialog'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// === VIDEO THUMBNAIL GENERATOR ===
function generateVideoThumbnail(videoSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 192
        canvas.height = 108
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          resolve(dataUrl)
        } else {
          resolve('')
        }
      } catch {
        resolve('')
      }
      video.src = ''
      video.load()
    }

    video.onerror = () => {
      resolve('')
    }

    video.src = videoSrc
    video.load()
  })
}

// PPTX file counter for unique IDs
let pptxCounter = 0

function SceneIcon({ type, size = 14 }: { type: Scene['type']; size?: number }) {
  const cls = `text-${size === 14 ? 4 : 3}`
  switch (type) {
    case 'image': return <ImageIcon className={`${cls} text-blue-400`} style={{ width: size, height: size }} />
    case 'video': return <Video className={`${cls} text-purple-400`} style={{ width: size, height: size }} />
    case 'web': return <Globe className={`${cls} text-cyan-400`} style={{ width: size, height: size }} />
    case 'text': return <Type className={`${cls} text-yellow-400`} style={{ width: size, height: size }} />
    case 'pptx-slide': return <Presentation className={`${cls} text-orange-400`} style={{ width: size, height: size }} />
    default: return null
  }
}

function getTypeLabel(type: SceneType): string {
  switch (type) {
    case 'image': return 'Ảnh'
    case 'video': return 'Video'
    case 'web': return 'Web'
    case 'text': return 'Chữ'
    case 'pptx-slide': return 'Slide'
    default: return ''
  }
}

// === SORTABLE GRID ITEM ===
function SortableGridItem({
  scene,
  displayIndex,
  isNext,
  isCurrent,
  onClick,
  onDelete,
}: {
  scene: Scene
  displayIndex: number
  isNext: boolean
  isCurrent: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const thumbnailSrc = scene.thumbnail || (scene.type === 'pptx-slide' ? scene.src : undefined)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-md overflow-hidden cursor-pointer transition-all group border ${
        isCurrent
          ? 'border-red-500 ring-1 ring-red-500/30'
          : isNext
            ? 'border-emerald-500 ring-1 ring-emerald-500/30'
            : 'border-zinc-700 hover:border-zinc-500'
      }`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 bg-zinc-800/80 rounded-br p-px transition-opacity"
      >
        <GripVertical className="w-2.5 h-2.5 text-zinc-400" />
      </div>

      {/* Compact layout: thumbnail left, info right - single row */}
      <div className="flex items-center gap-0.5 px-0.5 py-0 bg-zinc-900/90">
        {/* Order number */}
        <span className={`text-[7px] font-bold min-w-[10px] text-center rounded px-0.5 flex-shrink-0 ${
          isCurrent ? 'text-red-400 bg-red-900/30' : isNext ? 'text-emerald-400 bg-emerald-900/30' : 'text-zinc-500'
        }`}>
          {displayIndex}
        </span>

        {/* Mini thumbnail */}
        <div className="w-5 h-3 rounded-sm bg-zinc-800 relative overflow-hidden flex-shrink-0">
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt={scene.name} className="w-full h-full object-cover" draggable={false} />
          ) : scene.type === 'text' ? (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: scene.bgColor || '#1a1a2e' }}>
              <Type className="w-2.5 h-2.5 text-yellow-400/60" />
            </div>
          ) : scene.type === 'web' ? (
            <div className="w-full h-full flex items-center justify-center bg-cyan-900/20">
              <Globe className="w-2.5 h-2.5 text-cyan-400/40" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <SceneIcon type={scene.type} size={8} />
            </div>
          )}

          {/* Status badge */}
          {isCurrent && (
            <div className="absolute top-0 right-0 bg-red-500 text-white text-[5px] px-0.5 rounded-bl font-bold z-10 leading-tight">
              LIVE
            </div>
          )}
          {isNext && !isCurrent && (
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[5px] px-0.5 rounded-bl font-bold z-10 leading-tight">
              NEXT
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-[7px] text-zinc-300 truncate flex-1 leading-tight">{scene.name}</p>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity flex-shrink-0"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  )
}

// === PPTX DETAIL PANEL ===
function PptxDetailPanel({
  scenes,
  pptxGroupId,
  currentSceneIndex,
  nextSceneIndex,
  onSelectSlide,
  onDeleteSlide,
  onDeleteGroup,
  onMoveSlide,
}: {
  scenes: Scene[]
  pptxGroupId: string
  currentSceneIndex: number
  nextSceneIndex: number
  onSelectSlide: (index: number) => void
  onDeleteSlide: (id: string) => void
  onDeleteGroup: () => void
  onMoveSlide: (id: string, direction: 'up' | 'down') => void
}) {
  const groupSlides = scenes.filter((s) => s.pptxFileId === pptxGroupId)
  const fileName = groupSlides[0]?.pptxFileName || 'PPTX'

  return (
    <div className="p-2 bg-orange-900/10 border border-orange-700/20 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileBox className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[10px] font-medium text-orange-200 truncate max-w-[120px]">{fileName}</span>
          <span className="text-[8px] text-orange-400/60">{groupSlides.length} slide</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeleteGroup}
          className="text-red-400 hover:text-red-300 h-5 w-5 p-0"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <ScrollArea className="max-h-[150px]">
        <div className="space-y-0.5">
          {groupSlides.map((slide) => {
            const globalIdx = scenes.findIndex((s) => s.id === slide.id)
            const isCurrent = globalIdx === currentSceneIndex
            const isNext = globalIdx === nextSceneIndex
            return (
              <div
                key={slide.id}
                className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer transition-colors ${
                  isCurrent ? 'bg-red-900/30 border border-red-500/30' :
                  isNext ? 'bg-emerald-900/30 border border-emerald-500/30' :
                  'bg-zinc-800/50 hover:bg-zinc-800 border border-transparent'
                }`}
                onClick={() => onSelectSlide(globalIdx)}
              >
                <span className="text-[8px] font-bold text-zinc-500 w-3 text-center">{globalIdx + 1}</span>
                <div className="w-6 h-4 rounded overflow-hidden bg-black flex-shrink-0">
                  {slide.src && <img src={slide.src} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="text-[9px] text-zinc-300 truncate flex-1">{slide.name}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'up') }} className="text-zinc-500 hover:text-zinc-300">
                    <MoveUp className="w-2.5 h-2.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'down') }} className="text-zinc-500 hover:text-zinc-300">
                    <MoveDown className="w-2.5 h-2.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteSlide(slide.id) }} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// === IMAGE DETAIL PANEL ===
function ImageDetailPanel({ scene, onUpdate, onDelete }: { scene: Scene; onUpdate: (updates: Partial<Scene>) => void; onDelete: () => void }) {
  const [scale, setScale] = useState(100)

  return (
    <div className="p-2 bg-blue-900/10 border border-blue-700/20 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] font-medium text-blue-200 truncate max-w-[120px]">{scene.name}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 h-5 w-5 p-0">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <ZoomOut className="w-3 h-3 text-zinc-500" />
        <Slider
          value={[scale]}
          onValueChange={([v]) => { setScale(v); onUpdate({ name: scene.name }) }}
          min={25}
          max={200}
          step={5}
          className="flex-1"
        />
        <ZoomIn className="w-3 h-3 text-zinc-500" />
        <span className="text-[8px] text-zinc-400 w-7 text-right">{scale}%</span>
      </div>

      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setScale(100)} className="text-zinc-400 hover:text-white h-5 text-[8px] px-1.5">
          <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setScale(200)} className="text-zinc-400 hover:text-white h-5 text-[8px] px-1.5">
          <Maximize2 className="w-2.5 h-2.5 mr-0.5" /> Fit
        </Button>
      </div>
    </div>
  )
}

// === VIDEO DETAIL PANEL ===
function VideoDetailPanel({ scene, onUpdate, onDelete }: { scene: Scene; onUpdate: (updates: Partial<Scene>) => void; onDelete: () => void }) {
  const [trimStart, setTrimStart] = useState(scene.trimStart !== undefined ? String(scene.trimStart) : '')
  const [trimEnd, setTrimEnd] = useState(scene.trimEnd !== undefined ? String(scene.trimEnd) : '')
  const [videoPaused, setVideoPausedLocal] = useState(false)

  const handleApplyTrim = () => {
    const ts = trimStart ? parseFloat(trimStart) : undefined
    const te = trimEnd ? parseFloat(trimEnd) : undefined
    onUpdate({ trimStart: ts, trimEnd: te })
    toast.success('Đã áp dụng cắt video')
  }

  const handleClearTrim = () => {
    setTrimStart('')
    setTrimEnd('')
    onUpdate({ trimStart: undefined, trimEnd: undefined })
    toast.success('Đã xoá cắt video')
  }

  const handlePauseToggle = () => {
    const newPaused = !videoPaused
    setVideoPausedLocal(newPaused)
    setVideoPaused(newPaused)
  }

  return (
    <div className="p-2 bg-purple-900/10 border border-purple-700/20 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-medium text-purple-200 truncate max-w-[120px]">{scene.name}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={handlePauseToggle} className="text-purple-400 hover:text-purple-300 h-5 w-5 p-0">
            {videoPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 h-5 w-5 p-0">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Trim controls */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Scissors className="w-2.5 h-2.5 text-purple-400" />
          <span className="text-[8px] text-purple-300">Cắt video</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-zinc-500 w-6">Bắt đầu</span>
          <Input
            type="number"
            value={trimStart}
            onChange={(e) => setTrimStart(e.target.value)}
            placeholder="0"
            className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 flex-1"
            min={0}
            step={0.1}
          />
          <span className="text-[7px] text-zinc-500">giây</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-zinc-500 w-6">Kết thúc</span>
          <Input
            type="number"
            value={trimEnd}
            onChange={(e) => setTrimEnd(e.target.value)}
            placeholder="hết"
            className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 flex-1"
            min={0}
            step={0.1}
          />
          <span className="text-[7px] text-zinc-500">giây</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={handleApplyTrim} className="bg-purple-600 hover:bg-purple-700 text-white text-[8px] h-5 px-1.5">
            Áp dụng
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClearTrim} className="text-zinc-400 text-[8px] h-5 px-1.5">
            Xoá cắt
          </Button>
        </div>
      </div>
    </div>
  )
}

// === TEXT DETAIL PANEL ===
function TextDetailPanel({ scene, onUpdate, onDelete }: { scene: Scene; onUpdate: (updates: Partial<Scene>) => void; onDelete: () => void }) {
  const [content, setContent] = useState(scene.content || '')
  const [fontSize, setFontSize] = useState(scene.fontSize || 48)
  const [fontColor, setFontColor] = useState(scene.fontColor || '#ffffff')
  const [bgColor, setBgColor] = useState(scene.bgColor || '#1a1a2e')
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(scene.textAlign || 'center')
  const [isRunning, setIsRunning] = useState(false)

  const handleApply = () => {
    onUpdate({
      content,
      fontSize,
      fontColor,
      bgColor,
      textAlign,
    })
    toast.success('Đã cập nhật nội dung')
  }

  return (
    <div className="p-2 bg-yellow-900/10 border border-yellow-700/20 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[10px] font-medium text-yellow-200">Chữ</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 h-5 w-5 p-0">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nhập nội dung..."
        className="bg-zinc-900 border-zinc-600 text-zinc-200 text-[10px] min-h-[40px] resize-y"
        rows={2}
      />

      <div className="flex items-center gap-1">
        <span className="text-[7px] text-zinc-500 w-6">Cỡ chữ</span>
        <Slider
          value={[fontSize]}
          onValueChange={([v]) => setFontSize(v)}
          min={12}
          max={200}
          step={2}
          className="flex-1"
        />
        <span className="text-[8px] text-zinc-400 w-6 text-right">{fontSize}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-zinc-500">Chữ</span>
          <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-0" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-zinc-500">Nền</span>
          <input type="color" value={bgColor.startsWith('rgba') || bgColor.startsWith('rgb') ? '#1a1a2e' : bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-0" />
        </div>
        <div className="flex items-center gap-0.5 border-l border-zinc-700 pl-1">
          <button onClick={() => setTextAlign('left')} className={`p-0.5 rounded ${textAlign === 'left' ? 'bg-yellow-600/30 text-yellow-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <AlignLeft className="w-3 h-3" />
          </button>
          <button onClick={() => setTextAlign('center')} className={`p-0.5 rounded ${textAlign === 'center' ? 'bg-yellow-600/30 text-yellow-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <AlignCenter className="w-3 h-3" />
          </button>
          <button onClick={() => setTextAlign('right')} className={`p-0.5 rounded ${textAlign === 'right' ? 'bg-yellow-600/30 text-yellow-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <AlignRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex gap-1">
        <Button size="sm" onClick={handleApply} className="bg-yellow-600 hover:bg-yellow-700 text-black text-[8px] h-5 px-1.5 font-medium">
          Áp dụng
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsRunning(!isRunning)} className={`text-[8px] h-5 px-1.5 ${isRunning ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {isRunning ? 'Dừng chạy chữ' : 'Chạy chữ'}
        </Button>
      </div>
    </div>
  )
}

// === WEB DETAIL PANEL ===
function WebDetailPanel({ scene, onUpdate, onDelete }: { scene: Scene; onUpdate: (updates: Partial<Scene>) => void; onDelete: () => void }) {
  const [zoom, setZoom] = useState(100)
  const [url, setUrl] = useState(scene.url || '')

  return (
    <div className="p-2 bg-cyan-900/10 border border-cyan-700/20 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-medium text-cyan-200 truncate max-w-[120px]">{scene.name}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 h-5 w-5 p-0">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[7px] text-zinc-500">URL</span>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 flex-1"
          placeholder="https://..."
          onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate({ url }); toast.success('Đã cập nhật URL') } }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <ZoomOut className="w-3 h-3 text-zinc-500" />
        <Slider
          value={[zoom]}
          onValueChange={([v]) => setZoom(v)}
          min={25}
          max={200}
          step={10}
          className="flex-1"
        />
        <ZoomIn className="w-3 h-3 text-zinc-500" />
        <span className="text-[8px] text-zinc-400 w-7 text-right">{zoom}%</span>
      </div>

      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setZoom(100)} className="text-zinc-400 hover:text-white h-5 text-[8px] px-1.5">
          <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Reset zoom
        </Button>
        <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 h-5 text-[8px] px-1.5">
          <Maximize2 className="w-2.5 h-2.5 mr-0.5" /> Tương tác
        </Button>
      </div>
    </div>
  )
}

// === MAIN SCENE LIST ===
export function SceneList() {
  const {
    scenes,
    currentSceneIndex,
    nextSceneIndex,
    selectAsNext,
    removeScene,
    reorderScenes,
    addScene,
    clearAllScenes,
    updateScene,
    moveNextToPosition,
  } = usePresentationStore()

  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectedSceneId, setSelectedSceneId } = usePresentationStore()

  // Auto-select first scene when scenes load and none selected
  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id)
    }
  }, [scenes.length, selectedSceneId, scenes, setSelectedSceneId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id)
      const newIndex = scenes.findIndex((s) => s.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderScenes(oldIndex, newIndex)
      }
    }
  }

  // === ADD VIDEO WITH THUMBNAIL ===
  const addVideoScene = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    const thumbnail = await generateVideoThumbnail(url)
    addScene({
      type: 'video',
      name: file.name,
      src: url,
      thumbnail: thumbnail || undefined,
    })
  }, [addScene])

  // === DRAG & DROP FILE SUPPORT ===
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        addScene({ type: 'image', name: file.name, src: url, thumbnail: url })
      } else if (file.type.startsWith('video/')) {
        await addVideoScene(file)
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${++pptxCounter}-${file.name}`
          for (const slide of slides) {
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: slide.src,
              slideIndex: slide.index,
              pptxFileId,
              pptxFileName: file.name,
            })
          }
          toast.success(`Đã trích xuất ${slides.length} slide từ "${file.name}"`)
        } catch (err) {
          console.error('Error parsing PPTX:', err)
          toast.error(`Lỗi khi đọc file "${file.name}"`)
        }
      }
    }
  }, [addScene, addVideoScene])

  // === QUICK BATCH FILE UPLOAD ===
  const handleQuickUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        addScene({ type: 'image', name: file.name, src: url, thumbnail: url })
      } else if (file.type.startsWith('video/')) {
        await addVideoScene(file)
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${++pptxCounter}-${file.name}`
          for (const slide of slides) {
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: slide.src,
              slideIndex: slide.index,
              pptxFileId,
              pptxFileName: file.name,
            })
          }
          toast.success(`Đã trích xuất ${slides.length} slide từ "${file.name}"`)
        } catch (err) {
          console.error('Error parsing PPTX:', err)
          toast.error(`Lỗi khi đọc file "${file.name}"`)
        }
      }
    }
    e.target.value = ''
  }, [addScene, addVideoScene])

  // Handle clicking a grid item → set it as NEXT, or toggle off if same
  const handleItemClick = useCallback((index: number) => {
    const clickedId = scenes[index]?.id || null
    if (selectedSceneId === clickedId) {
      // Toggle off
      setSelectedSceneId(null)
    } else {
      selectAsNext(index)
      setSelectedSceneId(clickedId)
    }
  }, [selectAsNext, scenes, selectedSceneId, setSelectedSceneId])

  // Handle editing order number
  const handleOrderChange = useCallback((sceneId: string, newOrder: number) => {
    const idx = scenes.findIndex((s) => s.id === sceneId)
    if (idx >= 0 && newOrder >= 1 && newOrder <= scenes.length) {
      reorderScenes(idx, newOrder - 1)
    }
  }, [scenes, reorderScenes])

  // Delete PPTX group
  const deletePptxGroup = useCallback((groupId: string) => {
    const groupSlides = scenes.filter((s) => s.pptxFileId === groupId)
    for (const slide of groupSlides) {
      removeScene(slide.id)
    }
    if (selectedSceneId && groupSlides.some(s => s.id === selectedSceneId)) {
      setSelectedSceneId(null)
    }
    toast.success(`Đã xoá ${groupSlides.length} slide`)
  }, [scenes, removeScene, selectedSceneId, setSelectedSceneId])

  // Move slide within PPTX group
  const handleMoveSlide = useCallback((slideId: string, direction: 'up' | 'down') => {
    const idx = scenes.findIndex((s) => s.id === slideId)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx >= 0 && targetIdx < scenes.length) {
      reorderScenes(idx, targetIdx)
    }
  }, [scenes, reorderScenes])

  // Build the display list (group PPTX slides together in the grid)
  // For the grid, each item (including PPTX groups) is one box
  const pptxGroups = new Map<string, { fileName: string; slides: Scene[]; firstIndex: number }>()
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (scene.type === 'pptx-slide' && scene.pptxFileId) {
      const group = pptxGroups.get(scene.pptxFileId)
      if (group) {
        group.slides.push(scene)
      } else {
        pptxGroups.set(scene.pptxFileId, {
          fileName: scene.pptxFileName || scene.pptxFileId,
          slides: [scene],
          firstIndex: i,
        })
      }
    }
  }

  // Get the selected scene - for PPTX groups, use the first slide
  const selectedScene = selectedSceneId ? scenes.find((s) => s.id === selectedSceneId) || 
    (pptxGroups.has(selectedSceneId) ? pptxGroups.get(selectedSceneId)!.slides[0] : null) : null

  // Build render items for the grid
  const gridItems: Array<{
    type: 'scene' | 'pptx-group'
    scene?: Scene
    groupId?: string
    groupFileName?: string
    groupFirstSlide?: Scene
    displayIndex: number
    sceneIndex: number
  }> = []

  const seenGroups = new Set<string>()
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (scene.type === 'pptx-slide' && scene.pptxFileId) {
      if (!seenGroups.has(scene.pptxFileId)) {
        seenGroups.add(scene.pptxFileId)
        const group = pptxGroups.get(scene.pptxFileId)
        gridItems.push({
          type: 'pptx-group',
          groupId: scene.pptxFileId,
          groupFileName: group?.fileName,
          groupFirstSlide: group?.slides[0],
          displayIndex: i + 1,
          sceneIndex: i,
        })
      }
    } else {
      gridItems.push({
        type: 'scene',
        scene,
        displayIndex: i + 1,
        sceneIndex: i,
      })
    }
  }

  // Build visible scene IDs for SortableContext
  const visibleSceneIds: string[] = []
  for (const item of gridItems) {
    if (item.type === 'scene' && item.scene) {
      visibleSceneIds.push(item.scene.id)
    } else if (item.type === 'pptx-group' && item.groupId) {
      // Use the first slide's ID for the group box
      if (item.groupFirstSlide) {
        visibleSceneIds.push(item.groupFirstSlide.id)
      }
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-emerald-600/10 border-2 border-dashed border-emerald-500 rounded-lg z-10 flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs text-emerald-400 font-medium">Thả file vào đây</p>
            <p className="text-[9px] text-emerald-400/60">Ảnh, Video, PPTX</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex-1">
          Danh sách
        </h3>
        {scenes.length > 0 && (
          <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">
            {scenes.length} mục
          </span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {scenes.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Xoá tất cả ${scenes.length} thành phần?`)) {
                      clearAllScenes()
                      setSelectedSceneId(null)
                      toast.success('Đã xoá tất cả thành phần')
                    }
                  }}
                  className="text-zinc-500 hover:text-red-400 h-6 w-6 p-0"
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
                Xoá tất cả
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="text-zinc-400 hover:text-emerald-400 h-6 w-6 p-0"
              >
                <Upload className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
              Thêm nhiều file cùng lúc
            </TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pptx"
            onChange={handleQuickUpload}
            className="hidden"
          />
          <AddSceneDialog />
        </div>
      </div>

      {/* Grid of scene boxes - 3 per row */}
      <ScrollArea className="flex-1 min-h-0">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <ImageIcon className="w-10 h-10 mb-2 opacity-30" aria-hidden />
            <p className="text-xs">Chưa có thành phần nào</p>
            <p className="text-[10px] mt-1">Nhấn &quot;+&quot; hoặc kéo thả file vào đây</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleSceneIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 gap-1">
                {gridItems.map((item) => {
                  if (item.type === 'pptx-group' && item.groupId) {
                    const firstSlide = item.groupFirstSlide
                    const groupId = item.groupId
                    const isSelected = selectedSceneId === groupId || 
                      Boolean(firstSlide && pptxGroups.get(groupId)?.slides.some(s => s.id === selectedSceneId))
                    const isNext = scenes.findIndex((s) => s.pptxFileId === groupId) === nextSceneIndex ||
                      Boolean(firstSlide && scenes.findIndex((s) => s.id === firstSlide.id) === nextSceneIndex)
                    const isCurrent = scenes.findIndex((s) => s.pptxFileId === groupId) === currentSceneIndex ||
                      Boolean(firstSlide && scenes.findIndex((s) => s.id === firstSlide.id) === currentSceneIndex)

                    return (
                      <SortableGridItem
                        key={groupId}
                        scene={firstSlide || { id: groupId, type: 'pptx-slide', name: item.groupFileName || 'PPTX', order: 0 }}
                        displayIndex={item.displayIndex}
                        isNext={isNext}
                        isCurrent={isCurrent}
                        onClick={() => {
                          const idx = scenes.findIndex((s) => s.pptxFileId === groupId)
                          if (idx >= 0) {
                            if (selectedSceneId === groupId) {
                              setSelectedSceneId(null)
                            } else {
                              selectAsNext(idx)
                              setSelectedSceneId(groupId)
                            }
                          }
                        }}
                        onDelete={() => deletePptxGroup(groupId)}
                      />
                    )
                  }

                  if (item.type === 'scene' && item.scene) {
                    const isNext = item.sceneIndex === nextSceneIndex
                    const isCurrent = item.sceneIndex === currentSceneIndex

                    return (
                      <SortableGridItem
                        key={item.scene.id}
                        scene={item.scene}
                        displayIndex={item.displayIndex}
                        isNext={isNext}
                        isCurrent={isCurrent}
                        onClick={() => handleItemClick(item.sceneIndex)}
                        onDelete={() => {
                          removeScene(item.scene!.id)
                          if (selectedSceneId === item.scene!.id) setSelectedSceneId(null)
                          toast.success(`Đã xoá "${item.scene!.name}"`)
                        }}
                      />
                    )
                  }

                  return null
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </ScrollArea>

      {/* Detail panel - shown at bottom when scene selected */}
      {selectedScene && (
        <div className="mt-1 border-t border-zinc-800 pt-1 overflow-y-auto max-h-[200px]" style={{ transition: 'max-height 0.2s ease' }}>
          {selectedScene.type === 'pptx-slide' && selectedScene.pptxFileId && (
            <PptxDetailPanel
              scenes={scenes}
              pptxGroupId={selectedScene.pptxFileId}
              currentSceneIndex={currentSceneIndex}
              nextSceneIndex={nextSceneIndex}
              onSelectSlide={(idx) => selectAsNext(idx)}
              onDeleteSlide={(id) => { removeScene(id); toast.success('Đã xoá slide') }}
              onDeleteGroup={() => {
                if (selectedScene.pptxFileId) {
                  const groupSlides = scenes.filter(s => s.pptxFileId === selectedScene.pptxFileId)
                  for (const slide of groupSlides) removeScene(slide.id)
                  setSelectedSceneId(null)
                  toast.success(`Đã xoá ${groupSlides.length} slide`)
                }
              }}
              onMoveSlide={handleMoveSlide}
            />
          )}
          {selectedScene.type === 'image' && (
            <ImageDetailPanel
              scene={selectedScene}
              onUpdate={(updates) => updateScene(selectedScene.id, updates)}
              onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá ảnh') }}
            />
          )}
          {selectedScene.type === 'video' && (
            <VideoDetailPanel
              scene={selectedScene}
              onUpdate={(updates) => updateScene(selectedScene.id, updates)}
              onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá video') }}
            />
          )}
          {selectedScene.type === 'text' && (
            <TextDetailPanel
              scene={selectedScene}
              onUpdate={(updates) => updateScene(selectedScene.id, updates)}
              onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá chữ') }}
            />
          )}
          {selectedScene.type === 'web' && (
            <WebDetailPanel
              scene={selectedScene}
              onUpdate={(updates) => updateScene(selectedScene.id, updates)}
              onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá web') }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// === SCENE DETAIL PANEL (extracted, uses store) ===
export function SceneDetailPanel() {
  const { scenes, selectedSceneId, setSelectedSceneId, currentSceneIndex, nextSceneIndex, selectAsNext, removeScene, updateScene, reorderScenes } = usePresentationStore()
  const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null

  // Also handle PPTX group selection
  const pptxGroups = new Map<string, { fileName: string; slides: Scene[]; firstIndex: number }>()
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (scene.type === 'pptx-slide' && scene.pptxFileId) {
      const group = pptxGroups.get(scene.pptxFileId)
      if (group) {
        group.slides.push(scene)
      } else {
        pptxGroups.set(scene.pptxFileId, {
          fileName: scene.pptxFileName || scene.pptxFileId,
          slides: [scene],
          firstIndex: i,
        })
      }
    }
  }

  if (!selectedScene) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Eye className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-[10px]">Chọn mục để xem chi tiết</p>
      </div>
    )
  }

  const handleDeletePptxGroup = () => {
    if (!selectedScene.pptxFileId) return
    const groupSlides = scenes.filter(s => s.pptxFileId === selectedScene.pptxFileId)
    for (const slide of groupSlides) removeScene(slide.id)
    setSelectedSceneId(null)
    toast.success(`Đã xoá ${groupSlides.length} slide`)
  }

  const handleMoveSlide = (slideId: string, direction: 'up' | 'down') => {
    const idx = scenes.findIndex(s => s.id === slideId)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx >= 0 && targetIdx < scenes.length) {
      reorderScenes(idx, targetIdx)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <SceneIcon type={selectedScene.type} size={14} />
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex-1 truncate">
          {selectedScene.name}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setSelectedSceneId(null)} className="text-zinc-500 hover:text-white h-5 w-5 p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {/* Detail panels */}
        {selectedScene.type === 'pptx-slide' && selectedScene.pptxFileId && (
          <PptxDetailPanel
            scenes={scenes}
            pptxGroupId={selectedScene.pptxFileId}
            currentSceneIndex={currentSceneIndex}
            nextSceneIndex={nextSceneIndex}
            onSelectSlide={(idx) => selectAsNext(idx)}
            onDeleteSlide={(id) => { removeScene(id); toast.success('Đã xoá slide') }}
            onDeleteGroup={handleDeletePptxGroup}
            onMoveSlide={handleMoveSlide}
          />
        )}
        {selectedScene.type === 'image' && (
          <ImageDetailPanel
            scene={selectedScene}
            onUpdate={(updates) => updateScene(selectedScene.id, updates)}
            onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá ảnh') }}
          />
        )}
        {selectedScene.type === 'video' && (
          <VideoDetailPanel
            scene={selectedScene}
            onUpdate={(updates) => updateScene(selectedScene.id, updates)}
            onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá video') }}
          />
        )}
        {selectedScene.type === 'text' && (
          <TextDetailPanel
            scene={selectedScene}
            onUpdate={(updates) => updateScene(selectedScene.id, updates)}
            onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá chữ') }}
          />
        )}
        {selectedScene.type === 'web' && (
          <WebDetailPanel
            scene={selectedScene}
            onUpdate={(updates) => updateScene(selectedScene.id, updates)}
            onDelete={() => { removeScene(selectedScene.id); setSelectedSceneId(null); toast.success('Đã xoá web') }}
          />
        )}
      </ScrollArea>
    </div>
  )
}

// === TEXT OVERLAY TEMPLATES ===
const OVERLAY_TEMPLATES = [
  {
    id: 'lower-third',
    label: 'Thanh dưới',
    icon: '▬',
    fontSize: 36,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.75)',
    position: 'bottom' as const,
    animation: 'static' as const,
    scrollDuration: 15,
  },
  {
    id: 'scrolling-text',
    label: 'Chạy chữ',
    icon: '↔',
    fontSize: 40,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.7)',
    position: 'bottom' as const,
    animation: 'scroll' as const,
    scrollDuration: 15,
  },
  {
    id: 'center-title',
    label: 'Tiêu đề giữa',
    icon: '✦',
    fontSize: 64,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.6)',
    position: 'center' as const,
    animation: 'static' as const,
    scrollDuration: 15,
  },
  {
    id: 'corner-notify',
    label: 'Thông báo góc',
    icon: '📍',
    fontSize: 24,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.65)',
    position: 'top' as const,
    animation: 'static' as const,
    scrollDuration: 15,
  },
  {
    id: 'scrolling-top',
    label: 'Chạy chữ trên',
    icon: '📢',
    fontSize: 32,
    fontColor: '#ffffff',
    bgColor: 'rgba(200,0,0,0.8)',
    position: 'top' as const,
    animation: 'scroll' as const,
    scrollDuration: 20,
  },
]

/**
 * Text overlay management panel with preset templates
 */
export function TextOverlayPanel() {
  const { textOverlays, addTextOverlay, removeTextOverlay, toggleTextOverlay, updateTextOverlay } =
    usePresentationStore()
  const [newText, setNewText] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formFontSize, setFormFontSize] = useState(32)
  const [formFontColor, setFormFontColor] = useState('#ffffff')
  const [formBgColor, setFormBgColor] = useState('rgba(0,0,0,0.7)')
  const [formPosition, setFormPosition] = useState<'top' | 'bottom' | 'center'>('bottom')
  const [formAnimation, setFormAnimation] = useState<'static' | 'scroll' | 'typewriter'>('static')
  const [formScrollDuration, setFormScrollDuration] = useState(15)

  const resetForm = () => {
    setNewText('')
    setFormFontSize(32)
    setFormFontColor('#ffffff')
    setFormBgColor('rgba(0,0,0,0.7)')
    setFormPosition('bottom')
    setFormAnimation('static')
    setFormScrollDuration(15)
    setShowForm(false)
  }

  const handleAdd = () => {
    if (!newText.trim()) return
    addTextOverlay({
      text: newText,
      visible: false,
      fontSize: formFontSize,
      fontColor: formFontColor,
      bgColor: formBgColor,
      position: formPosition,
      animation: formAnimation,
      scrollDuration: formScrollDuration,
    })
    resetForm()
    toast.success('Đã thêm thông báo')
  }

  const applyTemplate = (template: typeof OVERLAY_TEMPLATES[number]) => {
    setFormFontSize(template.fontSize)
    setFormFontColor(template.fontColor)
    setFormBgColor(template.bgColor)
    setFormPosition(template.position)
    setFormAnimation(template.animation || 'static')
    setFormScrollDuration(template.scrollDuration || 15)
    if (!showForm) setShowForm(true)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Bell className="w-3 h-3" />
          Thông báo
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowForm(!showForm)}
          className="text-emerald-400 hover:text-emerald-300 h-5 w-5 p-0"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex gap-0.5 mb-1.5 flex-wrap">
        {OVERLAY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => applyTemplate(template)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[9px] text-zinc-400 hover:text-zinc-200 transition-colors"
            title={template.label}
          >
            <span className="text-[10px]">{template.icon}</span>
            <span>{template.label}</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="mb-1.5 p-1.5 bg-zinc-800 rounded-md space-y-1">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nhập thông báo..."
            className="bg-zinc-700 border-zinc-600 text-zinc-200 text-[10px] h-6"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-zinc-500">Cỡ</span>
              <Input
                type="number"
                value={formFontSize}
                onChange={(e) => setFormFontSize(Number(e.target.value))}
                className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 w-12"
                min={8}
                max={200}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-zinc-500">Vị trí</span>
              <Select value={formPosition} onValueChange={(v) => setFormPosition(v as 'top' | 'bottom' | 'center')}>
                <SelectTrigger className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-600">
                  <SelectItem value="top" className="text-[9px]">Trên</SelectItem>
                  <SelectItem value="center" className="text-[9px]">Giữa</SelectItem>
                  <SelectItem value="bottom" className="text-[9px]">Dưới</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-zinc-500">Chữ</span>
              <input type="color" value={formFontColor} onChange={(e) => setFormFontColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-zinc-500">Nền</span>
              <input
                type="color"
                value={formBgColor.startsWith('rgba') || formBgColor.startsWith('rgb') ? '#000000' : formBgColor}
                onChange={(e) => setFormBgColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-zinc-500">Kiểu</span>
            <Select value={formAnimation} onValueChange={(v) => setFormAnimation(v as 'static' | 'scroll' | 'typewriter')}>
              <SelectTrigger className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-600">
                <SelectItem value="static" className="text-[9px]">Tĩnh</SelectItem>
                <SelectItem value="scroll" className="text-[9px]">Chạy chữ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formAnimation === 'scroll' && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-zinc-500">Tốc độ</span>
              <Input
                type="number"
                value={formScrollDuration}
                onChange={(e) => setFormScrollDuration(Number(e.target.value))}
                className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 w-12"
                min={5}
                max={60}
              />
              <span className="text-[8px] text-zinc-500">giây</span>
            </div>
          )}
          <div className="flex gap-1">
            <Button size="sm" onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-5 px-2">
              Thêm
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm} className="text-zinc-400 text-[9px] h-5 px-2">
              Hủy
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {textOverlays.length === 0 ? (
          <p className="text-[9px] text-zinc-600 text-center py-2">
            Thêm thông báo chữ để hiện trên màn hình chiếu
          </p>
        ) : (
          <div className="space-y-0.5">
            {textOverlays.map((overlay) => (
              <div key={overlay.id} className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-zinc-800/50 group">
                <button onClick={() => toggleTextOverlay(overlay.id)} className="flex-shrink-0">
                  {overlay.visible ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
                </button>
                <span className="text-[10px] text-zinc-300 truncate flex-1">{overlay.text}</span>
                <span className="text-[8px] text-zinc-600">{overlay.fontSize}px {overlay.animation === 'scroll' ? '↔' : ''}</span>
                <button onClick={() => removeTextOverlay(overlay.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

/**
 * Control Panel - with projection buttons
 */
const SCREEN_PRESETS = [
  { label: '16:9 (1920×1080)', value: '16:9', width: 1920, height: 1080 },
  { label: '4:3 (1024×768)', value: '4:3', width: 1024, height: 768 },
  { label: '16:10 (1680×1050)', value: '16:10', width: 1680, height: 1050 },
  { label: 'Tuỳ chỉnh', value: 'custom', width: 0, height: 0 },
] as const

export function ControlPanel() {
  const {
    scenes,
    currentSceneIndex,
    nextSceneIndex,
    isLive,
    blackScreen,
    goNext,
    goPrev,
    goLive,
    stopLive,
    toggleBlackScreen,
    setOutputWindowRef,
    transitionType,
    transitionDuration,
    setTransitionType,
    setTransitionDuration,
    videoVolume,
    videoMuted,
    setVideoVolume,
    setVideoMuted,
    loadProject,
    saveProject,
    screenSize,
    setScreenSize,
    updateScene,
  } = usePresentationStore() as any

  const currentScene = scenes[currentSceneIndex]
  const isVideoScene = currentScene?.type === 'video'

  // Per-scene transition state
  const [useCustomTransition, setUseCustomTransition] = useState(false)
  const [customTransitionType, setCustomTransitionType] = useState<TransitionType>('fade')
  const [customTransitionDuration, setCustomTransitionDuration] = useState(600)

  // Video pause state
  const [videoPaused, setVideoPausedLocal] = useState(false)

  // Screen size
  const [screenPreset, setScreenPreset] = useState<string>(() => {
    const match = SCREEN_PRESETS.find((p) => p.width === screenSize?.width && p.height === screenSize?.height)
    return match ? match.value : 'custom'
  })
  const [customWidth, setCustomWidth] = useState(screenSize?.width || 1920)
  const [customHeight, setCustomHeight] = useState(screenSize?.height || 1080)

  // Video trim state
  const [trimStartInput, setTrimStartInput] = useState<string>('')
  const [trimEndInput, setTrimEndInput] = useState<string>('')

  // CloudConvert API key
  const [cloudConvertKey, setCloudConvertKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('showflow-cloudconvert-key') || ''
    }
    return ''
  })
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  // Sync state when current scene changes
  const [prevTransitionSceneId, setPrevTransitionSceneId] = useState<string | undefined>(currentScene?.id)
  if (currentScene?.id !== prevTransitionSceneId) {
    setPrevTransitionSceneId(currentScene?.id)
    if (currentScene?.sceneTransitionType) {
      setUseCustomTransition(true)
      setCustomTransitionType(currentScene.sceneTransitionType)
      setCustomTransitionDuration(currentScene.sceneTransitionDuration || 600)
    } else {
      setUseCustomTransition(false)
    }
    if (isVideoScene) {
      setTrimStartInput(currentScene.trimStart !== undefined ? currentScene.trimStart.toFixed(1) : '')
      setTrimEndInput(currentScene.trimEnd !== undefined ? currentScene.trimEnd.toFixed(1) : '')
    }
    setVideoPausedLocal(false)
  }

  const handleToggleCustomTransition = (checked: boolean) => {
    setUseCustomTransition(checked)
    if (currentScene) {
      if (checked) {
        updateScene(currentScene.id, { sceneTransitionType: customTransitionType, sceneTransitionDuration: customTransitionDuration })
      } else {
        updateScene(currentScene.id, { sceneTransitionType: undefined, sceneTransitionDuration: undefined })
      }
    }
  }

  const handleCustomTransitionTypeChange = (type: TransitionType) => {
    setCustomTransitionType(type)
    if (currentScene && useCustomTransition) {
      updateScene(currentScene.id, { sceneTransitionType: type })
    }
  }

  const handleCustomTransitionDurationChange = (duration: number) => {
    setCustomTransitionDuration(duration)
    if (currentScene && useCustomTransition) {
      updateScene(currentScene.id, { sceneTransitionDuration: duration })
    }
  }

  const handleVideoPauseToggle = () => {
    const newPaused = !videoPaused
    setVideoPausedLocal(newPaused)
    setVideoPaused(newPaused)
  }

  const handleScreenPresetChange = (value: string) => {
    setScreenPreset(value)
    const preset = SCREEN_PRESETS.find((p) => p.value === value)
    if (preset && preset.width > 0) {
      setScreenSize({ width: preset.width, height: preset.height })
      setCustomWidth(preset.width)
      setCustomHeight(preset.height)
    }
  }

  const handleCustomSizeChange = () => {
    const w = Math.max(320, Math.min(3840, customWidth))
    const h = Math.max(240, Math.min(2160, customHeight))
    setScreenSize({ width: w, height: h })
    setCustomWidth(w)
    setCustomHeight(h)
    toast.success(`Kích thước: ${w}×${h}`)
  }

  // === REMOTE CONNECTION === (removed - no longer using SSE/online projection)

  // === PROJECTION BUTTONS ===
  const [showProjectionGuide, setShowProjectionGuide] = useState(false)

  const handleStartProjection = async () => {
    if (scenes.length === 0) {
      toast.error('Chưa có nội dung để chiếu! Thêm ảnh/video/slide trước.')
      return
    }
    goLive()

    // Try to open output window - no position params (more reliable)
    try {
      const w = window.open('/output', 'showflow_output')
      if (w) {
        setOutputWindowRef(w)
        // Try to request fullscreen on the output window after it loads
        setTimeout(() => {
          try {
            if (!w.closed) {
              // Send fullscreen request via BroadcastChannel
              const bc = new BroadcastChannel('showflow-sync')
              bc.postMessage({ type: 'REQUEST_FULLSCREEN' })
              bc.close()
            }
          } catch {}
        }, 1500)
        toast.success('Đã mở cửa sổ trình chiếu!', { duration: 3000 })
      } else {
        toast('Popup bị chặn — Nhấn nút "Mở trang chiếu" bên dưới', { duration: 5000 })
      }
    } catch {
      toast('Không thể mở tự động — Nhấn nút "Mở trang chiếu" bên dưới', { duration: 5000 })
    }
    
    // Always show the guide
    setShowProjectionGuide(true)
  }

  const handleStopAll = () => {
    stopLive()
    const outputWin = usePresentationStore.getState().outputWindowRef
    if (outputWin && !outputWin.closed) {
      outputWin.close()
    }
    setOutputWindowRef(null)
    setShowProjectionGuide(false)
    toast.success('Đã tắt toàn bộ chiếu')
  }

  // === VIDEO TRIM HANDLERS ===
  const handleApplyTrim = () => {
    if (!isVideoScene || !currentScene) return
    const trimStart = trimStartInput ? parseFloat(trimStartInput) : undefined
    const trimEnd = trimEndInput ? parseFloat(trimEndInput) : undefined
    updateScene(currentScene.id, { trimStart, trimEnd })
    toast.success('Đã áp dụng cắt video')
  }

  const handleClearTrim = () => {
    if (!isVideoScene || !currentScene) return
    updateScene(currentScene.id, { trimStart: undefined, trimEnd: undefined })
    setTrimStartInput('')
    setTrimEndInput('')
    toast.success('Đã xoá cắt video')
  }

  return (
    <div className="flex flex-col h-full gap-1.5 overflow-y-auto">
      <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        Điều khiển
      </h3>

      {/* Section: Chiếu */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Chiếu</span>
        <div className="grid grid-cols-3 gap-1">
          <Button size="sm" onClick={handleStartProjection} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-7">
            <MonitorUp className="w-3 h-3 mr-1" /> Chiếu
          </Button>
          <Button size="sm" variant="ghost" onClick={handleStopAll} disabled={!isLive} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-[9px] h-7 border border-zinc-700">
            Dừng
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={toggleBlackScreen} className={`text-[9px] h-7 border ${blackScreen ? 'text-red-400 bg-red-900/20 border-red-500/50' : 'text-zinc-400 border-zinc-700 hover:text-white'}`}>
                <Square className="w-3 h-3 mr-1" /> Đen
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
              {blackScreen ? 'Bật hình' : 'Màn hình đen'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* Section: Điều hướng */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Điều hướng</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={goPrev} disabled={currentSceneIndex <= 0} className="text-zinc-400 hover:text-white h-7 flex-1 border border-zinc-700">
            <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Trước
          </Button>
          <span className="text-[10px] text-zinc-400 min-w-[36px] text-center tabular-nums font-mono font-bold">
            {scenes.length > 0 ? `${currentSceneIndex + 1}/${scenes.length}` : '0/0'}
          </span>
          <Button size="sm" variant="ghost" onClick={goNext} disabled={currentSceneIndex >= scenes.length - 1} className="text-zinc-400 hover:text-white h-7 flex-1 border border-zinc-700">
            Tiếp <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* Section: Hiệu ứng */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Hiệu ứng</span>
        <Select value={customTransitionType} onValueChange={(v) => {
          setCustomTransitionType(v as TransitionType)
          if (currentScene) updateScene(currentScene.id, { sceneTransitionType: v as TransitionType })
        }}>
          <SelectTrigger className="h-6 bg-zinc-900 border-zinc-700 text-zinc-300 text-[9px]">
            <SelectValue placeholder="Hiệu ứng chuyển" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[200px]">
            {TRANSITION_GROUPS.map((group) => (
              <SelectGroup key={group.key}>
                <SelectLabel className="text-[9px] text-zinc-500">{group.label}</SelectLabel>
                {TRANSITION_OPTIONS.filter((o) => o.group === group.key).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[9px]">
                    {opt.icon} {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-zinc-500 w-8">Tốc độ</span>
          <Slider value={[customTransitionDuration]} onValueChange={([v]) => {
            setCustomTransitionDuration(v)
            if (currentScene) updateScene(currentScene.id, { sceneTransitionDuration: v })
          }} min={100} max={3000} step={50} className="flex-1" />
          <span className="text-[8px] text-zinc-400 w-8 text-right">{customTransitionDuration}ms</span>
        </div>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* Section: Âm thanh */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Âm thanh</span>
        <div className="flex items-center gap-1">
          <Volume2 className="w-3 h-3 text-zinc-500" />
          <Slider value={[videoVolume * 100]} onValueChange={([v]) => setVideoVolume(v / 100)} min={0} max={100} className="flex-1" />
          <button onClick={() => setVideoMuted(!videoMuted)} className="text-zinc-400 hover:text-white">
            {videoMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* Section: Kích thước */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Kích thước</span>
        <Select value={screenPreset} onValueChange={handleScreenPresetChange}>
          <SelectTrigger className="h-6 bg-zinc-900 border-zinc-700 text-zinc-300 text-[9px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {SCREEN_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-[9px]">{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {screenPreset === 'custom' && (
          <div className="flex items-center gap-1">
            <Input type="number" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 w-16" min={320} max={3840} />
            <span className="text-[8px] text-zinc-600">×</span>
            <Input type="number" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1 w-16" min={240} max={2160} />
            <Button size="sm" onClick={handleCustomSizeChange} className="h-5 text-[8px] px-1.5 bg-zinc-700 hover:bg-zinc-600">OK</Button>
          </div>
        )}
      </div>

      {/* Video controls (only when current is video) */}
      {isVideoScene && (
        <>
          <div className="h-px bg-zinc-800" />
          <div className="space-y-1 p-1.5 bg-zinc-800/50 rounded-md">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={handleVideoPauseToggle} className="text-purple-400 h-5 w-5 p-0">
              {videoPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>
            <span className="text-[8px] text-zinc-500">Video</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-zinc-500">Cắt</span>
            <Input type="number" value={trimStartInput} onChange={(e) => setTrimStartInput(e.target.value)} placeholder="0" className="h-4 bg-zinc-900 border-zinc-600 text-zinc-300 text-[8px] px-1 w-12" min={0} step={0.1} />
            <span className="text-[7px] text-zinc-600">→</span>
            <Input type="number" value={trimEndInput} onChange={(e) => setTrimEndInput(e.target.value)} placeholder="hết" className="h-4 bg-zinc-900 border-zinc-600 text-zinc-300 text-[8px] px-1 w-12" min={0} step={0.1} />
          </div>
        </div>
        </>
      )}

      <div className="h-px bg-zinc-800" />

      {/* Section: Dự án */}
      <div className="space-y-1">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium">Dự án</span>
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="ghost" onClick={saveProject} className="text-zinc-400 hover:text-white text-[9px] h-7 border border-zinc-700">
            <Save className="w-3 h-3 mr-1" /> Lưu
          </Button>
          <Button size="sm" variant="ghost" onClick={loadProject} className="text-zinc-400 hover:text-white text-[9px] h-7 border border-zinc-700">
            <FolderOpen className="w-3 h-3 mr-1" /> Mở
          </Button>
        </div>
      </div>

      {/* Projection Guide - always show when live */}
      {isLive && (
        <div className="p-2 bg-emerald-900/20 border border-emerald-700/30 rounded-md space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-emerald-300 font-bold uppercase">Trang chiếu</span>
            <button onClick={() => setShowProjectionGuide(!showProjectionGuide)} className="text-zinc-500 hover:text-zinc-300">
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showProjectionGuide ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {/* Always visible: Open output button */}
          <a
            href="/output"
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] rounded-md font-medium transition-colors w-full"
          >
            <MonitorUp className="w-4 h-4" /> Mở trang chiếu
          </a>
          
          {showProjectionGuide && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="text-[7px] text-zinc-400">
                  {isLive ? 'Đang chiếu — nội dung tự đồng bộ qua BroadcastChannel' : 'Chưa bật chiếu'}
                </span>
              </div>
              <p className="text-[7px] text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-bold">1.</span> Nhấn nút xanh phía trên để mở trang chiếu (không bị chặn popup)
              </p>
              <p className="text-[7px] text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-bold">2.</span> Kéo cửa sổ chiếu sang màn hình 2 (máy chiếu)
              </p>
              <p className="text-[7px] text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-bold">3.</span> Click vào màn hình chiếu hoặc nhấn <kbd className="px-0.5 py-px bg-zinc-700 rounded text-[7px]">F11</kbd> để toàn màn hình
              </p>
              <div className="flex items-center gap-1 pt-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + '/output').catch(() => {})
                    toast.success('Đã copy URL!')
                  }}
                  className="h-5 text-[8px] px-1.5 border border-zinc-700 text-zinc-400"
                >
                  <Copy className="w-2.5 h-2.5 mr-0.5" /> Copy URL
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CloudConvert API Key */}
      <div className="space-y-1">
        <button 
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="text-[8px] text-zinc-600 uppercase tracking-wider font-medium hover:text-zinc-400 transition-colors flex items-center gap-1"
        >
          <Settings className="w-2.5 h-2.5" /> PPTX Cloud
        </button>
        {showApiKeyInput && (
          <div className="p-1.5 bg-zinc-800/50 rounded-md space-y-1">
            <p className="text-[7px] text-zinc-500">API key để chuyển đổi PPTX chính xác (miễn phí 25 phút/ngày tại cloudconvert.com)</p>
            <div className="flex items-center gap-1">
              <Input
                type="password"
                value={cloudConvertKey}
                onChange={(e) => {
                  setCloudConvertKey(e.target.value)
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('showflow-cloudconvert-key', e.target.value)
                  }
                }}
                placeholder="CloudConvert API Key"
                className="h-5 bg-zinc-900 border-zinc-600 text-zinc-300 text-[8px] px-1 flex-1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
