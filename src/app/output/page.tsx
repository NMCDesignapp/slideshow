'use client'

import React, { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react'
import { AnnotationPath, AnnotationPoint, AnnotationTool, Scene, TextOverlay, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'
import { MediaRenderer } from '@/components/presentation/media-renderer'
import { AnnotationLayer } from '@/components/presentation/annotation-layer'

interface OutputState {
  type: 'empty' | 'black' | 'scene'
  scene?: Scene
  overlays?: TextOverlay[]
  transitionType?: TransitionType
  transitionDuration?: number
  videoVolume?: number
  videoMuted?: boolean
  annotationTool?: AnnotationTool
  annotationColor?: string
  annotationSize?: number
  pointerPosition?: AnnotationPoint | null
  annotationPaths?: AnnotationPath[]
}

// === WEB AUDIO API KEEP-ALIVE ===
let outputAudioCtx: AudioContext | null = null
let outputOsc: OscillatorNode | null = null
let outputGain: GainNode | null = null

function startOutputAudioKeepAlive() {
  if (outputAudioCtx) return
  try {
    outputAudioCtx = new AudioContext()
    outputGain = outputAudioCtx.createGain()
    outputGain.gain.value = 0.001
    outputOsc = outputAudioCtx.createOscillator()
    outputOsc.frequency.value = 1
    outputOsc.connect(outputGain)
    outputGain.connect(outputAudioCtx.destination)
    outputOsc.start()
  } catch { /* ignore */ }
}

function stopOutputAudioKeepAlive() {
  try {
    outputOsc?.stop()
    outputOsc?.disconnect()
    outputGain?.disconnect()
    outputAudioCtx?.close()
  } catch { /* ignore */ }
  outputAudioCtx = null
  outputOsc = null
  outputGain = null
}

/**
 * Optimized overlay renderer with animation support
 */
const OverlayRenderer = memo(function OverlayRenderer({ overlays }: { overlays: TextOverlay[] }) {
  const visibleOverlays = overlays.filter((o) => o.visible)
  if (visibleOverlays.length === 0) return null

  return (
    <>
      {visibleOverlays.map((overlay) => {
        const positionClasses: Record<string, string> = {
          top: 'top-0 left-0 right-0',
          bottom: 'bottom-0 left-0 right-0',
          center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        }

        const enterClass: Record<string, string> = {
          top: 'overlay-enter-top',
          bottom: 'overlay-enter-bottom',
          center: 'overlay-enter-center',
        }

        const isScrolling = overlay.animation === 'scroll'
        const isTypewriter = overlay.animation === 'typewriter'
        const scrollDuration = overlay.scrollDuration || 15

        return (
          <div
            key={overlay.id}
            className={`absolute ${positionClasses[overlay.position] || positionClasses.bottom} p-4 z-50 ${enterClass[overlay.position] || 'overlay-enter-bottom'}`}
          >
            <div
              className={`px-6 py-3 rounded-lg inline-block max-w-full overflow-hidden`}
              style={{
                backgroundColor: overlay.bgColor || 'rgba(0,0,0,0.7)',
                fontSize: `${overlay.fontSize || 32}px`,
                color: overlay.fontColor || '#ffffff',
                fontFamily: 'Arial, sans-serif',
                ...(isScrolling ? { '--ticker-duration': `${scrollDuration}s` } as React.CSSProperties : {}),
              }}
            >
              {isScrolling ? (
                <span className="overlay-ticker" style={{ '--ticker-duration': `${scrollDuration}s` } as React.CSSProperties}>
                  {overlay.text} &nbsp;&nbsp;&nbsp; {overlay.text} &nbsp;&nbsp;&nbsp; {overlay.text}
                </span>
              ) : isTypewriter ? (
                <span className="overlay-typewriter" style={{ '--typewriter-steps': overlay.text.length } as React.CSSProperties}>{overlay.text}</span>
              ) : (
                overlay.text
              )}
            </div>
          </div>
        )
      })}
    </>
  )
})

// Aspect ratio options for output display
const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9', widthRatio: 16, heightRatio: 9 },
  { label: '4:3', value: '4:3', widthRatio: 4, heightRatio: 3 },
]

export default function OutputPage() {
  const [state, setState] = useState<OutputState>({ type: 'empty' })
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [connected, setConnected] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>('16:9')
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFullscreen = useCallback(() => {
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen?.()
    }
  }, [])

  // === BACKGROUND PLAYBACK FIX ===
  useEffect(() => {
    let wakeLock: any = null

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch { /* not available */ }
    }

    requestWakeLock()
    startOutputAudioKeepAlive()

    const forceAllVideosPlay = () => {
      if (videoPaused) return
      const videos = document.querySelectorAll('video')
      videos.forEach((v) => {
        if (v.paused && !v.ended) {
          v.play().catch(() => {})
        }
      })
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
      forceAllVideosPlay()
    }

    let keepAliveRunning = true
    const keepAliveLoop = () => {
      if (!keepAliveRunning) return
      forceAllVideosPlay()
      setTimeout(() => {
        if (keepAliveRunning) requestAnimationFrame(keepAliveLoop)
      }, 2000)
    }
    requestAnimationFrame(keepAliveLoop)

    const handleWindowBlur = () => {
      forceAllVideosPlay()
    }

    const handleVideoPauseGlobal = (e: Event) => {
      if (videoPaused) return
      const video = e.target as HTMLVideoElement
      if (video && !video.ended) {
        requestAnimationFrame(() => {
          video.play().catch(() => {})
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleWindowBlur)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            node.addEventListener('pause', handleVideoPauseGlobal)
          }
          if (node instanceof HTMLElement) {
            node.querySelectorAll('video').forEach((v) => {
              v.addEventListener('pause', handleVideoPauseGlobal)
            })
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    document.querySelectorAll('video').forEach((v) => {
      v.addEventListener('pause', handleVideoPauseGlobal)
    })

    return () => {
      keepAliveRunning = false
      stopOutputAudioKeepAlive()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleWindowBlur)
      observer.disconnect()
      document.querySelectorAll('video').forEach((v) => {
        v.removeEventListener('pause', handleVideoPauseGlobal)
      })
      if (wakeLock) wakeLock.release?.()
    }
  }, [videoPaused])

  // === STATE UPDATE HANDLER (shared by all modes) ===
  const handleStateUpdate = useCallback((payload: OutputState) => {
    const newId = payload.scene?.id

    // Detect scene change for cross-transition
    if (prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== newId && payload.scene) {
      const tType = payload.transitionType || 'none'
      if (tType !== 'none' && prevSceneIdRef.current) {
        setPrevScene(state.scene)
        setIsTransitioning(true)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          setPrevScene(undefined)
          setIsTransitioning(false)
        }, (payload.transitionDuration || DEFAULT_TRANSITION_DURATION) + 50)
      }
    }

    prevSceneIdRef.current = newId
    setState(payload)
  }, [state.scene])

  // === MODE 1: BroadcastChannel (MOST RELIABLE - works for popup, manual tab, same device) ===
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('showflow-sync')

      bc.onmessage = (event) => {
        const data = event.data
        if (data?.type === 'PRESENTATION_UPDATE') {
          setConnected(true)
          handleStateUpdate(data.payload as OutputState)
        }
        if (data?.type === 'VIDEO_PAUSE') {
          setVideoPaused(true)
          document.querySelectorAll('video').forEach((v) => v.pause())
        }
        if (data?.type === 'VIDEO_PLAY') {
          setVideoPaused(false)
          document.querySelectorAll('video').forEach((v) => {
            v.play().catch(() => {})
          })
        }
        if (data?.type === 'REQUEST_FULLSCREEN') {
          handleFullscreen()
        }
      }
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      bc?.close()
    }
  }, [handleStateUpdate, handleFullscreen])

  // === MODE 2: postMessage from opener window (legacy fallback) ===
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        setConnected(true)
        handleStateUpdate(event.data.payload as OutputState)
      }
      if (event.data?.type === 'VIDEO_PAUSE') {
        setVideoPaused(true)
        document.querySelectorAll('video').forEach((v) => v.pause())
      }
      if (event.data?.type === 'VIDEO_PLAY') {
        setVideoPaused(false)
        document.querySelectorAll('video').forEach((v) => {
          v.play().catch(() => {})
        })
      }
    }

    window.addEventListener('message', handler)

    // Signal opener that we're ready
    if (window.opener) {
      window.opener.postMessage({ type: 'OUTPUT_READY' }, '*')
    }

    return () => {
      window.removeEventListener('message', handler)
    }
  }, [handleStateUpdate])

  // Per-slide transition
  const transitionType = state.transitionType || 'none'
  const transitionDuration = state.transitionDuration || DEFAULT_TRANSITION_DURATION
  const duration = `${transitionDuration}ms`
  const durationVar = { '--transition-duration': duration } as React.CSSProperties

  // Calculate aspect ratio container
  const selectedRatio = ASPECT_RATIOS.find(r => r.value === aspectRatio) || ASPECT_RATIOS[0]

  const renderScene = () => {
    if (state.type === 'black') {
      return <div className="absolute inset-0 bg-black z-10" />
    }

    if (state.type === 'empty' || !state.scene) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white/20">
          <div className="text-center">
            <p className="text-xl mb-2">Đang chờ nội dung trình chiếu...</p>
            {!connected && (
              <p className="text-sm text-yellow-400/60">Đang kết nối tới máy điều khiển...</p>
            )}
          </div>
        </div>
      )
    }

    const scene = state.scene

    if (transitionType === 'none' || !isTransitioning) {
      return (
        <div className="absolute inset-0" style={{ willChange: 'contents' }}>
          <MediaRenderer scene={scene} isActive={true} keepAlive={true} />
        </div>
      )
    }

    return (
      <div
        className="absolute inset-0 overflow-hidden transition-container"
        style={{ ...durationVar, willChange: 'contents' }}
      >
        {prevScene && (
          <div
            key={`exit-${prevScene.id}`}
            className={`transition-${transitionType}-exit`}
            style={{ animationDuration: duration, ...durationVar, willChange: 'opacity, transform' }}
          >
            <MediaRenderer scene={prevScene} isActive={false} keepAlive={true} />
          </div>
        )}
        <div
          key={`enter-${scene.id}`}
          className={`transition-${transitionType}-enter`}
          style={{ animationDuration: duration, ...durationVar, willChange: 'opacity, transform' }}
        >
          <MediaRenderer scene={scene} isActive={true} keepAlive={true} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black cursor-none group"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
      onClick={handleFullscreen}
      onDoubleClick={() => document.exitFullscreen?.()}
    >
      {/* Full screen content - fills entire screen */}
      <div className="absolute inset-0">
        {renderScene()}
        {state.overlays && <OverlayRenderer overlays={state.overlays} />}
        <AnnotationLayer
          tool={state.annotationTool}
          pointerPosition={state.pointerPosition}
          paths={state.annotationPaths || []}
          color={state.annotationColor}
          size={state.annotationSize}
        />
      </div>

      {/* Aspect ratio buttons - top-left, appear on hover */}
      <div className="absolute top-3 left-3 z-50 opacity-0 group-hover:opacity-70 transition-opacity duration-300 flex gap-1">
        {ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio.value}
            onClick={(e) => {
              e.stopPropagation()
              setAspectRatio(ratio.value)
            }}
            className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
              aspectRatio === ratio.value
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
            }`}
          >
            {ratio.label}
          </button>
        ))}
      </div>

      {/* Connection status indicator - subtle, top right */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5 opacity-30 hover:opacity-80 transition-opacity">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
        <span className="text-[9px] text-white/70">
          {connected ? 'Đã kết nối' : 'Đang chờ...'}
        </span>
      </div>
    </div>
  )
}
