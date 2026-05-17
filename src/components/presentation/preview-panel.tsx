'use client'

import React from 'react'
import { usePresentationStore, TRANSITION_OPTIONS, TRANSITION_GROUPS, TransitionType } from '@/store/presentation-store'
import { TransitionRenderer, MediaRenderer } from './media-renderer'
import {
  Monitor,
  MonitorOff,
  ChevronLeft,
  ChevronRight,
  Square,
  Play,
  Pause,
  Sparkles,
  Clock,
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
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function PreviewPanel() {
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
  } = usePresentationStore()

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[currentSceneIndex + 1]

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
      presentationRequest
        .start()
        .then(() => {})
        .catch(() => {
          fallbackOpenWindow()
        })
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
            const currentScene = state.scenes[state.currentSceneIndex]
            w.postMessage(
              {
                type: 'PRESENTATION_UPDATE',
                payload: state.blackScreen
                  ? { type: 'black' }
                  : currentScene
                    ? {
                        type: 'scene',
                        scene: currentScene,
                        overlays: state.textOverlays,
                        transitionType: state.transitionType,
                        transitionDuration: state.transitionDuration,
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
    <div className="flex flex-col gap-3 h-full">
      {/* Control bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Navigation */}
        <Button
          size="sm"
          variant="ghost"
          onClick={goPrev}
          disabled={currentSceneIndex <= 0}
          className="text-zinc-400 hover:text-white h-8 w-8 p-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <span className="text-sm text-zinc-400 min-w-[60px] text-center">
          {scenes.length > 0 ? `${currentSceneIndex + 1} / ${scenes.length}` : '0 / 0'}
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={goNext}
          disabled={currentSceneIndex >= scenes.length - 1}
          className="text-zinc-400 hover:text-white h-8 w-8 p-0"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Separator */}
        <div className="w-px h-5 bg-zinc-700 mx-1" />

        {/* Transition selector with groups */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <Select value={transitionType} onValueChange={(v) => setTransitionType(v as TransitionType)}>
            <SelectTrigger className="h-7 w-[140px] bg-zinc-800 border-zinc-700 text-zinc-300 text-xs">
              <SelectValue placeholder="Hiệu ứng" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[320px] overflow-y-auto">
              {TRANSITION_GROUPS.map((group) => (
                <SelectGroup key={group.key}>
                  <SelectLabel className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold px-2 pt-2">
                    {group.label}
                  </SelectLabel>
                  {TRANSITION_OPTIONS.filter((opt) => opt.group === group.key).map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-zinc-300 text-xs focus:bg-zinc-700 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{opt.icon}</span>
                        <span>{opt.label}</span>
                        <span className="text-zinc-600 text-[10px]">– {opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {/* Duration slider */}
          {transitionType !== 'none' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 bg-zinc-800 rounded-md px-2 h-7">
                  <Clock className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                  <Slider
                    value={[transitionDuration]}
                    onValueChange={([v]) => setTransitionDuration(v)}
                    min={200}
                    max={2000}
                    step={100}
                    className="w-16"
                  />
                  <span className="text-[10px] text-zinc-500 min-w-[32px]">{transitionDuration}ms</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-300 text-xs">
                Thời gian chuyển cảnh
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          onClick={toggleBlackScreen}
          className={`h-8 gap-1.5 ${blackScreen ? 'text-red-400' : 'text-zinc-400 hover:text-white'}`}
        >
          <Square className="w-4 h-4" />
          <span className="text-xs">{blackScreen ? 'Bật hình' : 'Đen màn hình'}</span>
        </Button>

        <Button
          size="sm"
          onClick={handleToggleLive}
          className={`h-8 gap-1.5 ${
            isLive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isLive ? (
            <>
              <Pause className="w-4 h-4" />
              <span className="text-xs">Dừng chiếu</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span className="text-xs">Bắt đầu chiếu</span>
            </>
          )}
        </Button>
      </div>

      {/* Dual preview - "Tiếp theo" bên TRÁI, "Đang chiếu" bên PHẢI */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Next preview - LEFT (nhỏ hơn) */}
        <div className="flex-[1.2] flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tiếp theo</span>
          </div>
          <div className="flex-1 bg-black rounded-lg overflow-hidden border border-zinc-800 relative">
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

        {/* Main preview - Current (ĐANG CHIẾU) - RIGHT (lớn hơn) */}
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
          </div>
          <div className="flex-1 bg-black rounded-lg overflow-hidden border border-zinc-700 relative">
            {blackScreen ? (
              <div className="absolute inset-0 bg-black" />
            ) : currentScene ? (
              <TransitionRenderer
                scene={currentScene}
                transitionType={transitionType}
                transitionDuration={transitionDuration}
                isActive={true}
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
    </div>
  )
}
