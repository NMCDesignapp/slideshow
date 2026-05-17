'use client'

import React, { useState } from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType } from '@/store/presentation-store'
import { TransitionRenderer, MediaRenderer } from './media-renderer'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Monitor,
  MonitorOff,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Sortable filmstrip item for PPTX slides */
function FilmstripItem({
  scene,
  globalIndex,
  isActive,
  onClick,
  onDelete,
}: {
  scene: any
  globalIndex: number
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
      className={`relative group rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
        isActive
          ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
          : 'border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-100'
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 z-10"
        style={{ cursor: 'grab' }}
      />
      <div className="relative aspect-video bg-black w-full">
        <img
          src={scene.src}
          alt={scene.name || `Slide`}
          className="w-full h-full object-contain"
          draggable={false}
        />
        {isActive && (
          <div className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] px-1 py-px rounded font-bold flex items-center gap-0.5 z-20 pointer-events-none">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>
      {/* Delete button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-0.5 right-0.5 z-30 opacity-0 group-hover:opacity-100 bg-red-600/80 hover:bg-red-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center transition-opacity"
      >
        <X className="w-2 h-2" />
      </button>
    </div>
  )
}

export function PreviewPanel() {
  const {
    scenes,
    currentSceneIndex,
    isLive,
    blackScreen,
    transitionType,
    transitionDuration,
    setCurrentSceneIndex,
    goNext,
    goPrev,
    goLive,
    stopLive,
    toggleBlackScreen,
    setOutputWindowRef,
    setTransitionType,
    removeScene,
    reorderScenes,
    screenSize,
  } = usePresentationStore() as any

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[currentSceneIndex + 1]

  // Get PPTX slides for the filmstrip - find all slides that share a pptxFileId with current scene
  const pptxSlides = currentScene?.pptxFileId
    ? scenes.filter((s: any) => s.pptxFileId === currentScene.pptxFileId)
    : []
  const showFilmstrip = pptxSlides.length > 1

  // dnd-kit sensors for filmstrip
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleFilmstripDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s: any) => s.id === active.id)
      const newIndex = scenes.findIndex((s: any) => s.id === over.id)
      reorderScenes(oldIndex, newIndex)
    }
  }

  // Live toggle handler
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

  // Aspect ratio for previews
  const aspectRatio = screenSize.width / screenSize.height

  return (
    <div className="flex gap-2 flex-1 min-h-0 h-full">
      {/* FILMSTRIP - only shown when PPTX slides present */}
      {showFilmstrip && (
        <div className="w-[80px] flex-shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[8px] font-medium text-zinc-400 uppercase tracking-wider truncate">Slide</span>
          </div>
          <div className="flex-1 min-h-0 bg-zinc-900 rounded-lg border border-zinc-800 p-1 overflow-y-auto custom-scrollbar">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFilmstripDragEnd}>
              <SortableContext items={pptxSlides.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {pptxSlides.map((slide: any) => {
                    const globalIdx = scenes.findIndex((s: any) => s.id === slide.id)
                    const isActive = slide.id === currentScene?.id
                    return (
                      <FilmstripItem
                        key={slide.id}
                        scene={slide}
                        globalIndex={globalIdx}
                        isActive={isActive}
                        onClick={() => {
                          if (globalIdx >= 0) setCurrentSceneIndex(globalIdx)
                        }}
                        onDelete={() => {
                          removeScene(slide.id)
                        }}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* LEFT - "Tiếp theo" (Next) preview */}
      <div className="flex-[1.2] flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tiếp theo</span>
        </div>
        <div className="flex-1 bg-black rounded-lg overflow-hidden border border-zinc-800 relative" style={{ aspectRatio: aspectRatio }}>
          {nextScene ? (
            <MediaRenderer scene={nextScene} isActive={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700">
              <div className="text-center">
                <MonitorOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Hết nội dung</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CENTER - Control buttons between the two screens */}
      <div className="flex flex-col items-center justify-center gap-1.5 py-4 w-10 flex-shrink-0">
        {/* Live / Stop */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={handleToggleLive}
              className={`h-8 w-8 p-0 rounded-full ${
                isLive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            {isLive ? 'Dừng chiếu' : 'Bắt đầu chiếu'}
          </TooltipContent>
        </Tooltip>

        <div className="w-5 h-px bg-zinc-700 my-0.5" />

        {/* Previous */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={goPrev}
              disabled={currentSceneIndex <= 0}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Slide trước (←)
          </TooltipContent>
        </Tooltip>

        {/* Slide counter */}
        <div className="text-[9px] text-zinc-500 tabular-nums text-center leading-tight">
          <div className="text-zinc-300 font-semibold text-[10px]">{scenes.length > 0 ? currentSceneIndex + 1 : 0}</div>
          <div>/</div>
          <div>{scenes.length}</div>
        </div>

        {/* Next */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={goNext}
              disabled={currentSceneIndex >= scenes.length - 1}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Slide tiếp (→ / Space)
          </TooltipContent>
        </Tooltip>

        <div className="w-5 h-px bg-zinc-700 my-0.5" />

        {/* Black screen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleBlackScreen}
              className={`h-7 w-7 p-0 rounded-full ${
                blackScreen
                  ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            {blackScreen ? 'Bật hình' : 'Đen màn hình'} (B)
          </TooltipContent>
        </Tooltip>

        {/* Transition effect */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-zinc-700 rounded-full"
                onClick={() => {
                  const el = document.getElementById('transition-popover-trigger')
                  el?.click()
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            Hiệu ứng chuyển cảnh
          </TooltipContent>
        </Tooltip>

        {/* Transition quick select - compact dropdown */}
        <div className="w-8">
          <Select value={transitionType} onValueChange={(v) => setTransitionType(v as TransitionType)}>
            <SelectTrigger
              id="transition-popover-trigger"
              className="h-5 w-full bg-zinc-800 border-zinc-700 text-zinc-400 text-[8px] p-0 px-1 rounded"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[240px] overflow-y-auto w-[140px]">
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
                        <span className="text-[9px]">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* RIGHT panel - Main preview (ĐANG CHIẾU) */}
      <div className="flex-[3] flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Đang chiếu
          </span>
          {isLive && (
            <span className="text-[10px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded font-medium">
              LIVE
            </span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto">
            {scenes.length > 0 ? `${currentSceneIndex + 1}/${scenes.length}` : ''}
          </span>
        </div>
        <div className="flex-1 bg-black rounded-lg overflow-hidden border border-zinc-700 relative">
          {blackScreen ? (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <div className="text-zinc-700 text-center">
                <Monitor className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Màn hình đen</p>
              </div>
            </div>
          ) : currentScene ? (
            <TransitionRenderer
              scene={currentScene}
              transitionType={transitionType}
              transitionDuration={transitionDuration}
              isActive={true}
              keepAlive={isLive}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <Monitor className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Chưa có nội dung</p>
                <p className="text-xs mt-1 text-zinc-700">Thêm thành phần bên dưới</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
