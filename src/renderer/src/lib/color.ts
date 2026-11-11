export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Hsla {
  h: number
  s: number
  l: number
  a: number
}

export interface Oklcha {
  l: number
  c: number
  h: number
  a: number
}

export type ColorSource = 'hex' | 'rgb' | 'hsl' | 'oklch'

export type ColorResult =
  | { ok: true; color: Rgba; source: ColorSource; outOfGamut: boolean }
  | { ok: false; error: string }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360
}

function roundChannel(value: number): number {
  return Math.round(clamp(value, 0, 255))
}

function parseAlpha(raw: string | undefined): number | null {
  if (raw === undefined) return 1
  const text = raw.trim()
  const percent = text.endsWith('%')
  const numeric = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(numeric)) return null
  return clamp(percent ? numeric / 100 : numeric, 0, 1)
}

function splitFunctionArgs(body: string): { parts: string[]; alpha?: string } | null {
  const tokens = body.replace(/\//g, ' / ').split(/[\s,]+/).filter(Boolean)
  const slash = tokens.indexOf('/')
  if (slash !== -1) {
    if (slash !== tokens.length - 2) return null
    return { parts: tokens.slice(0, slash), alpha: tokens[slash + 1] }
  }
  if (tokens.length === 4) return { parts: tokens.slice(0, 3), alpha: tokens[3] }
  if (tokens.length === 3) return { parts: tokens }
  return null
}

function parseRgbChannel(part: string): number | null {
  const text = part.trim()
  const percent = text.endsWith('%')
  const numeric = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(numeric)) return null
  return roundChannel(percent ? (numeric / 100) * 255 : numeric)
}

function parseHue(part: string): number | null {
  const text = part.trim().toLowerCase()
  const numeric = Number(text.endsWith('deg') ? text.slice(0, -3) : text)
  if (!Number.isFinite(numeric)) return null
  return normalizeHue(numeric)
}

function parsePercent(part: string): number | null {
  const text = part.trim()
  if (!text.endsWith('%')) return null
  const numeric = Number(text.slice(0, -1))
  return Number.isFinite(numeric) ? clamp(numeric, 0, 100) : null
}

function parseHex(text: string): ColorResult | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)
  if (!match) return null
  const digits = match[1]

  if (digits.length === 3 || digits.length === 4) {
    const [r, g, b, a] = digits.split('')
    return {
      ok: true,
      source: 'hex',
      outOfGamut: false,
      color: {
        r: Number.parseInt(`${r}${r}`, 16),
        g: Number.parseInt(`${g}${g}`, 16),
        b: Number.parseInt(`${b}${b}`, 16),
        a: a === undefined ? 1 : Number.parseInt(`${a}${a}`, 16) / 255
      }
    }
  }

  return {
    ok: true,
    source: 'hex',
    outOfGamut: false,
    color: {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1
    }
  }
}

const toLinear = (channel: number): number => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const fromLinear = (value: number): number => {
  const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.max(value, 0) ** (1 / 2.4) - 0.055
  return clamp(encoded, 0, 1) * 255
}

export function rgbToHsl({ r, g, b, a }: Rgba): Hsla {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l: lightness * 100, a }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4

  return { h: normalizeHue(hue * 60), s: saturation * 100, l: lightness * 100, a }
}

export function hslToRgb({ h, s, l, a }: Hsla): Rgba {
  const saturation = clamp(s, 0, 100) / 100
  const lightness = clamp(l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = normalizeHue(h) / 60
  const secondary = chroma * (1 - Math.abs((section % 2) - 1))

  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green] = [chroma, secondary]
  else if (section < 2) [red, green] = [secondary, chroma]
  else if (section < 3) [green, blue] = [chroma, secondary]
  else if (section < 4) [green, blue] = [secondary, chroma]
  else if (section < 5) [red, blue] = [secondary, chroma]
  else [red, blue] = [chroma, secondary]

  const match = lightness - chroma / 2
  return {
    r: roundChannel((red + match) * 255),
    g: roundChannel((green + match) * 255),
    b: roundChannel((blue + match) * 255),
    a
  }
}

export function rgbToOklch({ r, g, b, a }: Rgba): Oklcha {
  const red = toLinear(r)
  const green = toLinear(g)
  const blue = toLinear(b)

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const axisA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const axisB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.hypot(axisA, axisB)
  const achromatic = chroma < 1e-6

  return {
    l: lightness,
    c: achromatic ? 0 : chroma,
    h: achromatic ? 0 : normalizeHue((Math.atan2(axisB, axisA) * 180) / Math.PI),
    a
  }
}

export function oklchToRgb({ l, c, h, a }: Oklcha): { color: Rgba; outOfGamut: boolean } {
  const hue = (normalizeHue(h) * Math.PI) / 180
  const axisA = Math.cos(hue) * c
  const axisB = Math.sin(hue) * c

  const lPrime = l + 0.3963377774 * axisA + 0.2158037573 * axisB
  const mPrime = l - 0.1055613458 * axisA - 0.0638541728 * axisB
  const sPrime = l - 0.0894841775 * axisA - 1.291485548 * axisB

  const long = lPrime ** 3
  const medium = mPrime ** 3
  const short = sPrime ** 3

  const red = 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short
  const green = -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short
  const blue = -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short

  const epsilon = 0.0001
  const outOfGamut = [red, green, blue].some((channel) => channel < -epsilon || channel > 1 + epsilon)

  return {
    color: {
      r: roundChannel(fromLinear(red)),
      g: roundChannel(fromLinear(green)),
      b: roundChannel(fromLinear(blue)),
      a
    },
    outOfGamut
  }
}

export function parseColor(input: string): ColorResult {
  const text = input.trim()
  if (!text) return { ok: false, error: 'Enter a color to convert.' }

  const hex = parseHex(text)
  if (hex) return hex

  const fn = /^(rgba?|hsla?|oklch)\((.*)\)$/i.exec(text)
  if (!fn) {
    return {
      ok: false,
      error: 'Use hex (#7c5cff), rgb(), hsl(), or oklch() syntax.'
    }
  }

  const name = fn[1].toLowerCase()
  const args = splitFunctionArgs(fn[2])
  if (!args) return { ok: false, error: `Check the number of values inside ${name}().` }

  const alpha = parseAlpha(args.alpha)
  if (alpha === null) return { ok: false, error: 'Alpha must be a number from 0 to 1 or a percent.' }

  if (name === 'rgb' || name === 'rgba') {
    const channels = args.parts.map(parseRgbChannel)
    if (channels.some((channel) => channel === null)) {
      return { ok: false, error: 'RGB channels must be numbers from 0 to 255 or percentages.' }
    }
    const [r, g, b] = channels as number[]
    return { ok: true, source: 'rgb', outOfGamut: false, color: { r, g, b, a: alpha } }
  }

  if (name === 'hsl' || name === 'hsla') {
    const hue = parseHue(args.parts[0])
    const saturation = parsePercent(args.parts[1])
    const lightness = parsePercent(args.parts[2])
    if (hue === null) return { ok: false, error: 'Hue must be a number of degrees, such as 210.' }
    if (saturation === null || lightness === null) {
      return { ok: false, error: 'Saturation and lightness need percent values, such as 60%.' }
    }
    return {
      ok: true,
      source: 'hsl',
      outOfGamut: false,
      color: hslToRgb({ h: hue, s: saturation, l: lightness, a: alpha })
    }
  }

  const lightness = parseOklchLightness(args.parts[0])
  const chroma = parseOklchChroma(args.parts[1])
  const hue = parseHue(args.parts[2])
  if (lightness === null) {
    return { ok: false, error: 'OKLCH lightness must be between 0 and 1, or a percentage.' }
  }
  if (chroma === null) {
    return { ok: false, error: 'OKLCH chroma must be a non-negative number, or a percentage.' }
  }
  if (hue === null) return { ok: false, error: 'OKLCH hue must be a number of degrees.' }

  const converted = oklchToRgb({ l: lightness, c: chroma, h: hue, a: alpha })
  return { ok: true, source: 'oklch', outOfGamut: converted.outOfGamut, color: converted.color }
}

function parseOklchLightness(part: string): number | null {
  const text = part.trim()
  const percent = text.endsWith('%')
  const numeric = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(numeric)) return null
  return clamp(percent ? numeric / 100 : numeric, 0, 1)
}

function parseOklchChroma(part: string): number | null {
  const text = part.trim()
  const percent = text.endsWith('%')
  const numeric = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return percent ? (numeric / 100) * 0.4 : numeric
}

function trimNumber(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function toHexByte(value: number): string {
  return roundChannel(value).toString(16).padStart(2, '0')
}

export function formatAlpha(alpha: number): string {
  return trimNumber(alpha, 3)
}

export function toHex({ r, g, b, a }: Rgba): string {
  const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  return a < 1 ? `${base}${toHexByte(a * 255)}` : base
}

export function toRgbString(color: Rgba): string {
  const channels = `${roundChannel(color.r)}, ${roundChannel(color.g)}, ${roundChannel(color.b)}`
  return color.a < 1 ? `rgba(${channels}, ${formatAlpha(color.a)})` : `rgb(${channels})`
}

export function toHslString(color: Rgba): string {
  const hsl = rgbToHsl(color)
  const values = `${trimNumber(hsl.h, 1)}, ${trimNumber(hsl.s, 1)}%, ${trimNumber(hsl.l, 1)}%`
  return color.a < 1 ? `hsla(${values}, ${formatAlpha(color.a)})` : `hsl(${values})`
}

export function toOklchString(color: Rgba): string {
  const oklch = rgbToOklch(color)
  const values = `${trimNumber(oklch.l, 4)} ${trimNumber(oklch.c, 4)} ${trimNumber(oklch.h, 2)}`
  return color.a < 1 ? `oklch(${values} / ${formatAlpha(color.a)})` : `oklch(${values})`
}
