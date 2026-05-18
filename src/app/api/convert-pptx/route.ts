import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'

const execFileAsync = promisify(execFile)

// Check if LibreOffice is available
let libreOfficeAvailable: boolean | null = null
async function isLibreOfficeAvailable(): Promise<boolean> {
  if (libreOfficeAvailable !== null) return libreOfficeAvailable
  try {
    await execFileAsync('which', ['libreoffice'], { timeout: 3000 })
    libreOfficeAvailable = true
  } catch {
    try {
      await execFileAsync('which', ['soffice'], { timeout: 3000 })
      libreOfficeAvailable = true
    } catch {
      libreOfficeAvailable = false
    }
  }
  return libreOfficeAvailable
}

// CloudConvert conversion
async function convertWithCloudConvert(fileBuffer: Buffer, fileName: string, apiKey: string): Promise<Array<{ index: number; dataUrl: string }>> {
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY không được cấu hình')
  }

  try {
    const CloudConvert = (await import('cloudconvert')).default
    const cloudConvert = new CloudConvert(apiKey)

    // Create job: upload → convert to PNG → export URL
    let job = await cloudConvert.jobs.create({
      tasks: {
        'upload-file': { operation: 'import/upload' },
        'convert-file': {
          operation: 'convert',
          input: 'upload-file',
          output_format: 'png',
          filename: fileName.replace('.pptx', '.png'),
        },
        'export-file': { operation: 'export/url', input: 'convert-file' },
      },
    })

    // Get upload task
    const uploadTask = job.tasks.find((t: any) => t.name === 'upload-file')
    if (!uploadTask) throw new Error('No upload task')

    // Upload the file
    await cloudConvert.tasks.upload(uploadTask, fileBuffer, fileName)

    // Wait for job to complete
    job = await cloudConvert.jobs.wait(job.id)

    // Get export URLs
    const exportTask = job.tasks.find((t: any) => t.name === 'export-file')
    if (!exportTask?.result?.files) {
      throw new Error('No export result')
    }

    const slides: Array<{ index: number; dataUrl: string }> = []
    
    for (let i = 0; i < exportTask.result.files.length; i++) {
      const file = exportTask.result.files[i]
      const response = await fetch(file.url)
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      slides.push({
        index: i + 1,
        dataUrl: `data:image/png;base64,${base64}`,
      })
    }

    return slides
  } catch (err: any) {
    console.error('CloudConvert error:', err)
    throw new Error(`CloudConvert conversion failed: ${err.message}`)
  }
}

// LibreOffice conversion
async function convertWithLibreOffice(inputPath: string, outputDir: string): Promise<Array<{ index: number; dataUrl: string }>> {
  const loCommand = libreOfficeAvailable ? 'libreoffice' : 'soffice'
  
  await execFileAsync(loCommand, [
    '--headless',
    '--convert-to', 'pdf',
    '--outdir', outputDir,
    inputPath,
  ], { timeout: 60000 })

  // Find the generated PDF
  const files = await fs.readdir(outputDir)
  const pdfFile = files.find(f => f.endsWith('.pdf'))
  if (!pdfFile) throw new Error('PDF not generated')

  const pdfPath = path.join(outputDir, pdfFile)

  // Convert PDF pages to PNG
  await execFileAsync('pdftoppm', [
    '-png', '-r', '150',
    pdfPath,
    path.join(outputDir, 'slide'),
  ], { timeout: 60000 })

  // Read generated PNGs
  const pngFiles = (await fs.readdir(outputDir))
    .filter(f => f.endsWith('.png') && f.startsWith('slide-'))
    .sort()

  const slides: Array<{ index: number; dataUrl: string }> = []
  for (let i = 0; i < pngFiles.length; i++) {
    const pngPath = path.join(outputDir, pngFiles[i])
    const data = await fs.readFile(pngPath)
    const base64 = data.toString('base64')
    slides.push({
      index: i + 1,
      dataUrl: `data:image/png;base64,${base64}`,
    })
  }

  return slides
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const hasLibreOffice = await isLibreOfficeAvailable()

    if (hasLibreOffice) {
      // Use LibreOffice for highest quality
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'showflow-'))
      try {
        const inputPath = path.join(tempDir, file.name)
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(inputPath, buffer)

        const slides = await convertWithLibreOffice(inputPath, tempDir)
        return NextResponse.json({ success: true, slides })
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    } else {
      // Try CloudConvert API (check header first, then env var)
      const apiKey = req.headers.get('x-cloudconvert-key') || process.env.CLOUDCONVERT_API_KEY
      if (apiKey) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer())
          const slides = await convertWithCloudConvert(buffer, file.name, apiKey)
          return NextResponse.json({ success: true, slides, method: 'cloudconvert' })
        } catch (err: any) {
          return NextResponse.json({ 
            success: false, 
            error: `CloudConvert failed: ${err.message}. Set CLOUDCONVERT_API_KEY env var or install LibreOffice.`,
            needsLibreOffice: true 
          }, { status: 500 })
        }
      } else {
        return NextResponse.json({ 
          success: false, 
          error: 'LibreOffice không có sẵn và chưa cấu hình CloudConvert API. Thêm CLOUDCONVERT_API_KEY vào biến môi trường.',
          needsLibreOffice: true 
        }, { status: 500 })
      }
    }
  } catch (err: any) {
    console.error('PPTX conversion error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Conversion failed' 
    }, { status: 500 })
  }
}

export const maxDuration = 60
