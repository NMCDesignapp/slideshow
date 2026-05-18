import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, rm, readFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
  const tmpDir = `/tmp/pptx-convert-${randomUUID()}`
  const inputPath = path.join(tmpDir, 'input.pptx')
  const pdfDir = path.join(tmpDir, 'pdf')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Create temp directory
    await mkdir(tmpDir, { recursive: true })
    await mkdir(pdfDir, { recursive: true })

    // Write uploaded file to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    // Step 1: Convert PPTX → PDF using LibreOffice
    const loResult = await execFileAsync('libreoffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', pdfDir,
      inputPath,
    ], { timeout: 60000 })

    // Find the generated PDF
    const pdfFiles = await (async () => {
      const { readdir } = await import('fs/promises')
      const files = await readdir(pdfDir)
      return files.filter(f => f.endsWith('.pdf'))
    })()

    if (pdfFiles.length === 0) {
      throw new Error('LibreOffice did not produce a PDF file')
    }

    const pdfPath = path.join(pdfDir, pdfFiles[0])

    // Step 2: Get page count
    const { stdout: infoOutput } = await execFileAsync('pdfinfo', [pdfPath], { timeout: 10000 })
    const pagesMatch = infoOutput.match(/Pages:\s+(\d+)/)
    const pageCount = pagesMatch ? parseInt(pagesMatch[1]) : 0

    if (pageCount === 0) {
      throw new Error('No pages found in PDF')
    }

    // Step 3: Convert PDF pages to PNG images
    const imgDir = path.join(tmpDir, 'images')
    await mkdir(imgDir, { recursive: true })

    // pdftoppm generates files with pattern: prefix-1.png, prefix-2.png, etc.
    const imgPrefix = path.join(imgDir, 'slide')

    await execFileAsync('pdftoppm', [
      '-png',
      '-r', '150', // 150 DPI - good balance of quality and size
      pdfPath,
      imgPrefix,
    ], { timeout: 30000 })

    // Step 4: Read generated images and return as base64
    const { readdir } = await import('fs/promises')
    const imgFiles = await readdir(imgDir)
    const pngFiles = imgFiles
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        // Sort by page number (handle leading zeros)
        const numA = parseInt(a.match(/(\d+)\.png$/)?.[1] || '0')
        const numB = parseInt(b.match(/(\d+)\.png$/)?.[1] || '0')
        return numA - numB
      })

    const slides: { index: number; dataUrl: string }[] = []

    for (let i = 0; i < pngFiles.length; i++) {
      const imgPath = path.join(imgDir, pngFiles[i])
      const imgBuffer = await readFile(imgPath)
      const base64 = imgBuffer.toString('base64')
      slides.push({
        index: i + 1,
        dataUrl: `data:image/png;base64,${base64}`,
      })
    }

    return NextResponse.json({
      success: true,
      slides,
      pageCount: slides.length,
      fileName: file.name,
    })

  } catch (error: any) {
    console.error('PPTX conversion error:', error)
    return NextResponse.json(
      { error: `Lỗi chuyển đổi: ${error.message || 'Unknown error'}` },
      { status: 500 }
    )
  } finally {
    // Clean up temp files
    try {
      await rm(tmpDir, { recursive: true, force: true })
    } catch { /* ignore cleanup errors */ }
  }
}

// Increase body size limit for large PPTX files (App Router syntax)
export const maxDuration = 60
export const bodySizeLimit = '50mb'
