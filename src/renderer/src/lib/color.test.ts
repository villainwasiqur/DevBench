import { describe, expect, it } from 'vitest'
import {
  hslToRgb,
  parseColor,
  rgbToHsl,
  rgbToOklch,
  toHex,
  toHslString,
  toOklchString,
  toRgbString
} from './color'

function colorOf(input: string) {
  const result = parseColor(input)
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('parseColor', () => {
  it('parses six-digit hex', () => {
    const result = colorOf('#7c5cff')
    expect(result.source).toBe('hex')
    expect(result.color).toEqual({ r: 124, g: 92, b: 255, a: 1 })
    expect(result.outOfGamut).toBe(false)
  })

  it('parses shorthand hex and eight-digit alpha', () => {
    expect(colorOf('#0f0').color).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(colorOf('#ff000080').color).toEqual({ r: 255, g: 0, b: 0, a: 128 / 255 })
  })

  it('accepts hex without a leading hash', () => {
    expect(colorOf('94a3b8').color).toEqual({ r: 148, g: 163, b: 184, a: 1 })
  })

  it('parses rgb percentages and slash alpha', () => {
    const result = colorOf('rgb(100% 0% 0% / 50%)')
    expect(result.source).toBe('rgb')
    expect(result.color).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
  })

  it('parses legacy rgba values', () => {
    expect(colorOf('rgba(12, 34, 56, 0.25)').color).toEqual({ r: 12, g: 34, b: 56, a: 0.25 })
  })

  it('parses hsl and normalizes hue', () => {
    expect(colorOf('hsl(120, 100%, 50%)').color).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(colorOf('hsl(390 100% 50%)').color).toEqual({ r: 255, g: 128, b: 0, a: 1 })
  })

  it('parses oklch and converts to srgb', () => {
    const result = colorOf('oklch(0.627955 0.257683 29.2339)')
    expect(result.source).toBe('oklch')
    expect(result.color.r).toBe(255)
    expect(result.color.g).toBe(0)
    expect(result.color.b).toBe(0)
    expect(result.outOfGamut).toBe(false)
  })

  it('flags oklch values outside the srgb gamut', () => {
    expect(colorOf('oklch(0.8 0.4 150)').outOfGamut).toBe(true)
  })

  it('clamps alpha to the valid range', () => {
    expect(colorOf('rgb(0 0 0 / 150%)').color.a).toBe(1)
    expect(colorOf('rgb(0 0 0 / -1)').color.a).toBe(0)
  })

  it('reports friendly errors for invalid input', () => {
    expect(parseColor('')).toEqual({ ok: false, error: 'Enter a color to convert.' })
    expect(parseColor('tomato')).toMatchObject({ ok: false })
    expect(parseColor('hsl(120 100 50)')).toMatchObject({
      ok: false,
      error: 'Saturation and lightness need percent values, such as 60%.'
    })
    expect(parseColor('rgb(1, 2)')).toMatchObject({ ok: false })
    expect(parseColor('rgb(0 0 0 / half)')).toMatchObject({
      ok: false,
      error: 'Alpha must be a number from 0 to 1 or a percent.'
    })
  })
})

describe('conversions', () => {
  it('converts hsl back to rgb', () => {
    expect(hslToRgb({ h: 210, s: 100, l: 50, a: 1 })).toEqual({ r: 0, g: 128, b: 255, a: 1 })
  })

  it('returns a zero hue for achromatic colors', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, l: 50.19607843137255, a: 1 })
    expect(rgbToOklch({ r: 255, g: 255, b: 255, a: 1 })).toMatchObject({ c: 0, h: 0 })
  })

  it('matches known oklch values for primary colors', () => {
    const red = rgbToOklch({ r: 255, g: 0, b: 0, a: 1 })
    expect(red.l).toBeCloseTo(0.6279, 3)
    expect(red.c).toBeCloseTo(0.2577, 3)
    expect(red.h).toBeCloseTo(29.23, 1)

    const blue = rgbToOklch({ r: 0, g: 0, b: 255, a: 1 })
    expect(blue.l).toBeCloseTo(0.452, 3)
    expect(blue.c).toBeCloseTo(0.3132, 3)
    expect(blue.h).toBeCloseTo(264.05, 1)
  })
})

describe('formatting', () => {
  const red = { r: 255, g: 0, b: 0, a: 1 }

  it('formats hex with optional alpha', () => {
    expect(toHex(red)).toBe('#ff0000')
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
  })

  it('formats rgb and rgba strings', () => {
    expect(toRgbString(red)).toBe('rgb(255, 0, 0)')
    expect(toRgbString({ r: 1, g: 2, b: 3, a: 0.5 })).toBe('rgba(1, 2, 3, 0.5)')
  })

  it('formats hsl strings', () => {
    expect(toHslString(red)).toBe('hsl(0, 100%, 50%)')
    expect(toHslString({ r: 0, g: 128, b: 255, a: 0.25 })).toBe('hsla(209.9, 100%, 50%, 0.25)')
  })

  it('formats oklch strings', () => {
    expect(toOklchString(red)).toBe('oklch(0.628 0.2577 29.23)')
    expect(toOklchString({ r: 255, g: 255, b: 255, a: 1 })).toBe('oklch(1 0 0)')
  })
})
