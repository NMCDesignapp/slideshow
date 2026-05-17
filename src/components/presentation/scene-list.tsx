'use client'

import React, { useState } from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType, Scene } from '@/store/presentation-store'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddSceneDialog } from './add-scene-dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  const { scenes, currentSceneIndex, setCurrentSceneIndex, removeScene, reorderScenes } =
    usePresentationStore()

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Danh sách
        </h3>
        <AddSceneDialog />
      </div>

      <ScrollArea className="flex-1">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <Image className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs">Chưa có thành phần nào</p>
            <p className="text-[10px] mt-1">Nhấn &quot;Thêm&quot; để bắt đầu</p>
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
                    onDelete={() => removeScene(scene.id)}
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
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" />
          Thông báo
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowForm(!showForm)}
          className="text-emerald-400 hover:text-emerald-300 h-6 w-6 p-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {showForm && (
        <div className="mb-2 p-2 bg-zinc-800 rounded-md space-y-1.5">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nhập thông báo..."
            className="bg-zinc-700 border-zinc-600 text-zinc-200 text-xs h-7"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-6 px-2"
            >
              Thêm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="text-zinc-400 text-[10px] h-6 px-2"
            >
              Hủy
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {textOverlays.length === 0 ? (
          <p className="text-[10px] text-zinc-600 text-center py-3">
            Thêm thông báo chữ để hiện trên màn hình chiếu
          </p>
        ) : (
          <div className="space-y-0.5">
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/50 group"
              >
                <button onClick={() => toggleTextOverlay(overlay.id)} className="flex-shrink-0">
                  {overlay.visible ? (
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
                <span className="text-xs text-zinc-300 truncate flex-1">{overlay.text}</span>
                <button
                  onClick={() => removeTextOverlay(overlay.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                >
                  <X className="w-3 h-3" />
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
 * Control Panel - all functional buttons moved here
 * This sits in the bottom section as a dedicated control bar
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
  } = usePresentationStore()

  const currentScene = scenes[currentSceneIndex]
  const isVideoScene = currentScene?.type === 'video'

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
              '*'
            )
          }
        } catch {
          clearInterval(checkLoaded)
        }
      }, 100)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap h-full px-3 py-1.5">
      {/* Navigation */}
      <div className="flex items-center gap-1">
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
      </div>

      <div className="w-px h-5 bg-zinc-700 mx-0.5" />

      {/* Transition selector */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <Select value={transitionType} onValueChange={(v) => setTransitionType(v as TransitionType)}>
          <SelectTrigger className="h-6 w-[110px] bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 bg-zinc-800 rounded px-1.5 h-6">
                <Clock className="w-2.5 h-2.5 text-zinc-500 flex-shrink-0" />
                <Slider
                  value={[transitionDuration]}
                  onValueChange={([v]) => setTransitionDuration(v)}
                  min={200}
                  max={2000}
                  step={100}
                  className="w-12"
                />
                <span className="text-[9px] text-zinc-500 min-w-[28px]">{transitionDuration}ms</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
              Thời gian chuyển cảnh
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="w-px h-5 bg-zinc-700 mx-0.5" />

      {/* Video volume (only show when current scene is video) */}
      {isVideoScene && (
        <>
          <div className="flex items-center gap-1">
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
              className="w-14"
            />
          </div>
          <div className="w-px h-5 bg-zinc-700 mx-0.5" />
        </>
      )}

      <div className="flex-1" />

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
  )
}
