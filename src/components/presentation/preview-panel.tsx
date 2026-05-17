'use client'

import React from 'react'
import { usePresentationStore } from '@/store/presentation-store'
import { TransitionRenderer, MediaRenderer } from './media-renderer'
import {
  Monitor,
  MonitorOff,
} from 'lucide-react'

/**
 * Get all slides belonging to the same PPTX file as the given scene
 */
function getPptxSlides(scenes: usePresentationStore extends { scenes: infer S } ? S : never, currentScene: { pptxFileId?: string }) {
  if (!currentScene.pptxFileId) return []
  return scenes.filter((s: { pptxFileId?: string }) => s.pptxFileId === currentScene.pptxFileId)
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
  } = usePresentationStore()

  const currentScene = scenes[currentSceneIndex]
  const nextScene = scenes[currentSceneIndex + 1]

  // Get PPTX slides for the slide navigator
  const pptxSlides = currentScene?.pptxFileId
    ? scenes.filter((s) => s.pptxFileId === currentScene.pptxFileId)
    : []
  const showSlideNavigator = pptxSlides.length > 1

  return (
    <div className="flex gap-3 flex-1 min-h-0 h-full">
      {/* LEFT panel - Slide Navigator (PPTX) or "Tiếp theo" preview */}
      <div className="flex-[1.2] flex flex-col min-w-0">
        {showSlideNavigator ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Slide PPTX</span>
              <span className="text-[10px] text-zinc-600">{pptxSlides.length} slide</span>
            </div>
            <div className="flex-1 bg-zinc-900 rounded-lg overflow-y-auto border border-zinc-800 p-2 space-y-1.5 custom-scrollbar">
              {pptxSlides.map((slide) => {
                const isActive = slide.id === currentScene?.id
                return (
                  <button
                    key={slide.id}
                    onClick={() => {
                      const idx = scenes.findIndex((s) => s.id === slide.id)
                      if (idx >= 0) setCurrentSceneIndex(idx)
                    }}
                    className={`w-full rounded-md overflow-hidden border-2 transition-all ${
                      isActive
                        ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'border-zinc-700 hover:border-zinc-500 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="relative aspect-video bg-black">
                      <img
                        src={slide.src}
                        alt={slide.name || `Slide ${slide.slideIndex}`}
                        className="w-full h-full object-contain"
                      />
                      {isActive && (
                        <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                          LIVE
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                        <span className="text-[10px] text-zinc-300">{slide.slideIndex ?? ''}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
            <div className="absolute inset-0 bg-black" />
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
