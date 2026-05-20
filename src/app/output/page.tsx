'use client'

import React, { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react'
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
 * Optimized overlay renderer
 * Supports scrolling text overlay type
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
  const [connected, setConnected] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute connection mode from window.opener - no setState needed in effects
  const connectionMode = useMemo(() => {
    if (typeof window === 'undefined') return 'unknown'
    return window.opener ? 'local' : 'remote'
  }, [])

  const handleFullscreen = useCallback(() => {
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen?.()
    }
  }, [])

  // === HANDLE FIRST USER INTERACTION FOR AUTOPLAY ===
  const handleUserInteraction = useCallback(() => {
    if (userInteracted) return
    setUserInteracted(true)

    // Resume AudioContext
    if (outputAudioCtx?.state === 'suspended') {
      outputAudioCtx.resume().catch(() => {})
    }

    // Force play all videos
    const videos = document.querySelectorAll('video')
    videos.forEach((v) => {
      if (v.paused && !v.ended) {
        v.play().catch(() => {})
      }
    })
  }, [userInteracted])

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
      if (videoPaused) return // Don't force play if user paused
      const videos = document.querySelectorAll('video')
      videos.forEach((v) => {
        if (v.paused && !v.ended) {
          // Start muted if needed for autoplay policy
          if (!userInteracted) {
            v.muted = true
          }
          v.play().then(() => {
            // Unmute after successful play if user has interacted
            if (userInteracted) {
              v.muted = false
            }
          }).catch(() => {})
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
      if (videoPaused) return // Don't auto-resume if user paused
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
  }, [videoPaused, userInteracted])

  // === STATE UPDATE HANDLER (shared by all sync modes) ===
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

  // === MODE 1: LOCAL (postMessage from opener window) ===
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        setConnected(true)
        handleStateUpdate(event.data.payload as OutputState)
      }
      // Handle video pause/play messages
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

  // === MODE 1b: BroadcastChannel sync (more reliable than postMessage) ===
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
      }
    } catch { /* BroadcastChannel not supported */ }

    return () => {
      bc?.close()
    }
  }, [handleStateUpdate])

  // === MODE 2: REMOTE (SSE from server - for cross-device) ===
  useEffect(() => {
    // Only try SSE if not opened as a popup (no window.opener)
    if (window.opener) return

    let eventSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      try {
        eventSource = new EventSource('/api/sync?stream=true')

        eventSource.onopen = () => {
          setConnected(true)
        }

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as OutputState
            // Check if it's a video control message
            if (payload.type === 'VIDEO_PAUSE') {
              setVideoPaused(true)
              document.querySelectorAll('video').forEach((v) => v.pause())
              return
            }
            if (payload.type === 'VIDEO_PLAY') {
              setVideoPaused(false)
              document.querySelectorAll('video').forEach((v) => {
                v.play().catch(() => {})
              })
              return
            }
            handleStateUpdate(payload)
          } catch { /* ignore parse errors */ }
        }

        eventSource.onerror = () => {
          setConnected(false)
          eventSource?.close()
          // Auto-reconnect after 3 seconds
          reconnectTimer = setTimeout(connect, 3000)
        }
      } catch {
        // SSE not supported, fallback to polling
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      eventSource?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [handleStateUpdate])

  // Per-slide transition: use the transition from payload (already resolved)
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
          <div className="text-center">
            <p className="text-xl mb-2">Đang chờ nội dung trình chiếu...</p>
            {connectionMode === 'remote' && !connected && (
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
      onClick={(e) => {
        handleUserInteraction()
        handleFullscreen()
      }}
      onDoubleClick={() => document.exitFullscreen?.()}
      onKeyDown={() => handleUserInteraction()}
      onMouseMove={() => handleUserInteraction()}
    >
      {/* 16:9 aspect ratio container - centers content within the full screen */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-[177.78vh] max-h-full">
          {renderScene()}
          {state.overlays && <OverlayRenderer overlays={state.overlays} />}
        </div>
      </div>

      {/* Click-to-activate overlay (shown when no user interaction yet) */}
      {!userInteracted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-white/10 text-center animate-pulse">
            <p className="text-sm">Nhấn để kích hoạt âm thanh</p>
          </div>
        </div>
      )}

      {/* Connection status indicator - subtle, top right */}
      {connectionMode === 'remote' && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5 opacity-30 hover:opacity-80 transition-opacity">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[9px] text-white/70">
            {connected ? 'Đã kết nối' : 'Mất kết nối'}
          </span>
        </div>
      )}
    </div>
  )
}
