'use client'

import React, { useEffect, useState, useRef } from 'react'
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

export default function OutputPage() {
  const [state, setState] = useState<OutputState>({ type: 'empty' })
  const [prevScene, setPrevScene] = useState<Scene | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevSceneIdRef = useRef<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFullscreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen?.()
    }
  }

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

    // Re-request wake lock on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
      // Force all videos to keep playing
      forceAllVideosPlay()
    }

    // Force video to keep playing on visibility change
    const forceAllVideosPlay = () => {
      const videos = document.querySelectorAll('video')
      videos.forEach((v) => {
        if (v.paused && !v.ended) {
          v.play().catch(() => {})
        }
      })
    }

    // Periodic keep-alive: check every 2 seconds
    const keepAliveInterval = setInterval(forceAllVideosPlay, 2000)

    // Handle window blur (user switches to another app)
    const handleWindowBlur = () => {
      forceAllVideosPlay()
    }

    // Also intercept the 'pause' event on any video element
    const handleVideoPauseGlobal = (e: Event) => {
      const video = e.target as HTMLVideoElement
      if (video && !video.ended) {
        // Browser may have auto-paused; resume after tiny delay
        setTimeout(() => {
          video.play().catch(() => {})
        }, 50)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('visibilitychange', forceAllVideosPlay)
    window.addEventListener('blur', handleWindowBlur)

    // Use MutationObserver to attach pause listeners to new video elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            node.addEventListener('pause', handleVideoPauseGlobal)
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Attach to any existing videos
    document.querySelectorAll('video').forEach((v) => {
      v.addEventListener('pause', handleVideoPauseGlobal)
    })

    return () => {
      stopOutputAudioKeepAlive()
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('visibilitychange', forceAllVideosPlay)
      window.removeEventListener('blur', handleWindowBlur)
      observer.disconnect()
      clearInterval(keepAliveInterval)
      document.querySelectorAll('video').forEach((v) => {
        v.removeEventListener('pause', handleVideoPauseGlobal)
      })
      if (wakeLock) wakeLock.release?.()
    }
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRESENTATION_UPDATE') {
        const payload = event.data.payload as OutputState
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
        <div className="absolute inset-0">
          <MediaRenderer
            scene={scene}
            isActive={true}
            keepAlive={true}
          />
        </div>
      )
    }

    // Cross-transition
    return (
      <div className="absolute inset-0 overflow-hidden transition-container" style={durationVar}>
        {prevScene && (
          <div
            key={`exit-${prevScene.id}`}
            className={`transition-${transitionType}-exit`}
            style={{ animationDuration: duration, ...durationVar }}
          >
            <MediaRenderer scene={prevScene} isActive={false} keepAlive={true} />
          </div>
        )}
        <div
          key={`enter-${scene.id}`}
          className={`transition-${transitionType}-enter`}
          style={{ animationDuration: duration, ...durationVar }}
        >
          <MediaRenderer scene={scene} isActive={true} keepAlive={true} />
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
