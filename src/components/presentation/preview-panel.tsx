'use client'

import React from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { MediaRenderer } from './media-renderer'
import {
  Monitor,
  MonitorOff,
  ChevronLeft,
  ChevronRight,
  Square,
  Maximize2,
  Play,
  Pause,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  } = usePresentationStore()

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[currentSceneIndex + 1]

  const handleToggleLive = async () => {
    if (isLive) {
      stopLive()
      // Close output window
      const outputWin = usePresentationStore.getState().outputWindowRef
      if (outputWin && !outputWin.closed) {
        outputWin.close()
      }
      setOutputWindowRef(null)
    } else {
      goLive()
      // Open output window for projector
      openOutputWindow()
    }
  }

  const openOutputWindow = () => {
    // Try Presentation API first
    if ('presentation' in navigator) {
      const presentationRequest = new (navigator as any).PresentationRequest([
        window.location.href + '#output',
      ])
      presentationRequest
        .start()
        .then((connection: any) => {
          // Connection established
        })
        .catch(() => {
          // Fallback to window.open
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
      // Wait for window to load, then start syncing
      const checkLoaded = setInterval(() => {
        try {
          if (w.document && w.document.readyState === 'complete') {
            clearInterval(checkLoaded)
            // Initial sync
            const state = usePresentationStore.getState()
            const currentScene = state.scenes[state.currentSceneIndex]
            w.postMessage(
              {
                type: 'PRESENTATION_UPDATE',
                payload: state.blackScreen
                  ? { type: 'black' }
                  : currentScene
                    ? { type: 'scene', scene: currentScene, overlays: state.textOverlays }
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
      <div className="flex items-center gap-2">
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

      {/* Dual preview */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Main preview - Current */}
        <div className="flex-[3] flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Đang chiếu
            </span>
          </div>
          <div className="flex-1 bg-black rounded-lg overflow-hidden border border-zinc-700 relative">
            {blackScreen ? (
              <div className="absolute inset-0 bg-black" />
            ) : currentScene ? (
              <MediaRenderer scene={currentScene} isActive={true} />
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

        {/* Next preview */}
        <div className="flex-[1.5] flex flex-col min-w-0">
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
      </div>
    </div>
  )
}
