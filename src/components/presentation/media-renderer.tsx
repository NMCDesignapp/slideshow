'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePresentationStore, Scene, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'

interface MediaRendererProps {
  scene: Scene
  className?: string
  isActive?: boolean
}

export function MediaRenderer({ scene, className = '', isActive = true }: MediaRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (scene.type === 'video' && videoRef.current && isActive) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [scene.id, scene.type, isActive])

  const renderContent = () => {
    switch (scene.type) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
            <img
              src={scene.src}
              alt={scene.name || 'Image'}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )

      case 'video':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              src={scene.src}
              className="max-w-full max-h-full object-contain"
              controls={false}
              loop
              autoPlay={isActive}
              muted={false}
            />
          </div>
        )

      case 'web':
        return (
          <div className="w-full h-full bg-white overflow-hidden">
            <iframe
              src={scene.url}
              className="w-full h-full border-0"
              title={scene.name}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        )

      case 'text':
        return (
          <div
            className="w-full h-full flex items-center justify-center p-8"
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
        )

      case 'pptx-slide':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
            <img
              src={scene.src}
              alt={scene.name || 'PPTX Slide'}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )

      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-black text-white/50">
            Không hỗ trợ định dạng này
          </div>
        )
    }
  }

  return <div className={`relative w-full h-full ${className}`}>{renderContent()}</div>
}

/**
 * Get the CSS animation class for a given transition type and phase.
 */
function getTransitionClass(type: TransitionType, phase: 'enter' | 'exit'): string {
  if (type === 'none') return ''
  return `transition-${type}-${phase}`
}

/**
 * Get the inline animation style for a given transition duration.
 */
function getTransitionStyle(duration: number): React.CSSProperties {
  return {
    '--transition-duration': `${duration}ms`,
    animationDuration: `${duration}ms`,
  } as React.CSSProperties
}

/**
 * TransitionRenderer - wraps scene changes with CSS animation transitions.
 *
 * Strategy: Render the current scene with an "enter" animation.
 * To show the outgoing scene during transition, we subscribe to the store
 * and keep a snapshot of the previous scene that clears after animation duration.
 */
interface TransitionRendererProps {
  scene: Scene | undefined
  transitionType: TransitionType
  transitionDuration: number
  className?: string
  isActive?: boolean
}

export function TransitionRenderer({
  scene,
  transitionType,
  transitionDuration,
  className = '',
  isActive = true,
}: TransitionRendererProps) {
  if (!scene) {
    return <div className={`w-full h-full ${className}`} />
  }

  // No transition - just render directly with key for React to track
  if (transitionType === 'none') {
    return (
      <div className={`w-full h-full ${className}`}>
        <MediaRenderer scene={scene} isActive={isActive} />
      </div>
    )
  }

  // With transition - render with enter animation class and key
  // The key change causes React to re-mount, triggering the CSS animation
  const enterClass = getTransitionClass(transitionType, 'enter')
  const style = getTransitionStyle(transitionDuration)

  return (
    <div className={`w-full h-full overflow-hidden ${className}`}>
      <div
        key={scene.id}
        className={`w-full h-full ${enterClass}`}
        style={style}
      >
        <MediaRenderer scene={scene} isActive={isActive} />
      </div>
    </div>
  )
}

/**
 * Component that syncs with the output window for dual-screen projection
 */
export function OutputSync() {
  const { scenes, currentSceneIndex, isLive, textOverlays, blackScreen, transitionType, transitionDuration } = usePresentationStore()
  const currentScene = scenes[currentSceneIndex]

  const getOutputContent = useCallback(() => {
    if (!isLive) return null
    if (blackScreen) {
      return { type: 'black' as const }
    }
    if (!currentScene) return { type: 'empty' as const }
    return {
      type: 'scene' as const,
      scene: currentScene,
      overlays: textOverlays,
      transitionType,
      transitionDuration,
    }
  }, [isLive, blackScreen, currentScene, textOverlays, transitionType, transitionDuration])

  useEffect(() => {
    const output = getOutputContent()
    if (output) {
      try {
        const outputWindow = usePresentationStore.getState().outputWindowRef
        if (outputWindow && !outputWindow.closed) {
          outputWindow.postMessage({
            type: 'PRESENTATION_UPDATE',
            payload: output,
          }, '*')
        }
      } catch {
        // Window may be closed
      }
    }
  }, [getOutputContent])

  return null
}
