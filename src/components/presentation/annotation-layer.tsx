'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { AnnotationPath, AnnotationPoint, AnnotationTool } from '@/store/presentation-store'

interface AnnotationLayerProps {
  tool?: AnnotationTool
  pointerPosition?: AnnotationPoint | null
  paths: AnnotationPath[]
  color?: string
  size?: number
  interactive?: boolean
  className?: string
  onPointerMove?: (point: AnnotationPoint | null) => void
  onStartPath?: (point: AnnotationPoint) => void
  onAppendPoint?: (point: AnnotationPoint) => void
}

function pointsToPath(points: AnnotationPoint[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x * 100} ${points[0].y * 100}`
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * 100} ${point.y * 100}`)
    .join(' ')
}

export function AnnotationLayer({
  tool = 'none',
  pointerPosition,
  paths,
  color = '#39ff14',
  size = 5,
  interactive = false,
  className = '',
  onPointerMove,
  onStartPath,
  onAppendPoint,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const canInteract = interactive && tool !== 'none'

  const getPoint = useCallback((event: React.PointerEvent<HTMLDivElement>): AnnotationPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }, [])

  const renderedPaths = useMemo(
    () => paths.map((path) => ({ ...path, d: pointsToPath(path.points) })),
    [paths]
  )

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 z-[60] ${canInteract ? 'pointer-events-auto' : 'pointer-events-none'} ${className}`}
      style={{ cursor: canInteract ? (tool === 'pen' ? 'crosshair' : 'none') : undefined }}
      onPointerMove={(event) => {
        if (!canInteract) return
        const point = getPoint(event)
        onPointerMove?.(point)
        if (tool === 'pen' && isDrawing) onAppendPoint?.(point)
      }}
      onPointerLeave={() => {
        if (!canInteract) return
        onPointerMove?.(null)
        setIsDrawing(false)
      }}
      onPointerDown={(event) => {
        if (!canInteract) return
        const point = getPoint(event)
        onPointerMove?.(point)
        if (tool === 'pen') {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          setIsDrawing(true)
          onStartPath?.(point)
        }
      }}
      onPointerUp={() => setIsDrawing(false)}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {renderedPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke={path.color}
            strokeWidth={Math.max(0.25, path.size / 5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 ${Math.max(3, path.size)}px ${path.color})` }}
          />
        ))}
      </svg>

      {pointerPosition && tool !== 'none' && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pointerPosition.x * 100}%`,
            top: `${pointerPosition.y * 100}%`,
            width: tool === 'laser' ? 26 : Math.max(14, size * 3),
            height: tool === 'laser' ? 26 : Math.max(14, size * 3),
            border: `2px solid ${color}`,
            background: tool === 'laser' ? color : 'transparent',
            boxShadow: `0 0 18px ${color}, 0 0 42px ${color}`,
            opacity: tool === 'laser' ? 0.86 : 0.7,
          }}
        />
      )}
    </div>
  )
}
