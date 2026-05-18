import JSZip from 'jszip'

interface PptxSlide {
  index: number
  /** Data URL of the slide image (PNG from server conversion, or SVG data URL from fallback) */
  src: string
}

/**
 * Parse a PPTX file and extract slides as images.
 * Tries server-side LibreOffice conversion first (100% accurate),
 * falls back to client-side SVG rendering if server is unavailable.
 */
export async function parsePptx(file: File): Promise<PptxSlide[]> {
  // Try server-side conversion first
  try {
    const serverResult = await convertPptxServer(file)
    if (serverResult && serverResult.length > 0) {
      return serverResult
    }
  } catch (err) {
    console.warn('Server-side PPTX conversion failed, falling back to client-side:', err)
  }

  // Fallback to client-side SVG rendering
  return parsePptxClientSide(file)
}

/**
 * Server-side PPTX conversion using LibreOffice + pdftoppm
 * Produces pixel-perfect PNG images of each slide.
 */
async function convertPptxServer(file: File): Promise<PptxSlide[]> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/convert-pptx', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Server error: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success || !data.slides) {
    throw new Error(data.error || 'Server conversion failed')
  }

  return data.slides.map((slide: { index: number; dataUrl: string }) => ({
    index: slide.index,
    src: slide.dataUrl,
  }))
}

/**
 * Client-side fallback: Parse PPTX ZIP and render slides as SVG.
 * Less accurate than server-side conversion but works offline.
 */
async function parsePptxClientSide(file: File): Promise<PptxSlide[]> {
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

  // Extract images from the PPTX
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
  const relsMap = new Map<string, Map<string, string>>()
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
            if (!relMatch[0].includes('image') && !target.includes('media')) continue
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

  // Parse theme XML for color resolution
  const themeColors = await parseThemeColors(zip)

  const slides: PptxSlide[] = []

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile.path)?.async('string')
    if (!xml) continue

    try {
      const svg = renderSlideToSvg(xml, imageMap, relsMap, slideFile.index, themeColors)
      const dataUrl = svgToDataUrl(svg)
      slides.push({ index: slideFile.index, src: dataUrl })
    } catch (err) {
      console.error(`Error rendering slide ${slideFile.index}:`, err)
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" width="960" height="720">` +
        `<rect width="960" height="720" fill="#f5f5f5"/>` +
        `<text x="480" y="360" text-anchor="middle" font-size="24" fill="#999" font-family="Arial">Slide ${slideFile.index} - Lỗi hiển thị</text>` +
        `</svg>`
      slides.push({ index: slideFile.index, src: svgToDataUrl(placeholderSvg) })
    }
  }

  if (slides.length === 0) {
    throw new Error(`Không thể trích xuất slide nào từ file "${file.name}".`)
  }

  return slides
}

/**
 * Parse theme XML from ppt/theme/theme1.xml to extract actual color scheme
 */
async function parseThemeColors(zip: JSZip): Promise<Map<string, string>> {
  const colorMap = new Map<string, string>()

  try {
    const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string')
    if (!themeXml) return colorMap

    // Extract the color scheme from <a:clrScheme>
    const clrSchemeMatch = themeXml.match(/<a:clrScheme[^>]*name="[^"]*"[^>]*>([\s\S]*?)<\/a:clrScheme>/)
    if (!clrSchemeMatch) return colorMap

    const clrXml = clrSchemeMatch[1]

    // Map each color entry: <a:dk1><a:srgbClr val="..."/></a:dk1>
    const colorEntries: [string, RegExp][] = [
      ['dk1', /<a:dk1[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['lt1', /<a:lt1[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['dk2', /<a:dk2[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['lt2', /<a:lt2[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent1', /<a:accent1[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent2', /<a:accent2[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent3', /<a:accent3[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent4', /<a:accent4[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent5', /<a:accent5[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['accent6', /<a:accent6[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['hlink', /<a:hlink[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
      ['folHlink', /<a:folHlink[^>]*>[\s\S]*?<a:srgbClr val="([^"]+)"/],
    ]

    for (const [name, regex] of colorEntries) {
      const match = clrXml.match(regex)
      if (match) {
        colorMap.set(name, `#${match[1]}`)
      }
    }

    // Also check for sysClr (system colors like "windowText" → usually black)
    const sysColorEntries: [string, RegExp][] = [
      ['dk1', /<a:dk1[^>]*>[\s\S]*?<a:sysClr val="[^"]*" lastClr="([^"]+)"/],
      ['lt1', /<a:lt1[^>]*>[\s\S]*?<a:sysClr val="[^"]*" lastClr="([^"]+)"/],
    ]

    for (const [name, regex] of sysColorEntries) {
      if (!colorMap.has(name)) {
        const match = clrXml.match(regex)
        if (match) {
          colorMap.set(name, `#${match[1]}`)
        }
      }
    }

    // tx1 and tx2 are aliases for dk1/dk2 in text context
    if (colorMap.has('dk1')) colorMap.set('tx1', colorMap.get('dk1')!)
    if (colorMap.has('dk2')) colorMap.set('tx2', colorMap.get('dk2')!)
    if (colorMap.has('lt1')) colorMap.set('bg1', colorMap.get('lt1')!)
    if (colorMap.has('lt2')) colorMap.set('bg2', colorMap.get('lt2')!)

  } catch (err) {
    console.warn('Failed to parse theme colors:', err)
  }

  return colorMap
}

/**
 * Determine if background is dark or light
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return true
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

function renderSlideToSvg(
  xml: string,
  imageMap: Map<string, string>,
  relsMap: Map<string, Map<string, string>>,
  slideIndex: number,
  themeColors: Map<string, string>
): string {
  const width = 960
  const height = 720
  const EMU_WIDTH = 9144000
  const EMU_HEIGHT = 6858000

  const shapes: string[] = []

  // Parse background
  let bgFill = '#ffffff'
  const bgMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:solidFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
  if (bgMatch) {
    bgFill = `#${bgMatch[1]}`
  }
  if (bgFill === '#ffffff') {
    const gradBgMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:gradFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
    if (gradBgMatch) {
      bgFill = `#${gradBgMatch[1]}`
    }
  }
  // Check for scheme color in background
  if (bgFill === '#ffffff') {
    const bgSchemeMatch = xml.match(/<p:bg[^>]*>[\s\S]*?<a:schemeClr val="([^"]+)"/)
    if (bgSchemeMatch) {
      const resolved = themeColors.get(bgSchemeMatch[1])
      if (resolved) bgFill = resolved
    }
  }

  const bgIsLight = isLightColor(bgFill)
  const defaultTextColor = bgIsLight ? '#333333' : '#ffffff'

  // Parse shape fills first (render behind text)
  const shapeElements = extractShapeFills(xml, themeColors)
  for (const shape of shapeElements) {
    const x = (shape.x / EMU_WIDTH) * width
    const y = (shape.y / EMU_HEIGHT) * height
    const w = (shape.w / EMU_WIDTH) * width
    const h = (shape.h / EMU_HEIGHT) * height
    shapes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${shape.fill}" rx="0"/>`
    )
  }

  // Parse images (render behind text, on top of shape fills)
  const imageElements = extractImageElements(xml, slideIndex)
  for (const img of imageElements) {
    const x = (img.x / EMU_WIDTH) * width
    const y = (img.y / EMU_HEIGHT) * height
    const w = (img.w / EMU_WIDTH) * width
    const h = (img.h / EMU_HEIGHT) * height

    const slideRels = relsMap.get(String(slideIndex))
    const mediaPath = slideRels?.get(img.rId)
    const src = mediaPath ? imageMap.get(mediaPath) : imageMap.get(img.rId) || ''

    if (src) {
      shapes.push(
        `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${src}" preserveAspectRatio="xMidYMid meet"/>`
      )
    }
  }

  // Parse text elements
  const textElements = extractTextElements(xml, defaultTextColor, themeColors)
  for (const el of textElements) {
    const x = (el.x / EMU_WIDTH) * width
    const y = (el.y / EMU_HEIGHT) * height
    const w = (el.w / EMU_WIDTH) * width
    const h = (el.h / EMU_HEIGHT) * height

    const paragraphsHtml = el.paragraphs.map((para) => {
      const indent = para.level > 0 ? `margin-left:${para.level * 20}px;` : ''
      const bulletPrefix = para.bullet ? '\u2022 ' : ''
      const paraAlign = para.align || el.align || 'left'
      return `<p style="margin:2px 0;${indent}text-align:${paraAlign};">` +
        para.runs.map((run) => {
          // FIX: Correct font size conversion
          // sz in PPTX is in hundredths of a point (e.g., sz="2400" = 24pt)
          // 1pt = 12700 EMU, so 1/100pt = 127 EMU
          // Rendered size = (fontSizeEMU / EMU_WIDTH) * pixelWidth
          const fontSizePx = Math.max(8, (run.fontSize / EMU_WIDTH) * width)
          return `<span style="` +
            `font-size:${fontSizePx.toFixed(1)}px;` +
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
        `overflow:visible;` +
        `padding:4px;` +
        `line-height:1.2;` +
        `box-sizing:border-box;` +
        `">${paragraphsHtml}</div>` +
        `</foreignObject>`
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
  fontSize: number  // in EMU
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

function extractTextElements(xml: string, defaultTextColor: string, themeColors: Map<string, string>): TextElement[] {
  const elements: TextElement[] = []

  const spRegex = /<p:sp[\s>][\s\S]*?<\/p:sp>/g
  let spMatch

  while ((spMatch = spRegex.exec(xml)) !== null) {
    const spXml = spMatch[0]

    const posMatch = spXml.match(
      /<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[^/]*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"[^/]*\/>/
    )
    if (!posMatch) continue

    const x = parseInt(posMatch[1])
    const y = parseInt(posMatch[2])
    const w = parseInt(posMatch[3])
    const h = parseInt(posMatch[4])

    let shapeAlign = 'left'
    if (/<a:pPr[^>]*algn="ctr"/.test(spXml)) shapeAlign = 'center'
    else if (/<a:pPr[^>]*algn="r"/.test(spXml)) shapeAlign = 'right'

    const paragraphs: TextParagraph[] = []
    const pRegex = /<a:p[\s>][\s\S]*?<\/a:p>/g
    let pMatch

    while ((pMatch = pRegex.exec(spXml)) !== null) {
      const pXml = pMatch[0]
      const runs: TextRun[] = []

      let level = 0
      let bullet = false
      let paraAlign = shapeAlign

      const pPrMatch = pXml.match(/<a:pPr[^>]*\/>/) || pXml.match(/<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/)
      if (pPrMatch) {
        const pPrXml = pPrMatch[0]
        const lvlMatch = pPrXml.match(/lvl="(\d+)"/)
        if (lvlMatch) level = parseInt(lvlMatch[1])

        if (/<a:buChar/.test(pPrXml)) bullet = true
        if (/<a:buNone/.test(pPrXml)) bullet = false
        if (level > 0 && !/<a:buNone/.test(pPrXml)) bullet = true

        const alignMatch = pPrXml.match(/algn="([^"]+)"/)
        if (alignMatch) {
          if (alignMatch[1] === 'ctr') paraAlign = 'center'
          else if (alignMatch[1] === 'r') paraAlign = 'right'
          else if (alignMatch[1] === 'l') paraAlign = 'left'
        }
      }

      const rRegex = /<a:r[\s>][\s\S]*?<\/a:r>/g
      let rMatch

      while ((rMatch = rRegex.exec(pXml)) !== null) {
        const rXml = rMatch[0]

        const tMatch = rXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/)
        if (!tMatch) continue
        const text = tMatch[1].trim()
        if (!text) continue

        // FIX: sz is in hundredths of a point. Convert to EMU: value * 127
        // (because 1pt = 12700 EMU, so 1/100pt = 127 EMU)
        // Default 18pt = 1800 hundredths = 1800 * 127 = 228600 EMU
        let fontSize = 228600 // default 18pt in EMU
        let color = defaultTextColor
        let bold = false
        let italic = false
        let underline = false

        const rPrMatch = rXml.match(/<a:rPr[^>]*\/>/) || rXml.match(/<a:rPr[^>]*>[\s\S]*?<\/a:rPr>/)
        if (rPrMatch) {
          const rPrXml = rPrMatch[0]

          const szMatch = rPrXml.match(/sz="(\d+)"/)
          if (szMatch) fontSize = parseInt(szMatch[1]) * 127 // convert hundredths of pt → EMU

          // Color resolution with theme support
          const clrMatch = rPrXml.match(/<a:srgbClr val="([^"]+)"/)
          if (clrMatch) {
            color = `#${clrMatch[1]}`
          } else {
            const schemeMatch = rPrXml.match(/<a:schemeClr val="([^"]+)"/)
            if (schemeMatch) {
              const schemeColor = schemeMatch[1]
              // Try theme colors first
              const themeResolved = themeColors.get(schemeColor)
              if (themeResolved) {
                color = themeResolved
              } else {
                // Fallback defaults
                switch (schemeColor) {
                  case 'tx1': case 'dk1': color = defaultTextColor; break
                  case 'tx2': case 'dk2': color = isLightColor(defaultTextColor === '#333333' ? '#ffffff' : defaultTextColor) ? '#445566' : '#aabbcc'; break
                  case 'lt1': color = '#ffffff'; break
                  case 'lt2': color = '#e7e6e6'; break
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
            }
            const idxMatch = rPrXml.match(/<a:idxClr idx="(\d+)"/)
            if (idxMatch) {
              const idxColors = ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
                '#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
                '#800000','#008000','#000080','#808000','#800080','#008080','#c0c0c0','#808080']
              const idx = parseInt(idxMatch[1])
              color = idxColors[idx] || defaultTextColor
            }
          }

          bold = / b="1"/.test(rPrXml) || / b="true"/.test(rPrXml)
          italic = / i="1"/.test(rPrXml) || / i="true"/.test(rPrXml)
          underline = /<a:u/.test(rPrXml) && !/<a:uFn/.test(rPrXml)
        }

        runs.push({ text, fontSize, color, bold, italic, underline })
      }

      if (runs.length === 0) continue
      paragraphs.push({ runs, level, bullet, align: paraAlign })
    }

    if (paragraphs.length === 0) continue
    elements.push({ x, y, w, h, paragraphs, align: shapeAlign })
  }

  return elements
}

interface ShapeFill {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

function extractShapeFills(xml: string, themeColors: Map<string, string>): ShapeFill[] {
  const elements: ShapeFill[] = []

  const spRegex = /<p:sp[\s>][\s\S]*?<\/p:sp>/g
  let spMatch

  while ((spMatch = spRegex.exec(xml)) !== null) {
    const spXml = spMatch[0]

    // Only process shapes with solid fill and NO text
    if (!/<a:solidFill>/.test(spXml)) continue
    if (/<a:t>/.test(spXml)) continue

    const posMatch = spXml.match(
      /<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[^/]*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"[^/]*\/>/
    )
    if (!posMatch) continue

    let fill = '#cccccc'
    const fillMatch = spXml.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([^"]+)"/)
    if (fillMatch) {
      fill = `#${fillMatch[1]}`
    } else {
      // Try scheme color
      const schemeMatch = spXml.match(/<a:solidFill>[\s\S]*?<a:schemeClr val="([^"]+)"/)
      if (schemeMatch) {
        const resolved = themeColors.get(schemeMatch[1])
        if (resolved) fill = resolved
      }
    }

    elements.push({
      x: parseInt(posMatch[1]),
      y: parseInt(posMatch[2]),
      w: parseInt(posMatch[3]),
      h: parseInt(posMatch[4]),
      fill,
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
