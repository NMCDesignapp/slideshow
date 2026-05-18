'use client'

import React, { useEffect, useCallback } from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { PreviewPanel } from '@/components/presentation/preview-panel'
import { SceneList, TextOverlayPanel, ControlPanel } from '@/components/presentation/scene-list'
import { OutputSync } from '@/components/presentation/media-renderer'
import { Toaster, toast } from 'sonner'
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

  // Output sync is now handled entirely by OutputSync component
  // (removed duplicate postMessage logic that was sending data twice)

  return (
    <TooltipProvider delayDuration={300}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* Header - ultra minimal */}
        <header className="flex items-center gap-3 px-4 py-1 bg-zinc-900/60 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <MonitorUp className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-xs font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
              ShowFlow
            </h1>
          </div>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[9px] text-zinc-600 cursor-help hover:text-zinc-400 transition-colors">
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

        {/* Main content - all in resizable vertical layout */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Preview area - top */}
            <ResizablePanel defaultSize={50} minSize={25}>
              <div className="h-full p-2 pb-1">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

            {/* Bottom area - Scene List + Detail (left) | Controls (right) */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0 p-1.5 pt-1 pb-1">
                  <ResizablePanelGroup direction="horizontal">
                    {/* LEFT: Scene List + Detail Panel integrated */}
                    <ResizablePanel defaultSize={55} minSize={30}>
                      <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 p-1.5 overflow-hidden">
                        <SceneList />
                      </div>
                    </ResizablePanel>

                    <ResizableHandle className="bg-zinc-800 hover:bg-emerald-600/50 transition-colors" />

                    {/* RIGHT: Controls + Overlays */}
                    <ResizablePanel defaultSize={45} minSize={20}>
                      <div className="h-full flex flex-col gap-1">
                        <div className="flex-1 bg-zinc-900 rounded-lg border border-zinc-800 p-1.5 overflow-auto min-h-0">
                          <ControlPanel />
                        </div>
                        <div className="flex-[0.6] bg-zinc-900 rounded-lg border border-zinc-800 p-1.5 overflow-hidden min-h-0">
                          <TextOverlayPanel />
                        </div>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
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
