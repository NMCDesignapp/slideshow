'use client'

import React, { useEffect, useCallback } from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { PreviewPanel } from '@/components/presentation/preview-panel'
import { SceneList, TextOverlayPanel, ControlPanel } from '@/components/presentation/scene-list'
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
    videoVolume,
    videoMuted,
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
                  videoVolume,
                  videoMuted,
                }
              : { type: 'empty' },
        },
        '*'
      )
    } catch {
      // Window might be closed
    }
  }, [isLive, scenes, currentSceneIndex, blackScreen, outputWindowRef, textOverlays, transitionType, transitionDuration, videoVolume, videoMuted])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* Header - minimal */}
        <header className="flex items-center gap-3 px-4 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <MonitorUp className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
              ShowFlow
            </h1>
          </div>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] text-zinc-600 cursor-help hover:text-zinc-400 transition-colors">
                <Keyboard className="w-3 h-3" />
                <span className="hidden sm:inline">← → Space B</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <div className="text-[10px] space-y-1 p-1">
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">←</kbd> <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">→</kbd> Chuyển slide</p>
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">Space</kbd> Slide tiếp</p>
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">B</kbd> Đen/Bật màn hình</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </header>

        {/* Main content */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Preview area - top */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full p-3 pb-1">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

            {/* Bottom area - edit + controls */}
            <ResizablePanel defaultSize={45} minSize={25}>
              <div className="h-full flex flex-col">
                {/* Edit panels */}
                <div className="flex-1 min-h-0 p-3 pt-1 pb-1">
                  <ResizablePanelGroup direction="horizontal">
                    {/* Scene list */}
                    <ResizablePanel defaultSize={70} minSize={40}>
                      <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 p-2.5 overflow-hidden">
                        <SceneList />
                      </div>
                    </ResizablePanel>

                    <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

                    {/* Text overlays */}
                    <ResizablePanel defaultSize={30} minSize={20}>
                      <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 p-2.5 overflow-hidden">
                        <TextOverlayPanel />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>

                {/* Control bar - bottom strip */}
                <div className="bg-zinc-900/80 border-t border-zinc-800 backdrop-blur-sm">
                  <ControlPanel />
                </div>
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
