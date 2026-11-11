import { encode } from 'uqr'

export type QrEcc = 'L' | 'M' | 'Q' | 'H'

export const QR_ECC_LEVELS: ReadonlyArray<{ value: QrEcc; label: string }> = [
  { value: 'L', label: 'L · 7%' },
  { value: 'M', label: 'M · 15%' },
  { value: 'Q', label: 'Q · 25%' },
  { value: 'H', label: 'H · 30%' }
]

export interface QrMatrix {
  version: number
  size: number
  ecc: QrEcc
  modules: boolean[][]
}

export type QrResult = { ok: true; matrix: QrMatrix } | { ok: false; error: string }

export const MAX_QR_CHARS = 2000

export function createQr(text: string, options: { ecc?: QrEcc; border?: number } = {}): QrResult {
  const value = text.trim()
  if (!value) return { ok: false, error: 'Enter text or a URL to encode.' }
  if (value.length > MAX_QR_CHARS) {
    return {
      ok: false,
      error: `Keep the text under ${MAX_QR_CHARS.toLocaleString()} characters so it fits in a QR code.`
    }
  }

  const ecc = options.ecc ?? 'M'
  try {
    const encoded = encode(value, { ecc, border: options.border ?? 4 })
    return {
      ok: true,
      matrix: {
        version: encoded.version,
        size: encoded.size,
        ecc,
        modules: encoded.data
      }
    }
  } catch {
    return {
      ok: false,
      error: 'That text is too long for a QR code. Shorten it or use a lower error correction level.'
    }
  }
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function qrToSvg(
  matrix: QrMatrix,
  options: { pixelSize?: number; dark?: string; light?: string } = {}
): string {
  const { size, modules } = matrix
  const pixelSize = Math.max(1, Math.round(options.pixelSize ?? 8))
  const dark = options.dark && HEX_COLOR.test(options.dark) ? options.dark : '#0b0b0b'
  const light = options.light && HEX_COLOR.test(options.light) ? options.light : '#ffffff'

  const segments: string[] = []
  for (let row = 0; row < size; row += 1) {
    const line = modules[row]
    let column = 0
    while (column < size) {
      if (!line[column]) {
        column += 1
        continue
      }
      let runEnd = column
      while (runEnd + 1 < size && line[runEnd + 1]) runEnd += 1
      segments.push(`M${column} ${row}h${runEnd - column + 1}v1h-${runEnd - column + 1}z`)
      column = runEnd + 1
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * pixelSize}" height="${size * pixelSize}" viewBox="0 0 ${size} ${size}" role="img" shape-rendering="crispEdges">`,
    '<title>QR code</title>',
    `<rect width="${size}" height="${size}" fill="${escapeAttribute(light)}"/>`,
    `<path d="${segments.join('')}" fill="${escapeAttribute(dark)}"/>`,
    '</svg>'
  ].join('')
}

export function qrToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
