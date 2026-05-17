'use client'

import React, { useEffect, useState, useRef, useCallback, memo } from 'react'
import { Scene, TextOverlay, TransitionType, DEFAULT_TRANSITION_DURATION } from '@/store/presentation-store'
import { MediaRenderer } from '@/components/presentation/media-renderer'

interface OutputState {
  type: 'empty' | 'black' | 'scene'
  scene?: Scene
  overlays?: TextOverlay[]
  transitionType?: TransitionType
  transitionDuration?: number
  videoVolume?: number
  videoMuted?: boolean
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
 * Optimized overlay renderer - memoized to prevent re-renders
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

        return (
          <div
            key={overlay.id}
            className={`absolute ${positionClasses[overlay.position] || positionClasses.bottom} p-4 z-50`}
            style={{ willChange: 'auto' }}
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
      })}
    </>
  )
})

export default function OutputPage() {
  const [state, setState] = useState<OutputState>({ type: 'empty' })
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFullscreen = useCallback(() => {
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen?.()
    }
  }, [])

  // === ENHANCED BACKGROUND PLAYBACK FIX ===
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

    // Use requestAnimationFrame-based keep-alive for smoother behavior
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
          // Also check child nodes
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
  }, [])

  // === MESSAGE HANDLER - optimized with useCallback ===
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        const payload = event.data.payload as OutputState
        const newId = payload.scene?.id

        // Detect scene change for cross-transition
        if (prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== newId && payload.scene) {
          const tType = payload.transitionType || 'none'
          if (tType !== 'none' && prevSceneIdRef.current) {
            // Use functional setState to avoid stale closure
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
      }
    }

    window.addEventListener('message', handler)

    if (window.opener) {
      window.opener.postMessage({ type: 'OUTPUT_READY' }, '*')
    }

    return () => {
      window.removeEventListener('message', handler)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scene])

  const transitionType = state.transitionType || 'none'
  const transitionDuration = state.transitionDuration || DEFAULT_TRANSITION_DURATION
  const duration = `${transitionDuration}ms`
  const durationVar = { '--transition-duration': duration } as React.CSSProperties

  const renderScene = () => {
    if (state.type === 'black') {
      return <div className="absolute inset-0 bg-black z-10" />
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
    if (transitionType === 'none' || !isTransitioning) {
      return (
        <div className="absolute inset-0" style={{ willChange: 'contents' }}>
          <MediaRenderer
            scene={scene}
            isActive={true}
            keepAlive={true}
          />
        </div>
      )
    }

    // Cross-transition with GPU compositing
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
      className="fixed inset-0 bg-black cursor-none"
      style={{ 
        // Force GPU compositing layer for the entire output
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
      onClick={handleFullscreen}
      onDoubleClick={() => document.exitFullscreen?.()}
    >
      {renderScene()}
      {state.overlays && <OverlayRenderer overlays={state.overlays} />}
    </div>
  )
}
