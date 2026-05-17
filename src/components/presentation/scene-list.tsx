'use client'

import React, { useState } from 'react'
import { usePresentationStore, Scene, TextOverlay } from '@/store/presentation-store'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Image,
  Video,
  Globe,
  Type,
  Presentation,
  Eye,
  EyeOff,
  Plus,
  Bell,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddSceneDialog } from './add-scene-dialog'

function SceneIcon({ type }: { type: Scene['type'] }) {
  switch (type) {
    case 'image':
      return <Image className="w-4 h-4 text-blue-400" />
    case 'video':
      return <Video className="w-4 h-4 text-purple-400" />
    case 'web':
      return <Globe className="w-4 h-4 text-cyan-400" />
    case 'text':
      return <Type className="w-4 h-4 text-yellow-400" />
    case 'pptx-slide':
      return <Presentation className="w-4 h-4 text-orange-400" />
    default:
      return null
  }
}

function SortableSceneItem({
  scene,
  isActive,
  onClick,
  onDelete,
}: {
  scene: Scene
  isActive: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
        isActive
          ? 'bg-emerald-600/20 border border-emerald-500/50'
          : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <SceneIcon type={scene.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">{scene.name}</p>
      </div>
      {scene.type === 'image' && scene.thumbnail && (
        <div className="w-8 h-6 rounded overflow-hidden flex-shrink-0">
          <img src={scene.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export function SceneList() {
  const { scenes, currentSceneIndex, setCurrentSceneIndex, removeScene, reorderScenes } =
    usePresentationStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id)
      const newIndex = scenes.findIndex((s) => s.id === over.id)
      reorderScenes(oldIndex, newIndex)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Danh sách trình chiếu
        </h3>
        <AddSceneDialog />
      </div>

      <ScrollArea className="flex-1">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Image className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Chưa có thành phần nào</p>
            <p className="text-xs mt-1">Nhấn &quot;Thêm thành phần&quot; để bắt đầu</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {scenes.map((scene, index) => (
                  <SortableSceneItem
                    key={scene.id}
                    scene={scene}
                    isActive={index === currentSceneIndex}
                    onClick={() => setCurrentSceneIndex(index)}
                    onDelete={() => removeScene(scene.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </ScrollArea>
    </div>
  )
}

/**
 * Text overlay management panel
 */
export function TextOverlayPanel() {
  const { textOverlays, addTextOverlay, removeTextOverlay, toggleTextOverlay, updateTextOverlay } =
    usePresentationStore()
  const [newText, setNewText] = useState('')
  const [showForm, setShowForm] = useState(false)

  const handleAdd = () => {
    if (!newText.trim()) return
    addTextOverlay({
      text: newText,
      visible: false,
      fontSize: 32,
      fontColor: '#ffffff',
      bgColor: 'rgba(0,0,0,0.7)',
      position: 'bottom',
    })
    setNewText('')
    setShowForm(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Thông báo chữ
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowForm(!showForm)}
          className="text-emerald-400 hover:text-emerald-300 h-7"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 bg-zinc-800 rounded-lg space-y-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nhập thông báo..."
            className="bg-zinc-700 border-zinc-600 text-zinc-200 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
            >
              Thêm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="text-zinc-400 text-xs h-7"
            >
              Hủy
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {textOverlays.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">
            Thêm thông báo chữ để hiển thị trên màn hình chiếu
          </p>
        ) : (
          <div className="space-y-1">
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 group"
              >
                <button onClick={() => toggleTextOverlay(overlay.id)} className="flex-shrink-0">
                  {overlay.visible ? (
                    <Eye className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
                <span className="text-sm text-zinc-300 truncate flex-1">{overlay.text}</span>
                <button
                  onClick={() => removeTextOverlay(overlay.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
