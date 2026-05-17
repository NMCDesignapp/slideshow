'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Scene, TextOverlay } from '@/store/presentation-store'

interface OutputState {
  type: 'empty' | 'black' | 'scene'
  scene?: Scene
  overlays?: TextOverlay[]
}

export default function OutputPage() {
  const [state, setState] = useState<OutputState>({ type: 'empty' })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        setState(event.data.payload)
      }
    }

    window.addEventListener('message', handler)

    // Signal to parent that we're ready
    if (window.opener) {
      window.opener.postMessage({ type: 'OUTPUT_READY' }, '*')
    }

    return () => window.removeEventListener('message', handler)
  }, [])

  // Request fullscreen on click
  const handleFullscreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen?.()
    }
  }

  const renderScene = () => {
    if (state.type === 'black') {
      return <div className="absolute inset-0 bg-black" />
    }

    if (state.type === 'empty' || !state.scene) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white/20">
          <p className="text-xl">Đang chờ nội dung trình chiếu...</p>
        </div>
      )
    }

    const scene = state.scene

    return (
      <div className="absolute inset-0">
        {scene.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img src={scene.src} alt={scene.name || 'Image'} className="max-w-full max-h-full object-contain" />
          </div>
        )}

        {scene.type === 'video' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              src={scene.src}
              className="max-w-full max-h-full object-contain"
              autoPlay
              loop
              controls={false}
            />
          </div>
        )}

        {scene.type === 'web' && (
          <iframe
            src={scene.url}
            className="w-full h-full border-0"
            title={scene.name}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        )}

        {scene.type === 'text' && (
          <div
            className="w-full h-full flex items-center justify-center p-16"
            style={{ backgroundColor: scene.bgColor || '#1a1a2e' }}
          >
            <div
              className="max-w-[90%] break-words"
              style={{
                fontSize: `${scene.fontSize || 48}px`,
                color: scene.fontColor || '#ffffff',
                textAlign: scene.textAlign || 'center',
                fontFamily: 'Arial, sans-serif',
                lineHeight: 1.4,
              }}
            >
              {scene.content}
            </div>
          </div>
        )}

        {scene.type === 'pptx-slide' && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img src={scene.src} alt={scene.name || 'PPTX Slide'} className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    )
  }

  const renderOverlays = () => {
    if (!state.overlays || state.overlays.length === 0) return null

    return state.overlays
      .filter((o) => o.visible)
      .map((overlay) => {
        const positionClasses: Record<string, string> = {
          top: 'top-0 left-0 right-0',
          bottom: 'bottom-0 left-0 right-0',
          center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        }

        return (
          <div
            key={overlay.id}
            className={`absolute ${positionClasses[overlay.position] || positionClasses.bottom} p-4`}
          >
            <div
              className="px-6 py-3 rounded-lg inline-block max-w-full"
              style={{
                backgroundColor: overlay.bgColor || 'rgba(0,0,0,0.7)',
                fontSize: `${overlay.fontSize || 32}px`,
                color: overlay.fontColor || '#ffffff',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {overlay.text}
            </div>
          </div>
        )
      })
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black cursor-none"
      onClick={handleFullscreen}
      onDoubleClick={() => document.exitFullscreen?.()}
    >
      {renderScene()}
      {renderOverlays()}
    </div>
  )
}
