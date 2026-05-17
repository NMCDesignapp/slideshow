'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePresentationStore, Scene, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'

// === WEB AUDIO API KEEP-ALIVE ===
// Prevents browser from throttling video/audio when the tab loses focus
let audioContext: AudioContext | null = null
let silenceOscillator: OscillatorNode | null = null
let silenceGain: GainNode | null = null

function startAudioKeepAlive() {
  if (audioContext) return // already running
  try {
    audioContext = new AudioContext()
    silenceGain = audioContext.createGain()
    silenceGain.gain.value = 0.001 // nearly silent
    silenceOscillator = audioContext.createOscillator()
    silenceOscillator.frequency.value = 1 // sub-bass, inaudible
    silenceOscillator.connect(silenceGain)
    silenceGain.connect(audioContext.destination)
    silenceOscillator.start()
  } catch {
    // AudioContext not available
  }
}

function stopAudioKeepAlive() {
  try {
    silenceOscillator?.stop()
    silenceOscillator?.disconnect()
    silenceGain?.disconnect()
    audioContext?.close()
  } catch {
    // ignore
  }
  audioContext = null
  silenceOscillator = null
  silenceGain = null
}

interface MediaRendererProps {
  scene: Scene
  className?: string
  isActive?: boolean
  /** If true, keep video playing even when tab loses focus */
  keepAlive?: boolean
}

export function MediaRenderer({ scene, className = '', isActive = true, keepAlive = false }: MediaRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoVolume = usePresentationStore((s) => s.videoVolume)
  const videoMuted = usePresentationStore((s) => s.videoMuted)

  // Auto-play video when scene becomes active
  useEffect(() => {
    if (scene.type === 'video' && videoRef.current && isActive) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [scene.id, scene.type, isActive])

  // Sync volume/mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume
      videoRef.current.muted = videoMuted
    }
  }, [videoVolume, videoMuted])

  // === ENHANCED BACKGROUND PLAYBACK FIX ===
  // Keep video playing when user switches to another app/tab
  useEffect(() => {
    if (!keepAlive || scene.type !== 'video') return

    // Start Web Audio API keep-alive to prevent browser throttling
    startAudioKeepAlive()

    const forcePlay = () => {
      if (!videoRef.current) return
      if (videoRef.current.paused && !videoRef.current.ended && isActive) {
        videoRef.current.play().catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab lost focus — force video to keep playing
        forcePlay()
      } else {
        // Tab regained focus — ensure still playing
        forcePlay()
      }
    }

    const handleWindowBlur = () => {
      // Window lost focus (user switched app)
      forcePlay()
    }

    // Periodic keep-alive: force play every 2 seconds as safety net
    const keepAliveInterval = setInterval(forcePlay, 2000)

    // Also handle the 'pause' event on the video element itself
    const handleVideoPause = () => {
      if (isActive && !videoRef.current?.ended) {
        // Browser auto-paused; resume immediately
        setTimeout(forcePlay, 50)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    videoRef.current?.addEventListener('pause', handleVideoPause)

    return () => {
      stopAudioKeepAlive()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      videoRef.current?.removeEventListener('pause', handleVideoPause)
      clearInterval(keepAliveInterval)
    }
  }, [keepAlive, scene.type, isActive])

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
              muted={videoMuted}
              playsInline
              // Prevent browser from throttling video on background
              style={{ objectFit: 'contain' as const }}
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
 */
interface TransitionRendererProps {
  scene: Scene | undefined
  transitionType: TransitionType
  transitionDuration: number
  className?: string
  isActive?: boolean
  keepAlive?: boolean
}

export function TransitionRenderer({
  scene,
  transitionType,
  transitionDuration,
  className = '',
  isActive = true,
  keepAlive = false,
}: TransitionRendererProps) {
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const newId = scene?.id

    if (prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== newId && scene) {
      const oldScene = usePresentationStore.getState().scenes.find(
        (s) => s.id === prevSceneIdRef.current
      )
      if (oldScene && transitionType !== 'none') {
        setPrevScene(oldScene)
        setIsTransitioning(true)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          setPrevScene(undefined)
          setIsTransitioning(false)
        }, transitionDuration + 50)
      }
    }

    prevSceneIdRef.current = newId
  }, [scene?.id, transitionType, transitionDuration])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!scene) {
    return <div className={`w-full h-full ${className}`} />
  }

  if (transitionType === 'none' || !isTransitioning) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <div key={scene.id} className="w-full h-full">
          <MediaRenderer scene={scene} isActive={isActive} keepAlive={keepAlive} />
        </div>
      </div>
    )
  }

  const duration = `${transitionDuration}ms`
  const durationVar = { '--transition-duration': duration } as React.CSSProperties

  return (
    <div className={`w-full h-full overflow-hidden transition-container ${className}`} style={durationVar}>
      {prevScene && (
        <div
          key={`exit-${prevScene.id}`}
          className={`transition-${transitionType}-exit`}
          style={{ animationDuration: duration, ...durationVar }}
        >
          <MediaRenderer scene={prevScene} isActive={false} keepAlive={keepAlive} />
        </div>
      )}
      <div
        key={`enter-${scene.id}`}
        className={`transition-${transitionType}-enter`}
        style={{ animationDuration: duration, ...durationVar }}
      >
        <MediaRenderer scene={scene} isActive={isActive} keepAlive={keepAlive} />
      </div>
    </div>
  )
}

/**
 * Component that syncs with the output window for dual-screen projection
 */
export function OutputSync() {
  const { scenes, currentSceneIndex, isLive, textOverlays, blackScreen, transitionType, transitionDuration, videoVolume, videoMuted } = usePresentationStore()
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
      videoVolume,
      videoMuted,
    }
  }, [isLive, blackScreen, currentScene, textOverlays, transitionType, transitionDuration, videoVolume, videoMuted])

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
