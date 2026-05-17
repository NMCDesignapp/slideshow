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
 * TransitionRenderer - cross-transition that shows both old and new scene simultaneously.
 *
 * When the scene changes:
 * 1. Keep the OLD scene rendered with an "exit" animation
 * 2. Render the NEW scene on top with an "enter" animation
 * 3. After the transition duration, remove the old scene
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
  // Track previous scene for cross-transition
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect scene change
  useEffect(() => {
    const newId = scene?.id

    if (prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== newId && scene) {
      // Scene changed → start transition
      // Find the old scene from the store
      const oldScene = usePresentationStore.getState().scenes.find(
        (s) => s.id === prevSceneIdRef.current
      )
      if (oldScene && transitionType !== 'none') {
        setPrevScene(oldScene)
        setIsTransitioning(true)

        // Clear after transition
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          setPrevScene(undefined)
          setIsTransitioning(false)
        }, transitionDuration + 50) // small buffer
      }
    }

    prevSceneIdRef.current = newId
  }, [scene?.id, transitionType, transitionDuration])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!scene) {
    return <div className={`w-full h-full ${className}`} />
  }

  // No transition
  if (transitionType === 'none' || !isTransitioning) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <div
          key={scene.id}
          className="w-full h-full"
        >
          <MediaRenderer scene={scene} isActive={isActive} />
        </div>
      </div>
    )
  }

  // Cross-transition: old scene exits + new scene enters
  const duration = `${transitionDuration}ms`
  const durationVar = { '--transition-duration': duration } as React.CSSProperties

  return (
    <div className={`w-full h-full overflow-hidden transition-container ${className}`} style={durationVar}>
      {/* OLD scene - exit animation (behind) */}
      {prevScene && (
        <div
          key={`exit-${prevScene.id}`}
          className={`transition-${transitionType}-exit`}
          style={{ animationDuration: duration, ...durationVar }}
        >
          <MediaRenderer scene={prevScene} isActive={false} />
        </div>
      )}
      {/* NEW scene - enter animation (on top) */}
      <div
        key={`enter-${scene.id}`}
        className={`transition-${transitionType}-enter`}
        style={{ animationDuration: duration, ...durationVar }}
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
