import JSZip from 'jszip'

interface PptxSlide {
  index: number
  /** SVG string of the slide */
  svg: string
}

/**
 * Parse a PPTX file and extract slides as SVG.
 * PPTX is a ZIP containing XML files. We render each slide to SVG
 * by extracting shapes, text, and images.
 */
export async function parsePptx(file: File): Promise<PptxSlide[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Find all slide XML files
  const slideFiles: { index: number; path: string }[] = []
  zip.forEach((relativePath, zipEntry) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/)
    if (match) {
      slideFiles.push({
        index: parseInt(match[1], 10),
        path: relativePath,
      })
    }
  })

  slideFiles.sort((a, b) => a.index - b.index)

  // Extract images from the PPTX
  const imageMap = new Map<string, string>()
  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.startsWith('ppt/media/') && !zipEntry.dir) {
      zipEntry.async('base64').then((base64) => {
        const ext = relativePath.split('.').pop()?.toLowerCase()
        let mimeType = 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
        else if (ext === 'gif') mimeType = 'image/gif'
        else if (ext === 'bmp') mimeType = 'image/bmp'
        else if (ext === 'tiff' || ext === 'tif') mimeType = 'image/tiff'
        else if (ext === 'svg') mimeType = 'image/svg+xml'
        imageMap.set(relativePath, `data:${mimeType};base64,${base64}`)
      })
    }
  })

  // Wait for all images to be extracted
  const imageEntries: Promise<void>[] = []
  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.startsWith('ppt/media/') && !zipEntry.dir) {
      imageEntries.push(
        zipEntry.async('base64').then((base64) => {
          const ext = relativePath.split('.').pop()?.toLowerCase()
          let mimeType = 'image/png'
          if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
          else if (ext === 'gif') mimeType = 'image/gif'
          else if (ext === 'bmp') mimeType = 'image/bmp'
          else if (ext === 'svg') mimeType = 'image/svg+xml'
          imageMap.set(relativePath, `data:${mimeType};base64,${base64}`)
        })
      )
    }
  })
  await Promise.all(imageEntries)

  const slides: PptxSlide[] = []

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile.path)?.async('string')
    if (!xml) continue

    const svg = await renderSlideToSvg(xml, imageMap, zip, slideFile.index)
    slides.push({ index: slideFile.index, svg })
  }

  return slides
}

async function renderSlideToSvg(
  xml: string,
  imageMap: Map<string, string>,
  zip: JSZip,
  slideIndex: number
): Promise<string> {
  // Standard slide dimensions (9144000 x 6858000 EMU = 10" x 7.5")
  const width = 960
  const height = 720

  const shapes: string[] = []

  // Parse text runs from XML
  const textRuns = extractTextElements(xml)
  for (const run of textRuns) {
    const x = (run.x / 9144000) * width
    const y = (run.y / 6858000) * height
    const w = (run.w / 9144000) * width
    const h = (run.h / 6858000) * height
    const fontSize = Math.max(12, (run.fontSize / 9144000) * width * 0.8)

    shapes.push(
      `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="` +
        `font-size:${fontSize}px;` +
        `color:${run.color || '#ffffff'};` +
        `font-family:Arial,sans-serif;` +
        `font-weight:${run.bold ? 'bold' : 'normal'};` +
        `font-style:${run.italic ? 'italic' : 'normal'};` +
        `text-align:${run.align || 'left'};` +
        `word-wrap:break-word;` +
        `padding:4px;` +
        `">${escapeHtml(run.text)}</div>` +
        `</foreignObject>`
    )
  }

  // Parse images
  const imageElements = extractImageElements(xml, slideIndex)
  for (const img of imageElements) {
    const x = (img.x / 9144000) * width
    const y = (img.y / 6858000) * height
    const w = (img.w / 9144000) * width
    const h = (img.h / 6858000) * height
    const src = imageMap.get(img.rId) || ''

    if (src) {
      shapes.push(
        `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${src}" preserveAspectRatio="xMidYMid meet"/>`
      )
    }
  }

  // Parse background
  let bgFill = '#1a1a2e'
  const bgMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:solidFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
  if (bgMatch) {
    bgFill = `#${bgMatch[1]}`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${bgFill}"/>` +
    shapes.join('') +
    `</svg>`
  )
}

interface TextElement {
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  align: string
}

function extractTextElements(xml: string): TextElement[] {
  const elements: TextElement[] = []

  // Match <p:sp> shapes
  const spRegex = /<p:sp[\s>][\s\S]*?<\/p:sp>/g
  let spMatch

  while ((spMatch = spRegex.exec(xml)) !== null) {
    const spXml = spMatch[0]

    // Get position (xfrm)
    const posMatch = spXml.match(
      /<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[^/]*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"[^/]*\/>/
    )
    if (!posMatch) continue

    const x = parseInt(posMatch[1])
    const y = parseInt(posMatch[2])
    const w = parseInt(posMatch[3])
    const h = parseInt(posMatch[4])

    // Get text runs
    const runRegex = /<a:r[\s>][\s\S]*?<a:t[^>]*>([\s\S]*?)<\/a:t>/g
    let runMatch
    const texts: string[] = []

    while ((runMatch = runRegex.exec(spXml)) !== null) {
      texts.push(runMatch[1].trim())
    }

    if (texts.length === 0) continue

    // Get font size
    let fontSize = 1800000 // default 18pt
    const fsMatch = spXml.match(/<a:rPr[^>]*sz="(\d+)"/)
    if (fsMatch) fontSize = parseInt(fsMatch[1]) * 100

    // Get font color
    let color = '#ffffff'
    const colorMatch = spXml.match(/<a:srgbClr val="([^"]+)"/)
    if (colorMatch) color = `#${colorMatch[1]}`

    // Bold / Italic
    const bold = /<a:rPr[^>]*b="1"/.test(spXml) || /<a:rPr[^>]*b="true"/.test(spXml)
    const italic = /<a:rPr[^>]*i="1"/.test(spXml) || /<a:rPr[^>]*i="true"/.test(spXml)

    // Alignment
    let align = 'left'
    if (/<a:pPr[^>]*algn="ctr"/.test(spXml)) align = 'center'
    else if (/<a:pPr[^>]*algn="r"/.test(spXml)) align = 'right'

    elements.push({
      x,
      y,
      w,
      h,
      text: texts.join('\n'),
      fontSize,
      color,
      bold,
      italic,
      align,
    })
  }

  return elements
}

interface ImageElement {
  x: number
  y: number
  w: number
  h: number
  rId: string
}

function extractImageElements(xml: string, slideIndex: number): ImageElement[] {
  const elements: ImageElement[] = []

  // Match <p:pic> elements
  const picRegex = /<p:pic[\s>][\s\S]*?<\/p:pic>/g
  let picMatch

  while ((picMatch = picRegex.exec(xml)) !== null) {
    const picXml = picMatch[0]

    const posMatch = picXml.match(
      /<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[^/]*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"[^/]*\/>/
    )
    if (!posMatch) continue

    const rIdMatch = picXml.match(/r:embed="([^"]+)"/)
    if (!rIdMatch) continue

    elements.push({
      x: parseInt(posMatch[1]),
      y: parseInt(posMatch[2]),
      w: parseInt(posMatch[3]),
      h: parseInt(posMatch[4]),
      rId: rIdMatch[1],
    })
  }

  return elements
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Convert SVG string to a data URL for use in img tags
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString('base64')}`
}
