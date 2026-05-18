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
    screenSize,
  } = usePresentationStore() as any

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[nextSceneIndex]

  // Aspect ratio for previews
  const aspectRatio = screenSize.width / screenSize.height

  return (
    <div className="flex gap-2 flex-1 min-h-0 h-full">
      {/* LEFT - Screen 1: "ĐANG CHIẾU" (Currently projecting) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-red-600/20 border border-red-500/40">
            <span className="text-[10px] font-bold text-red-400">1</span>
          </div>
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
        <div className="flex-1 max-h-full bg-black rounded-lg overflow-hidden border border-zinc-700 relative" style={{ aspectRatio: aspectRatio }}>
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
              isPreview={true}
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

      {/* CENTER - Navigation controls column */}
      <div className="flex flex-col items-center justify-center gap-2 px-1 min-w-[44px]">
        {/* Prev button */}
        <button
          onClick={goPrev}
          disabled={currentSceneIndex <= 0}
          className="h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Slide counter */}
        <div className="text-[11px] font-mono text-zinc-400 tabular-nums text-center leading-tight">
          <div className="text-emerald-400 font-bold text-sm">
            {scenes.length > 0 ? currentSceneIndex + 1 : 0}
          </div>
          <div className="text-zinc-600">/</div>
          <div>{scenes.length}</div>
        </div>

        {/* Next button - projects the next scene */}
        <button
          onClick={goNext}
          disabled={nextSceneIndex < 0 || scenes.length === 0}
          className="h-9 w-9 rounded-lg bg-emerald-700/30 border border-emerald-600/50 flex items-center justify-center text-emerald-400 hover:text-white hover:bg-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Chiếu slide tiếp theo"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-6 h-px bg-zinc-700 my-0.5" />

        {/* Arrow indicating "project next" */}
        <div className="text-emerald-500/50">
          <ArrowRight className="w-4 h-4" />
        </div>

        {/* Divider */}
        <div className="w-6 h-px bg-zinc-700 my-0.5" />

        {/* Black screen toggle */}
        <button
          onClick={toggleBlackScreen}
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
            blackScreen
              ? 'bg-red-600/20 border border-red-500/50 text-red-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
          title={blackScreen ? 'Bật hình' : 'Màn hình đen'}
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Live/Stop toggle */}
        <button
          onClick={isLive ? stopLive : goLive}
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
            isLive
              ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700'
          }`}
          title={isLive ? 'Dừng chiếu' : 'Bắt đầu chiếu'}
        >
          {isLive ? <Radio className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      </div>

      {/* RIGHT - Screen 2: "TIẾP THEO" (Next to project) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-600/20 border border-emerald-500/40">
            <span className="text-[10px] font-bold text-emerald-400">2</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
            Tiếp theo
          </span>
        </div>
        <div className="flex-1 max-h-full bg-black rounded-lg overflow-hidden border border-emerald-800/50 relative" style={{ aspectRatio: aspectRatio }}>
          {nextScene ? (
            <MediaRenderer scene={nextScene} isActive={false} isPreview={true} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700">
              <div className="text-center">
                <MonitorOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Chọn mục từ danh sách</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
