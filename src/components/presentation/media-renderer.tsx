'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { usePresentationStore, Scene, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'

// === WEB AUDIO API KEEP-ALIVE ===
let audioContext: AudioContext | null = null
let silenceOscillator: OscillatorNode | null = null
let silenceGain: GainNode | null = null

function startAudioKeepAlive() {
  if (audioContext) return
  try {
    audioContext = new AudioContext()
    silenceGain = audioContext.createGain()
    silenceGain.gain.value = 0.001
    silenceOscillator = audioContext.createOscillator()
    silenceOscillator.frequency.value = 1
    silenceOscillator.connect(silenceGain)
    silenceGain.connect(audioContext.destination)
    silenceOscillator.start()
  } catch { /* ignore */ }
}

function stopAudioKeepAlive() {
  try {
    silenceOscillator?.stop()
    silenceOscillator?.disconnect()
    silenceGain?.disconnect()
    audioContext?.close()
  } catch { /* ignore */ }
  audioContext = null
  silenceOscillator = null
  silenceGain = null
}

// === PRELOADING CACHE ===
const preloadedImages = new Map<string, HTMLImageElement>()
const preloadedVideos = new Map<string, HTMLVideoElement>()

function preloadScene(scene: Scene) {
  if (!scene.src) return
  if (scene.type === 'image' || scene.type === 'pptx-slide') {
    if (!preloadedImages.has(scene.src)) {
      const img = new Image()
      img.src = scene.src
      preloadedImages.set(scene.src, img)
    }
  } else if (scene.type === 'video') {
    if (!preloadedVideos.has(scene.src)) {
      const vid = document.createElement('video')
      vid.src = scene.src
      vid.preload = 'auto'
      vid.muted = true
      vid.load()
      preloadedVideos.set(scene.src, vid)
    }
  }
}

// === VIDEO PAUSE STATE ===
let videoPausedByUser = false

export function setVideoPaused(paused: boolean) {
  videoPausedByUser = paused
  // Also send postMessage to output window
  try {
    const outputWindow = usePresentationStore.getState().outputWindowRef
    if (outputWindow && !outputWindow.closed) {
      outputWindow.postMessage({
        type: paused ? 'VIDEO_PAUSE' : 'VIDEO_PLAY',
      }, window.location.origin)
    }
  } catch { /* ignore */ }
  // Also send via API for remote devices
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: paused ? 'VIDEO_PAUSE' : 'VIDEO_PLAY' }),
  }).catch(() => {})
}

export function isVideoPaused() {
  return videoPausedByUser
}

interface MediaRendererProps {
  scene: Scene
  className?: string
  isActive?: boolean
  /** keepAlive = true means this is in the OUTPUT window (actual projection) */
  keepAlive?: boolean
  /** Whether this is a preview panel (not the actual output) */
  isPreview?: boolean
}

/**
 * MediaRenderer - Optimized for smooth playback
 * - Memoized to prevent unnecessary re-renders
 * - GPU-accelerated with will-change hints
 * - Video preloading and seamless playback
 * - Video only auto-plays in OUTPUT window, not in preview panels
 * - Supports trimStart/trimEnd for video trimming
 */
export const MediaRenderer = memo(function MediaRenderer({ scene, className = '', isActive = true, keepAlive = false, isPreview = false }: MediaRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoVolume = usePresentationStore((s) => s.videoVolume)
  const videoMuted = usePresentationStore((s) => s.videoMuted)

  // Whether video should actually play (only in output window, not in preview)
  const shouldAutoPlay = isActive && keepAlive && !isPreview

  // Auto-play video when scene becomes active in the output window
  useEffect(() => {
    if (scene.type === 'video' && videoRef.current && shouldAutoPlay) {
      const video = videoRef.current
      // Use requestAnimationFrame for smooth startup
      requestAnimationFrame(() => {
        // Apply trim start
        if (scene.trimStart !== undefined && scene.trimStart > 0) {
          video.currentTime = scene.trimStart
        } else {
          video.currentTime = 0
        }
        video.play().catch(() => {})
      })
    }
  }, [scene.id, scene.type, shouldAutoPlay, scene.trimStart])

  // Pause video when not active (especially in preview panels)
  useEffect(() => {
    if (scene.type === 'video' && videoRef.current && !shouldAutoPlay) {
      const video = videoRef.current
      video.pause()
    }
  }, [shouldAutoPlay, scene.type])

  // Handle video trim end - pause or loop when reaching trimEnd
  useEffect(() => {
    if (scene.type !== 'video' || !videoRef.current || !shouldAutoPlay) return
    if (scene.trimEnd === undefined && scene.trimStart === undefined) return

    const video = videoRef.current
    const handleTimeUpdate = () => {
      if (scene.trimEnd !== undefined && video.currentTime >= scene.trimEnd) {
        // Loop back to trimStart or pause
        if (scene.trimStart !== undefined) {
          video.currentTime = scene.trimStart
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [scene.type, shouldAutoPlay, scene.trimStart, scene.trimEnd])

  // Sync volume/mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume
      videoRef.current.muted = videoMuted
    }
  }, [videoVolume, videoMuted])

  // === ENHANCED BACKGROUND PLAYBACK FIX ===
  useEffect(() => {
    if (!keepAlive || scene.type !== 'video') return

    startAudioKeepAlive()

    const forcePlay = () => {
      if (!videoRef.current) return
      if (videoRef.current.paused && !videoRef.current.ended && shouldAutoPlay && !videoPausedByUser) {
        videoRef.current.play().catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      forcePlay()
    }

    const handleWindowBlur = () => {
      forcePlay()
    }

    // Use requestAnimationFrame-based keep-alive instead of setInterval for smoother behavior
    let keepAliveRunning = true
    const keepAliveLoop = () => {
      if (!keepAliveRunning) return
      forcePlay()
      setTimeout(() => {
        if (keepAliveRunning) requestAnimationFrame(keepAliveLoop)
      }, 2000)
    }
    requestAnimationFrame(keepAliveLoop)

    // Intercept the 'pause' event
    const handleVideoPause = () => {
      if (shouldAutoPlay && !videoRef.current?.ended && !videoPausedByUser) {
        requestAnimationFrame(forcePlay)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    videoRef.current?.addEventListener('pause', handleVideoPause)

    return () => {
      keepAliveRunning = false
      stopAudioKeepAlive()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      videoRef.current?.removeEventListener('pause', handleVideoPause)
    }
  }, [keepAlive, scene.type, shouldAutoPlay])

  // ALL hooks must be called before any conditional returns
  // Determine if we should use preview mode rendering
  const isVideoPreview = scene.type === 'video' && isPreview && !!scene.thumbnail
  const isWebPreview = scene.type === 'web' && isPreview

  const renderContent = useMemo(() => {
    // Preview: show video thumbnail instead of playing video
    if (scene.type === 'video' && isPreview && scene.thumbnail) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden">
          <img
            src={scene.thumbnail}
            alt={scene.name || 'Video'}
            className="max-w-full max-h-full object-contain opacity-80"
            loading="eager"
          />
          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )
    }

    // Preview: render interactive iframe for web type
    if (scene.type === 'web' && isPreview) {
      return (
        <div className="w-full h-full bg-white overflow-hidden">
          <iframe
            src={scene.url}
            className="w-full h-full border-0"
            title={scene.name}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="eager"
          />
        </div>
      )
    }

    switch (scene.type) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden"
            style={{ willChange: 'contents' }}
          >
            <img
              src={scene.src}
              alt={scene.name || 'Image'}
              className="max-w-full max-h-full object-contain"
              style={{ willChange: 'transform', imageRendering: 'auto' }}
              loading="eager"
              decoding="async"
            />
          </div>
        )

      case 'video':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden"
            style={{ willChange: 'contents' }}
          >
            <video
              ref={videoRef}
              src={scene.src}
              className="max-w-full max-h-full"
              style={{ objectFit: 'contain', willChange: 'transform' }}
              controls={false}
              loop
              autoPlay={shouldAutoPlay}
              muted={videoMuted}
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
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
              loading="eager"
            />
          </div>
        )

      case 'text':
        return (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ backgroundColor: scene.bgColor || '#1a1a2e', willChange: 'contents' }}
          >
            <div
              className="max-w-[90%] break-words"
              style={{
                fontSize: `${scene.fontSize || 48}px`,
                color: scene.fontColor || '#ffffff',
                textAlign: scene.textAlign || 'center',
                fontFamily: 'Arial, sans-serif',
                lineHeight: 1.4,
                willChange: 'auto',
              }}
            >
              {scene.content}
            </div>
          </div>
        )

      case 'pptx-slide':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden"
            style={{ willChange: 'contents' }}
          >
            <img
              src={scene.src}
              alt={scene.name || 'PPTX Slide'}
              className="max-w-full max-h-full object-contain"
              style={{ willChange: 'transform' }}
              loading="eager"
              decoding="async"
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
   
  }, [scene.id, scene.type, scene.src, scene.url, scene.content, scene.fontSize, scene.fontColor, scene.bgColor, scene.textAlign, scene.name, shouldAutoPlay, videoMuted, isPreview, scene.thumbnail])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {renderContent}
    </div>
  )
})

/**
 * TransitionRenderer - Optimized cross-transition with GPU compositing
 * Now supports per-slide transition overrides via scene.sceneTransitionType
 */
interface TransitionRendererProps {
  scene: Scene | undefined
  transitionType: TransitionType
  transitionDuration: number
  className?: string
  isActive?: boolean
  keepAlive?: boolean
  isPreview?: boolean
}

export const TransitionRenderer = memo(function TransitionRenderer({
  scene,
  transitionType,
  transitionDuration,
  className = '',
  isActive = true,
  keepAlive = false,
  isPreview = false,
}: TransitionRendererProps) {
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine effective transition: per-slide overrides global
  const effectiveTransitionType = scene?.sceneTransitionType || transitionType
  const effectiveTransitionDuration = scene?.sceneTransitionDuration || transitionDuration

  // Preload next scene for instant switching
  useEffect(() => {
    const scenes = usePresentationStore.getState().scenes
    const currentIdx = scenes.findIndex((s) => s.id === scene?.id)
    // Preload next 2 scenes
    for (let i = 1; i <= 2; i++) {
      const nextScene = scenes[currentIdx + i]
      if (nextScene) preloadScene(nextScene)
    }
  }, [scene?.id])

  useEffect(() => {
    const newId = scene?.id

    if (prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== newId && scene) {
      const oldScene = usePresentationStore.getState().scenes.find(
        (s) => s.id === prevSceneIdRef.current
      )
      if (oldScene && effectiveTransitionType !== 'none') {
        setPrevScene(oldScene)
        setIsTransitioning(true)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          setPrevScene(undefined)
          setIsTransitioning(false)
        }, effectiveTransitionDuration + 50)
      }
    }

    prevSceneIdRef.current = newId
  }, [scene?.id, effectiveTransitionType, effectiveTransitionDuration])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!scene) {
    return <div className={`w-full h-full ${className}`} />
  }

  if (effectiveTransitionType === 'none' || !isTransitioning) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`} style={{ willChange: 'contents' }}>
        <div key={scene.id} className="w-full h-full">
          <MediaRenderer scene={scene} isActive={isActive} keepAlive={keepAlive} isPreview={isPreview} />
        </div>
      </div>
    )
  }

  const duration = `${effectiveTransitionDuration}ms`
  const durationVar = { '--transition-duration': duration } as React.CSSProperties

  return (
    <div
      className={`w-full h-full overflow-hidden transition-container ${className}`}
      style={{ ...durationVar, willChange: 'contents' }}
    >
      {prevScene && (
        <div
          key={`exit-${prevScene.id}`}
          className={`transition-${effectiveTransitionType}-exit`}
          style={{ animationDuration: duration, ...durationVar, willChange: 'opacity, transform' }}
        >
          <MediaRenderer scene={prevScene} isActive={false} keepAlive={keepAlive} isPreview={isPreview} />
        </div>
      )}
      <div
        key={`enter-${scene.id}`}
        className={`transition-${effectiveTransitionType}-enter`}
        style={{ animationDuration: duration, ...durationVar, willChange: 'opacity, transform' }}
      >
        <MediaRenderer scene={scene} isActive={isActive} keepAlive={keepAlive} isPreview={isPreview} />
      </div>
    </div>
  )
})

/**
 * Component that syncs with the output window for dual-screen projection
 * Supports both:
 * - LOCAL: postMessage to popup window (same device, dual monitor)
 * - REMOTE: POST to /api/sync for cross-device (SSE to output page)
 * Now includes per-slide transition overrides
 */
export function OutputSync() {
  const { scenes, currentSceneIndex, isLive, textOverlays, blackScreen, transitionType, transitionDuration, videoVolume, videoMuted } = usePresentationStore()
  const currentScene = scenes[currentSceneIndex]

  const getOutputContent = useCallback(() => {
    if (!isLive) return null
    if (blackScreen) return { type: 'black' as const }
    if (!currentScene) return { type: 'empty' as const }
    return {
      type: 'scene' as const,
      scene: currentScene,
      overlays: textOverlays,
      // Per-slide transition: scene can override global
      transitionType: currentScene.sceneTransitionType || transitionType,
      transitionDuration: currentScene.sceneTransitionDuration || transitionDuration,
      videoVolume,
      videoMuted,
    }
  }, [isLive, blackScreen, currentScene, textOverlays, transitionType, transitionDuration, videoVolume, videoMuted])

  useEffect(() => {
    const output = getOutputContent()
    if (!output) return

    // MODE 1: Local sync (postMessage to popup window)
    try {
      const outputWindow = usePresentationStore.getState().outputWindowRef
      if (outputWindow && !outputWindow.closed) {
        outputWindow.postMessage({
          type: 'PRESENTATION_UPDATE',
          payload: output,
        }, window.location.origin)
      }
    } catch { /* Window may be closed */ }

    // MODE 2: Remote sync (POST to API for cross-device SSE)
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(output),
    }).catch(() => { /* Network error, ignore */ })
  }, [getOutputContent])

  return null
}
