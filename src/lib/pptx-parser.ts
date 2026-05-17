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
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (err) {
    throw new Error(`Không thể đọc file "${file.name}". File có thể bị lỗi hoặc không hợp lệ.`)
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch (err) {
    throw new Error(`File "${file.name}" không phải là file PPTX hợp lệ. Vui lòng kiểm tra lại.`)
  }

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

  if (slideFiles.length === 0) {
    throw new Error(`Không tìm thấy slide nào trong file "${file.name}". File có thể bị lỗi.`)
  }

  slideFiles.sort((a, b) => a.index - b.index)

  // Extract images from the PPTX (single pass, properly awaited)
  const imageMap = new Map<string, string>()
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
          else if (ext === 'tiff' || ext === 'tif') mimeType = 'image/tiff'
          else if (ext === 'svg') mimeType = 'image/svg+xml'
          imageMap.set(relativePath, `data:${mimeType};base64,${base64}`)
        })
      )
    }
  })
  await Promise.all(imageEntries)

  // Parse relationship files to map rId -> media path
  const relsMap = new Map<string, Map<string, string>>() // slide rels: slidePath -> (rId -> mediaPath)
  const relsEntries: Promise<void>[] = []
  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/) && !zipEntry.dir) {
      relsEntries.push(
        zipEntry.async('string').then((relsXml) => {
          const slideNum = relativePath.match(/slide(\d+)/)?.[1] || '1'
          const rels = new Map<string, string>()
          const relRegex = /<Relationship\s+Id="([^"]+)"\s+Type="[^"]*"[^>]*Target="([^"]+)"/g
          let relMatch
          while ((relMatch = relRegex.exec(relsXml)) !== null) {
            const rId = relMatch[1]
            let target = relMatch[2]
            // Only process image relationships
            if (!relMatch[0].includes('image') && !target.includes('media')) continue
            // Target is relative to ppt/slides/, resolve to full path
            if (target.startsWith('../')) {
              target = 'ppt/' + target.replace('../', '')
            } else if (!target.startsWith('ppt/')) {
              target = 'ppt/slides/' + target
            }
            rels.set(rId, target)
          }
          relsMap.set(slideNum, rels)
        })
      )
    }
  })
  await Promise.all(relsEntries)

  const slides: PptxSlide[] = []

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile.path)?.async('string')
    if (!xml) continue

    try {
      const svg = renderSlideToSvg(xml, imageMap, relsMap, slideFile.index)
      slides.push({ index: slideFile.index, svg })
    } catch (err) {
      console.error(`Error rendering slide ${slideFile.index}:`, err)
      // Add a placeholder SVG for failed slides
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" width="960" height="720">` +
        `<rect width="960" height="720" fill="#f5f5f5"/>` +
        `<text x="480" y="360" text-anchor="middle" font-size="24" fill="#999" font-family="Arial">Slide ${slideFile.index} - Lỗi hiển thị</text>` +
        `</svg>`
      slides.push({ index: slideFile.index, svg: placeholderSvg })
    }
  }

  if (slides.length === 0) {
    throw new Error(`Không thể trích xuất slide nào từ file "${file.name}".`)
  }

  return slides
}

/**
 * Determine if background is dark or light, to set default text color accordingly
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return true
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

function renderSlideToSvg(
  xml: string,
  imageMap: Map<string, string>,
  relsMap: Map<string, Map<string, string>>,
  slideIndex: number
): string {
  // Standard slide dimensions (9144000 x 6858000 EMU = 10" x 7.5")
  const width = 960
  const height = 720

  const shapes: string[] = []

  // Parse background first to determine text color defaults
  let bgFill = '#ffffff'
  const bgMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:solidFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
  if (bgMatch) {
    bgFill = `#${bgMatch[1]}`
  }
  // Also check for gradient backgrounds
  if (bgFill === '#ffffff') {
    const gradBgMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:gradFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
    if (gradBgMatch) {
      bgFill = `#${gradBgMatch[1]}`
    }
  }

  const bgIsLight = isLightColor(bgFill)
  const defaultTextColor = bgIsLight ? '#333333' : '#ffffff'

  // Parse text elements (improved with paragraph and bullet support)
  const textElements = extractTextElements(xml, defaultTextColor)
  for (const el of textElements) {
    const x = (el.x / 9144000) * width
    const y = (el.y / 6858000) * height
    const w = (el.w / 9144000) * width
    const h = (el.h / 6858000) * height

    // Build paragraphs HTML
    const paragraphsHtml = el.paragraphs.map((para) => {
      const indent = para.level > 0 ? `margin-left:${para.level * 20}px;` : ''
      const bulletPrefix = para.bullet ? '• ' : ''
      const paraAlign = para.align || el.align || 'left'
      return `<p style="margin:2px 0;${indent}text-align:${paraAlign};">` +
        para.runs.map((run) => {
          const fontSize = Math.max(10, (run.fontSize / 9144000) * width * 0.8)
          return `<span style="` +
            `font-size:${fontSize}px;` +
            `color:${run.color};` +
            `font-weight:${run.bold ? 'bold' : 'normal'};` +
            `font-style:${run.italic ? 'italic' : 'normal'};` +
            `text-decoration:${run.underline ? 'underline' : 'none'};` +
            `">${escapeHtml(bulletPrefix + run.text)}</span>`
        }).join('') +
        `</p>`
    }).join('')

    shapes.push(
      `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="` +
        `font-family:Arial,sans-serif;` +
        `word-wrap:break-word;` +
        `overflow:hidden;` +
        `padding:4px;` +
        `line-height:1.3;` +
        `">${paragraphsHtml}</div>` +
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

    // Resolve rId -> media path -> data URL
    const slideRels = relsMap.get(String(slideIndex))
    const mediaPath = slideRels?.get(img.rId)
    const src = mediaPath ? imageMap.get(mediaPath) : imageMap.get(img.rId) || ''

    if (src) {
      shapes.push(
        `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${src}" preserveAspectRatio="xMidYMid meet"/>`
      )
    }
  }

  // Parse shape fills (rectangles with solid fill, useful for background shapes)
  const shapeElements = extractShapeFills(xml)
  for (const shape of shapeElements) {
    const x = (shape.x / 9144000) * width
    const y = (shape.y / 6858000) * height
    const w = (shape.w / 9144000) * width
    const h = (shape.h / 6858000) * height
    shapes.unshift(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${shape.fill}" rx="0"/>`
    )
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${bgFill}"/>` +
    shapes.join('') +
    `</svg>`
  )
}

interface TextRun {
  text: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

interface TextParagraph {
  runs: TextRun[]
  level: number
  bullet: boolean
  align: string
}

interface TextElement {
  x: number
  y: number
  w: number
  h: number
  paragraphs: TextParagraph[]
  align: string
}

function extractTextElements(xml: string, defaultTextColor: string): TextElement[] {
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

    // Default shape-level alignment
    let shapeAlign = 'left'
    if (/<a:pPr[^>]*algn="ctr"/.test(spXml)) shapeAlign = 'center'
    else if (/<a:pPr[^>]*algn="r"/.test(spXml)) shapeAlign = 'right'

    // Extract paragraphs from <a:p> elements
    const paragraphs: TextParagraph[] = []
    const pRegex = /<a:p[\s>][\s\S]*?<\/a:p>/g
    let pMatch

    while ((pMatch = pRegex.exec(spXml)) !== null) {
      const pXml = pMatch[0]
      const runs: TextRun[] = []

      // Get paragraph-level properties
      let level = 0
      let bullet = false
      let paraAlign = shapeAlign

      const pPrMatch = pXml.match(/<a:pPr[^>]*\/>/) || pXml.match(/<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/)
      if (pPrMatch) {
        const pPrXml = pPrMatch[0]
        const lvlMatch = pPrXml.match(/lvl="(\d+)"/)
        if (lvlMatch) level = parseInt(lvlMatch[1])

        // Check for bullet character
        if (/<a:buChar/.test(pPrXml) || /<a:buAutoNum/.test(pPrXml) || /<a:buNone/.test(pPrXml) === false && /buClr|buSzPct|buFont|buChar|buAutoNum/.test(pPrXml)) {
          bullet = true
        }
        // Explicit buChar always means bullet
        if (/<a:buChar/.test(pPrXml)) bullet = true
        // Explicit buNone means no bullet
        if (/<a:buNone/.test(pPrXml)) bullet = false
        // If level > 0 and no explicit buNone, treat as bullet
        if (level > 0 && !/<a:buNone/.test(pPrXml)) bullet = true

        const alignMatch = pPrXml.match(/algn="([^"]+)"/)
        if (alignMatch) {
          if (alignMatch[1] === 'ctr') paraAlign = 'center'
          else if (alignMatch[1] === 'r') paraAlign = 'right'
          else if (alignMatch[1] === 'l') paraAlign = 'left'
        }
      }

      // Extract text runs from <a:r> elements
      const rRegex = /<a:r[\s>][\s\S]*?<\/a:r>/g
      let rMatch

      while ((rMatch = rRegex.exec(pXml)) !== null) {
        const rXml = rMatch[0]

        // Get text content
        const tMatch = rXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/)
        if (!tMatch) continue
        const text = tMatch[1].trim()
        if (!text) continue

        // Get run properties
        let fontSize = 1800000 // default 18pt in EMU (18 * 100 * 1000)
        let color = defaultTextColor
        let bold = false
        let italic = false
        let underline = false

        const rPrMatch = rXml.match(/<a:rPr[^>]*\/>/) || rXml.match(/<a:rPr[^>]*>[\s\S]*?<\/a:rPr>/)
        if (rPrMatch) {
          const rPrXml = rPrMatch[0]

          const szMatch = rPrXml.match(/sz="(\d+)"/)
          if (szMatch) fontSize = parseInt(szMatch[1]) * 100 // sz is in 100ths of a point

          // Color: check for srgbClr first (direct color)
          const clrMatch = rPrXml.match(/<a:srgbClr val="([^"]+)"/)
          if (clrMatch) {
            color = `#${clrMatch[1]}`
          } else {
            // Check for scheme color (theme-based)
            const schemeMatch = rPrXml.match(/<a:schemeClr val="([^"]+)"/)
            if (schemeMatch) {
              // Map common scheme colors to reasonable defaults
              const schemeColor = schemeMatch[1]
              switch (schemeColor) {
                case 'tx1': case 'dk1': color = defaultTextColor; break
                case 'tx2': case 'dk2': color = bgIsLightFromDefault(defaultTextColor) ? '#445566' : '#aabbcc'; break
                case 'lt1': color = bgIsLightFromDefault(defaultTextColor) ? '#ffffff' : '#ffffff'; break
                case 'lt2': color = bgIsLightFromDefault(defaultTextColor) ? '#eeeeee' : '#dddddd'; break
                case 'accent1': color = '#4472C4'; break
                case 'accent2': color = '#ED7D31'; break
                case 'accent3': color = '#A5A5A5'; break
                case 'accent4': color = '#FFC000'; break
                case 'accent5': color = '#5B9BD5'; break
                case 'accent6': color = '#70AD47'; break
                case 'hlink': color = '#0563C1'; break
                default: color = defaultTextColor
              }
            }
            // Check for indexed colors
            const idxMatch = rPrXml.match(/<a:idxClr idx="(\d+)"/)
            if (idxMatch) {
              const idxColors = ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
                '#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
                '#800000','#008000','#000080','#808000','#800080','#008080','#c0c0c0','#808080',
                '#999966','#996633','#669933','#663399']
              const idx = parseInt(idxMatch[1])
              color = idxColors[idx] || defaultTextColor
            }
          }

          bold = /b="1"/.test(rPrXml) || /b="true"/.test(rPrXml) || (/<a:rPr[^>]*b="[^"]*"/.test(rPrXml) === false && /<a:rPr[^>]*b="/.test(rPrXml) === false && false)
          // More accurate bold detection - default is b="0" or missing, b="1" means bold
          bold = / b="1"/.test(rPrXml) || / b="true"/.test(rPrXml)
          italic = / i="1"/.test(rPrXml) || / i="true"/.test(rPrXml)
          underline = /<a:u/.test(rPrXml) && !/<a:uFn/.test(rPrXml)
        }

        runs.push({ text, fontSize, color, bold, italic, underline })
      }

      // If no runs found, check for end-para-run (empty paragraph)
      if (runs.length === 0) {
        // Skip empty paragraphs
        continue
      }

      paragraphs.push({ runs, level, bullet, align: paraAlign })
    }

    if (paragraphs.length === 0) continue

    elements.push({
      x,
      y,
      w,
      h,
      paragraphs,
      align: shapeAlign,
    })
  }

  return elements
}

/**
 * Helper to check if the default text color implies a light background
 */
function bgIsLightFromDefault(defaultTextColor: string): boolean {
  return defaultTextColor === '#333333' || defaultTextColor === '#000000'
}

interface ShapeFill {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

function extractShapeFills(xml: string): ShapeFill[] {
  const elements: ShapeFill[] = []

  // Match <p:sp> shapes that have solid fill (but no text - background shapes)
  const spRegex = /<p:sp[\s>][\s\S]*?<\/p:sp>/g
  let spMatch

  while ((spMatch = spRegex.exec(xml)) !== null) {
    const spXml = spMatch[0]

    // Only process shapes with <p:spPr> containing a solidFill and NO <p:txBody> text
    if (!/<a:solidFill>/.test(spXml)) continue
    if (/<a:t>/.test(spXml)) continue // Skip shapes that have text

    const posMatch = spXml.match(
      /<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[^/]*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"[^/]*\/>/
    )
    if (!posMatch) continue

    const fillMatch = spXml.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
    if (!fillMatch) continue

    elements.push({
      x: parseInt(posMatch[1]),
      y: parseInt(posMatch[2]),
      w: parseInt(posMatch[3]),
      h: parseInt(posMatch[4]),
      fill: `#${fillMatch[1]}`,
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
