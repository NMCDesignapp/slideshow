'use client'

import React, { useState, useCallback, useRef } from 'react'
import { usePresentationStore, SceneType, Scene } from '@/store/presentation-store'
import { parsePptx } from '@/lib/pptx-parser'
import {
  Image,
  Video,
  Globe,
  Type,
  Presentation,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type AddMode = 'image' | 'video' | 'web' | 'text' | 'pptx'

// PPTX file counter for unique IDs
let pptxCounter = 0

// Generate thumbnail from video file
function generateVideoThumbnail(videoSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 192
        canvas.height = 108
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          resolve(dataUrl)
        } else {
          resolve('')
        }
      } catch {
        resolve('')
      }
      video.src = ''
      video.load()
    }

    video.onerror = () => {
      resolve('')
    }

    video.src = videoSrc
    video.load()
  })
}

export function AddSceneDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AddMode>('image')
  const addScene = usePresentationStore((s) => s.addScene)

  // Form states
  const [imageUrl, setImageUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [webUrl, setWebUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [textFontSize, setTextFontSize] = useState(48)
  const [textFontColor, setTextFontColor] = useState('#ffffff')
  const [textBgColor, setTextBgColor] = useState('#1a1a2e')
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')
  const [loading, setLoading] = useState(false)

  // Selected files state for filename chips
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setImageUrl('')
    setVideoUrl('')
    setWebUrl('')
    setTextContent('')
    setTextFontSize(48)
    setTextFontColor('#ffffff')
    setTextBgColor('#1a1a2e')
    setTextAlign('center')
    setLoading(false)
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const newFiles = Array.from(files)
      setSelectedFiles((prev) => [...prev, ...newFiles])
    },
    []
  )

  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const processFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return

    setLoading(true)
    try {
      for (const file of selectedFiles) {
        if (mode === 'pptx') {
          try {
            const slides = await parsePptx(file)
            const pptxFileId = `pptx-${++pptxCounter}-${file.name}`
            for (const slide of slides) {
              addScene({
                type: 'pptx-slide',
                name: `Slide ${slide.index}`,
                src: slide.src,
                slideIndex: slide.index,
                pptxFileId,
                pptxFileName: file.name,
              })
            }
            toast.success(`Đã trích xuất ${slides.length} slide từ "${file.name}"`)
          } catch (err: any) {
            toast.error(err.message || `Lỗi khi đọc file "${file.name}"`)
          }
        } else if (mode === 'image') {
          const url = URL.createObjectURL(file)
          addScene({
            type: 'image',
            name: file.name,
            src: url,
            thumbnail: url,
          })
        } else if (mode === 'video') {
          const url = URL.createObjectURL(file)
          const thumbnail = await generateVideoThumbnail(url)
          addScene({
            type: 'video',
            name: file.name,
            src: url,
            thumbnail: thumbnail || undefined,
          })
        }
      }
      setOpen(false)
      resetForm()
    } catch (err) {
      console.error('Error processing files:', err)
      toast.error('Lỗi khi xử lý file')
    } finally {
      setLoading(false)
    }
  }, [selectedFiles, mode, addScene])

  const handleSubmit = () => {
    switch (mode) {
      case 'image':
        if (imageUrl) {
          addScene({ type: 'image', name: 'Hình ảnh', src: imageUrl, thumbnail: imageUrl })
        }
        break
      case 'video':
        if (videoUrl) {
          addScene({ type: 'video', name: 'Video', src: videoUrl })
        }
        break
      case 'web':
        if (webUrl) {
          addScene({
            type: 'web',
            name: new URL(webUrl).hostname,
            url: webUrl,
          })
        }
        break
      case 'text':
        if (textContent) {
          addScene({
            type: 'text',
            name: textContent.substring(0, 30),
            content: textContent,
            fontSize: textFontSize,
            fontColor: textFontColor,
            bgColor: textBgColor,
            textAlign,
          })
        }
        break
    }
    setOpen(false)
    resetForm()
  }

  const modeOptions: { value: AddMode; label: string; icon: React.ReactNode }[] = [
    { value: 'image', label: 'Hình ảnh', icon: <Image className="w-4 h-4" aria-hidden /> },
    { value: 'video', label: 'Video', icon: <Video className="w-4 h-4" /> },
    { value: 'web', label: 'Trang web', icon: <Globe className="w-4 h-4" /> },
    { value: 'text', label: 'Văn bản', icon: <Type className="w-4 h-4" /> },
    { value: 'pptx', label: 'PowerPoint', icon: <Presentation className="w-4 h-4" /> },
  ]

  const getAcceptType = () => {
    switch (mode) {
      case 'image': return 'image/*'
      case 'video': return 'video/*'
      case 'pptx': return '.pptx'
      default: return '*'
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5">
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[10px]">Thêm</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <DialogTitle>Thêm thành phần trình chiếu</DialogTitle>
        </DialogHeader>

        {/* Mode selection */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setMode(opt.value); setSelectedFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                mode === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Form based on mode */}
        {mode === 'image' && (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Tải file hình ảnh (chọn nhiều)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
              {/* Filename chips */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-1 bg-zinc-800 border border-zinc-600 rounded-md px-2 py-1 text-[10px] text-zinc-300 group"
                    >
                      <Image className="w-3 h-3 text-blue-400 flex-shrink-0" aria-hidden />
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <span className="text-zinc-500">({(file.size / 1024).toFixed(0)}KB)</span>
                      <button
                        onClick={() => removeSelectedFile(idx)}
                        className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-zinc-500 text-sm">
              <div className="flex-1 h-px bg-zinc-700" />
              hoặc nhập URL
              <div className="flex-1 h-px bg-zinc-700" />
            </div>
            <div>
              <Label className="text-zinc-300">URL hình ảnh</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
            </div>
          </div>
        )}

        {mode === 'video' && (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Tải file video (chọn nhiều)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileSelect}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
              {/* Filename chips */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-1 bg-zinc-800 border border-zinc-600 rounded-md px-2 py-1 text-[10px] text-zinc-300 group"
                    >
                      <Video className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <span className="text-zinc-500">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
                      <button
                        onClick={() => removeSelectedFile(idx)}
                        className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-zinc-500 text-sm">
              <div className="flex-1 h-px bg-zinc-700" />
              hoặc nhập URL
              <div className="flex-1 h-px bg-zinc-700" />
            </div>
            <div>
              <Label className="text-zinc-300">URL video</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
            </div>
          </div>
        )}

        {mode === 'web' && (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">URL trang web</Label>
              <Input
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
            </div>
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Nội dung văn bản</Label>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Nhập nội dung muốn trình chiếu..."
                rows={4}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Cỡ chữ</Label>
                <Input
                  type="number"
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(Number(e.target.value))}
                  min={12}
                  max={200}
                  className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Căn lề</Label>
                <Select value={textAlign} onValueChange={(v) => setTextAlign(v as 'left' | 'center' | 'right')}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600">
                    <SelectItem value="left">Trái</SelectItem>
                    <SelectItem value="center">Giữa</SelectItem>
                    <SelectItem value="right">Phải</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Màu chữ</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={textFontColor}
                    onChange={(e) => setTextFontColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={textFontColor}
                    onChange={(e) => setTextFontColor(e.target.value)}
                    className="bg-zinc-800 border-zinc-600 text-zinc-200 flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-zinc-300">Màu nền</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={textBgColor}
                    onChange={(e) => setTextBgColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={textBgColor}
                    onChange={(e) => setTextBgColor(e.target.value)}
                    className="bg-zinc-800 border-zinc-600 text-zinc-200 flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'pptx' && (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-300">Tải file PowerPoint</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pptx"
                multiple
                onChange={handleFileSelect}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
              {/* Filename chips for PPTX */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-1 bg-orange-900/30 border border-orange-700/50 rounded-md px-2 py-1.5 text-[10px] text-zinc-300 group"
                    >
                      <Presentation className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                      <span className="text-zinc-500">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
                      <button
                        onClick={() => removeSelectedFile(idx)}
                        className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-zinc-500 text-sm">
              Tất cả các slide trong file PPTX sẽ được trích xuất và thêm vào danh sách trình chiếu.
            </p>
          </div>
        )}

        {/* Submit button */}
        {(mode === 'pptx' || mode === 'image' || mode === 'video') ? (
          <Button
            onClick={processFiles}
            disabled={loading || selectedFiles.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              `Thêm ${selectedFiles.length} file`
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? 'Đang xử lý...' : 'Thêm'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
