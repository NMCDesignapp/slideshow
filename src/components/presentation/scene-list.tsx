'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType, Scene } from '@/store/presentation-store'
import { parsePptx, svgToDataUrl } from '@/lib/pptx-parser'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddSceneDialog } from './add-scene-dialog'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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

function SceneIcon({ type }: { type: Scene['type'] }) {
  switch (type) {
    case 'image':
      return <Image className="w-4 h-4 text-blue-400" />
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
      </div>
      {scene.type === 'image' && scene.thumbnail && (
        <div className="w-7 h-5 rounded overflow-hidden flex-shrink-0">
          <img src={scene.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
        </div>
      )}
      {(scene.type === 'pptx-slide') && scene.src && (
        <div className="w-7 h-5 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
          <img src={scene.src} alt="Slide" className="w-full h-full object-cover" />
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

export function SceneList() {
  const { scenes, currentSceneIndex, setCurrentSceneIndex, removeScene, reorderScenes, addScene, clearAllScenes } =
    usePresentationStore()
  const [isDragOver, setIsDragOver] = useState(false)
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
        const url = URL.createObjectURL(file)
        addScene({
          type: 'video',
          name: file.name,
          src: url,
        })
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${Date.now()}-${file.name}`
          for (const slide of slides) {
            const dataUrl = svgToDataUrl(slide.svg)
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: dataUrl,
              slideIndex: slide.index,
              pptxFileId,
            })
          }
        } catch (err) {
          console.error('Error parsing PPTX:', err)
        }
      }
    }
  }, [addScene])

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
        const url = URL.createObjectURL(file)
        addScene({
          type: 'video',
          name: file.name,
          src: url,
        })
      } else if (file.name.endsWith('.pptx')) {
        try {
          const slides = await parsePptx(file)
          const pptxFileId = `pptx-${Date.now()}-${file.name}`
          for (const slide of slides) {
            const dataUrl = svgToDataUrl(slide.svg)
            addScene({
              type: 'pptx-slide',
              name: `Slide ${slide.index}`,
              src: dataUrl,
              slideIndex: slide.index,
              pptxFileId,
            })
          }
        } catch (err) {
          console.error('Error parsing PPTX:', err)
        }
      }
    }
    // Reset input so same file can be re-added
    e.target.value = ''
  }, [addScene])

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
            <Image className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs">Chưa có thành phần nào</p>
            <p className="text-[10px] mt-1">Nhấn &quot;+&quot; hoặc kéo thả file vào đây</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {scenes.map((scene, index) => (
                  <SortableSceneItem
                    key={scene.id}
                    scene={scene}
                    isActive={index === currentSceneIndex}
                    onClick={() => setCurrentSceneIndex(index)}
                    onDelete={() => {
                      removeScene(scene.id)
                      toast.success(`Đã xoá "${scene.name}"`)
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </ScrollArea>
    </div>
  )
}

/**
 * Text overlay management panel
 */
export function TextOverlayPanel() {
  const { textOverlays, addTextOverlay, removeTextOverlay, toggleTextOverlay } =
    usePresentationStore()
  const [newText, setNewText] = useState('')
  const [showForm, setShowForm] = useState(false)

  const handleAdd = () => {
    if (!newText.trim()) return
    addTextOverlay({
      text: newText,
      visible: false,
      fontSize: 32,
      fontColor: '#ffffff',
      bgColor: 'rgba(0,0,0,0.7)',
      position: 'bottom',
    })
    setNewText('')
    setShowForm(false)
    toast.success('Đã thêm thông báo')
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

      {showForm && (
        <div className="mb-1.5 p-1.5 bg-zinc-800 rounded-md space-y-1">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nhập thông báo..."
            className="bg-zinc-700 border-zinc-600 text-zinc-200 text-[10px] h-6"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
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
              onClick={() => setShowForm(false)}
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
 * Control Panel - full panel layout (integrated into the bottom editing area)
 */
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
  } = usePresentationStore() as any

  const currentScene = scenes[currentSceneIndex]
  const isVideoScene = currentScene?.type === 'video'

  // === REMOTE CONNECTION INFO ===
  const [localIp, setLocalIp] = useState<string>('')
  const [showRemoteInfo, setShowRemoteInfo] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Try to detect local IP for remote device instructions
    // Use WebRTC to get local IP
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

    // Fallback: use hostname
    if (!localIp) {
      setLocalIp(window.location.hostname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleToggleLive = async () => {
    if (isLive) {
      stopLive()
      const outputWin = usePresentationStore.getState().outputWindowRef
      if (outputWin && !outputWin.closed) {
        outputWin.close()
      }
      setOutputWindowRef(null)
    } else {
      goLive()
      openOutputWindow()
    }
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
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    )
    if (w) {
      setOutputWindowRef(w)
      const checkLoaded = setInterval(() => {
        try {
          if (w.document && w.document.readyState === 'complete') {
            clearInterval(checkLoaded)
            const state = usePresentationStore.getState()
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
                        transitionType: state.transitionType,
                        transitionDuration: state.transitionDuration,
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

  return (
    <div className="flex flex-col h-full gap-2">
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

        {/* Live toggle */}
        <Button
          size="sm"
          onClick={handleToggleLive}
          className={`h-7 gap-1 px-3 ${
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
      </div>

      {/* Transition row */}
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

      {/* Project save/load + remote connection row */}
      <div className="flex items-center gap-1 mt-auto">
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

        {/* Remote device connection */}
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

          {/* URL display + copy */}
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

          {/* Quick actions */}
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
            <p>• Nhấn &quot;Chiếu&quot; trước khi mở URL trên thiết bị khác</p>
            <p>• Nhấn fullscreen trên thiết bị chiếu</p>
          </div>
        </div>
      )}
    </div>
  )
}
