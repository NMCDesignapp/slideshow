'use client'

import React, { useEffect, useCallback } from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { PreviewPanel } from '@/components/presentation/preview-panel'
import { SceneList, TextOverlayPanel } from '@/components/presentation/scene-list'
import { OutputSync } from '@/components/presentation/media-renderer'
import {
  MonitorUp,
  Keyboard,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

export default function Home() {
  const {
    goNext,
    goPrev,
    blackScreen,
    toggleBlackScreen,
    scenes,
    currentSceneIndex,
    isLive,
    outputWindowRef,
    textOverlays,
    transitionType,
    transitionDuration,
  } = usePresentationStore()

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          goPrev()
          break
        case 'b':
        case 'B':
          e.preventDefault()
          toggleBlackScreen()
          break
      }
    },
    [goNext, goPrev, toggleBlackScreen]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Sync output window whenever state changes
  useEffect(() => {
    if (!isLive) return
    const win = outputWindowRef
    if (!win || win.closed) return

    try {
      const currentScene = scenes[currentSceneIndex]
      win.postMessage(
        {
          type: 'PRESENTATION_UPDATE',
          payload: blackScreen
            ? { type: 'black' }
            : currentScene
              ? {
                  type: 'scene',
                  scene: currentScene,
                  overlays: textOverlays,
                  transitionType,
                  transitionDuration,
                }
              : { type: 'empty' },
        },
        '*'
      )
    } catch {
      // Window might be closed
    }
  }, [isLive, scenes, currentSceneIndex, blackScreen, outputWindowRef, textOverlays, transitionType, transitionDuration])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <MonitorUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
                ShowFlow
              </h1>
              <p className="text-[10px] text-zinc-500 leading-tight">Trình chiếu đơn giản</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-help hover:text-zinc-400 transition-colors">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Phím tắt</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <div className="text-xs space-y-1.5 p-1">
                  <p>
                    <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px]">←</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px]">→</kbd>{' '}
                    Chuyển slide
                  </p>
                  <p>
                    <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px]">Space</kbd>{' '}
                    Slide tiếp
                  </p>
                  <p>
                    <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px]">B</kbd>{' '}
                    Đen/Bật màn hình
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main content - resizable panels */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Preview area - top */}
            <ResizablePanel defaultSize={58} minSize={35}>
              <div className="h-full p-3 pb-1">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

            {/* Edit area - bottom */}
            <ResizablePanel defaultSize={42} minSize={25}>
              <div className="h-full p-3 pt-1">
                <ResizablePanelGroup direction="horizontal">
                  {/* Scene list - left */}
                  <ResizablePanel defaultSize={70} minSize={40}>
                    <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 p-3 overflow-hidden">
                      <SceneList />
                    </div>
                  </ResizablePanel>

                  <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

                  {/* Text overlays - right */}
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 p-3 overflow-hidden">
                      <TextOverlayPanel />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Output sync component (invisible) */}
        <OutputSync />
      </div>
    </TooltipProvider>
  )
}
