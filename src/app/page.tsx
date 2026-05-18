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
  Activity,
  Layers3,
  Radio,
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
      <div className="neon-shell h-screen flex flex-col text-white overflow-hidden">
        {/* Header - neon command bar */}
        <header className="relative z-10 px-4 py-2 border-b border-emerald-400/20 bg-black/35 backdrop-blur-xl">
          <div className="absolute inset-x-0 bottom-0 neon-line" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border border-emerald-300/45 bg-emerald-400/10 flex items-center justify-center shadow-[0_0_22px_rgba(34,197,94,0.35)]">
                <MonitorUp className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="leading-none">
                <h1 className="text-sm font-black uppercase tracking-[0.28em] neon-text">ShowFlow</h1>
                <p className="text-[9px] text-emerald-300/60 uppercase tracking-[0.24em]">Neon line console</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 ml-3">
              <div className="neon-chip rounded-full px-2.5 py-1 text-[10px] text-emerald-100 flex items-center gap-1.5">
                <Layers3 className="w-3 h-3 text-emerald-300" />
                <span>{scenes.length} cảnh</span>
              </div>
              <div className="neon-chip rounded-full px-2.5 py-1 text-[10px] text-emerald-100 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-emerald-300" />
                <span>{transitionType} · {transitionDuration}ms</span>
              </div>
              <div className={`rounded-full px-2.5 py-1 text-[10px] flex items-center gap-1.5 border ${isLive ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_18px_rgba(34,197,94,0.25)]' : 'border-zinc-700 bg-zinc-950/60 text-zinc-400'}`}>
                <Radio className={`w-3 h-3 ${isLive ? 'text-emerald-300 animate-pulse' : 'text-zinc-500'}`} />
                <span>{isLive ? 'LIVE output' : 'Standby'}</span>
              </div>
            </div>

            <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[9px] text-zinc-600 cursor-help hover:text-zinc-400 transition-colors">
                <Keyboard className="w-3 h-3" />
                <span className="hidden sm:inline">← → Space B</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-950 border-emerald-400/30 text-emerald-50 shadow-[0_0_20px_rgba(34,197,94,0.16)]">
              <div className="text-[10px] space-y-1 p-1">
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">←</kbd> <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">→</kbd> Chuyển slide</p>
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">Space</kbd> Slide tiếp</p>
                <p><kbd className="px-1 py-0.5 bg-zinc-700 rounded text-[9px]">B</kbd> Đen/Bật màn hình</p>
              </div>
            </TooltipContent>
          </Tooltip>
          </div>
        </header>

        {/* Main content - all in resizable vertical layout */}
        <div className="relative z-10 flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Preview area - top */}
            <ResizablePanel defaultSize={50} minSize={25}>
              <div className="h-full p-2 pb-1">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-emerald-400/20 hover:bg-emerald-400/55 transition-colors shadow-[0_0_12px_rgba(34,197,94,0.25)]" />

            {/* Bottom area - Scene List + Detail (left) | Controls (right) */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0 p-1.5 pt-1 pb-1">
                  <ResizablePanelGroup direction="horizontal">
                    {/* LEFT: Scene List + Detail Panel integrated */}
                    <ResizablePanel defaultSize={55} minSize={30}>
                      <div className="neon-panel h-full rounded-xl p-1.5 overflow-hidden">
                        <SceneList />
                      </div>
                    </ResizablePanel>

                    <ResizableHandle className="bg-emerald-400/20 hover:bg-emerald-400/55 transition-colors shadow-[0_0_12px_rgba(34,197,94,0.25)]" />

                    {/* RIGHT: Controls + Overlays */}
                    <ResizablePanel defaultSize={45} minSize={20}>
                      <div className="h-full flex flex-col gap-1">
                        <div className="neon-panel flex-1 rounded-xl p-1.5 overflow-auto min-h-0">
                          <ControlPanel />
                        </div>
                        <div className="neon-panel flex-[0.6] rounded-xl p-1.5 overflow-hidden min-h-0">
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
