'use client'

import React from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { TransitionRenderer, MediaRenderer } from './media-renderer'
import {
  Monitor,
  MonitorOff,
  ChevronLeft,
  ChevronRight,
  Square,
  Play,
  Pause,
  Radio,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

export function PreviewPanel() {
  const {
    scenes,
    currentSceneIndex,
    nextSceneIndex,
    isLive,
    blackScreen,
    transitionType,
    transitionDuration,
    goNext,
    goPrev,
    toggleBlackScreen,
    goLive,
    stopLive,
    setOutputWindowRef,
    screenSize,
  } = usePresentationStore() as any

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[nextSceneIndex]

  // Aspect ratio for previews
  const aspectRatio = screenSize.width / screenSize.height

  // Handle Go Live button - open output window and go live
  const handleGoLive = () => {
    // If already live, just stop
    if (isLive) {
      stopLive()
      return
    }

    // Open output window
    const outputUrl = window.location.origin + '/output'
    // Try to position on second monitor
    const secondMonitorX = window.screen.width
    const newWindow = window.open(
      outputUrl,
      'showflow-output',
      `width=1920,height=1080,left=${secondMonitorX},top=0,fullscreen=yes`
    )

    if (newWindow) {
      setOutputWindowRef(newWindow)
      goLive()
      toast.success('Đã bật chiếu! Di chuyển cửa sổ output sang màn hình 2.')
    } else {
      toast.error('Trình duyệt đã chặn popup. Vui lòng cho phép popup.')
    }
  }

  return (
    <div className="flex gap-1.5 flex-1 min-h-0 h-full items-stretch">
      {/* LEFT - Screen 2: "TIẾP THEO" (Next to project) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="flex items-center justify-center w-4 h-4 rounded bg-emerald-600/20 border border-emerald-500/40">
            <span className="text-[9px] font-bold text-emerald-400">2</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
            Tiếp theo
          </span>
        </div>
        <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden border border-emerald-800/50 relative">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${screenSize.width} / ${screenSize.height}` }}>
              {nextScene ? (
                <MediaRenderer scene={nextScene} isActive={false} isPreview={true} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <div className="text-center">
                    <MonitorOff className="w-8 h-8 mx-auto mb-1 opacity-30" />
                    <p className="text-[9px]">Chọn mục từ danh sách</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER - Navigation controls column */}
      <div className="flex flex-col items-center justify-center gap-1.5 px-0.5 min-w-[36px]">
        {/* Prev button */}
        <button
          onClick={goPrev}
          disabled={currentSceneIndex <= 0}
          className="h-8 w-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Slide counter */}
        <div className="text-[10px] font-mono text-zinc-400 tabular-nums text-center leading-tight">
          <div className="text-emerald-400 font-bold text-xs">
            {scenes.length > 0 ? currentSceneIndex + 1 : 0}
          </div>
          <div className="text-zinc-600 text-[8px]">/</div>
          <div className="text-[10px]">{scenes.length}</div>
        </div>

        {/* Next button - projects the next scene */}
        <button
          onClick={goNext}
          disabled={nextSceneIndex < 0 || scenes.length === 0}
          className="h-8 w-8 rounded-md bg-emerald-700/30 border border-emerald-600/50 flex items-center justify-center text-emerald-400 hover:text-white hover:bg-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Chiếu slide tiếp theo"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-5 h-px bg-zinc-700" />

        {/* Arrow indicating "project next" */}
        <div className="text-emerald-500/50">
          <ArrowRight className="w-3 h-3" />
        </div>

        {/* Divider */}
        <div className="w-5 h-px bg-zinc-700" />

        {/* Black screen toggle */}
        <button
          onClick={toggleBlackScreen}
          className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
            blackScreen
              ? 'bg-red-600/20 border border-red-500/50 text-red-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
          title={blackScreen ? 'Bật hình' : 'Màn hình đen'}
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Live/Stop toggle */}
        <button
          onClick={handleGoLive}
          className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
            isLive
              ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700'
          }`}
          title={isLive ? 'Dừng chiếu' : 'Bắt đầu chiếu'}
        >
          {isLive ? <Radio className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
      </div>

      {/* RIGHT - Screen 1: "ĐANG CHIẾU" (Currently projecting) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="flex items-center justify-center w-4 h-4 rounded bg-red-600/20 border border-red-500/40">
            <span className="text-[9px] font-bold text-red-400">1</span>
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
            Đang chiếu
          </span>
          {isLive && (
            <span className="text-[8px] bg-red-600/20 text-red-400 px-1 py-px rounded font-medium">
              LIVE
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 bg-black rounded-lg overflow-hidden border border-zinc-700 relative">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${screenSize.width} / ${screenSize.height}` }}>
              {blackScreen ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                  <div className="text-zinc-700 text-center">
                    <Monitor className="w-10 h-10 mx-auto mb-1 opacity-20" />
                    <p className="text-[10px]">Màn hình đen</p>
                  </div>
                </div>
              ) : currentScene ? (
                <TransitionRenderer
                  scene={currentScene}
                  transitionType={transitionType}
                  transitionDuration={transitionDuration}
                  isActive={true}
                  keepAlive={isLive}
                  isPreview={true}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <div className="text-center">
                    <Monitor className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-[10px]">Chưa có nội dung</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
