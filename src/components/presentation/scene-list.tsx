'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType, Scene } from '@/store/presentation-store'
import { parsePptx, svgToDataUrl } from '@/lib/pptx-parser'
import { setVideoPaused, isVideoPaused } from './media-renderer'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Image,
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
  ChevronRight as ChevronRightIcon,
  Square,
  Play,
  Pause,
  Sparkles,
  Clock,
  Volume2,
  VolumeX,
  MonitorUp,
  Upload,
  Save,
  FolderOpen,
  Wifi,
  Copy,
  ExternalLink,
  Trash,
  Globe as GlobeIcon,
  Power,
  Scissors,
  Check,
  FileBox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Checkbox } from '@/components/ui/checkbox'

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

function SceneIcon({ type }: { type: Scene['type'] }) {
  switch (type) {
    case 'image':
      return <Image className="w-4 h-4 text-blue-400" aria-hidden />
    case 'video':
      return <Video className="w-4 h-4 text-purple-400" />
    case 'web':
      return <Globe className="w-4 h-4 text-cyan-400" />
    case 'text':
      return <Type className="w-4 h-4 text-yellow-400" />
    case 'pptx-slide':
      return <Presentation className="w-4 h-4 text-orange-400" />
    default:
      return null
  }
}

function SortableSceneItem({
  scene,
  isActive,
  onClick,
  onDelete,
}: {
  scene: Scene
  isActive: boolean
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

  // Determine thumbnail to show
  const thumbnailSrc = scene.thumbnail || (scene.type === 'pptx-slide' ? scene.src : undefined)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors group ${
        isActive
          ? 'bg-emerald-600/20 border border-emerald-500/50'
          : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <SceneIcon type={scene.type} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-200 truncate">{scene.name}</p>
        {/* Show trim info for video */}
        {scene.type === 'video' && (scene.trimStart !== undefined || scene.trimEnd !== undefined) && (
          <p className="text-[9px] text-zinc-500">
            {scene.trimStart !== undefined ? `${scene.trimStart.toFixed(1)}s` : '0s'}
            {' → '}
            {scene.trimEnd !== undefined ? `${scene.trimEnd.toFixed(1)}s` : 'hết'}
          </p>
        )}
        {/* Show per-scene transition indicator */}
        {scene.sceneTransitionType && (
          <p className="text-[9px] text-amber-400/70">
            ✦ {scene.sceneTransitionType} {scene.sceneTransitionDuration ? `${scene.sceneTransitionDuration}ms` : ''}
          </p>
        )}
      </div>
      {thumbnailSrc && (
        <div className="w-7 h-5 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
          <img src={thumbnailSrc} alt="Thumbnail" className="w-full h-full object-cover" />
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/** PPTX group header item */
function PptxGroupItem({
  fileName,
  slideCount,
  isExpanded,
  onToggle,
  onDeleteGroup,
  groupId,
}: {
  fileName: string
  slideCount: number
  isExpanded: boolean
  onToggle: () => void
  onDeleteGroup: () => void
  groupId: string
}) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-orange-900/20 border border-orange-700/30 cursor-pointer group transition-colors hover:bg-orange-900/30"
      onClick={onToggle}
    >
      <button className="text-orange-400 flex-shrink-0">
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRightIcon className="w-3.5 h-3.5" />
        )}
      </button>
      <FileBox className="w-4 h-4 text-orange-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-orange-200 truncate font-medium">{fileName}</p>
        <p className="text-[9px] text-orange-400/60">{slideCount} slide</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDeleteGroup()
        }}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function SceneList() {
  const { scenes, currentSceneIndex, setCurrentSceneIndex, removeScene, reorderScenes, addScene, clearAllScenes, updateScene } =
    usePresentationStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const [expandedPptxGroups, setExpandedPptxGroups] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id)
      const newIndex = scenes.findIndex((s) => s.id === over.id)
      reorderScenes(oldIndex, newIndex)
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
        addScene({
          type: 'image',
          name: file.name,
          src: url,
          thumbnail: url,
        })
      } else if (file.type.startsWith('video/')) {
        await addVideoScene(file)
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${++pptxCounter}-${file.name}`
          for (const slide of slides) {
            const dataUrl = svgToDataUrl(slide.svg)
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: dataUrl,
              slideIndex: slide.index,
              pptxFileId,
              pptxFileName: file.name,
            })
          }
          // Auto-expand new PPTX groups
          setExpandedPptxGroups((prev) => new Set([...prev, pptxFileId]))
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
        addScene({
          type: 'image',
          name: file.name,
          src: url,
          thumbnail: url,
        })
      } else if (file.type.startsWith('video/')) {
        await addVideoScene(file)
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${++pptxCounter}-${file.name}`
          for (const slide of slides) {
            const dataUrl = svgToDataUrl(slide.svg)
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: dataUrl,
              slideIndex: slide.index,
              pptxFileId,
              pptxFileName: file.name,
            })
          }
          setExpandedPptxGroups((prev) => new Set([...prev, pptxFileId]))
          toast.success(`Đã trích xuất ${slides.length} slide từ "${file.name}"`)
        } catch (err) {
          console.error('Error parsing PPTX:', err)
          toast.error(`Lỗi khi đọc file "${file.name}"`)
        }
      }
    }
    e.target.value = ''
  }, [addScene, addVideoScene])

  // Toggle PPTX group expand/collapse
  const togglePptxGroup = useCallback((groupId: string) => {
    setExpandedPptxGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  // Delete all slides in a PPTX group
  const deletePptxGroup = useCallback((groupId: string) => {
    const groupSlides = scenes.filter((s) => s.pptxFileId === groupId)
    for (const slide of groupSlides) {
      removeScene(slide.id)
    }
    toast.success(`Đã xoá ${groupSlides.length} slide`)
  }, [scenes, removeScene])

  // Build grouped scene list
  // Group PPTX slides by pptxFileId, show other scenes normally
  const pptxGroups = new Map<string, { fileName: string; slides: Scene[] }>()
  for (const scene of scenes) {
    if (scene.type === 'pptx-slide' && scene.pptxFileId) {
      const group = pptxGroups.get(scene.pptxFileId)
      if (group) {
        group.slides.push(scene)
      } else {
        pptxGroups.set(scene.pptxFileId, {
          fileName: scene.pptxFileName || scene.pptxFileId,
          slides: [scene],
        })
      }
    }
  }

  // Build the ordered render list: iterate through scenes, group PPTX together
  const renderedItems: Array<{
    type: 'scene' | 'pptx-group'
    scene?: Scene
    groupId?: string
    groupFileName?: string
    groupSlides?: Scene[]
    index: number
  }> = []

  const seenPptxGroups = new Set<string>()
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (scene.type === 'pptx-slide' && scene.pptxFileId) {
      if (!seenPptxGroups.has(scene.pptxFileId)) {
        seenPptxGroups.add(scene.pptxFileId)
        const group = pptxGroups.get(scene.pptxFileId)
        if (group) {
          renderedItems.push({
            type: 'pptx-group',
            groupId: scene.pptxFileId,
            groupFileName: group.fileName,
            groupSlides: group.slides,
            index: i,
          })
        }
      }
      // Skip individual slides - they're part of the group
    } else {
      renderedItems.push({
        type: 'scene',
        scene,
        index: i,
      })
    }
  }

  return (
    <div
      className="flex flex-col h-full relative"
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

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Danh sách
        </h3>
        <div className="flex items-center gap-1">
          {/* Clear all button */}
          {scenes.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Xoá tất cả ${scenes.length} thành phần?`)) {
                      clearAllScenes()
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
          {/* Quick batch upload button */}
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

      <ScrollArea className="flex-1">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <Image className="w-10 h-10 mb-2 opacity-30" aria-hidden />
            <p className="text-xs">Chưa có thành phần nào</p>
            <p className="text-[10px] mt-1">Nhấn &quot;+&quot; hoặc kéo thả file vào đây</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {renderedItems.map((item) => {
                  if (item.type === 'pptx-group' && item.groupId) {
                    const isExpanded = expandedPptxGroups.has(item.groupId)
                    return (
                      <div key={`group-${item.groupId}`}>
                        <PptxGroupItem
                          fileName={item.groupFileName || 'PPTX'}
                          slideCount={item.groupSlides?.length || 0}
                          isExpanded={isExpanded}
                          onToggle={() => togglePptxGroup(item.groupId!)}
                          onDeleteGroup={() => deletePptxGroup(item.groupId!)}
                          groupId={item.groupId}
                        />
                        {isExpanded && item.groupSlides && (
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {item.groupSlides.map((slide) => {
                              const globalIdx = scenes.findIndex((s) => s.id === slide.id)
                              return (
                                <SortableSceneItem
                                  key={slide.id}
                                  scene={slide}
                                  isActive={globalIdx === currentSceneIndex}
                                  onClick={() => setCurrentSceneIndex(globalIdx)}
                                  onDelete={() => {
                                    removeScene(slide.id)
                                    toast.success(`Đã xoá "${slide.name}"`)
                                  }}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (item.type === 'scene' && item.scene) {
                    return (
                      <SortableSceneItem
                        key={item.scene.id}
                        scene={item.scene}
                        isActive={item.index === currentSceneIndex}
                        onClick={() => setCurrentSceneIndex(item.index)}
                        onDelete={() => {
                          removeScene(item.scene!.id)
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
  },
  {
    id: 'scrolling-text',
    label: 'Chạy chữ',
    icon: '↔',
    fontSize: 40,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.7)',
    position: 'bottom' as const,
  },
  {
    id: 'center-title',
    label: 'Tiêu đề giữa',
    icon: '✦',
    fontSize: 64,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.6)',
    position: 'center' as const,
  },
  {
    id: 'corner-notify',
    label: 'Thông báo góc',
    icon: '📍',
    fontSize: 24,
    fontColor: '#ffffff',
    bgColor: 'rgba(0,0,0,0.65)',
    position: 'top' as const,
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
  // Form fields
  const [formFontSize, setFormFontSize] = useState(32)
  const [formFontColor, setFormFontColor] = useState('#ffffff')
  const [formBgColor, setFormBgColor] = useState('rgba(0,0,0,0.7)')
  const [formPosition, setFormPosition] = useState<'top' | 'bottom' | 'center'>('bottom')

  const resetForm = () => {
    setNewText('')
    setFormFontSize(32)
    setFormFontColor('#ffffff')
    setFormBgColor('rgba(0,0,0,0.7)')
    setFormPosition('bottom')
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
    })
    resetForm()
    toast.success('Đã thêm thông báo')
  }

  const applyTemplate = (template: typeof OVERLAY_TEMPLATES[number]) => {
    setFormFontSize(template.fontSize)
    setFormFontColor(template.fontColor)
    setFormBgColor(template.bgColor)
    setFormPosition(template.position)
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

      {/* Template presets row */}
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
              <input
                type="color"
                value={formFontColor}
                onChange={(e) => setFormFontColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0"
              />
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
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-5 px-2"
            >
              Thêm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={resetForm}
              className="text-zinc-400 text-[9px] h-5 px-2"
            >
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
              <div
                key={overlay.id}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-zinc-800/50 group"
              >
                <button onClick={() => toggleTextOverlay(overlay.id)} className="flex-shrink-0">
                  {overlay.visible ? (
                    <Eye className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-zinc-500" />
                  )}
                </button>
                <span className="text-[10px] text-zinc-300 truncate flex-1">{overlay.text}</span>
                <span className="text-[8px] text-zinc-600">{overlay.fontSize}px</span>
                <button
                  onClick={() => removeTextOverlay(overlay.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                >
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
 * Control Panel - with projection buttons at bottom
 * Now includes: per-scene transition, video pause/play, all existing controls
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

  // Screen size preset matching
  const [screenPreset, setScreenPreset] = useState<string>(() => {
    const match = SCREEN_PRESETS.find((p) => p.width === screenSize?.width && p.height === screenSize?.height)
    return match ? match.value : 'custom'
  })
  const [customWidth, setCustomWidth] = useState(screenSize?.width || 1920)
  const [customHeight, setCustomHeight] = useState(screenSize?.height || 1080)

  // Video trim state
  const [trimStartInput, setTrimStartInput] = useState<string>('')
  const [trimEndInput, setTrimEndInput] = useState<string>('')

  // Sync per-scene transition state when current scene changes
  // Using the "sync from props during render" pattern to avoid setState-in-effect lint
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

  // Per-scene transition handlers
  const handleToggleCustomTransition = (checked: boolean) => {
    setUseCustomTransition(checked)
    if (currentScene) {
      if (checked) {
        updateScene(currentScene.id, {
          sceneTransitionType: customTransitionType,
          sceneTransitionDuration: customTransitionDuration,
        })
      } else {
        updateScene(currentScene.id, {
          sceneTransitionType: undefined,
          sceneTransitionDuration: undefined,
        })
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

  // Video pause/play handler
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
    toast.success(`Kích thước màn hình: ${w}×${h}`)
  }

  // === REMOTE CONNECTION INFO ===
  const [localIp, setLocalIp] = useState<string>(typeof window !== 'undefined' ? window.location.hostname : '')
  const [showRemoteInfo, setShowRemoteInfo] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      pc.createOffer().then((offer) => pc.setLocalDescription(offer))
      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
        if (match && match[1] !== '0.0.0.0') {
          setLocalIp(match[1])
          pc.close()
        }
      }
    } catch { /* WebRTC not available */ }
  }, [])

  const outputUrl = localIp ? `http://${localIp}:${window.location.port || 3000}/output` : ''

  const copyUrl = () => {
    if (outputUrl) {
      navigator.clipboard.writeText(outputUrl).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openOutputInNewTab = () => {
    window.open('/output', '_blank')
  }

  // === PROJECTION BUTTONS ===
  const handleStartProjection = async () => {
    goLive()
    openOutputWindow()
    toast.success('Đã bắt đầu chiếu cục bộ')
  }

  const handleStartOnlineProjection = async () => {
    goLive()
    openOutputWindow()
    setShowRemoteInfo(true)
    toast.success('Đã bật chiếu online - chia sẻ URL cho thiết bị khác')
  }

  const handleStopAll = () => {
    stopLive()
    const outputWin = usePresentationStore.getState().outputWindowRef
    if (outputWin && !outputWin.closed) {
      outputWin.close()
    }
    setOutputWindowRef(null)
    toast.success('Đã tắt toàn bộ chiếu')
  }

  const openOutputWindow = () => {
    if ('presentation' in navigator) {
      const presentationRequest = new (navigator as any).PresentationRequest([
        window.location.href + '#output',
      ])
      presentationRequest.start().then(() => {}).catch(() => fallbackOpenWindow())
    } else {
      fallbackOpenWindow()
    }
  }

  const fallbackOpenWindow = () => {
    const w = window.open(
      '/output',
      'presentation_output',
      `width=${screenSize.width},height=${screenSize.height},menubar=no,toolbar=no,location=no,status=no`
    )
    if (w) {
      setOutputWindowRef(w)
      const checkLoaded = setInterval(() => {
        try {
          if (w.document && w.document.readyState === 'complete') {
            clearInterval(checkLoaded)
            const state = usePresentationStore.getState() as any
            const cs = state.scenes[state.currentSceneIndex]
            w.postMessage(
              {
                type: 'PRESENTATION_UPDATE',
                payload: state.blackScreen
                  ? { type: 'black' }
                  : cs
                    ? {
                        type: 'scene',
                        scene: cs,
                        overlays: state.textOverlays,
                        transitionType: cs.sceneTransitionType || state.transitionType,
                        transitionDuration: cs.sceneTransitionDuration || state.transitionDuration,
                        videoVolume: state.videoVolume,
                        videoMuted: state.videoMuted,
                      }
                    : { type: 'empty' },
              },
              window.location.origin
            )
          }
        } catch {
          clearInterval(checkLoaded)
        }
      }, 100)
    }
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
    <div className="flex flex-col h-full gap-1.5">
      <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        Điều khiển
      </h3>

      {/* Navigation row */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={goPrev}
          disabled={currentSceneIndex <= 0}
          className="text-zinc-400 hover:text-white h-7 w-7 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-zinc-400 min-w-[42px] text-center tabular-nums">
          {scenes.length > 0 ? `${currentSceneIndex + 1}/${scenes.length}` : '0/0'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={goNext}
          disabled={currentSceneIndex >= scenes.length - 1}
          className="text-zinc-400 hover:text-white h-7 w-7 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-zinc-700 mx-0.5" />

        {/* Black screen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleBlackScreen}
              className={`h-7 gap-1 px-2 ${blackScreen ? 'text-red-400 bg-red-400/10' : 'text-zinc-400 hover:text-white'}`}
            >
              <Square className="w-3.5 h-3.5" />
              <span className="text-[10px]">{blackScreen ? 'Bật hình' : 'Đen'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Đen/Bật màn hình (Phím B)
          </TooltipContent>
        </Tooltip>

        {/* Video pause/play button - only when video scene is active */}
        {isVideoScene && isLive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleVideoPauseToggle}
                className={`h-7 gap-1 px-2 ${videoPaused ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-white'}`}
              >
                {videoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="text-[10px]">{videoPaused ? 'Phát' : 'Dừng'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
              {videoPaused ? 'Phát video trên màn hình chiếu' : 'Tạm dừng video trên màn hình chiếu'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Per-scene transition row */}
      {currentScene && (
        <div className="bg-zinc-800/40 rounded-md p-1.5 space-y-1 border border-zinc-700/30">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="custom-transition"
              checked={useCustomTransition}
              onCheckedChange={(checked) => handleToggleCustomTransition(!!checked)}
              className="h-3 w-3 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <label htmlFor="custom-transition" className="text-[9px] text-zinc-400 cursor-pointer select-none">
              Hiệu ứng riêng cho slide này
            </label>
          </div>
          {useCustomTransition && (
            <div className="flex items-center gap-1.5 pl-1">
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <Select value={customTransitionType} onValueChange={(v) => handleCustomTransitionTypeChange(v as TransitionType)}>
                <SelectTrigger className="h-5 flex-1 min-w-0 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px]">
                  <SelectValue placeholder="Hiệu ứng" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[200px] overflow-y-auto">
                  {TRANSITION_GROUPS.map((group) => (
                    <SelectGroup key={group.key}>
                      <SelectLabel className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold px-2 pt-1">
                        {group.label}
                      </SelectLabel>
                      {TRANSITION_OPTIONS.filter((opt) => opt.group === group.key).map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-zinc-300 text-[9px] focus:bg-zinc-700 focus:text-white"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[10px]">{opt.icon}</span>
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {customTransitionType !== 'none' && (
                <div className="flex items-center gap-0.5 bg-zinc-900 rounded px-1 h-5">
                  <Clock className="w-2 h-2 text-zinc-500 flex-shrink-0" />
                  <Slider
                    value={[customTransitionDuration]}
                    onValueChange={([v]) => handleCustomTransitionDurationChange(v)}
                    min={200}
                    max={2000}
                    step={100}
                    className="w-10"
                  />
                  <span className="text-[8px] text-zinc-500 min-w-[24px]">{customTransitionDuration}ms</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Global transition row */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <Select value={transitionType} onValueChange={(v) => setTransitionType(v as TransitionType)}>
          <SelectTrigger className="h-6 flex-1 min-w-0 bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            <SelectValue placeholder="Hiệu ứng" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[280px] overflow-y-auto">
            {TRANSITION_GROUPS.map((group) => (
              <SelectGroup key={group.key}>
                <SelectLabel className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold px-2 pt-1.5">
                  {group.label}
                </SelectLabel>
                {TRANSITION_OPTIONS.filter((opt) => opt.group === group.key).map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-zinc-300 text-[10px] focus:bg-zinc-700 focus:text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {transitionType !== 'none' && (
          <div className="flex items-center gap-1 bg-zinc-800 rounded px-1.5 h-6">
            <Clock className="w-2.5 h-2.5 text-zinc-500 flex-shrink-0" />
            <Slider
              value={[transitionDuration]}
              onValueChange={([v]) => setTransitionDuration(v)}
              min={200}
              max={2000}
              step={100}
              className="w-14"
            />
            <span className="text-[9px] text-zinc-500 min-w-[28px]">{transitionDuration}ms</span>
          </div>
        )}
      </div>

      {/* Video volume (only when current scene is video) */}
      {isVideoScene && (
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setVideoMuted(!videoMuted)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {videoMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
              {videoMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            </TooltipContent>
          </Tooltip>
          <Slider
            value={[videoMuted ? 0 : videoVolume * 100]}
            onValueChange={([v]) => {
              setVideoVolume(v / 100)
              if (v > 0) setVideoMuted(false)
            }}
            min={0}
            max={100}
            step={5}
            className="w-20"
          />
          <span className="text-[9px] text-zinc-500">{videoMuted ? '0%' : `${Math.round(videoVolume * 100)}%`}</span>
        </div>
      )}

      {/* Video trim controls (only when current scene is video) */}
      {isVideoScene && (
        <div className="bg-zinc-800/60 rounded-md p-1.5 space-y-1.5 border border-zinc-700/50">
          <div className="flex items-center gap-1">
            <Scissors className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Cắt video</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-500 w-8">Bắt đầu</span>
            <Input
              type="number"
              value={trimStartInput}
              onChange={(e) => setTrimStartInput(e.target.value)}
              placeholder="0"
              className="h-5 flex-1 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1.5 min-w-0"
              min={0}
              step={0.5}
            />
            <span className="text-[9px] text-zinc-500">giây</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-500 w-8">Kết thúc</span>
            <Input
              type="number"
              value={trimEndInput}
              onChange={(e) => setTrimEndInput(e.target.value)}
              placeholder="cuối"
              className="h-5 flex-1 bg-zinc-900 border-zinc-600 text-zinc-300 text-[9px] px-1.5 min-w-0"
              min={0}
              step={0.5}
            />
            <span className="text-[9px] text-zinc-500">giây</span>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleApplyTrim}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-5 px-2 flex-1"
            >
              Áp dụng
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearTrim}
              className="text-zinc-400 hover:text-red-400 text-[9px] h-5 px-2"
            >
              Xoá cắt
            </Button>
          </div>
        </div>
      )}

      {/* Screen size selector */}
      <div className="flex items-center gap-1.5">
        <MonitorUp className="w-3 h-3 text-cyan-400 flex-shrink-0" />
        <Select value={screenPreset} onValueChange={handleScreenPresetChange}>
          <SelectTrigger className="h-6 flex-1 min-w-0 bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            <SelectValue placeholder="Kích thước" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {SCREEN_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value} className="text-zinc-300 text-[10px] focus:bg-zinc-700 focus:text-white">
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {screenPreset === 'custom' && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={customWidth}
              onChange={(e) => setCustomWidth(Number(e.target.value))}
              className="h-6 w-14 bg-zinc-800 border-zinc-700 text-zinc-300 text-[9px] px-1"
              min={320}
              max={3840}
            />
            <span className="text-zinc-600 text-[9px]">×</span>
            <Input
              type="number"
              value={customHeight}
              onChange={(e) => setCustomHeight(Number(e.target.value))}
              className="h-6 w-14 bg-zinc-800 border-zinc-700 text-zinc-300 text-[9px] px-1"
              min={240}
              max={2160}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCustomSizeChange}
              className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300"
            >
              <span className="text-[9px]">✓</span>
            </Button>
          </div>
        )}
        {screenPreset !== 'custom' && (
          <span className="text-[9px] text-zinc-600">{screenSize?.width}×{screenSize?.height}</span>
        )}
      </div>

      {/* === PROJECTION BUTTONS === */}
      <div className="flex items-center gap-1 pt-1 border-t border-zinc-800">
        <Button
          size="sm"
          onClick={isLive ? handleStopAll : handleStartProjection}
          className={`h-7 gap-1 px-3 flex-1 ${
            isLive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <MonitorUp className="w-3.5 h-3.5" />
          {isLive ? (
            <>
              <Pause className="w-3 h-3" />
              <span className="text-[10px]">Dừng</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span className="text-[10px]">Chiếu</span>
            </>
          )}
        </Button>

        <Button
          size="sm"
          onClick={handleStartOnlineProjection}
          className="h-7 gap-1 px-3 flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
          disabled={isLive}
        >
          <GlobeIcon className="w-3.5 h-3.5" />
          <span className="text-[10px]">Online</span>
        </Button>

        {isLive && (
          <Button
            size="sm"
            onClick={handleStopAll}
            className="h-7 gap-1 px-3 bg-red-800 hover:bg-red-900 text-white"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[10px]">Tắt hết</span>
          </Button>
        )}
      </div>

      {/* Project save/load + remote connection row */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                saveProject()
                toast.success('Đã lưu dự án')
              }}
              className="text-zinc-500 hover:text-emerald-400 h-6 gap-1 px-2"
            >
              <Save className="w-3 h-3" />
              <span className="text-[9px]">Lưu</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Lưu dự án vào trình duyệt
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                loadProject()
                toast.success('Đã mở dự án')
              }}
              className="text-zinc-500 hover:text-cyan-400 h-6 gap-1 px-2"
            >
              <FolderOpen className="w-3 h-3" />
              <span className="text-[9px]">Mở</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Mở dự án đã lưu
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRemoteInfo(!showRemoteInfo)}
              className={`h-6 gap-1 px-2 ${showRemoteInfo ? 'text-cyan-400' : 'text-zinc-500 hover:text-cyan-400'}`}
            >
              <Wifi className="w-3 h-3" />
              <span className="text-[9px]">Thiết bị khác</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Chiếu từ thiết bị khác qua mạng LAN
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Remote connection info panel */}
      {showRemoteInfo && (
        <div className="bg-zinc-800/80 rounded-md p-2 space-y-2 border border-zinc-700">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Chiếu từ thiết bị khác</span>
          </div>

          <p className="text-[9px] text-zinc-400 leading-relaxed">
            Mở URL bên dưới trên thiết bị khác (cùng mạng WiFi/LAN) để hiển thị màn hình chiếu:
          </p>

          {outputUrl && (
            <div className="flex items-center gap-1 bg-zinc-900 rounded px-2 py-1.5 border border-zinc-600">
              <code className="text-[10px] text-emerald-400 font-mono flex-1 truncate">{outputUrl}</code>
              <button
                onClick={copyUrl}
                className="text-zinc-400 hover:text-white transition-colors flex-shrink-0"
              >
                {copied ? (
                  <span className="text-[8px] text-emerald-400">Đã copy!</span>
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          )}

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={openOutputInNewTab}
              className="text-[9px] text-zinc-400 hover:text-white h-5 gap-1 px-2"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Mở tab mới
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyUrl}
              className="text-[9px] text-zinc-400 hover:text-white h-5 gap-1 px-2"
            >
              <Copy className="w-2.5 h-2.5" />
              Copy URL
            </Button>
          </div>

          <div className="text-[8px] text-zinc-600 leading-relaxed pt-1 border-t border-zinc-700">
            <p>• Cả 2 thiết bị phải cùng mạng WiFi/LAN</p>
            <p>• Nhấn &quot;Chiếu&quot; hoặc &quot;Online&quot; trước khi mở URL trên thiết bị khác</p>
            <p>• Nhấn fullscreen trên thiết bị chiếu</p>
          </div>
        </div>
      )}
    </div>
  )
}
