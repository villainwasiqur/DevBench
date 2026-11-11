import { describe, expect, it } from 'vitest'
import { createQr, MAX_QR_CHARS, qrToDataUrl, qrToSvg, type QrMatrix } from './qr'

function matrixOf(text: string, options?: Parameters<typeof createQr>[1]): QrMatrix {
  const result = createQr(text, options)
  if (!result.ok) throw new Error(result.error)
  return result.matrix
}

describe('createQr', () => {
  it('encodes a short value with a four-module quiet zone', () => {
    const matrix = matrixOf('hello')
    expect(matrix.version).toBe(1)
    expect(matrix.ecc).toBe('M')
    expect(matrix.size).toBe(21 + 4 * 2)
    expect(matrix.modules).toHaveLength(matrix.size)
    expect(matrix.modules.every((row) => row.length === matrix.size)).toBe(true)
  })

  it('keeps the border light and starts the code inside it', () => {
    const matrix = matrixOf('hello')
    expect(matrix.modules[0].every((module) => !module)).toBe(true)
    expect(matrix.modules[matrix.size - 1].every((module) => !module)).toBe(true)
    expect(matrix.modules[4][4]).toBe(true)
  })

  it('honors a custom border', () => {
    const matrix = matrixOf('hello', { border: 2 })
    expect(matrix.size).toBe(25)
  })

  it('produces a stable matrix for the same input', () => {
    expect(matrixOf('https://example.com').modules).toEqual(matrixOf('https://example.com').modules)
  })

  it('uses a larger version for stronger error correction', () => {
    const low = matrixOf('https://example.com/very/long/path?with=params', { ecc: 'L' })
    const high = matrixOf('https://example.com/very/long/path?with=params', { ecc: 'H' })
    expect(high.version).toBeGreaterThanOrEqual(low.version)
  })

  it('reports empty and oversized input', () => {
    expect(createQr('')).toEqual({ ok: false, error: 'Enter text or a URL to encode.' })
    expect(createQr('   ')).toMatchObject({ ok: false })
    expect(createQr('x'.repeat(MAX_QR_CHARS + 1))).toMatchObject({
      ok: false,
      error: expect.stringContaining('under')
    })
  })

  it('reports values that exceed the encoding capacity', () => {
    expect(createQr('漢'.repeat(1200), { ecc: 'H' })).toMatchObject({ ok: false })
  })
})

describe('qrToSvg', () => {
  const matrix = matrixOf('hello')

  it('renders a self-contained svg with a crisp path', () => {
    const svg = qrToSvg(matrix)
    expect(svg.startsWith('<svg ')).toBe(true)
    expect(svg).toContain('viewBox="0 0 29 29"')
    expect(svg).toContain('width="232" height="232"')
    expect(svg).toContain('<title>QR code</title>')
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).toContain('<path d="M4 4')
    expect(svg).not.toContain('<script')
  })

  it('scales the pixel size', () => {
    expect(qrToSvg(matrix, { pixelSize: 10 })).toContain('width="290" height="290"')
  })

  it('ignores unsafe colors', () => {
    const svg = qrToSvg(matrix, { dark: '" onload="alert(1)', light: 'red' })
    expect(svg).not.toContain('onload')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#0b0b0b"')
  })

  it('wraps the svg in a data url', () => {
    const svg = qrToSvg(matrix)
    const url = qrToDataUrl(svg)
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodeURIComponent(url.split(',')[1])).toBe(svg)
  })
})
