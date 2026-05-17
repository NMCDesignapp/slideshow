'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Scene, TextOverlay, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'
import { MediaRenderer } from '@/components/presentation/media-renderer'

interface OutputState {
  type: 'empty' | 'black' | 'scene'
  scene?: Scene
  overlays?: TextOverlay[]
  transitionType?: TransitionType
  transitionDuration?: number
}

/**
 * Get the CSS animation class for a given transition type and phase.
 */
function getTransitionClass(type: TransitionType, phase: 'enter' | 'exit'): string {
  if (type === 'none') return ''
  return `transition-${type}-${phase}`
}

export default function OutputPage() {
  const [state, setState] = useState<OutputState>({ type: 'empty' })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFullscreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen?.()
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        setState(event.data.payload)
      }
    }

    window.addEventListener('message', handler)

    if (window.opener) {
      window.opener.postMessage({ type: 'OUTPUT_READY' }, '*')
    }

    return () => window.removeEventListener('message', handler)
  }, [])

  const transitionType = state.transitionType || 'none'
  const transitionDuration = state.transitionDuration || DEFAULT_TRANSITION_DURATION

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

    // No transition - instant
    if (transitionType === 'none') {
      return (
        <div className="absolute inset-0">
          <MediaRenderer scene={scene} isActive={true} />
        </div>
      )
    }

    // With transition - use key to trigger CSS animation on scene change
    const enterClass = getTransitionClass(transitionType, 'enter')
    const style = {
      '--transition-duration': `${transitionDuration}ms`,
      animationDuration: `${transitionDuration}ms`,
    } as React.CSSProperties

    return (
      <div className="absolute inset-0 overflow-hidden">
        <div
          key={scene.id}
          className={`w-full h-full ${enterClass}`}
          style={style}
        >
          <MediaRenderer scene={scene} isActive={true} />
        </div>
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
            className={`absolute ${positionClasses[overlay.position] || positionClasses.bottom} p-4 z-50`}
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
