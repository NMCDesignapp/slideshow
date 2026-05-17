'use client'

import React, { useState, useCallback } from 'react'
import { usePresentationStore, SceneType, Scene } from '@/store/presentation-store'
import { parsePptx, svgToDataUrl } from '@/lib/pptx-parser'
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

type AddMode = 'image' | 'video' | 'web' | 'text' | 'pptx'

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
  }

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'pptx') => {
      const file = e.target.files?.[0]
      if (!file) return

      setLoading(true)

      try {
        if (type === 'pptx') {
          const slides = await parsePptx(file)
          for (const slide of slides) {
            const dataUrl = svgToDataUrl(slide.svg)
            addScene({
              type: 'pptx-slide',
              name: `${file.name} - Slide ${slide.index}`,
              src: dataUrl,
              slideIndex: slide.index,
            })
          }
          setOpen(false)
          resetForm()
          return
        }

        const url = URL.createObjectURL(file)

        if (type === 'image') {
          addScene({
            type: 'image',
            name: file.name,
            src: url,
            thumbnail: url,
          })
        } else if (type === 'video') {
          addScene({
            type: 'video',
            name: file.name,
            src: url,
          })
        }

        setOpen(false)
        resetForm()
      } catch (err) {
        console.error('Error processing file:', err)
      } finally {
        setLoading(false)
      }
    },
    [addScene]
  )

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
    { value: 'image', label: 'Hình ảnh', icon: <Image className="w-5 h-5" /> },
    { value: 'video', label: 'Video', icon: <Video className="w-5 h-5" /> },
    { value: 'web', label: 'Trang web', icon: <Globe className="w-5 h-5" /> },
    { value: 'text', label: 'Văn bản', icon: <Type className="w-5 h-5" /> },
    { value: 'pptx', label: 'PowerPoint', icon: <Presentation className="w-5 h-5" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" />
          Thêm thành phần
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <DialogTitle>Thêm thành phần trình chiếu</DialogTitle>
        </DialogHeader>

        {/* Mode selection */}
        <div className="flex gap-2 flex-wrap mb-4">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
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
              <Label className="text-zinc-300">Tải file hình ảnh</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'image')}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
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
              <Label className="text-zinc-300">Tải file video</Label>
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileUpload(e, 'video')}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
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
                type="file"
                accept=".pptx"
                onChange={(e) => handleFileUpload(e, 'pptx')}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 mt-1"
              />
            </div>
            <p className="text-zinc-500 text-sm">
              Tất cả các slide trong file PPTX sẽ được trích xuất và thêm vào danh sách trình chiếu.
            </p>
          </div>
        )}

        {mode !== 'pptx' && (
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
