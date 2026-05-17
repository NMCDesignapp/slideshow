'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { usePresentationStore, Scene } from '@/store/presentation-store'

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

  return <div className={`relative ${className}`}>{renderContent()}</div>
}

/**
 * Component that syncs with the output window for dual-screen projection
 */
export function OutputSync() {
  const { scenes, currentSceneIndex, isLive, textOverlays, blackScreen } = usePresentationStore()
  const currentScene = scenes[currentSceneIndex]

  const getOutputContent = useCallback(() => {
    if (!isLive) return null
    if (blackScreen) {
      return { type: 'black' as const }
    }
    if (!currentScene) return { type: 'empty' as const }
    return { type: 'scene' as const, scene: currentScene, overlays: textOverlays }
  }, [isLive, blackScreen, currentScene, textOverlays])

  // Send state to output window via postMessage
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
